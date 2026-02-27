import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FEEDS_DIR = path.join(__dirname, 'feeds');

const PORT = Number(process.env.TELEMETRY_PORT || 8787);
const EMIT_INTERVAL_MS = Math.max(1000, Number(process.env.TELEMETRY_EMIT_MS || 5000));

const MODEL_FIELDS = [
  'Duration',
  'Protocol_Type',
  'Source_Port',
  'Destination_Port',
  'Packet_Length',
  'Packet_Size',
  'Header_Length',
  'Bytes_Transferred',
  'Bytes_Received',
  'Packets_Sent',
  'Packets_Received',
  'Packet_Rate',
  'Byte_Rate',
  'Connection_Count',
  'Active_Connections',
  'Failed_Connections',
  'Error_Rate',
  'Retransmission_Rate',
  'SYN_Count',
  'ACK_Count',
  'FIN_Count',
  'RST_Count',
  'PSH_Count',
  'URG_Count',
  'Window_Size',
  'TTL',
  'Fragmentation',
  'Same_Source_Port_Rate',
  'Same_Dest_Port_Rate',
  'Service_Count',
  'DNS_Query_Count',
  'TLS_Handshake_Time',
  'Payload_Entropy',
  'Unique_Destination_IPs',
  'Average_Inter_Arrival_Time',
  'CPU_Usage',
  'Memory_Usage',
  'Disk_Write_Rate',
  'Process_Count',
  'Login_Attempts',
];

const BASE_ROW = {
  Duration: 150,
  Protocol_Type: 6,
  Source_Port: 443,
  Destination_Port: 8080,
  Packet_Length: 512,
  Packet_Size: 1024,
  Header_Length: 20,
  Bytes_Transferred: 2048,
  Bytes_Received: 4096,
  Packets_Sent: 100,
  Packets_Received: 120,
  Packet_Rate: 50,
  Byte_Rate: 10240,
  Connection_Count: 5,
  Active_Connections: 3,
  Failed_Connections: 0,
  Error_Rate: 0.01,
  Retransmission_Rate: 0.02,
  SYN_Count: 5,
  ACK_Count: 120,
  FIN_Count: 3,
  RST_Count: 0,
  PSH_Count: 80,
  URG_Count: 0,
  Window_Size: 65535,
  TTL: 64,
  Fragmentation: 0,
  Same_Source_Port_Rate: 0.2,
  Same_Dest_Port_Rate: 0.3,
  Service_Count: 3,
  DNS_Query_Count: 18,
  TLS_Handshake_Time: 42,
  Payload_Entropy: 2.1,
  Unique_Destination_IPs: 6,
  Average_Inter_Arrival_Time: 12,
  CPU_Usage: 21,
  Memory_Usage: 36,
  Disk_Write_Rate: 4,
  Process_Count: 112,
  Login_Attempts: 1,
};

const ATTACK_TO_CLASS = {
  normal: 0,
  ddos: 1,
  brute: 2,
  ransomware: 3,
  zeroday: 4,
};

const sourceStates = [
  {
    id: 'zeek',
    format: 'jsonl',
    file: process.env.ZEEK_LOG || path.join(FEEDS_DIR, 'zeek_conn.jsonl'),
    cursor: 0,
    recordsIngested: 0,
    lastIngestAt: null,
    lastError: null,
  },
  {
    id: 'suricata',
    format: 'jsonl',
    file: process.env.SURICATA_LOG || path.join(FEEDS_DIR, 'suricata_eve.jsonl'),
    cursor: 0,
    recordsIngested: 0,
    lastIngestAt: null,
    lastError: null,
  },
  {
    id: 'netflow',
    format: 'csv',
    file: process.env.NETFLOW_LOG || path.join(FEEDS_DIR, 'netflow.csv'),
    cursor: 0,
    recordsIngested: 0,
    lastIngestAt: null,
    lastError: null,
  },
  {
    id: 'sflow',
    format: 'csv',
    file: process.env.SFLOW_LOG || path.join(FEEDS_DIR, 'sflow.csv'),
    cursor: 0,
    recordsIngested: 0,
    lastIngestAt: null,
    lastError: null,
  },
];

const telemetryQueue = [];
let sequence = 0;
let lastTelemetry = null;

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const parseProtocol = (value) => {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (normalized === 'TCP' || normalized === '6') return 6;
  if (normalized === 'UDP' || normalized === '17') return 17;
  if (normalized === 'ICMP' || normalized === '1') return 1;
  return 6;
};

