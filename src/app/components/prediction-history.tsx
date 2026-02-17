import React from 'react';
import { Card } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';

interface PredictionLog {
  timestamp: string;
  prediction: string;
  confidence: number;
}

interface PredictionHistoryProps {
  logs: PredictionLog[];
}

export function PredictionHistory({ logs }: PredictionHistoryProps) {
  const shouldScroll = logs.length > 10;

  const getBadgeVariant = (prediction: string) => {
    switch (prediction) {
      case 'Normal': return 'default';
      case 'DDoS': return 'destructive';
      case 'Brute Force': return 'secondary';
      case 'Ransomware': return 'outline';
      default: return 'default';
    }
  };

  return (
    <Card className="p-6">
      <h3 className="text-xl font-bold mb-4">Recent Predictions</h3>
      <div className={`${shouldScroll ? 'max-h-[28rem] overflow-y-auto pr-2' : ''}`}>
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Prediction</TableHead>
              <TableHead>Confidence (%)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  No predictions yet
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-mono text-sm">
                    {new Date(log.timestamp).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getBadgeVariant(log.prediction)}>
                      {log.prediction}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-semibold">
                    {log.confidence.toFixed(2)}%
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>
      </div>
    </Card>
  );
}
