import React from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';

interface AttackProbability {
  attackType: string;
  probability: number;
}

interface AttackProbabilityTableProps {
  probabilities: AttackProbability[];
  finalPrediction: string;
}

export function AttackProbabilityTable({ probabilities, finalPrediction }: AttackProbabilityTableProps) {
  const sorted = [...probabilities].sort((a, b) => b.probability - a.probability);

  return (
    <Card className="p-6">
      <h3 className="text-xl font-bold mb-4">Attack Type Probability Table</h3>
      <div className="space-y-3">
        {sorted.map((item) => (
          <div key={item.attackType} className="space-y-1">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{item.attackType}</span>
                {item.attackType === finalPrediction && <Badge variant="secondary">Winner</Badge>}
              </div>
              <span className="text-sm font-semibold">{item.probability.toFixed(2)}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 transition-all"
                style={{ width: `${Math.min(item.probability, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
