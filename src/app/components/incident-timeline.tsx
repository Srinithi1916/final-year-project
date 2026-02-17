import React from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';

interface IncidentLog {
  timestamp: string;
  prediction: string;
  confidence: number;
}

interface IncidentTimelineProps {
  logs: IncidentLog[];
}

export function IncidentTimeline({ logs }: IncidentTimelineProps) {
  const recent = logs.slice(0, 12);
  const shouldScroll = recent.length > 7;

  const getSeverity = (prediction: string, confidence: number) => {
    if (prediction === 'Normal') return { label: 'Low', color: 'default' as const };
    if (prediction === 'Zero-Day' || confidence >= 95) return { label: 'Critical', color: 'destructive' as const };
    if (prediction === 'DDoS' || prediction === 'Ransomware') return { label: 'High', color: 'secondary' as const };
    return { label: 'Medium', color: 'outline' as const };
  };

  return (
    <Card className="p-6">
      <h3 className="text-xl font-bold mb-4">Incident Timeline</h3>
      {recent.length === 0 ? (
        <p className="text-sm text-muted-foreground">No incidents captured yet.</p>
      ) : (
        <div className={`${shouldScroll ? 'max-h-[34rem] overflow-y-auto pr-2' : ''}`}>
          <div className="space-y-3">
          {recent.map((log, idx) => {
            const severity = getSeverity(log.prediction, log.confidence);
            return (
              <div key={`${log.timestamp}-${idx}`} className="flex items-start gap-3">
                <div className="mt-1 h-2.5 w-2.5 rounded-full bg-indigo-500 shrink-0" />
                <div className="flex-1 rounded-lg border p-3 bg-white/60 dark:bg-slate-900/40">
                  <div className="flex flex-wrap items-center gap-2 justify-between">
                    <div className="font-medium">{log.prediction}</div>
                    <Badge variant={severity.color}>{severity.label}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {new Date(log.timestamp).toLocaleString()}
                  </div>
                  <div className="text-sm mt-1">Confidence: {log.confidence.toFixed(2)}%</div>
                </div>
              </div>
            );
          })}
          </div>
        </div>
      )}
    </Card>
  );
}
