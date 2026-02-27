import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const filePath = process.argv[2];
const baseUrl = process.argv[3] || 'http://localhost:8791';
const chunkSizeKb = Number(process.argv[4] || 64);
const chunkSizeBytes = Math.max(1024, chunkSizeKb * 1024);
const extraArgs = process.argv.slice(5);

const tamperFileChecksum = extraArgs.includes('--tamper-file-checksum');
const tamperChunkArg = extraArgs.find((arg) => arg.startsWith('--tamper-chunk='));
const tamperChunkIndex = tamperChunkArg ? Number(tamperChunkArg.split('=')[1]) : null;

if (!filePath) {
  console.error('Usage: node backend/send-file.mjs <filePath> [baseUrl] [chunkSizeKb] [--tamper-file-checksum] [--tamper-chunk=<index>]');
  process.exit(1);
}

if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

const sha256Hex = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

const fileSha256Hex = (targetPath) =>
  new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(targetPath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });

const postJson = async (url, body) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!response.ok || json.ok === false) {
    const errorMessage = json.error || `HTTP ${response.status}`;
    throw new Error(errorMessage);
  }
  return json;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const send = async () => {
  const stat = fs.statSync(filePath);
  const totalChunks = Math.ceil(stat.size / chunkSizeBytes);
  const fileChecksum = await fileSha256Hex(filePath);
  const fileChecksumForStart = tamperFileChecksum
    ? `${fileChecksum.slice(0, 63)}${fileChecksum.slice(63) === 'a' ? 'b' : 'a'}`
    : fileChecksum;
  const fileName = path.basename(filePath);

  console.log(`[sender] file=${fileName} bytes=${stat.size} chunks=${totalChunks} chunkSize=${chunkSizeBytes}`);
  console.log(`[sender] checksum=${fileChecksum}`);
  if (tamperFileChecksum) {
    console.log('[sender] tamper mode: file checksum altered for start request');
  }
  if (tamperChunkIndex !== null && Number.isInteger(tamperChunkIndex) && tamperChunkIndex >= 0) {
    console.log(`[sender] tamper mode: chunk payload modified at chunk ${tamperChunkIndex}`);
  }

  const startResp = await postJson(`${baseUrl}/transfer/start`, {
    fileName,
    totalChunks,
    totalBytes: stat.size,
    fileChecksum: fileChecksumForStart,
  });

  const transferId = startResp.transfer.transferId;
  console.log(`[sender] transferId=${transferId}`);

  const fd = fs.openSync(filePath, 'r');
  try {
    for (let i = 0; i < totalChunks; i += 1) {
      const offset = i * chunkSizeBytes;
      const length = Math.min(chunkSizeBytes, stat.size - offset);
      const buffer = Buffer.alloc(length);
      fs.readSync(fd, buffer, 0, length, offset);

      const checksum = sha256Hex(buffer);
      const payloadBuffer =
        tamperChunkIndex !== null && tamperChunkIndex === i
          ? (() => {
              const modified = Buffer.from(buffer);
              if (modified.length > 0) {
                modified[0] = modified[0] ^ 1;
              }
              return modified;
            })()
          : buffer;
      const dataBase64 = payloadBuffer.toString('base64');
      let attempts = 0;
      let sent = false;

      while (!sent && attempts < 3) {
        attempts += 1;
        try {
          const ack = await postJson(`${baseUrl}/transfer/chunk`, {
            transferId,
            chunkIndex: i,
            checksum,
            dataBase64,
          });
          const progress = `${ack.transfer.receivedChunks}/${ack.transfer.totalChunks}`;
          console.log(`[sender] chunk ${i} ack (${progress}) status=${ack.transfer.status}`);
          sent = true;
        } catch (error) {
          if (attempts >= 3) {
            throw error;
          }
          console.warn(`[sender] chunk ${i} attempt ${attempts} failed, retrying...`);
          await sleep(500 * attempts);
        }
      }
    }
  } finally {
    fs.closeSync(fd);
  }

  const completeResp = await postJson(`${baseUrl}/transfer/complete`, {
    transferId,
  });

  console.log(`[sender] completed status=${completeResp.transfer.status}`);
  console.log(`[sender] receiver checksum=${completeResp.transfer.actualFileChecksum}`);
  console.log(`[sender] transfer done`);
};

send().catch((error) => {
  console.error('[sender] failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
