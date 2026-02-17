import React from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';

interface VoteReason {
  feature: string;
  impact: number;
  description: string;
}

interface ModelReasoningEntry {
  model: 'MLP' | 'CNN' | 'LSTM';
  prediction: string;
  confidence: number;
  reasons: VoteReason[];
}

interface VoteReasonPanelProps {
  modelReasoning: ModelReasoningEntry[];
}

export function VoteReasonPanel({ modelReasoning }: VoteReasonPanelProps) {
  return (
    <Card className="p-6">
      <h3 className="text-xl font-bold mb-4">Vote Reason Panel</h3>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {modelReasoning.map((entry) => (
          <div key={entry.model} className="rounded-lg border p-4 bg-white/60 dark:bg-slate-900/40">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm text-muted-foreground">{entry.model}</div>
                <div className="font-semibold">{entry.prediction}</div>
              </div>
              <Badge variant={entry.prediction === 'Normal' ? 'default' : 'destructive'}>
                {entry.confidence.toFixed(1)}%
              </Badge>
            </div>
            <div className="space-y-2">
              {entry.reasons.slice(0, 3).map((reason, idx) => (
                <div key={`${entry.model}-${idx}`} className="rounded-md border p-2 bg-background/40">
                  <div className="text-sm font-medium">{reason.feature}</div>
                  <div className="text-xs text-muted-foreground">{reason.description}</div>
                  <div className="text-xs font-semibold mt-1">Impact: {reason.impact.toFixed(2)}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
