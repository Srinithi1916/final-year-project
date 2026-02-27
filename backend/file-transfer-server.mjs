import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.TRANSFER_PORT || 8791);
const STALE_TIMEOUT_MS = Math.max(10_000, Number(process.env.TRANSFER_STALE_TIMEOUT_MS || 20_000));
const MAX_BODY_BYTES = Math.max(1_000_000, Number(process.env.TRANSFER_MAX_BODY_BYTES || 12_000_000));

const STORAGE_ROOT = path.join(__dirname, 'received');
const TEMP_ROOT = path.join(STORAGE_ROOT, 'tmp');
const COMPLETE_ROOT = path.join(STORAGE_ROOT, 'complete');

const STATUS = {
  QUEUED: 'QUEUED',
  SENDING: 'SENDING',
  PARTIAL: 'PARTIAL',
  VERIFIED: 'VERIFIED',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
};

const TERMINAL_STATES = new Set([STATUS.COMPLETED, STATUS.FAILED]);

/** @type {Map<string, any>} */
const transfers = new Map();

fs.mkdirSync(TEMP_ROOT, { recursive: true });
fs.mkdirSync(COMPLETE_ROOT, { recursive: true });

const sha256Hex = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

const fileSha256Hex = (filePath) =>
  new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });

const nowIso = () => new Date().toISOString();

const sanitizeFileName = (name) => {
  const safe = String(name || 'received_file')
    .replace(/[^\w.\-]/g, '_')
    .replace(/_+/g, '_');
  return safe || 'received_file';
};

const sendJson = (res, statusCode, body) => {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(body));
};

const readRequestJson = (req) =>
  new Promise((resolve, reject) => {
    let body = '';
    let totalBytes = 0;

    req.on('data', (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > MAX_BODY_BYTES) {
        reject(new Error(`Request body too large. Limit ${MAX_BODY_BYTES} bytes.`));
        req.destroy();
        return;
      }
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });

    req.on('error', reject);
  });

const transferSummary = (transfer) => ({
  transferId: transfer.id,
  fileName: transfer.fileName,
  totalChunks: transfer.totalChunks,
  totalBytes: transfer.totalBytes,
  receivedChunks: transfer.receivedChunks.size,
  receivedBytes: transfer.receivedBytes,
  missingChunks: transfer.missingChunks.slice(0, 200),
  status: transfer.status,
  createdAt: transfer.createdAt,
  updatedAt: transfer.updatedAt,
  lastChunkAt: transfer.lastChunkAt,
  expectedFileChecksum: transfer.expectedFileChecksum,
  actualFileChecksum: transfer.actualFileChecksum,
  failureReason: transfer.failureReason,
  statusHistory: transfer.statusHistory,
});

const allowedTransitions = {
  [STATUS.QUEUED]: new Set([STATUS.SENDING, STATUS.FAILED]),
  [STATUS.SENDING]: new Set([STATUS.PARTIAL, STATUS.VERIFIED, STATUS.FAILED]),
  [STATUS.PARTIAL]: new Set([STATUS.SENDING, STATUS.FAILED]),
  [STATUS.VERIFIED]: new Set([STATUS.COMPLETED, STATUS.FAILED]),
  [STATUS.COMPLETED]: new Set([]),
  [STATUS.FAILED]: new Set([]),
};

const broadcast = (payload) => {
  const text = JSON.stringify(payload);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(text);
    }
  });
};

const setStatus = (transfer, nextStatus, reason) => {
  if (transfer.status === nextStatus) return;
  if (!allowedTransitions[transfer.status]?.has(nextStatus)) {
    throw new Error(`Invalid status transition ${transfer.status} -> ${nextStatus}`);
  }

  transfer.status = nextStatus;
  transfer.updatedAt = nowIso();
  const historyEntry = {
    status: nextStatus,
    at: transfer.updatedAt,
    reason: reason || '',
  };
  transfer.statusHistory.unshift(historyEntry);

  broadcast({
    type: 'transfer-status',
    transferId: transfer.id,
    status: nextStatus,
    reason: historyEntry.reason,
    at: historyEntry.at,
    fileName: transfer.fileName,
  });
};

const recalcMissingChunks = (transfer) => {
  const missing = [];
  for (let i = 0; i < transfer.totalChunks; i += 1) {
    if (!transfer.receivedChunks.has(i)) {
      missing.push(i);
    }
  }
  transfer.missingChunks = missing;
};