const normalizeAttackType = (value) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'normal') return 'normal';
  if (normalized === 'ddos' || normalized === 'dos') return 'ddos';
  if (normalized === 'brute force' || normalized === 'bruteforce' || normalized === 'brute') return 'brute';
  if (normalized === 'ransomware') return 'ransomware';
  if (normalized === 'zero-day' || normalized === 'zero day' || normalized === 'zeroday') return 'zeroday';
  return null;
};

const inferAttackType = (row) => {
  if (row.Packet_Rate > 10000 && row.Connection_Count > 3000 && row.Error_Rate > 0.5) return 'ddos';
  if (row.Failed_Connections > 600 || row.Login_Attempts > 200) return 'brute';
  if (row.Bytes_Transferred > 60000 && row.Disk_Write_Rate > 120) return 'ransomware';
  if (row.Payload_Entropy > 9.1 && row.Error_Rate > 0.5 && row.Connection_Count > 20000) return 'zeroday';
  return 'normal';
};

const finalizeRow = (partial) => {
  const merged = { ...BASE_ROW, ...partial };
  const output = {};
  MODEL_FIELDS.forEach((field) => {
    output[field] = toNumber(merged[field], BASE_ROW[field]);
  });
  return output;
};

const buildPacket = (source, row, attackHint, summary) => {
  const attackType = normalizeAttackType(attackHint) || inferAttackType(row);
  return {
    type: 'telemetry',
    source,
    timestamp: new Date().toISOString(),
    seq: ++sequence,
    attackType,
    forcedClass: ATTACK_TO_CLASS[attackType] ?? null,
    summary,
    row: finalizeRow(row),
  };
};

const parseJsonLine = (line) => {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
};

const parseCsvRecord = (headers, line) => {
  const values = line.split(',');
  if (values.length < headers.length) return null;
  const record = {};
  headers.forEach((header, idx) => {
    record[header] = (values[idx] || '').trim();
  });
  return record;
};

const parseZeekEvent = (rawEvent) => {
  const durationSec = Math.max(0.1, toNumber(rawEvent.duration, 1));
  const sentPkts = toNumber(rawEvent.orig_pkts, 80);
  const recvPkts = toNumber(rawEvent.resp_pkts, 90);
  const sentBytes = toNumber(rawEvent.orig_bytes, 2000);
  const recvBytes = toNumber(rawEvent.resp_bytes, 3000);
  const totalPkts = Math.max(1, sentPkts + recvPkts);
  const connState = String(rawEvent.conn_state || '').toUpperCase();
  const failedConnections = ['S0', 'REJ', 'RSTO', 'RSTR'].includes(connState)
    ? Math.max(1, Math.round(totalPkts * 0.3))
    : Math.max(0, Math.round(totalPkts * 0.02));
  const packetRate = Math.round(totalPkts / durationSec);
  const byteRate = Math.round((sentBytes + recvBytes) / durationSec);

  const row = {
    Duration: Math.round(durationSec * 100),
    Protocol_Type: parseProtocol(rawEvent.proto),
    Source_Port: toNumber(rawEvent['id.orig_p'], 443),
    Destination_Port: toNumber(rawEvent['id.resp_p'], 8080),
    Bytes_Transferred: sentBytes,
    Bytes_Received: recvBytes,
    Packets_Sent: sentPkts,
    Packets_Received: recvPkts,
    Packet_Rate: packetRate,
    Byte_Rate: byteRate,
    Connection_Count: Math.max(1, Math.round(totalPkts)),
    Active_Connections: Math.max(1, Math.round(totalPkts * 0.5)),
    Failed_Connections: failedConnections,
    Error_Rate: Math.min(0.99, failedConnections / Math.max(totalPkts, 1)),
    Retransmission_Rate: Math.min(0.99, toNumber(rawEvent.retransmission_rate, 0.05)),
    SYN_Count: Math.max(1, Math.round(sentPkts * 0.8)),
    ACK_Count: Math.max(1, Math.round(recvPkts * 1.2)),
    RST_Count: ['REJ', 'RSTR', 'RSTO'].includes(connState) ? Math.max(1, Math.round(totalPkts * 0.2)) : 0,
    DNS_Query_Count: toNumber(rawEvent.dns_queries, 20),
    Payload_Entropy: toNumber(rawEvent.payload_entropy, 3.1),
    Unique_Destination_IPs: Math.max(1, toNumber(rawEvent.unique_dst_ips, 10)),
    Login_Attempts: Math.max(0, toNumber(rawEvent.login_attempts, 0)),
    CPU_Usage: Math.min(99, toNumber(rawEvent.cpu_usage, 30)),
    Memory_Usage: Math.min(99, toNumber(rawEvent.memory_usage, 40)),
    Disk_Write_Rate: Math.max(1, toNumber(rawEvent.disk_write_rate, 6)),
  };

  return buildPacket('zeek', row, rawEvent.attack_type || rawEvent.label, 'Parsed Zeek connection telemetry');
};

