import React from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Brain, Check, X } from 'lucide-react';

interface NeuralNetworkModelProps {
  modelName: string;
  modelColor: string;
  prediction: number;
  confidence: number;
  isActive: boolean;
}

export function NeuralNetworkModel({
  modelName,
  modelColor,
  prediction,
  confidence,
  isActive
}: NeuralNetworkModelProps) {
  const predictionLabel = prediction === 1 ? 'Positive' : 'Negative';
  const predictionIcon = prediction === 1 ? Check : X;
  const Icon = predictionIcon;

  return (
    <Card className={`p-6 transition-all ${isActive ? 'ring-2 ring-offset-2' : 'opacity-70'}`} style={{ borderColor: modelColor, ringColor: modelColor }}>
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg" style={{ backgroundColor: `${modelColor}20` }}>
          <Brain className="size-6" style={{ color: modelColor }} />
        </div>
        <h3 className="font-semibold">{modelName}</h3>
      </div>

      {/* Neural Network Visualization */}
      <div className="my-6">
        <svg width="100%" height="120" viewBox="0 0 200 120">
          {/* Input Layer */}
          <circle cx="30" cy="30" r="8" fill={modelColor} opacity="0.6" />
          <circle cx="30" cy="60" r="8" fill={modelColor} opacity="0.6" />
          <circle cx="30" cy="90" r="8" fill={modelColor} opacity="0.6" />

          {/* Hidden Layer */}
          <circle cx="100" cy="20" r="8" fill={modelColor} opacity="0.7" />
          <circle cx="100" cy="50" r="8" fill={modelColor} opacity="0.7" />
          <circle cx="100" cy="80" r="8" fill={modelColor} opacity="0.7" />
          <circle cx="100" cy="110" r="8" fill={modelColor} opacity="0.7" />

          {/* Output Layer */}
          <circle cx="170" cy="60" r="10" fill={modelColor} opacity="0.9" />

          {/* Connections - Input to Hidden */}
          {[30, 60, 90].map((y1, i) => (
            <g key={`input-${i}`}>
              {[20, 50, 80, 110].map((y2, j) => (
                <line
                  key={`hidden-${j}`}
                  x1="38"
                  y1={y1}
                  x2="92"
                  y2={y2}
                  stroke={modelColor}
                  strokeWidth="1"
                  opacity="0.2"
                />
              ))}
            </g>
          ))}

          {/* Connections - Hidden to Output */}
          {[20, 50, 80, 110].map((y, i) => (
            <line
              key={`output-${i}`}
              x1="108"
              y1={y}
              x2="160"
              y2="60"
              stroke={modelColor}
              strokeWidth="1"
              opacity="0.3"
            />
          ))}
        </svg>
      </div>

      {/* Prediction */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Prediction:</span>
          <Badge variant={prediction === 1 ? "default" : "destructive"} className="gap-1">
            <Icon className="size-3" />
            {predictionLabel}
          </Badge>
        </div>
        
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Confidence:</span>
            <span className="font-medium">{(confidence * 100).toFixed(1)}%</span>
          </div>
          <div className="w-full bg-secondary rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all duration-500"
              style={{ 
                width: `${confidence * 100}%`,
                backgroundColor: modelColor 
              }}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}
