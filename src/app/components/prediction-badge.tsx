import React from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';

interface PredictionResult {
  prediction: string;
  confidence: number;
}

export function PredictionBadge({ prediction, confidence }: PredictionResult) {
  const getBadgeStyles = () => {
    switch (prediction) {
      case 'Normal':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'DDoS':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'Brute Force':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Ransomware':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="text-center py-8">
      <Badge 
        className={`text-2xl px-8 py-4 rounded-full border-2 ${getBadgeStyles()}`}
        variant="outline"
      >
        {prediction}
      </Badge>
      <p className="text-muted-foreground mt-4">
        Detected with {confidence.toFixed(2)}% confidence
      </p>
    </div>
  );
}
