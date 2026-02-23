import React from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface ModelVotingChartProps {
  mlpPrediction: string;
  mlpConfidence: number;
  cnnPrediction: string;
  cnnConfidence: number;
  lstmPrediction: string;
  lstmConfidence: number;
  finalPrediction: string;
  activeModels?: number;
}

export function ModelVotingChart({
  mlpPrediction,
  mlpConfidence,
  cnnPrediction,
  cnnConfidence,
  lstmPrediction,
  lstmConfidence,
  finalPrediction,
  activeModels = 3,
}: ModelVotingChartProps) {
  const votes = [mlpPrediction, cnnPrediction, lstmPrediction];
  const activeVotes = votes.filter((vote) => vote !== 'Offline');
  const finalVoteCount = activeVotes.filter((vote) => vote === finalPrediction).length;

  const data = [
    { model: 'MLP', confidence: mlpConfidence, prediction: mlpPrediction },
    { model: 'CNN', confidence: cnnConfidence, prediction: cnnPrediction },
    { model: 'LSTM', confidence: lstmConfidence, prediction: lstmPrediction }
  ];

  const getBarColor = (prediction: string) => {
    switch (prediction) {
      case 'Normal': return '#10b981';
      case 'DDoS': return '#ef4444';
      case 'Brute Force': return '#f59e0b';
      case 'Ransomware': return '#6366f1';
      case 'Zero-Day': return '#a855f7';
      case 'Offline': return '#94a3b8';
      default: return '#64748b';
    }
  };

  const getBadgeVariant = (prediction: string): 'default' | 'destructive' | 'secondary' | 'outline' => {
    if (prediction === 'Offline') return 'outline';
    return prediction === 'Normal' ? 'default' : 'destructive';
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Model Voting Breakdown</h3>
      
      {/* Bar Chart */}
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
          <YAxis type="category" dataKey="model" tick={{ fontSize: 14, fontWeight: 600 }} width={80} />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'white', 
              border: '1px solid #e5e7eb',
              borderRadius: '8px'
            }}
            formatter={(value: number, name: string, props: any) => [
              `${value.toFixed(1)}% - ${props.payload.prediction}`,
              'Confidence'
            ]}
          />
          <Bar dataKey="confidence" radius={[0, 8, 8, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(entry.prediction)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Individual Model Results */}
      <div className="grid grid-cols-3 gap-3 mt-4">
        <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
          <div className="text-xs text-muted-foreground mb-1">MLP</div>
          <Badge variant={getBadgeVariant(mlpPrediction)} className="text-xs">
            {mlpPrediction}
          </Badge>
          <div className="text-sm font-semibold mt-1">{mlpConfidence.toFixed(1)}%</div>
        </div>

        <div className="text-center p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
          <div className="text-xs text-muted-foreground mb-1">CNN</div>
          <Badge variant={getBadgeVariant(cnnPrediction)} className="text-xs">
            {cnnPrediction}
          </Badge>
          <div className="text-sm font-semibold mt-1">{cnnConfidence.toFixed(1)}%</div>
        </div>

        <div className="text-center p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
          <div className="text-xs text-muted-foreground mb-1">LSTM</div>
          <Badge variant={getBadgeVariant(lstmPrediction)} className="text-xs">
            {lstmPrediction}
          </Badge>
          <div className="text-sm font-semibold mt-1">{lstmConfidence.toFixed(1)}%</div>
        </div>
      </div>

      {/* Voting Summary */}
      <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
        <div className="text-sm text-muted-foreground mb-1">Ensemble Decision</div>
        <div className="text-lg font-bold">
          Majority Vote: {finalPrediction} ({finalVoteCount}/{Math.max(activeModels, 1)})
        </div>
        {activeModels < 3 && (
          <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
            Degraded mode: {activeModels} model(s) available for voting.
          </div>
        )}
      </div>
    </Card>
  );
}