const parseSuricataEvent = (rawEvent) => {
  const flow = rawEvent.flow || {};
  const durationSec = Math.max(0.1, toNumber(flow.age, 1));
  const sentPkts = toNumber(flow.pkts_toserver, 80);
  const recvPkts = toNumber(flow.pkts_toclient, 90);
  const sentBytes = toNumber(flow.bytes_toserver, 2000);
  const recvBytes = toNumber(flow.bytes_toclient, 3000);
  const totalPkts = Math.max(1, sentPkts + recvPkts);
  const alerts = rawEvent.alert || {};
  const signature = String(alerts.signature || '').toLowerCase();

  const row = {
    Duration: Math.round(durationSec * 100),
    Protocol_Type: parseProtocol(rawEvent.proto),
    Source_Port: toNumber(rawEvent.src_port, 443),
    Destination_Port: toNumber(rawEvent.dest_port, 8080),
    Bytes_Transferred: sentBytes,
    Bytes_Received: recvBytes,
    Packets_Sent: sentPkts,
    Packets_Received: recvPkts,
    Packet_Rate: Math.round(totalPkts / durationSec),
    Byte_Rate: Math.round((sentBytes + recvBytes) / durationSec),
    Connection_Count: Math.max(1, Math.round(totalPkts)),
    Active_Connections: Math.max(1, Math.round(totalPkts * 0.45)),
    Failed_Connections: Math.max(0, Math.round(toNumber(flow.tcp_retransmission, 0) + toNumber(rawEvent.failed_connections, 0))),
    Error_Rate: Math.min(0.99, toNumber(rawEvent.error_rate, signature.includes('flood') ? 0.8 : 0.04)),
    Retransmission_Rate: Math.min(0.99, toNumber(rawEvent.retransmission_rate, 0.06)),
    SYN_Count: Math.max(1, Math.round(sentPkts * 0.7)),
    ACK_Count: Math.max(1, Math.round(recvPkts * 1.1)),
    RST_Count: Math.max(0, toNumber(rawEvent.rst_count, 0)),
    DNS_Query_Count: toNumber(rawEvent.dns_query_count, 18),
    Payload_Entropy: toNumber(rawEvent.payload_entropy, 3.0),
    Unique_Destination_IPs: Math.max(1, toNumber(rawEvent.unique_destination_ips, 12)),
    Login_Attempts: Math.max(0, toNumber(rawEvent.login_attempts, 0)),
    CPU_Usage: Math.min(99, toNumber(rawEvent.cpu_usage, 32)),
    Memory_Usage: Math.min(99, toNumber(rawEvent.memory_usage, 44)),
    Disk_Write_Rate: Math.max(1, toNumber(rawEvent.disk_write_rate, 7)),
  };

  return buildPacket('suricata', row, rawEvent.attack_type || rawEvent.label, 'Parsed Suricata EVE flow telemetry');
};

