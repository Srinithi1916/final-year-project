import React from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { AlertTriangle, Shield, Activity, TrendingUp } from 'lucide-react';

export interface AnomalyScore {
  overallScore: number; // 0-100, higher = more anomalous
  isZeroDay: boolean;
  reconstructionError: number;
  isolationScore: number;
  statisticalDeviation: number;
  confidence: number;
}

interface AnomalyDetectorProps {
  anomalyScore: AnomalyScore;
  topAnomalousFeatures: Array<{
    feature: string;
    deviation: number;
    expectedRange: string;
    actualValue: number;
  }>;
}

export function AnomalyDetector({ anomalyScore, topAnomalousFeatures }: AnomalyDetectorProps) {
  const { overallScore, isZeroDay, reconstructionError, isolationScore, statisticalDeviation, confidence } = anomalyScore;

  const getAnomalyLevel = () => {
    if (overallScore < 30) return { label: 'Low', color: 'text-green-600 bg-green-50 dark:bg-green-950/30' };
    if (overallScore < 60) return { label: 'Medium', color: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-950/30' };
    if (overallScore < 80) return { label: 'High', color: 'text-orange-600 bg-orange-50 dark:bg-orange-950/30' };
    return { label: 'Critical', color: 'text-red-600 bg-red-50 dark:bg-red-950/30' };
  };

  const level = getAnomalyLevel();

  return (
    <Card className={`p-6 border-2 ${isZeroDay ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/20' : 'border-gray-200'}`}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-2xl font-bold flex items-center gap-2">
            {isZeroDay ? (
              <>
                <AlertTriangle className="size-7 text-purple-600" />
                Zero-Day Attack Detected
              </>
            ) : (
              <>
                <Shield className="size-7 text-blue-600" />
                Anomaly Analysis
              </>
            )}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {isZeroDay 
              ? 'Unknown attack pattern detected - potential zero-day threat'
              : 'Traffic pattern within expected parameters'
            }
          </p>
        </div>
        
        <div className={`px-6 py-3 rounded-xl ${level.color}`}>
          <div className="text-sm font-medium">Anomaly Level</div>
          <div className="text-3xl font-bold">{level.label}</div>
        </div>
      </div>

      {/* Overall Anomaly Score */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold">Overall Anomaly Score</span>
          <span className="text-2xl font-bold text-purple-600">{overallScore.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-4 overflow-hidden">
          <div 
            className={`h-full transition-all duration-500 ${
              overallScore < 30 ? 'bg-green-500' :
              overallScore < 60 ? 'bg-yellow-500' :
              overallScore < 80 ? 'bg-orange-500' : 'bg-red-500'
            }`}
            style={{ width: `${overallScore}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>Normal (0%)</span>
          <span>Threshold (70%)</span>
          <span>Critical (100%)</span>
        </div>
      </div>

      {/* Detection Methods */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Autoencoder Reconstruction Error */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="size-4 text-blue-600" />
            <span className="text-sm font-medium">Reconstruction Error</span>
          </div>
          <div className="text-2xl font-bold text-blue-600">{reconstructionError.toFixed(2)}</div>
          <div className="text-xs text-muted-foreground mt-1">
            Autoencoder-based detection
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2 mt-2">
            <div 
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${Math.min(reconstructionError * 10, 100)}%` }}
            />
          </div>
        </div>

        {/* Isolation Forest Score */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="size-4 text-orange-600" />
            <span className="text-sm font-medium">Isolation Score</span>
          </div>
          <div className="text-2xl font-bold text-orange-600">{isolationScore.toFixed(2)}</div>
          <div className="text-xs text-muted-foreground mt-1">
            Tree-based isolation
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2 mt-2">
            <div 
              className="h-full bg-orange-500 rounded-full transition-all"
              style={{ width: `${isolationScore}%` }}
            />
          </div>
        </div>

        {/* Statistical Deviation */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="size-4 text-purple-600" />
            <span className="text-sm font-medium">Statistical Deviation</span>
          </div>
          <div className="text-2xl font-bold text-purple-600">{statisticalDeviation.toFixed(2)}σ</div>
          <div className="text-xs text-muted-foreground mt-1">
            Z-score based analysis
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2 mt-2">
            <div 
              className="h-full bg-purple-500 rounded-full transition-all"
              style={{ width: `${Math.min((statisticalDeviation / 5) * 100, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Top Anomalous Features */}
      <div>
        <h4 className="font-semibold mb-3 flex items-center gap-2">
          <AlertTriangle className="size-5 text-orange-600" />
          Top Anomalous Features
        </h4>
        <div className="space-y-2">
          {topAnomalousFeatures.map((feature, index) => (
            <div 
              key={index}
              className="bg-white dark:bg-slate-900 p-3 rounded-lg border flex items-center justify-between"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-xs">
                    {feature.feature}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Expected: {feature.expectedRange}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="font-medium">Actual Value: </span>
                  <span className={feature.deviation > 3 ? 'text-red-600 font-bold' : 'text-yellow-600'}>
                    {feature.actualValue.toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Deviation</div>
                <div className={`text-xl font-bold ${
                  feature.deviation > 4 ? 'text-red-600' :
                  feature.deviation > 3 ? 'text-orange-600' :
                  'text-yellow-600'
                }`}>
                  {feature.deviation.toFixed(1)}σ
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Zero-Day Confidence */}
      {isZeroDay && (
        <div className="mt-6 p-4 bg-purple-100 dark:bg-purple-950/40 border-2 border-purple-500 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-purple-900 dark:text-purple-100">
                Zero-Day Detection Confidence
              </div>
              <div className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                Likelihood this is an unknown attack
              </div>
            </div>
            <div className="text-4xl font-bold text-purple-600">
              {confidence.toFixed(1)}%
            </div>
          </div>
        </div>
      )}

      {isZeroDay && (
        <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-900/40 border rounded-lg space-y-3">
          <h4 className="font-semibold">Zero-Day Investigation Notes</h4>
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Why this is marked as Zero-Day: </span>
            The traffic is highly anomalous across multiple features and does not align with known
            DDoS, Brute Force, or Ransomware signatures.
          </div>
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">How we found it: </span>
            Detection combines reconstruction error, isolation score, and statistical deviation, then
            compares against a zero-day threshold when no known signature match exists.
          </div>
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">How to investigate and solve: </span>
            Isolate affected hosts, block suspicious ports/IPs, capture PCAP and endpoint telemetry,
            validate top anomalous features, deploy temporary rules, and retrain/update signatures
            after incident confirmation.
          </div>
        </div>
      )}

      {/* Recommendation */}
      <div className={`mt-6 p-4 rounded-lg border-l-4 ${
        isZeroDay 
          ? 'bg-red-50 dark:bg-red-950/20 border-red-500'
          : 'bg-blue-50 dark:bg-blue-950/20 border-blue-500'
      }`}>
        <div className="font-semibold mb-1">
          {isZeroDay ? '🚨 Recommended Action' : '✅ System Status'}
        </div>
        <div className="text-sm text-muted-foreground">
          {isZeroDay 
            ? 'Immediate investigation required. Isolate affected systems and collect forensic data. This traffic pattern does not match any known attack signatures.'
            : 'Traffic matches known patterns. Continue monitoring for deviations from baseline behavior.'
          }
        </div>
      </div>
    </Card>
  );
}
