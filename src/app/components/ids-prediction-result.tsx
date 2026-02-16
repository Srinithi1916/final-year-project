import React from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Shield, AlertTriangle, Activity } from 'lucide-react';

interface IDSPredictionResultProps {
  mlpPrediction: number;
  cnnPrediction: number;
  lstmPrediction: number;
  finalDecision: string;
  confidence: number;
  processingTime?: number;
}

export function IDSPredictionResult({
  mlpPrediction,
  cnnPrediction,
  lstmPrediction,
  finalDecision,
  confidence,
  processingTime = 0
}: IDSPredictionResultProps) {
  const isAttack = finalDecision === 'ATTACK';
  const votes = [mlpPrediction, cnnPrediction, lstmPrediction];
  const attackVotes = votes.filter(v => v >= 0.5).length;
  const normalVotes = 3 - attackVotes;

  return (
    <div className="space-y-6">
      {/* Overall Status */}
      <Card className={`p-6 ${isAttack ? 'border-red-500 bg-red-50 dark:bg-red-950/20' : 'border-green-500 bg-green-50 dark:bg-green-950/20'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {isAttack ? (
              <div className="p-3 bg-red-500/20 rounded-xl">
                <AlertTriangle className="size-8 text-red-600" />
              </div>
            ) : (
              <div className="p-3 bg-green-500/20 rounded-xl">
                <Shield className="size-8 text-green-600" />
              </div>
            )}
            <div>
              <h3 className="text-2xl font-bold">{finalDecision}</h3>
              <p className="text-sm text-muted-foreground">
                {isAttack ? 'Intrusion detected!' : 'Network traffic is normal'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{(confidence * 100).toFixed(1)}%</div>
            <div className="text-sm text-muted-foreground">Confidence</div>
          </div>
        </div>
      </Card>

      {/* Individual Model Predictions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-sm">MLP</span>
            <Badge variant={mlpPrediction >= 0.5 ? "destructive" : "default"}>
              {mlpPrediction >= 0.5 ? 'ATTACK' : 'NORMAL'}
            </Badge>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span>Probability</span>
              <span className="font-mono">{(mlpPrediction * 100).toFixed(1)}%</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2">
              <div
                className={`h-2 rounded-full ${mlpPrediction >= 0.5 ? 'bg-red-500' : 'bg-green-500'}`}
                style={{ width: `${mlpPrediction * 100}%` }}
              />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-sm">CNN</span>
            <Badge variant={cnnPrediction >= 0.5 ? "destructive" : "default"}>
              {cnnPrediction >= 0.5 ? 'ATTACK' : 'NORMAL'}
            </Badge>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span>Probability</span>
              <span className="font-mono">{(cnnPrediction * 100).toFixed(1)}%</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2">
              <div
                className={`h-2 rounded-full ${cnnPrediction >= 0.5 ? 'bg-red-500' : 'bg-green-500'}`}
                style={{ width: `${cnnPrediction * 100}%` }}
              />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-sm">LSTM</span>
            <Badge variant={lstmPrediction >= 0.5 ? "destructive" : "default"}>
              {lstmPrediction >= 0.5 ? 'ATTACK' : 'NORMAL'}
            </Badge>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span>Probability</span>
              <span className="font-mono">{(lstmPrediction * 100).toFixed(1)}%</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2">
              <div
                className={`h-2 rounded-full ${lstmPrediction >= 0.5 ? 'bg-red-500' : 'bg-green-500'}`}
                style={{ width: `${lstmPrediction * 100}%` }}
              />
            </div>
          </div>
        </Card>
      </div>

      {/* Voting Summary */}
      <Card className="p-4 bg-muted/50">
        <div className="flex items-center gap-3 mb-3">
          <Activity className="size-5 text-primary" />
          <h4 className="font-semibold">Voting Summary</h4>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-2xl font-bold text-red-600">{attackVotes}</div>
            <div className="text-sm text-muted-foreground">Attack Votes</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">{normalVotes}</div>
            <div className="text-sm text-muted-foreground">Normal Votes</div>
          </div>
        </div>
        {processingTime > 0 && (
          <div className="mt-3 pt-3 border-t">
            <div className="text-xs text-muted-foreground">
              Processing Time: <span className="font-mono font-semibold">{processingTime}ms</span>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
