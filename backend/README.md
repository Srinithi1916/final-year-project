# Live Telemetry Backend

This backend simulates live connectors for:
- Zeek (`backend/feeds/zeek_conn.jsonl`)
- Suricata (`backend/feeds/suricata_eve.jsonl`)
- NetFlow (`backend/feeds/netflow.csv`)
- sFlow (`backend/feeds/sflow.csv`)

It streams one telemetry event every 5 seconds over WebSocket.

## Run

```bash
npm install
npm run telemetry:server
```

WebSocket endpoint:

```text
ws://localhost:8787/ws
```

HTTP endpoints:
- `GET /health`
- `GET /sources`
- `POST /ingest` (push custom telemetry rows)

## Frontend

The React app listens by default to:

```text
ws://localhost:8787/ws
```

Override via env:

```text
VITE_TELEMETRY_WS_URL=ws://localhost:8787/ws
```

## File Transfer Reliability Backend

This server implements:
- `3) Checksum verification`: SHA-256 per chunk and full file checksum verification.
- `9) Detailed status tracking`: `QUEUED -> SENDING -> PARTIAL -> VERIFIED -> COMPLETED/FAILED`.

### Run transfer server

```bash
npm run transfer:server
```

Default endpoints:
- HTTP: `http://localhost:8791`
- WebSocket status stream: `ws://localhost:8791/ws`

### Transfer API

- `POST /transfer/start`
  Body:
  - `fileName` string
  - `totalChunks` number
  - `totalBytes` number
  - `fileChecksum` sha256 hex

- `POST /transfer/chunk`
  Body:
  - `transferId` string
  - `chunkIndex` number
  - `checksum` sha256 hex for chunk
  - `dataBase64` chunk bytes

- `POST /transfer/complete`
  Body:
  - `transferId` string

- `GET /transfer/:id/status`
- `GET /transfers`
- `GET /health`
- `POST /transfer/self-test` (built-in checksum + lifecycle verification)

### Sender test script

```bash
npm run transfer:send -- public/datasets/live_send_receive_all_attacks.csv
```

Optional args:

```bash
npm run transfer:send -- <filePath> <baseUrl> <chunkSizeKb>
```

Example:

```bash
npm run transfer:send -- public/datasets/live_send_receive_all_attacks.csv http://localhost:8791 64
```

Failure simulation:

```bash
npm run transfer:send -- public/datasets/live_send_receive_all_attacks.csv http://localhost:8791 64 --tamper-chunk=0
npm run transfer:send -- public/datasets/live_send_receive_all_attacks.csv http://localhost:8791 64 --tamper-file-checksum
```