const ensureTransfer = (transferId) => {
  const transfer = transfers.get(transferId);
  if (!transfer) {
    throw new Error('Transfer not found');
  }
  return transfer;
};

const writeChunk = (transfer, chunkIndex, buffer) => {
  const chunkPath = path.join(transfer.tempDir, `${chunkIndex}.part`);
  fs.writeFileSync(chunkPath, buffer);
};

const assembleChunks = (transfer) => {
  const assembledPath = path.join(transfer.tempDir, `${transfer.id}.assembled`);
  const fd = fs.openSync(assembledPath, 'w');
  try {
    for (let i = 0; i < transfer.totalChunks; i += 1) {
      const chunkPath = path.join(transfer.tempDir, `${i}.part`);
      const data = fs.readFileSync(chunkPath);
      fs.writeSync(fd, data);
    }
  } finally {
    fs.closeSync(fd);
  }
  return assembledPath;
};

const createTransfer = (payload) => {
  const fileName = sanitizeFileName(payload.fileName);
  const totalChunks = Number(payload.totalChunks);
  const totalBytes = Number(payload.totalBytes || 0);
  const expectedFileChecksum = String(payload.fileChecksum || '').toLowerCase().trim();

  if (!fileName) throw new Error('fileName is required');
  if (!Number.isInteger(totalChunks) || totalChunks <= 0) {
    throw new Error('totalChunks must be a positive integer');
  }
  if (!/^[a-f0-9]{64}$/.test(expectedFileChecksum)) {
    throw new Error('fileChecksum must be a valid SHA-256 hex string');
  }

  const id = crypto.randomUUID();
  const tempDir = path.join(TEMP_ROOT, id);
  fs.mkdirSync(tempDir, { recursive: true });

  const createdAt = nowIso();
  const transfer = {
    id,
    fileName,
    totalChunks,
    totalBytes,
    expectedFileChecksum,
    actualFileChecksum: null,
    status: STATUS.QUEUED,
    statusHistory: [{ status: STATUS.QUEUED, at: createdAt, reason: 'Transfer created.' }],
    receivedChunks: new Set(),
    chunkChecksums: new Map(),
    receivedBytes: 0,
    missingChunks: Array.from({ length: totalChunks }, (_, index) => index),
    createdAt,
    updatedAt: createdAt,
    lastChunkAt: null,
    failureReason: null,
    tempDir,
    completedPath: null,
  };

  transfers.set(id, transfer);
  return transfer;
};

