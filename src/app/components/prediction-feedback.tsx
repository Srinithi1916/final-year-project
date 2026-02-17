import React from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Download } from 'lucide-react';

export interface FeedbackEntry {
  id: string;
  predictionTimestamp: string;
  feedbackTimestamp: string;
  prediction: string;
  confidence: number;
  userFeedback: 'Correct' | 'Wrong';
  outcome: 'True Positive' | 'True Negative' | 'False Positive' | 'False Negative';
  featureSnapshot?: string;
}

interface PredictionFeedbackProps {
  currentPrediction: {
    timestamp: string;
    prediction: string;
    confidence: number;
  } | null;
  feedbackLogs: FeedbackEntry[];
  onMarkFeedback: (isCorrect: boolean) => void;
  onExportFeedback: () => void;
}

const getOutcomeVariant = (outcome: FeedbackEntry['outcome']) => {
  if (outcome === 'True Positive' || outcome === 'True Negative') return 'default';
  return 'destructive';
};

export function PredictionFeedback({
  currentPrediction,
  feedbackLogs,
  onMarkFeedback,
  onExportFeedback,
}: PredictionFeedbackProps) {
  const currentFeedback = currentPrediction
    ? feedbackLogs.find((entry) => entry.predictionTimestamp === currentPrediction.timestamp)
    : null;

  const stats = feedbackLogs.reduce(
    (acc, entry) => {
      if (entry.outcome === 'True Positive') acc.tp += 1;
      if (entry.outcome === 'True Negative') acc.tn += 1;
      if (entry.outcome === 'False Positive') acc.fp += 1;
      if (entry.outcome === 'False Negative') acc.fn += 1;
      return acc;
    },
    { tp: 0, tn: 0, fp: 0, fn: 0 },
  );

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="text-xl font-bold">Prediction Feedback</h3>
        <Button
          onClick={onExportFeedback}
          variant="secondary"
          disabled={feedbackLogs.length === 0}
        >
          <Download className="size-4 mr-2" />
          Export Feedback CSV
        </Button>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        Mark each prediction as correct or wrong. Feedback is stored locally and can be exported for retraining.
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        <Badge variant="outline">TP: {stats.tp}</Badge>
        <Badge variant="outline">TN: {stats.tn}</Badge>
        <Badge variant="outline">FP: {stats.fp}</Badge>
        <Badge variant="outline">FN: {stats.fn}</Badge>
      </div>

      <div className="flex flex-wrap gap-3 mb-5">
        <Button onClick={() => onMarkFeedback(true)} disabled={!currentPrediction}>
          Mark Correct
        </Button>
        <Button onClick={() => onMarkFeedback(false)} variant="destructive" disabled={!currentPrediction}>
          Mark Wrong
        </Button>
        {currentFeedback && (
          <Badge variant={getOutcomeVariant(currentFeedback.outcome)}>
            Current: {currentFeedback.outcome}
          </Badge>
        )}
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Prediction Time</TableHead>
              <TableHead>Prediction</TableHead>
              <TableHead>Confidence</TableHead>
              <TableHead>User Feedback</TableHead>
              <TableHead>Outcome</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {feedbackLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No feedback recorded yet
                </TableCell>
              </TableRow>
            ) : (
              feedbackLogs.slice(0, 12).map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-mono text-xs">
                    {new Date(entry.predictionTimestamp).toLocaleString()}
                  </TableCell>
                  <TableCell>{entry.prediction}</TableCell>
                  <TableCell>{entry.confidence.toFixed(2)}%</TableCell>
                  <TableCell>{entry.userFeedback}</TableCell>
                  <TableCell>
                    <Badge variant={getOutcomeVariant(entry.outcome)}>{entry.outcome}</Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