const parseNetflowRecord = (record) => {
  const durationMs = Math.max(1, toNumber(record.duration_ms, 500));
  const packets = Math.max(1, toNumber(record.packets, 200));
  const bytes = Math.max(1, toNumber(record.bytes, 16000));
  const synCount = Math.max(1, toNumber(record.syn, Math.round(packets * 0.3)));
  const ackCount = Math.max(1, toNumber(record.ack, Math.round(packets * 0.4)));
  const rstCount = Math.max(0, toNumber(record.rst, Math.round(packets * 0.05)));
  const flows = Math.max(1, toNumber(record.flows, packets));
  const durationSec = durationMs / 1000;

  const row = {
    Duration: Math.round(durationMs / 10),
    Protocol_Type: parseProtocol(record.protocol),
    Source_Port: toNumber(record.src_port, 443),
    Destination_Port: toNumber(record.dst_port, 8080),
    Bytes_Transferred: Math.round(bytes * 0.52),
    Bytes_Received: Math.round(bytes * 0.48),
    Packets_Sent: Math.round(packets * 0.55),
    Packets_Received: Math.round(packets * 0.45),
    Packet_Rate: Math.round(packets / Math.max(durationSec, 0.1)),
    Byte_Rate: Math.round(bytes / Math.max(durationSec, 0.1)),
    Connection_Count: flows,
    Active_Connections: Math.max(1, Math.round(flows * 0.6)),
    Failed_Connections: Math.max(0, toNumber(record.failed_connections, 0)),
    Error_Rate: Math.min(0.99, toNumber(record.error_rate, 0.05)),
    Retransmission_Rate: Math.min(0.99, toNumber(record.retransmission_rate, 0.03)),
    SYN_Count: synCount,
    ACK_Count: ackCount,
    RST_Count: rstCount,
    DNS_Query_Count: Math.max(0, toNumber(record.dns_query_count, 20)),
    Payload_Entropy: toNumber(record.payload_entropy, 2.8),
    Unique_Destination_IPs: Math.max(1, toNumber(record.unique_destination_ips, 16)),
    Login_Attempts: Math.max(0, toNumber(record.login_attempts, 0)),
    CPU_Usage: Math.min(99, toNumber(record.cpu_usage, 30)),
    Memory_Usage: Math.min(99, toNumber(record.memory_usage, 42)),
    Disk_Write_Rate: Math.max(1, toNumber(record.disk_write_rate, 6)),
  };

  return buildPacket('netflow', row, record.attack_type || record.Attack_Type || record.label, 'Parsed NetFlow telemetry');
};

const parseSflowRecord = (record) => {
  const packetRate = Math.max(1, toNumber(record.packet_rate, 80));
  const byteRate = Math.max(1, toNumber(record.byte_rate, 12000));
  const activeConnections = Math.max(1, toNumber(record.active_connections, 10));
  const failedConnections = Math.max(0, toNumber(record.failed_connections, 0));

  const row = {
    Duration: Math.max(1, toNumber(record.duration, 160)),
    Protocol_Type: parseProtocol(record.protocol),
    Source_Port: toNumber(record.src_port, 443),
    Destination_Port: toNumber(record.dst_port, 8080),
    Bytes_Transferred: Math.round(byteRate * 0.45),
    Bytes_Received: Math.round(byteRate * 0.55),
    Packets_Sent: Math.round(packetRate * 0.52),
    Packets_Received: Math.round(packetRate * 0.48),
    Packet_Rate: packetRate,
    Byte_Rate: byteRate,
    Connection_Count: Math.max(1, toNumber(record.connection_count, Math.round(packetRate * 0.6))),
    Active_Connections: activeConnections,
    Failed_Connections: failedConnections,
    Error_Rate: Math.min(0.99, toNumber(record.error_rate, 0.05)),
    Retransmission_Rate: Math.min(0.99, toNumber(record.retransmission_rate, 0.04)),
    SYN_Count: Math.max(1, toNumber(record.syn_count, Math.round(packetRate * 0.5))),
    ACK_Count: Math.max(1, toNumber(record.ack_count, Math.round(packetRate * 0.7))),
    RST_Count: Math.max(0, toNumber(record.rst_count, Math.round(packetRate * 0.02))),
    DNS_Query_Count: Math.max(0, toNumber(record.dns_query_count, 24)),
    Payload_Entropy: toNumber(record.payload_entropy, 3.0),
    Unique_Destination_IPs: Math.max(1, toNumber(record.unique_destination_ips, 22)),
    Login_Attempts: Math.max(0, toNumber(record.login_attempts, 0)),
    CPU_Usage: Math.min(99, toNumber(record.cpu_usage, 35)),
    Memory_Usage: Math.min(99, toNumber(record.memory_usage, 48)),
    Disk_Write_Rate: Math.max(1, toNumber(record.disk_write_rate, 8)),
  };

  return buildPacket('sflow', row, record.attack_type || record.Attack_Type || record.label, 'Parsed sFlow telemetry');
};

const readLines = (filePath) => {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf8');
  return content.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
};