const runChecksumSelfTest = () => {
  const sourceA = Buffer.from('cyber-security-transfer-selftest-A', 'utf8');
  const sourceB = Buffer.from('cyber-security-transfer-selftest-B', 'utf8');
  const combined = Buffer.concat([sourceA, sourceB]);

  const chunkChecksum = sha256Hex(sourceA);
  const chunkRecalc = sha256Hex(Buffer.from(sourceA));
  const chunkMatchPassed = chunkChecksum === chunkRecalc;

  const tamperedChunk = Buffer.from(sourceA);
  tamperedChunk[0] = tamperedChunk[0] ^ 1;
  const tamperedChecksum = sha256Hex(tamperedChunk);
  const chunkMismatchPassed = tamperedChecksum !== chunkChecksum;

  const fileChecksum = sha256Hex(combined);
  const tamperedFile = Buffer.from(combined);
  tamperedFile[tamperedFile.length - 1] = tamperedFile[tamperedFile.length - 1] ^ 1;
  const tamperedFileChecksum = sha256Hex(tamperedFile);
  const finalMismatchPassed = fileChecksum !== tamperedFileChecksum;

  const lifecycleRulesPassed =
    allowedTransitions[STATUS.QUEUED].has(STATUS.SENDING) &&
    allowedTransitions[STATUS.SENDING].has(STATUS.PARTIAL) &&
    allowedTransitions[STATUS.SENDING].has(STATUS.VERIFIED) &&
    allowedTransitions[STATUS.PARTIAL].has(STATUS.SENDING) &&
    allowedTransitions[STATUS.VERIFIED].has(STATUS.COMPLETED) &&
    !allowedTransitions[STATUS.COMPLETED].has(STATUS.SENDING);

  const tests = [
    {
      id: 'chunk_match',
      title: 'Chunk checksum match accepted',
      expected: 'equal SHA-256 values',
      actual: chunkMatchPassed ? 'equal' : 'different',
      passed: chunkMatchPassed,
    },
    {
      id: 'chunk_mismatch',
      title: 'Chunk checksum mismatch detected',
      expected: 'different SHA-256 values',
      actual: chunkMismatchPassed ? 'different' : 'equal',
      passed: chunkMismatchPassed,
    },
    {
      id: 'file_mismatch',
      title: 'Final file checksum mismatch detected',
      expected: 'different SHA-256 values',
      actual: finalMismatchPassed ? 'different' : 'equal',
      passed: finalMismatchPassed,
    },
    {
      id: 'lifecycle_rules',
      title: 'Lifecycle transition guards',
      expected: 'valid transitions only',
      actual: lifecycleRulesPassed ? 'valid transitions enforced' : 'transition guard issue',
      passed: lifecycleRulesPassed,
    },
  ];

  return {
    generatedAt: nowIso(),
    overallPass: tests.every((test) => test.passed),
    tests,
    sampleChecksums: {
      chunkChecksum,
      tamperedChecksum,
      fileChecksum,
      tamperedFileChecksum,
    },
  };
};

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    sendJson(res, 400, { error: 'Missing URL' });
    return;
  }

  if (req.method === 'OPTIONS') {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    sendJson(res, 200, {
      status: 'ok',
      transfers: transfers.size,
      staleTimeoutMs: STALE_TIMEOUT_MS,
      wsClients: wss.clients.size,
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/transfers') {
    sendJson(res, 200, {
      items: Array.from(transfers.values()).map((transfer) => transferSummary(transfer)),
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/transfer/self-test') {
    sendJson(res, 200, {
      ok: true,
      ...runChecksumSelfTest(),
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/transfer/start') {
    try {
      const payload = await readRequestJson(req);
      const transfer = createTransfer(payload);
      sendJson(res, 201, {
        ok: true,
        transfer: transferSummary(transfer),
      });
    } catch (error) {
      sendJson(res, 400, {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to create transfer',
      });
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/transfer/chunk') {
    try {
      const payload = await readRequestJson(req);
      const transferId = String(payload.transferId || '');
      const chunkIndex = Number(payload.chunkIndex);
      const checksum = String(payload.checksum || '').toLowerCase().trim();
      const dataBase64 = String(payload.dataBase64 || '');

      if (!transferId) throw new Error('transferId is required');
      if (!Number.isInteger(chunkIndex) || chunkIndex < 0) throw new Error('chunkIndex must be >= 0');
      if (!/^[a-f0-9]{64}$/.test(checksum)) throw new Error('checksum must be valid SHA-256 hex');
      if (!dataBase64) throw new Error('dataBase64 is required');

      const transfer = ensureTransfer(transferId);
      if (TERMINAL_STATES.has(transfer.status)) {
        throw new Error(`Transfer is in terminal state: ${transfer.status}`);
      }
      if (chunkIndex >= transfer.totalChunks) {
        throw new Error(`chunkIndex out of range. totalChunks=${transfer.totalChunks}`);
      }

      if (transfer.status === STATUS.PARTIAL) {
        setStatus(transfer, STATUS.SENDING, 'Chunk upload resumed after partial delivery.');
      }
      if (transfer.status === STATUS.QUEUED) {
        setStatus(transfer, STATUS.SENDING, 'First chunk received.');
      }

      const buffer = Buffer.from(dataBase64, 'base64');
      const actualChecksum = sha256Hex(buffer);
      if (actualChecksum !== checksum) {
        transfer.failureReason = `Chunk checksum mismatch at index ${chunkIndex}.`;
        setStatus(transfer, STATUS.FAILED, transfer.failureReason);
        sendJson(res, 409, {
          ok: false,
          error: transfer.failureReason,
          expectedChecksum: checksum,
          actualChecksum,
          transfer: transferSummary(transfer),
        });
        return;
      }

      const existingChecksum = transfer.chunkChecksums.get(chunkIndex);
      if (existingChecksum && existingChecksum !== checksum) {
        transfer.failureReason = `Conflicting checksum for chunk ${chunkIndex}.`;
        setStatus(transfer, STATUS.FAILED, transfer.failureReason);
        sendJson(res, 409, {
          ok: false,
          error: transfer.failureReason,
          transfer: transferSummary(transfer),
        });
        return;
      }

      if (!transfer.receivedChunks.has(chunkIndex)) {
        writeChunk(transfer, chunkIndex, buffer);
        transfer.receivedChunks.add(chunkIndex);
        transfer.chunkChecksums.set(chunkIndex, checksum);
        transfer.receivedBytes += buffer.byteLength;
        transfer.lastChunkAt = nowIso();
        transfer.updatedAt = transfer.lastChunkAt;
        recalcMissingChunks(transfer);
      }

      broadcast({
        type: 'transfer-chunk-ack',
        transferId: transfer.id,
        chunkIndex,
        receivedChunks: transfer.receivedChunks.size,
        totalChunks: transfer.totalChunks,
        status: transfer.status,
        at: nowIso(),
      });

      sendJson(res, 200, {
        ok: true,
        ack: true,
        transfer: transferSummary(transfer),
      });
    } catch (error) {
      sendJson(res, 400, {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to ingest chunk',
      });
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/transfer/complete') {
    try {
      const payload = await readRequestJson(req);
      const transferId = String(payload.transferId || '');
      const transfer = ensureTransfer(transferId);

      if (TERMINAL_STATES.has(transfer.status)) {
        throw new Error(`Transfer is in terminal state: ${transfer.status}`);
      }

      recalcMissingChunks(transfer);
      if (transfer.missingChunks.length > 0) {
        setStatus(
          transfer,
          STATUS.PARTIAL,
          `Complete requested with missing chunks: ${transfer.missingChunks.slice(0, 15).join(', ')}`,
        );
        sendJson(res, 409, {
          ok: false,
          error: 'Missing chunks. Transfer marked PARTIAL.',
          transfer: transferSummary(transfer),
        });
        return;
      }

      const assembledPath = assembleChunks(transfer);
      const actualChecksum = await fileSha256Hex(assembledPath);
      transfer.actualFileChecksum = actualChecksum;

      if (actualChecksum !== transfer.expectedFileChecksum) {
        transfer.failureReason = 'Final file checksum mismatch.';
        setStatus(transfer, STATUS.FAILED, transfer.failureReason);
        sendJson(res, 409, {
          ok: false,
          error: transfer.failureReason,
          expectedChecksum: transfer.expectedFileChecksum,
          actualChecksum,
          transfer: transferSummary(transfer),
        });
        return;
      }

      setStatus(transfer, STATUS.VERIFIED, 'Chunk and full-file SHA-256 checksum validated.');

      const finalFileName = `${transfer.id}_${transfer.fileName}`;
      const finalPath = path.join(COMPLETE_ROOT, finalFileName);
      fs.renameSync(assembledPath, finalPath);
      transfer.completedPath = finalPath;

      setStatus(transfer, STATUS.COMPLETED, 'File moved to completed storage.');

      sendJson(res, 200, {
        ok: true,
        transfer: transferSummary(transfer),
      });
    } catch (error) {
      sendJson(res, 400, {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to complete transfer',
      });
    }
    return;
  }

  const statusMatch = req.url.match(/^\/transfer\/([^/]+)\/status$/);
  if (req.method === 'GET' && statusMatch) {
    try {
      const transfer = ensureTransfer(statusMatch[1]);
      sendJson(res, 200, {
        ok: true,
        transfer: transferSummary(transfer),
      });
    } catch (error) {
      sendJson(res, 404, {
        ok: false,
        error: error instanceof Error ? error.message : 'Transfer not found',
      });
    }
    return;
  }

  sendJson(res, 404, { ok: false, error: 'Not found' });
});

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  if (req.url !== '/ws') {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws);
  });
});

wss.on('connection', (ws) => {
  ws.send(
    JSON.stringify({
      type: 'hello',
      message: 'Connected to file transfer status stream.',
      timestamp: nowIso(),
    }),
  );
});

setInterval(() => {
  const now = Date.now();
  transfers.forEach((transfer) => {
    if (TERMINAL_STATES.has(transfer.status)) return;
    if (transfer.status === STATUS.QUEUED) return;

    const lastActivityMs = transfer.lastChunkAt ? new Date(transfer.lastChunkAt).getTime() : new Date(transfer.updatedAt).getTime();
    if (now - lastActivityMs <= STALE_TIMEOUT_MS) return;

    if (transfer.receivedChunks.size > 0 && transfer.receivedChunks.size < transfer.totalChunks && transfer.status !== STATUS.PARTIAL) {
      setStatus(transfer, STATUS.PARTIAL, `No chunk activity for ${Math.floor(STALE_TIMEOUT_MS / 1000)}s.`);
    }
  });
}, 2000);

server.listen(PORT, () => {
  console.log(`[transfer] server listening on http://localhost:${PORT}`);
  console.log(`[transfer] websocket endpoint ws://localhost:${PORT}/ws`);
  console.log(`[transfer] stale timeout ${STALE_TIMEOUT_MS}ms`);
});
