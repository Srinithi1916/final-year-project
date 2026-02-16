import React from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Vote, Check, X, TrendingUp } from 'lucide-react';

interface VotingResultProps {
  votes: number[];
  finalPrediction: number;
  votingConfidence: number;
}

export function VotingResult({ votes, finalPrediction, votingConfidence }: VotingResultProps) {
  const positiveVotes = votes.filter(v => v === 1).length;
  const negativeVotes = votes.filter(v => v === 0).length;
  const totalVotes = votes.length;
  
  const predictionLabel = finalPrediction === 1 ? 'Positive' : 'Negative';
  const Icon = finalPrediction === 1 ? Check : X;

  return (
    <Card className="p-8 bg-gradient-to-br from-primary/5 to-primary/10 border-2 border-primary/20">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-primary/20 rounded-xl">
          <Vote className="size-8 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Ensemble Voting Result</h2>
          <p className="text-sm text-muted-foreground">Majority decision from {totalVotes} models</p>
        </div>
      </div>

      {/* Voting Breakdown */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-background/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Check className="size-5 text-green-600" />
            <span className="font-medium">Positive Votes</span>
          </div>
          <div className="text-3xl font-bold text-green-600">{positiveVotes}</div>
        </div>
        
        <div className="bg-background/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <X className="size-5 text-red-600" />
            <span className="font-medium">Negative Votes</span>
          </div>
          <div className="text-3xl font-bold text-red-600">{negativeVotes}</div>
        </div>
      </div>

      {/* Final Prediction */}
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-background/70 rounded-lg">
          <div className="flex items-center gap-3">
            <Icon className={`size-6 ${finalPrediction === 1 ? 'text-green-600' : 'text-red-600'}`} />
            <span className="font-semibold">Final Prediction:</span>
          </div>
          <Badge 
            variant={finalPrediction === 1 ? "default" : "destructive"} 
            className="text-lg px-4 py-1"
          >
            {predictionLabel}
          </Badge>
        </div>

        {/* Consensus Strength */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-4 text-primary" />
              <span className="font-medium">Consensus Strength:</span>
            </div>
            <span className="font-bold">{(votingConfidence * 100).toFixed(0)}%</span>
          </div>
          <div className="w-full bg-secondary rounded-full h-3">
            <div
              className="bg-primary h-3 rounded-full transition-all duration-500"
              style={{ width: `${votingConfidence * 100}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground text-center">
            {votingConfidence === 1 
              ? 'Unanimous decision - all models agree!' 
              : votingConfidence >= 0.66 
                ? 'Strong majority consensus' 
                : 'Simple majority decision'}
          </p>
        </div>
      </div>
    </Card>
  );
}