const parseStateLine = (state, line, headers) => {
  if (state.id === 'zeek') {
    const parsed = parseJsonLine(line);
    return parsed ? parseZeekEvent(parsed) : null;
  }
  if (state.id === 'suricata') {
    const parsed = parseJsonLine(line);
    return parsed ? parseSuricataEvent(parsed) : null;
  }
  if (state.id === 'netflow') {
    const record = parseCsvRecord(headers, line);
    return record ? parseNetflowRecord(record) : null;
  }
  if (state.id === 'sflow') {
    const record = parseCsvRecord(headers, line);
    return record ? parseSflowRecord(record) : null;
  }
  return null;
};

const ingestSource = (state) => {
  try {
    const lines = readLines(state.file);
    if (lines.length === 0) return;

    let headers = [];
    let dataLines = lines;
    if (state.format === 'csv') {
      headers = lines[0].split(',').map((header) => header.trim());
      dataLines = lines.slice(1);
    }

    if (state.cursor > dataLines.length) {
      state.cursor = 0;
    }

    const newLines = dataLines.slice(state.cursor);
    state.cursor = dataLines.length;
    if (newLines.length === 0) return;

    newLines.forEach((line) => {
      const packet = parseStateLine(state, line, headers);
      if (packet) {
        telemetryQueue.push(packet);
        state.recordsIngested += 1;
        state.lastIngestAt = new Date().toISOString();
      }
    });

    state.lastError = null;
  } catch (error) {
    state.lastError = error instanceof Error ? error.message : 'Unknown ingestion error';
  }
};

const ingestAllSources = () => {
  sourceStates.forEach((state) => ingestSource(state));
};

const createHeartbeatPacket = () => {
  const heartbeatRow = finalizeRow(BASE_ROW);
  return {
    type: 'telemetry',
    source: 'heartbeat',
    timestamp: new Date().toISOString(),
    seq: ++sequence,
    attackType: 'normal',
    forcedClass: ATTACK_TO_CLASS.normal,
    summary: 'No fresh telemetry lines. Heartbeat normal packet emitted.',
    row: heartbeatRow,
  };
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
    req.on('data', (chunk) => {
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
      emitIntervalMs: EMIT_INTERVAL_MS,
      connectedClients: wss.clients.size,
      queueDepth: telemetryQueue.length,
      lastTelemetry,
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/sources') {
    sendJson(res, 200, {
      sources: sourceStates.map((state) => ({
        id: state.id,
        file: state.file,
        cursor: state.cursor,
        recordsIngested: state.recordsIngested,
        lastIngestAt: state.lastIngestAt,
        lastError: state.lastError,
      })),
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/ingest') {
    try {
      const body = await readRequestJson(req);
      const row = finalizeRow(body.row || {});
      const packet = buildPacket(
        String(body.source || 'api'),
        row,
        body.attackType || body.attack_type || body.label,
        'Ingested from /ingest API',
      );
      telemetryQueue.push(packet);
      sendJson(res, 200, { accepted: true, queued: telemetryQueue.length, packet });
      return;
    } catch {
      sendJson(res, 400, { accepted: false, error: 'Invalid JSON body' });
      return;
    }
  }

  if (req.method === 'GET' && req.url === '/') {
    sendJson(res, 200, {
      message: 'Telemetry server running',
      websocket: `ws://localhost:${PORT}/ws`,
      health: `http://localhost:${PORT}/health`,
      sources: `http://localhost:${PORT}/sources`,
    });
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
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
      timestamp: new Date().toISOString(),
      message: 'Connected to telemetry stream',
      emitIntervalMs: EMIT_INTERVAL_MS,
    }),
  );

  if (lastTelemetry) {
    ws.send(JSON.stringify(lastTelemetry));
  }
});

const broadcastTelemetry = (packet) => {
  const payload = JSON.stringify(packet);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(payload);
    }
  });
};

ingestAllSources();

setInterval(() => {
  ingestAllSources();
  const nextPacket = telemetryQueue.length > 0 ? telemetryQueue.shift() : createHeartbeatPacket();
  lastTelemetry = nextPacket;
  broadcastTelemetry(nextPacket);
}, EMIT_INTERVAL_MS);

server.listen(PORT, () => {
  console.log(`[telemetry] server listening on http://localhost:${PORT}`);
  console.log(`[telemetry] websocket endpoint ws://localhost:${PORT}/ws`);
  console.log(`[telemetry] emit interval ${EMIT_INTERVAL_MS}ms`);
  sourceStates.forEach((state) => {
    console.log(`[telemetry] ${state.id} source file: ${state.file}`);
  });
});
