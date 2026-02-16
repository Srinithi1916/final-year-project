import React from 'react';
import { Card } from './ui/card';
import { Progress } from './ui/progress';

interface RiskLevelProps {
  confidence: number;
  prediction: string;
}

export function RiskLevel({ confidence, prediction }: RiskLevelProps) {
  const getRiskLevel = () => {
    if (prediction === 'Normal') return { level: 'Low Risk', color: 'bg-green-500' };
    if (confidence > 80) return { level: 'Critical Risk', color: 'bg-red-600' };
    if (confidence > 60) return { level: 'High Risk', color: 'bg-orange-500' };
    return { level: 'Medium Risk', color: 'bg-yellow-500' };
  };

  const risk = getRiskLevel();

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">Risk Level</h3>
        <span className="text-sm font-medium">{risk.level}</span>
      </div>
      <Progress value={confidence} className="h-6" />
      <div className="flex justify-between mt-2 text-sm text-muted-foreground">
        <span>0%</span>
        <span className="font-medium text-foreground">{confidence.toFixed(1)}%</span>
        <span>100%</span>
      </div>
    </Card>
  );
}
