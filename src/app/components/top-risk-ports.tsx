import React from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';

interface RiskLog {
  timestamp: string;
  prediction: string;
  confidence: number;
  sourcePort: number;
  destinationPort: number;
  protocolType: number;
}

interface TopRiskPortsProps {
  logs: RiskLog[];
}

interface RiskEntry {
  key: string;
  score: number;
  hits: number;
}

const protocolName = (value: number) => {
  if (value === 6) return 'TCP';
  if (value === 17) return 'UDP';
  if (value === 1) return 'ICMP';
  return `Proto-${value}`;
};

const severityMultiplier = (prediction: string) => {
  if (prediction === 'Zero-Day') return 1.6;
  if (prediction === 'Ransomware') return 1.35;
  if (prediction === 'DDoS') return 1.25;
  if (prediction === 'Brute Force') return 1.2;
  return 0.2;
};

export function TopRiskPorts({ logs }: TopRiskPortsProps) {
  const aggregate = (
    rows: RiskLog[],
    keyFn: (row: RiskLog) => string,
    limit = 5,
  ): RiskEntry[] => {
    const map = new Map<string, RiskEntry>();
    rows.forEach((row) => {
      const key = keyFn(row);
      if (!key || key === '0') return;
      const weight = (row.confidence / 100) * severityMultiplier(row.prediction);
      const current = map.get(key) || { key, score: 0, hits: 0 };
      current.score += weight;
      current.hits += 1;
      map.set(key, current);
    });

    return Array.from(map.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  };

  const sourcePorts = aggregate(logs, (row) => String(row.sourcePort));
  const destinationPorts = aggregate(logs, (row) => String(row.destinationPort));
  const protocols = aggregate(logs, (row) => protocolName(row.protocolType));

  const renderList = (title: string, entries: RiskEntry[]) => (
    <div className="rounded-lg border p-4 bg-white/60 dark:bg-slate-900/40">
      <h4 className="font-semibold mb-3">{title}</h4>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No data yet.</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div key={entry.key} className="flex items-center justify-between gap-2">
              <span className="font-medium text-sm">{entry.key}</span>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{entry.hits} hits</Badge>
                <span className="text-xs text-muted-foreground">
                  Risk {entry.score.toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <Card className="p-6">
      <h3 className="text-xl font-bold mb-4">Top Risk Hosts/Ports</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Ranked by attack confidence and severity from recent incidents.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {renderList('Source Ports', sourcePorts)}
        {renderList('Destination Ports', destinationPorts)}
        {renderList('Protocols', protocols)}
      </div>
    </Card>
  );
}
