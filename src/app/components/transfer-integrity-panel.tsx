import React from 'react';
import { Card } from './ui/card';

type TransferStatus = 'QUEUED' | 'SENDING' | 'PARTIAL' | 'VERIFIED' | 'COMPLETED' | 'FAILED';

interface TransferHistoryEntry {
  status: TransferStatus;
  at: string;
  reason: string;
}

interface TransferSummary {
  transferId: string;
  fileName: string;
  totalChunks: number;
  totalBytes: number;
  receivedChunks: number;
  receivedBytes: number;
  missingChunks: number[];
  status: TransferStatus;
  createdAt: string;
  updatedAt: string;
  lastChunkAt: string | null;
  expectedFileChecksum: string;
  actualFileChecksum: string | null;
  failureReason: string | null;
  statusHistory: TransferHistoryEntry[];
}

const TRANSFER_API_URL = import.meta.env.VITE_TRANSFER_API_URL || 'http://localhost:8791';
const PROCESS_STEPS: TransferStatus[] = ['QUEUED', 'SENDING', 'PARTIAL', 'VERIFIED', 'COMPLETED', 'FAILED'];

const getChecksumScore = (transfer: TransferSummary): number => {
  if (transfer.actualFileChecksum) {
    return transfer.actualFileChecksum === transfer.expectedFileChecksum ? 100 : 0;
  }
  if (transfer.totalChunks <= 0) return 0;
  return Math.min(100, (transfer.receivedChunks / transfer.totalChunks) * 100);
};

const getProcessTone = (step: TransferStatus, latest: TransferSummary, seen: Set<TransferStatus>) => {
  if (latest.status === step) {
    if (step === 'FAILED') return 'bg-red-600 text-white border-red-600';
    if (step === 'COMPLETED') return 'bg-emerald-600 text-white border-emerald-600';
    return 'bg-blue-600 text-white border-blue-600';
  }
  if (seen.has(step)) {
    if (step === 'FAILED') return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
    return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800';
  }
  return 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
};

export function TransferIntegrityPanel() {
  const [latestTransfer, setLatestTransfer] = React.useState<TransferSummary | null>(null);
  const [isConnected, setIsConnected] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;

    const poll = async () => {
      try {
        const response = await fetch(`${TRANSFER_API_URL}/transfers`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const payload = await response.json() as { items?: TransferSummary[] };
        if (!mounted) return;

        const items = [...(payload.items || [])].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        );

        setLatestTransfer(items.length > 0 ? items[0] : null);
        setIsConnected(true);
        setError(null);
        setLastSyncAt(new Date().toISOString());
      } catch {
        if (!mounted) return;
        setIsConnected(false);
        setError(`Transfer API unavailable at ${TRANSFER_API_URL}`);
      }
    };

    poll();
    const timerId = window.setInterval(poll, 5000);

    return () => {
      mounted = false;
      window.clearInterval(timerId);
    };
  }, []);

  const checksumScore = latestTransfer ? getChecksumScore(latestTransfer) : 0;
  const processSeen = new Set<TransferStatus>((latestTransfer?.statusHistory || []).map((entry) => entry.status));

  return (
    <Card className="p-6 mt-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-xl font-semibold">Transfer Integrity</h3>
          <p className="text-sm text-muted-foreground">
            Receiver-side checksum score and delivery process lifecycle from backend transfer service.
          </p>
        </div>
        <div className={`text-xs font-semibold px-2 py-1 rounded-full ${isConnected ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>
          {isConnected ? 'API Connected' : 'API Disconnected'}
        </div>
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {!latestTransfer ? (
        <p className="mt-4 text-sm text-muted-foreground">No transfer records yet.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mt-4">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Latest File</p>
              <p className="text-sm font-semibold break-all">{latestTransfer.fileName}</p>
              <p className="text-xs text-muted-foreground break-all">{latestTransfer.transferId}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Current Status</p>
              <p className="text-sm font-semibold">{latestTransfer.status}</p>
              <p className="text-xs text-muted-foreground">
                {latestTransfer.receivedChunks}/{latestTransfer.totalChunks} chunks
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Checksum Score</p>
              <p className="text-sm font-semibold">{checksumScore.toFixed(2)}%</p>
              <p className="text-xs text-muted-foreground">
                {latestTransfer.actualFileChecksum
                  ? latestTransfer.actualFileChecksum === latestTransfer.expectedFileChecksum
                    ? 'Full checksum matched'
                    : 'Checksum mismatch'
                  : 'Chunk progress based score'}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Last Sync</p>
              <p className="text-sm font-semibold">
                {lastSyncAt ? new Date(lastSyncAt).toLocaleTimeString() : '-'}
              </p>
              <p className="text-xs text-muted-foreground">
                Updated: {new Date(latestTransfer.updatedAt).toLocaleTimeString()}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-600 to-cyan-500 transition-[width] duration-500"
                style={{ width: `${checksumScore}%` }}
              />
            </div>
          </div>

          <div className="mt-4">
            <p className="text-sm font-semibold mb-2">Process Lifecycle</p>
            <div className="flex flex-wrap gap-2">
              {PROCESS_STEPS.map((step) => (
                <span key={step} className={`text-xs font-semibold rounded-full border px-3 py-1 ${getProcessTone(step, latestTransfer, processSeen)}`}>
                  {step}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-4 text-xs text-muted-foreground space-y-1">
            <p>Expected SHA-256: {latestTransfer.expectedFileChecksum}</p>
            <p>Actual SHA-256: {latestTransfer.actualFileChecksum || 'Not available yet'}</p>
            {latestTransfer.failureReason && (
              <p className="text-red-600 dark:text-red-400">Failure: {latestTransfer.failureReason}</p>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
