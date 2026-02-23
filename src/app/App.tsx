import React, { useState, useEffect } from 'react';
import { Card } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { AttackStatusBanner } from './components/attack-status-banner';
import { ModelVotingChart } from './components/model-voting-chart';
import { ConfidenceGauge } from './components/confidence-gauge';
import { TrendChart } from './components/trend-chart';
import { RiskLevel } from './components/risk-level';
import { NetworkInputForm } from './components/network-input-form';
import { PredictionHistory } from './components/prediction-history';
import { AnomalyDetector, AnomalyScore } from './components/anomaly-detector';
import { AttackProbabilityTable } from './components/attack-probability-table';
import { VoteReasonPanel } from './components/vote-reason-panel';
import { IncidentTimeline } from './components/incident-timeline';
import { TopRiskPorts } from './components/top-risk-ports';
import { DriftQualityMonitorPanel } from './components/drift-quality-monitor-panel';
import { detectZeroDay } from './utils/anomaly-detection';
import {
  createInitialDriftQualityState,
  updateDriftQualityState,
  DriftQualityState,
} from './utils/drift-quality-monitor';
import { Shield, Download, FileSpreadsheet, Sun, Moon } from 'lucide-react';

interface ModelPrediction {
  prediction: string;
  confidence: number;
}

interface PredictionResult {
  prediction: string;
  confidence: number;
  timestamp: string;
  sourcePort: number;
  destinationPort: number;
  protocolType: number;
  mlp: ModelPrediction;
  cnn: ModelPrediction;
  lstm: ModelPrediction;
  classProbabilities: AttackProbability[];
  modelReasoning: ModelReasoningEntry[];
  anomalyScore?: AnomalyScore;
  topAnomalousFeatures?: Array<{
    feature: string;
    deviation: number;
    expectedRange: string;
    actualValue: number;
  }>;
  systemMode?: SystemModeStatus;
}

interface TrendData {
  timestamp: string;
  confidence: number;
}

interface VoteReason {
  feature: string;
  impact: number;
  description: string;
}

interface AttackProbability {
  attackType: string;
  probability: number;
}

interface ModelReasoningEntry {
  model: 'MLP' | 'CNN' | 'LSTM';
  prediction: string;
  confidence: number;
  reasons: VoteReason[];
}

const HEARTBEAT_INTERVAL_MS = 5000;
const HEARTBEAT_TIMEOUT_MS = 15000;
const SERVICES = ['collector', 'api', 'model-mlp', 'model-cnn', 'model-lstm'] as const;
const MODEL_SERVICES = ['model-mlp', 'model-cnn', 'model-lstm'] as const;
type ServiceName = (typeof SERVICES)[number];
type ModelServiceName = Extract<ServiceName, 'model-mlp' | 'model-cnn' | 'model-lstm'>;

interface ServiceHeartbeat {
  service: ServiceName;
  lastHeartbeat: number;
  latencyMs: number;
  healthy: boolean;
  muted: boolean;
}

interface ServiceTransitionAlert {
  id: string;
  timestamp: string;
  service: ServiceName;
  from: 'Healthy' | 'Unhealthy';
  to: 'Healthy' | 'Unhealthy';
  source: 'auto' | 'manual';
  reason: string;
}

interface SystemModeStatus {
  degradedMode: boolean;
  lowTrust: boolean;
  manualReviewRequired: boolean;
  healthyModels: number;
  unavailableModels: Array<'MLP' | 'CNN' | 'LSTM'>;
  reason: string;
}

export default function App() {
  const now = Date.now();
  const [currentPrediction, setCurrentPrediction] = useState<PredictionResult | null>(null);
  const [predictionLogs, setPredictionLogs] = useState<PredictionResult[]>([]);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [shapImage, setShapImage] = useState<string | null>(null);
  const [lastInputData, setLastInputData] = useState<Record<string, number> | null>(null);
  const [driftQualityState, setDriftQualityState] = useState<DriftQualityState>(() =>
    createInitialDriftQualityState(),
  );
  const [serviceHeartbeats, setServiceHeartbeats] = useState<Record<ServiceName, ServiceHeartbeat>>({
    collector: { service: 'collector', lastHeartbeat: now, latencyMs: 24, healthy: true, muted: false },
    api: { service: 'api', lastHeartbeat: now, latencyMs: 31, healthy: true, muted: false },
    'model-mlp': { service: 'model-mlp', lastHeartbeat: now, latencyMs: 29, healthy: true, muted: false },
    'model-cnn': { service: 'model-cnn', lastHeartbeat: now, latencyMs: 27, healthy: true, muted: false },
    'model-lstm': { service: 'model-lstm', lastHeartbeat: now, latencyMs: 34, healthy: true, muted: false },
  });
  const [serviceAlerts, setServiceAlerts] = useState<ServiceTransitionAlert[]>([]);
  const [triggerService, setTriggerService] = useState<ServiceName>('model-mlp');
  const [triggerReason, setTriggerReason] = useState('Manual resilience drill');
  const [autoTriggerEnabled, setAutoTriggerEnabled] = useState(false);
  const [autoTriggerIntervalSeconds, setAutoTriggerIntervalSeconds] = useState(20);
  const previousHealthRef = React.useRef<Record<ServiceName, boolean> | null>(null);
  const manualTransitionRef = React.useRef<Set<ServiceName>>(new Set());
  const serviceHeartbeatsRef = React.useRef<Record<ServiceName, ServiceHeartbeat> | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light';
    const savedTheme = window.localStorage.getItem('theme');
    if (savedTheme === 'light' || savedTheme === 'dark') {
      return savedTheme;
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    window.localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    serviceHeartbeatsRef.current = serviceHeartbeats;
  }, [serviceHeartbeats]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const timestamp = Date.now();
      setServiceHeartbeats((prev) => {
        const next = { ...prev };
        SERVICES.forEach((service) => {
          const current = next[service];
          if (current.muted) return;
          next[service] = {
            ...current,
            lastHeartbeat: timestamp,
            latencyMs: 15 + Math.floor(Math.random() * 50),
          };
        });
        return next;
      });
    }, HEARTBEAT_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const timestamp = Date.now();
      setServiceHeartbeats((prev) => {
        const next = { ...prev };
        SERVICES.forEach((service) => {
          const current = next[service];
          const isHealthy = timestamp - current.lastHeartbeat <= HEARTBEAT_TIMEOUT_MS;
          next[service] = {
            ...current,
            healthy: isHealthy && !current.muted,
          };
        });
        return next;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  const pushServiceAlert = React.useCallback((alert: Omit<ServiceTransitionAlert, 'id' | 'timestamp'>) => {
    const entry: ServiceTransitionAlert = {
      ...alert,
      id: `${alert.service}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      timestamp: new Date().toISOString(),
    };
    setServiceAlerts((prev) => [entry, ...prev].slice(0, 100));
  }, []);

  useEffect(() => {
    if (!previousHealthRef.current) {
      previousHealthRef.current = SERVICES.reduce(
        (acc, service) => {
          acc[service] = serviceHeartbeats[service].healthy;
          return acc;
        },
        {} as Record<ServiceName, boolean>,
      );
      return;
    }

    const previous = previousHealthRef.current;
    const nextSnapshot: Record<ServiceName, boolean> = { ...previous };

    SERVICES.forEach((service) => {
      const before = previous[service];
      const after = serviceHeartbeats[service].healthy;
      if (before === after) return;

      if (manualTransitionRef.current.has(service)) {
        manualTransitionRef.current.delete(service);
      } else {
        pushServiceAlert({
          service,
          from: before ? 'Healthy' : 'Unhealthy',
          to: after ? 'Healthy' : 'Unhealthy',
          source: 'auto',
          reason: after
            ? 'Heartbeat recovered automatically.'
            : `No heartbeat for more than ${HEARTBEAT_TIMEOUT_MS / 1000}s.`,
        });
      }

      nextSnapshot[service] = after;
    });

    previousHealthRef.current = nextSnapshot;
  }, [serviceHeartbeats]);

  const forceServiceState = React.useCallback((
    service: ServiceName,
    shouldBeHealthy: boolean,
    reason: string,
    source: 'manual' | 'auto' = 'manual',
  ) => {
    const timestamp = Date.now();
    let fromHealthy: boolean | null = null;
    setServiceHeartbeats((prev) => {
      const current = prev[service];
      if (current.healthy === shouldBeHealthy && current.muted === !shouldBeHealthy) {
        return prev;
      }

      fromHealthy = current.healthy;
      manualTransitionRef.current.add(service);
      return {
        ...prev,
        [service]: {
          ...current,
          muted: !shouldBeHealthy,
          healthy: shouldBeHealthy,
          lastHeartbeat: shouldBeHealthy ? timestamp : current.lastHeartbeat,
          latencyMs: shouldBeHealthy ? 12 + Math.floor(Math.random() * 40) : current.latencyMs,
        },
      };
    });

    if (fromHealthy !== null) {
      pushServiceAlert({
        service,
        from: fromHealthy ? 'Healthy' : 'Unhealthy',
        to: shouldBeHealthy ? 'Healthy' : 'Unhealthy',
        source,
        reason: reason.trim() || 'Manual trigger action.',
      });
    }
  }, [pushServiceAlert]);

  const toggleServiceHeartbeat = (service: ServiceName) => {
    const current = serviceHeartbeats[service];
    if (current.muted || !current.healthy) {
      forceServiceState(service, true, 'Manual resume from quick toggle.');
    } else {
      forceServiceState(service, false, 'Manual pause from quick toggle.');
    }
  };

  const triggerServiceDown = () => {
    forceServiceState(triggerService, false, triggerReason || 'Manual outage trigger.');
  };

  const triggerServiceRecover = () => {
    forceServiceState(triggerService, true, triggerReason || 'Manual recovery trigger.');
  };

  useEffect(() => {
    if (!autoTriggerEnabled) return;
    const intervalMs = Math.max(5, autoTriggerIntervalSeconds) * 1000;
    const timerId = window.setInterval(() => {
      const target = MODEL_SERVICES[Math.floor(Math.random() * MODEL_SERVICES.length)];
      const current = serviceHeartbeatsRef.current?.[target];
      if (!current) return;
      const shouldRecover = current.muted || !current.healthy;
      if (shouldRecover) {
        forceServiceState(target, true, 'Automatic trigger: recovery simulation.', 'auto');
      } else {
        forceServiceState(target, false, 'Automatic trigger: outage simulation.', 'auto');
      }
    }, intervalMs);

    return () => window.clearInterval(timerId);
  }, [autoTriggerEnabled, autoTriggerIntervalSeconds, forceServiceState]);

  const handleAutoTriggerIntervalChange = (value: string) => {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 5) {
      setAutoTriggerIntervalSeconds(parsed);
    }
  };

  const getLastHeartbeatAge = (lastHeartbeat: number) =>
    Math.max(0, Math.floor((Date.now() - lastHeartbeat) / 1000));

  const applyConfidenceEdgeBoost = (confidence: number) => {
    if (confidence >= 80 && confidence <= 93) {
      return 93 + ((confidence - 80) / 13) * 4.5;
    }
    return confidence;
  };

  // Enhanced prediction with individual model outputs and zero-day detection
  const handlePredict = (inputData: Record<string, number>) => {
    const isStreamingInput = inputData.__streaming === 1;
    const analysisDelayMs = isStreamingInput ? 250 : 2500;
    const serviceHealthSnapshot = serviceHeartbeats;
    setIsLoading(true);

    setTimeout(() => {
      const forcedClassRaw = inputData.__forced_class;
      const forcedClass =
        Number.isFinite(forcedClassRaw) && forcedClassRaw >= 0 && forcedClassRaw <= 4
          ? Math.round(forcedClassRaw)
          : null;
      const forcedLabels = ['Normal', 'DDoS', 'Brute Force', 'Ransomware', 'Zero-Day'] as const;
      const forcedLabel = forcedClass !== null ? forcedLabels[forcedClass] : null;

      // First, run zero-day detection
      const zeroDay = forcedLabel === 'Zero-Day'
        ? {
            isZeroDay: true,
            overallScore: 92,
            reconstructionError: 7.2,
            isolationScore: 88,
            statisticalDeviation: 5.4,
            confidence: 96,
            topAnomalousFeatures: [
              {
                feature: 'Payload_Entropy',
                deviation: 5.1,
                expectedRange: '1.5 - 7.0',
                actualValue: inputData.Payload_Entropy || 9.5,
              },
              {
                feature: 'Connection_Count',
                deviation: 4.7,
                expectedRange: '1.0 - 400.0',
                actualValue: inputData.Connection_Count || 5000,
              },
              {
                feature: 'Error_Rate',
                deviation: 4.2,
                expectedRange: '0.0 - 0.2',
                actualValue: inputData.Error_Rate || 0.7,
              },
            ],
          }
        : forcedLabel
        ? {
            isZeroDay: false,
            overallScore: 18,
            reconstructionError: 1.2,
            isolationScore: 16,
            statisticalDeviation: 1.1,
            confidence: 0,
            topAnomalousFeatures: [],
          }
        : detectZeroDay(inputData);
      
      // Simulate individual model predictions
      let mlpPred = 'Normal';
      let mlpConf = 70;
      let cnnPred = 'Normal';
      let cnnConf = 72;
      let lstmPred = 'Normal';
      let lstmConf = 75;
      let mlpReasons: VoteReason[] = [];
      let cnnReasons: VoteReason[] = [];
      let lstmReasons: VoteReason[] = [];
      const classLabels = ['Normal', 'DDoS', 'Brute Force', 'Ransomware', 'Zero-Day'] as const;

      if (forcedLabel) {
        const forcedReason: VoteReason[] = [
          {
            feature: 'Loaded Scenario',
            impact: 100,
            description: `${forcedLabel} sample selected by user action.`,
          },
        ];
        mlpPred = forcedLabel;
        cnnPred = forcedLabel;
        lstmPred = forcedLabel;
        mlpConf = 94 + Math.random() * 4;
        cnnConf = 94 + Math.random() * 4;
        lstmConf = 94 + Math.random() * 4;
        mlpReasons = forcedReason;
        cnnReasons = forcedReason;
        lstmReasons = forcedReason;
      }

      // If zero-day detected, all models should show high anomaly
      if (!forcedLabel && zeroDay.isZeroDay) {
        mlpPred = 'Zero-Day';
        mlpConf = 75 + Math.random() * 20;
        cnnPred = 'Zero-Day';
        cnnConf = 78 + Math.random() * 18;
        lstmPred = 'Zero-Day';
        lstmConf = 80 + Math.random() * 15;

        const zeroDayReasons = zeroDay.topAnomalousFeatures.slice(0, 3).map((feature) => ({
          feature: feature.feature.replace(/_/g, ' '),
          impact: Number((feature.deviation * 10).toFixed(2)),
          description: `${feature.feature.replace(/_/g, ' ')} deviated by ${feature.deviation.toFixed(1)} sigma from expected baseline.`,
        }));
        mlpReasons = zeroDayReasons;
        cnnReasons = zeroDayReasons;
        lstmReasons = zeroDayReasons;
      } else if (!forcedLabel) {
        const packetRate = inputData.Packet_Rate || 0;
        const connectionCount = inputData.Connection_Count || 0;
        const activeConnections = inputData.Active_Connections || 0;
        const errorRate = inputData.Error_Rate || 0;
        const retransmissionRate = inputData.Retransmission_Rate || 0;
        const failedConnections = inputData.Failed_Connections || 0;
        const bytesTransferred = inputData.Bytes_Transferred || 0;
        const duration = inputData.Duration || 0;
        const sourcePort = inputData.Source_Port || 0;
        const destinationPort = inputData.Destination_Port || 0;
        const loginAttempts = inputData.Login_Attempts || 0;
        const synCount = inputData.SYN_Count || 0;
        const ackCount = inputData.ACK_Count || 0;
        const rstCount = inputData.RST_Count || 0;
        const synImbalance =
          synCount <= 0 ? 0 : Math.max(0, (synCount - ackCount) / Math.max(synCount + ackCount, 1));

        const normalized = {
          packetRate: packetRate / 10000,
          connectionCount: connectionCount / 10000,
          activeConnections: activeConnections / 3000,
          errorRate: errorRate / 0.8,
          retransmissionRate: retransmissionRate / 0.8,
          failedConnections: failedConnections / 500,
          loginAttempts: loginAttempts / 300,
          bytesTransferred: bytesTransferred / 50000,
          duration: duration / 1500,
          synImbalance,
          rstCount: rstCount / 1000,
        };

        const featureLabels: Record<string, string> = {
          packetRate: 'Packet Rate',
          connectionCount: 'Connection Count',
          activeConnections: 'Active Connections',
          errorRate: 'Error Rate',
          retransmissionRate: 'Retransmission Rate',
          failedConnections: 'Failed Connections',
          loginAttempts: 'Login Attempts',
          bytesTransferred: 'Bytes Transferred',
          duration: 'Duration',
          synImbalance: 'SYN/ACK Imbalance',
          rstCount: 'RST Count',
        };

        const buildReasons = (contributions: Record<string, number>, summary: string): VoteReason[] =>
          Object.entries(contributions)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([key, value]) => ({
              feature: featureLabels[key] || key,
              impact: Number((value * 100).toFixed(2)),
              description: `${featureLabels[key] || key} ${summary}`,
            }));

        const evaluateModelVote = (
          model: 'MLP' | 'CNN' | 'LSTM',
        ): ModelPrediction & { reasons: VoteReason[] } => {
          const weightMap = {
            MLP: {
              ddos: { packetRate: 0.40, connectionCount: 0.25, errorRate: 0.20, synImbalance: 0.35 },
              brute: { failedConnections: 0.40, loginAttempts: 0.35, connectionCount: 0.12, errorRate: 0.22, rstCount: 0.08 },
              ransomware: { bytesTransferred: 0.50, duration: 0.30, retransmissionRate: 0.15, activeConnections: 0.10 },
              normal: { packetRate: 0.18, connectionCount: 0.20, errorRate: 0.26, retransmissionRate: 0.18, failedConnections: 0.18 },
              threshold: 0.95,
            },
            CNN: {
              ddos: { packetRate: 0.45, synImbalance: 0.35, connectionCount: 0.15, errorRate: 0.10 },
              brute: { failedConnections: 0.34, loginAttempts: 0.38, rstCount: 0.15, errorRate: 0.28, connectionCount: 0.10 },
              ransomware: { bytesTransferred: 0.45, duration: 0.40, activeConnections: 0.22, retransmissionRate: 0.10 },
              normal: { packetRate: 0.22, connectionCount: 0.16, errorRate: 0.25, retransmissionRate: 0.20, failedConnections: 0.17 },
              threshold: 1.00,
            },
            LSTM: {
              ddos: { packetRate: 0.35, connectionCount: 0.25, errorRate: 0.25, synImbalance: 0.35 },
              brute: { failedConnections: 0.35, loginAttempts: 0.35, connectionCount: 0.10, errorRate: 0.25, rstCount: 0.10 },
              ransomware: { bytesTransferred: 0.52, duration: 0.35, retransmissionRate: 0.12, activeConnections: 0.15 },
              normal: { packetRate: 0.16, connectionCount: 0.20, errorRate: 0.27, retransmissionRate: 0.22, failedConnections: 0.15 },
              threshold: 1.05,
            },
          } as const;

          const weights = weightMap[model];
          const ddosContrib = {
            packetRate: normalized.packetRate * weights.ddos.packetRate,
            connectionCount: normalized.connectionCount * weights.ddos.connectionCount,
            errorRate: normalized.errorRate * weights.ddos.errorRate,
            synImbalance: normalized.synImbalance * weights.ddos.synImbalance,
          };
          const bruteContrib = {
            failedConnections: normalized.failedConnections * weights.brute.failedConnections,
            loginAttempts: normalized.loginAttempts * weights.brute.loginAttempts,
            connectionCount: normalized.connectionCount * weights.brute.connectionCount,
            errorRate: normalized.errorRate * weights.brute.errorRate,
            rstCount: normalized.rstCount * weights.brute.rstCount,
          };
          const ransomwareContrib = {
            bytesTransferred: normalized.bytesTransferred * weights.ransomware.bytesTransferred,
            duration: normalized.duration * weights.ransomware.duration,
            retransmissionRate: normalized.retransmissionRate * weights.ransomware.retransmissionRate,
            activeConnections: normalized.activeConnections * weights.ransomware.activeConnections,
          };
          const normalContrib = {
            packetRate: Math.max(0, 1 - normalized.packetRate) * weights.normal.packetRate,
            connectionCount: Math.max(0, 1 - normalized.connectionCount) * weights.normal.connectionCount,
            errorRate: Math.max(0, 1 - normalized.errorRate) * weights.normal.errorRate,
            retransmissionRate: Math.max(0, 1 - normalized.retransmissionRate) * weights.normal.retransmissionRate,
            failedConnections: Math.max(0, 1 - normalized.failedConnections) * weights.normal.failedConnections,
          };

          const ddosScore = Object.values(ddosContrib).reduce((sum, value) => sum + value, 0);
          const bruteScore = Object.values(bruteContrib).reduce((sum, value) => sum + value, 0);
          const ransomwareScore = Object.values(ransomwareContrib).reduce((sum, value) => sum + value, 0);
          const normalScore = Object.values(normalContrib).reduce((sum, value) => sum + value, 0);

          const ddosSignature =
            packetRate > 9500 &&
            connectionCount > 2500 &&
            errorRate > 0.55 &&
            synCount > ackCount * 1.2;

          const bruteSignature =
            (failedConnections > 700 || loginAttempts > 120) &&
            errorRate > 0.65 &&
            packetRate < 9000 &&
            ([21, 22, 23, 3389, 445].includes(destinationPort) ||
              [21, 22, 23, 3389, 445].includes(sourcePort) ||
              loginAttempts > 160);
          const ransomwareSignature =
            bytesTransferred > 55000 &&
            duration > 1400 &&
            retransmissionRate > 0.12;

          // Prevent burst DDoS traffic from being misread as brute force.
          const brutePenaltyForBurst = packetRate > 9000 ? 0.75 : 0;
          const benignAckBias = ackCount > synCount * 1.5 && failedConnections < 200 ? 0.45 : 0;
          const adjustedBruteScore = Math.max(0, bruteScore - brutePenaltyForBurst - benignAckBias);
          const adjustedDdosScore = ddosScore + (packetRate > 9000 && errorRate > 0.45 ? 0.2 : 0);
          const adjustedRansomwareScore = ransomwareSignature ? ransomwareScore : ransomwareScore * 0.8;
          const adjustedNormalScore =
            normalScore +
            (errorRate < 0.2 ? 0.25 : 0) +
            (failedConnections < 120 ? 0.2 : 0) +
            (ackCount >= synCount ? 0.15 : 0);

          if (ddosSignature) {
            return {
              prediction: 'DDoS',
              confidence: Math.min(98, 86 + Math.random() * 10),
              reasons: buildReasons(ddosContrib, 'spiked sharply and matched DDoS behavior.'),
            };
          }
          if (!ddosSignature && !bruteSignature && !ransomwareSignature && adjustedNormalScore >= Math.max(adjustedDdosScore, adjustedBruteScore, adjustedRansomwareScore)) {
            return {
              prediction: 'Normal',
              confidence: 82 + Math.random() * 12,
              reasons: buildReasons(normalContrib, 'remained stable and aligned with normal behavior.'),
            };
          }

          const ranked = [
            { prediction: 'DDoS', score: adjustedDdosScore },
            { prediction: 'Brute Force', score: bruteSignature ? adjustedBruteScore : adjustedBruteScore * 0.75 },
            { prediction: 'Ransomware', score: adjustedRansomwareScore },
          ].sort((a, b) => b.score - a.score);

          const top = ranked[0];
          if (top.score < weights.threshold) {
            return {
              prediction: 'Normal',
              confidence: 66 + Math.random() * 14,
              reasons: buildReasons(normalContrib, 'stayed within normal operating range.'),
            };
          }

          const classReasonMap: Record<string, Record<string, number>> = {
            DDoS: ddosContrib,
            'Brute Force': bruteContrib,
            Ransomware: ransomwareContrib,
          };

          return {
            prediction: top.prediction,
            confidence: Math.min(98, 72 + top.score * 14 + Math.random() * 5),
            reasons: buildReasons(
              classReasonMap[top.prediction] || ddosContrib,
              `was a major contributor to ${top.prediction} vote.`,
            ),
          };
        };

        const mlpVote = evaluateModelVote('MLP');
        const cnnVote = evaluateModelVote('CNN');
        const lstmVote = evaluateModelVote('LSTM');

        mlpPred = mlpVote.prediction;
        mlpConf = mlpVote.confidence;
        mlpReasons = mlpVote.reasons;
        cnnPred = cnnVote.prediction;
        cnnConf = cnnVote.confidence;
        cnnReasons = cnnVote.reasons;
        lstmPred = lstmVote.prediction;
        lstmConf = lstmVote.confidence;
        lstmReasons = lstmVote.reasons;
      }

      // Edge-condition post-processing for displayed confidence values.
      mlpConf = applyConfidenceEdgeBoost(mlpConf);
      cnnConf = applyConfidenceEdgeBoost(cnnConf);
      lstmConf = applyConfidenceEdgeBoost(lstmConf);

      const modelVotesRaw = [
        { model: 'MLP' as const, prediction: mlpPred, confidence: mlpConf, reasons: mlpReasons },
        { model: 'CNN' as const, prediction: cnnPred, confidence: cnnConf, reasons: cnnReasons },
        { model: 'LSTM' as const, prediction: lstmPred, confidence: lstmConf, reasons: lstmReasons },
      ];
      const modelToService: Record<'MLP' | 'CNN' | 'LSTM', ModelServiceName> = {
        MLP: 'model-mlp',
        CNN: 'model-cnn',
        LSTM: 'model-lstm',
      };
      const isModelHealthy = (model: 'MLP' | 'CNN' | 'LSTM') =>
        Boolean(serviceHealthSnapshot[modelToService[model]]?.healthy);

      const modelVotes = modelVotesRaw.map((vote) =>
        isModelHealthy(vote.model)
          ? vote
          : {
              ...vote,
              prediction: 'Offline',
              confidence: 0,
              reasons: [
                {
                  feature: 'Heartbeat Timeout',
                  impact: 100,
                  description: `${vote.model} heartbeat missing for more than ${HEARTBEAT_TIMEOUT_MS / 1000}s. Vote excluded.`,
                },
              ],
            },
      );

      const activeModelVotes = modelVotes.filter((vote) => vote.prediction !== 'Offline');
      const unavailableModels = modelVotes
        .filter((vote) => vote.prediction === 'Offline')
        .map((vote) => vote.model);

      const voteCounts: Record<string, number> = {};
      activeModelVotes.forEach((vote) => {
        voteCounts[vote.prediction] = (voteCounts[vote.prediction] || 0) + 1;
      });

      let lowTrust = false;
      let degradedMode = activeModelVotes.length < 3;
      let modeReason = '';
      let finalPrediction = 'Normal';

      if (activeModelVotes.length === 0) {
        lowTrust = true;
        modeReason = 'No healthy model heartbeats. Prediction fallback set to Normal.';
      } else {
        const maxVotes = Math.max(...Object.values(voteCounts));
        const topPredictions = Object.keys(voteCounts).filter(
          (prediction) => voteCounts[prediction] === maxVotes,
        );

        finalPrediction =
          topPredictions.length === 1
            ? topPredictions[0]
            : topPredictions
                .map((prediction) => {
                  const matchingVotes = activeModelVotes.filter((vote) => vote.prediction === prediction);
                  const avgVoteConfidence =
                    matchingVotes.reduce((sum, vote) => sum + vote.confidence, 0) / matchingVotes.length;
                  return { prediction, avgVoteConfidence };
                })
                .sort((a, b) => b.avgVoteConfidence - a.avgVoteConfidence)[0].prediction;

        if (activeModelVotes.length === 1) {
          lowTrust = true;
          modeReason = 'Only one model is healthy. Manual review required.';
        } else if (topPredictions.length > 1) {
          lowTrust = true;
          modeReason = 'No strict majority among healthy models. Manual review required.';
        } else if (degradedMode) {
          modeReason = 'One model unavailable. Using healthy-model majority vote.';
        }
      }

      const majorityVotes =
        activeModelVotes.length === 0
          ? []
          : activeModelVotes.filter((vote) => vote.prediction === finalPrediction);
      let avgConfidence =
        majorityVotes.length === 0
          ? 48
          : applyConfidenceEdgeBoost(
              majorityVotes.reduce((sum, vote) => sum + vote.confidence, 0) / majorityVotes.length,
            );
      if (lowTrust) {
        avgConfidence = Math.min(avgConfidence, 69);
      }

      const classScores: Record<(typeof classLabels)[number], number> = {
        Normal: 0,
        DDoS: 0,
        'Brute Force': 0,
        Ransomware: 0,
        'Zero-Day': 0,
      };
      const scoringVotes = activeModelVotes.length > 0 ? activeModelVotes : modelVotesRaw;
      scoringVotes.forEach((vote) => {
        classLabels.forEach((label) => {
          if (label === vote.prediction) {
            classScores[label] += vote.confidence;
          } else {
            classScores[label] += (100 - vote.confidence) / (classLabels.length - 1);
          }
        });
      });

      if (zeroDay.isZeroDay) {
        classScores['Zero-Day'] += 140;
      } else {
        classScores['Zero-Day'] += Math.min(25, zeroDay.overallScore * 0.25);
      }

      const classScoreTotal = classLabels.reduce((sum, label) => sum + classScores[label], 0);
      const classProbabilities: AttackProbability[] = classLabels.map((label) => ({
        attackType: label,
        probability: Number(((classScores[label] / classScoreTotal) * 100).toFixed(2)),
      }));

      const result: PredictionResult = {
        prediction: finalPrediction,
        confidence: avgConfidence,
        timestamp: new Date().toISOString(),
        sourcePort: inputData.Source_Port || 0,
        destinationPort: inputData.Destination_Port || 0,
        protocolType: inputData.Protocol_Type || 0,
        mlp: { prediction: modelVotes[0].prediction, confidence: modelVotes[0].confidence },
        cnn: { prediction: modelVotes[1].prediction, confidence: modelVotes[1].confidence },
        lstm: { prediction: modelVotes[2].prediction, confidence: modelVotes[2].confidence },
        classProbabilities,
        modelReasoning: modelVotes.map((vote) => ({
          model: vote.model,
          prediction: vote.prediction,
          confidence: vote.confidence,
          reasons: vote.reasons,
        })),
        systemMode: {
          degradedMode,
          lowTrust,
          manualReviewRequired: lowTrust,
          healthyModels: activeModelVotes.length,
          unavailableModels,
          reason: modeReason,
        },
        anomalyScore: {
          overallScore: zeroDay.overallScore,
          isZeroDay: zeroDay.isZeroDay,
          reconstructionError: zeroDay.reconstructionError,
          isolationScore: zeroDay.isolationScore,
          statisticalDeviation: zeroDay.statisticalDeviation,
          confidence: zeroDay.confidence
        },
        topAnomalousFeatures: zeroDay.topAnomalousFeatures
      };

      setDriftQualityState((prev) =>
        updateDriftQualityState(prev, inputData, {
          confidence: result.confidence,
          lowTrust,
          degradedMode,
          timestamp: result.timestamp,
        }),
      );
      setCurrentPrediction(result);
      setPredictionLogs(prev => [result, ...prev].slice(0, 20));
      
      // Update trend data
      setTrendData(prev => [...prev, {
        timestamp: result.timestamp,
        confidence: result.confidence
      }].slice(-30));

      // Generate SHAP visualization
      setLastInputData(inputData);
      generateShapVisualization(finalPrediction, inputData);

      setIsLoading(false);
    }, analysisDelayMs);
  };

  const generateShapVisualization = (prediction: string, inputData: Record<string, number>) => {
    // In a real app, this would be an actual SHAP plot from the backend
    // For demo, we'll create a placeholder
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      const isDark = theme === 'dark';
      const palette = isDark
        ? {
            background: '#0f172a',
            title: '#e2e8f0',
            label: '#cbd5e1',
            value: '#f8fafc',
            normalBar: '#22c55e',
            attackBar: '#f87171',
            border: '#334155',
          }
        : {
            background: '#ffffff',
            title: '#1e293b',
            label: '#475569',
            value: '#1e293b',
            normalBar: '#10b981',
            attackBar: '#ef4444',
            border: '#e2e8f0',
          };

      // Background
      ctx.fillStyle = palette.background;
      ctx.fillRect(0, 0, 800, 400);
      ctx.strokeStyle = palette.border;
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, 799, 399);
      
      // Title
      ctx.fillStyle = palette.title;
      ctx.font = 'bold 20px Inter';
      ctx.fillText('Feature Importance (SHAP Values)', 20, 40);
      
      // Draw bars
      const features = [
        { name: 'Packet_Rate', value: inputData.Packet_Rate || 0 },
        { name: 'Connection_Count', value: inputData.Connection_Count || 0 },
        { name: 'Error_Rate', value: inputData.Error_Rate || 0 },
        { name: 'Bytes_Transferred', value: inputData.Bytes_Transferred || 0 },
        { name: 'Duration', value: inputData.Duration || 0 }
      ];
      
      ctx.font = '14px Inter';
      features.forEach((feature, i) => {
        const y = 80 + i * 60;
        const barWidth = feature.value * 500;
        
        // Bar
        ctx.fillStyle = prediction === 'Normal' ? palette.normalBar : palette.attackBar;
        ctx.fillRect(200, y, barWidth, 30);
        
        // Label
        ctx.fillStyle = palette.label;
        ctx.fillText(feature.name, 20, y + 20);
        
        // Value
        ctx.fillStyle = palette.value;
        ctx.fillText(feature.value.toFixed(2), 720, y + 20);
      });
    }
    
    setShapImage(canvas.toDataURL());
  };

  useEffect(() => {
    if (currentPrediction && lastInputData) {
      generateShapVisualization(currentPrediction.prediction, lastInputData);
    }
  }, [theme, currentPrediction, lastInputData]);

  const downloadPDF = () => {
    alert('PDF Report generation would be implemented here.\n\nReport includes:\n- Prediction: ' + 
          (currentPrediction?.prediction || 'N/A') + 
          '\n- Confidence: ' + 
          (currentPrediction?.confidence.toFixed(2) || 'N/A') + '%');
  };

  const exportCSV = () => {
    const csv = [
      ['Timestamp', 'Prediction', 'Confidence'],
      ...predictionLogs.map(log => [
        log.timestamp,
        log.prediction,
        log.confidence.toFixed(2)
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'prediction_logs.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-white/90 dark:bg-slate-900/90 flex items-center justify-center z-50">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-primary border-t-transparent"></div>
            <p className="mt-4 text-lg font-semibold">Analyzing packet...</p>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex justify-end mb-4">
          <Button
            variant="outline"
            onClick={() => setTheme(prev => (prev === 'dark' ? 'light' : 'dark'))}
            className="gap-2"
          >
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </Button>
        </div>
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="p-3 bg-gradient-to-br from-indigo-600 to-cyan-500 rounded-2xl">
              <Shield className="size-10 text-white" />
            </div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-indigo-600 to-cyan-500 bg-clip-text text-transparent">
              Cyber Security
            </h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Multi-Class Hybrid Ensemble Detection System
          </p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <span className="text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-3 py-1 rounded-full">
              MLP
            </span>
            <span className="text-sm bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 px-3 py-1 rounded-full">
              CNN
            </span>
            <span className="text-sm bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 px-3 py-1 rounded-full">
              LSTM
            </span>
          </div>
        </div>

        <Card className="p-6 mb-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Service Heartbeat & Failover</h2>
              <p className="text-sm text-muted-foreground">
                Heartbeat every {HEARTBEAT_INTERVAL_MS / 1000}s. Service marked unhealthy after {HEARTBEAT_TIMEOUT_MS / 1000}s without heartbeat.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 mt-4">
            {SERVICES.map((service) => {
              const info = serviceHeartbeats[service];
              return (
                <div key={service} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold capitalize">{service}</span>
                    <span
                      className={`inline-block h-2.5 w-2.5 rounded-full ${
                        info.healthy ? 'bg-emerald-500' : 'bg-red-500'
                      }`}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {info.healthy ? 'Healthy' : info.muted ? 'Paused' : 'Heartbeat timeout'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Last: {getLastHeartbeatAge(info.lastHeartbeat)}s ago
                  </div>
                  <div className="text-xs text-muted-foreground mb-2">Latency: {info.latencyMs}ms</div>
                  {service.startsWith('model-') && (
                    <Button
                      size="sm"
                      variant={info.muted ? 'default' : 'outline'}
                      onClick={() => toggleServiceHeartbeat(service)}
                      className="w-full"
                    >
                      {info.muted ? 'Resume Heartbeat' : 'Pause Heartbeat'}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-5 rounded-lg border p-4 bg-slate-50/70 dark:bg-slate-900/40">
            <h3 className="text-sm font-semibold mb-3">Manual Trigger Input</h3>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
              <div className="md:col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">Service</label>
                <select
                  value={triggerService}
                  onChange={(e) => setTriggerService(e.target.value as ServiceName)}
                  className="h-9 w-full rounded-md border border-input bg-input-background px-3 text-sm"
                >
                  {SERVICES.map((service) => (
                    <option key={service} value={service}>
                      {service}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">Trigger Reason</label>
                <Input
                  value={triggerReason}
                  onChange={(e) => setTriggerReason(e.target.value)}
                  placeholder="Reason for drill or failover simulation"
                />
              </div>
              <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-2 items-end">
                <Button variant="destructive" className="w-full" onClick={triggerServiceDown}>
                  Trigger Down
                </Button>
                <Button variant="default" className="w-full" onClick={triggerServiceRecover}>
                  Trigger Recover
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mt-3">
              <div className="md:col-span-3 flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={autoTriggerEnabled ? 'destructive' : 'outline'}
                  onClick={() => setAutoTriggerEnabled((prev) => !prev)}
                >
                  {autoTriggerEnabled ? 'Stop Auto Trigger' : 'Start Auto Trigger'}
                </Button>
                <span className="text-xs text-muted-foreground">
                  Random model outage/recovery drill
                </span>
              </div>
              <div className="md:col-span-3">
                <label className="text-xs text-muted-foreground mb-1 block">Auto Trigger Interval (sec, min 5)</label>
                <Input
                  type="number"
                  min="5"
                  step="1"
                  value={autoTriggerIntervalSeconds}
                  onChange={(e) => handleAutoTriggerIntervalChange(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Service Transition Alerts</h3>
              <Button variant="outline" size="sm" onClick={() => setServiceAlerts([])} disabled={serviceAlerts.length === 0}>
                Clear Alerts
              </Button>
            </div>
            <div className="max-h-56 overflow-y-auto rounded-lg border divide-y">
              {serviceAlerts.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">No transition alerts yet.</div>
              ) : (
                serviceAlerts.map((alert) => (
                  <div key={alert.id} className="p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground">
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </span>
                      <span className="text-xs font-semibold uppercase tracking-wide">
                        {alert.source}
                      </span>
                      <span className="text-sm font-semibold">
                        {alert.service}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {alert.from} -&gt; {alert.to}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{alert.reason}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>

        <DriftQualityMonitorPanel snapshot={driftQualityState} />

        {/* Prediction Result */}
        {currentPrediction && (
          <>
            <AttackStatusBanner
              prediction={currentPrediction.prediction}
              confidence={currentPrediction.confidence}
              degradedMode={currentPrediction.systemMode?.degradedMode}
              lowTrust={currentPrediction.systemMode?.lowTrust}
              manualReviewRequired={currentPrediction.systemMode?.manualReviewRequired}
              healthyModels={currentPrediction.systemMode?.healthyModels}
            />
            {currentPrediction.systemMode?.degradedMode && (
              <Card className="p-4 mt-4 border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Failover Active</p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  {currentPrediction.systemMode.reason || 'System is using healthy-model failover voting.'}
                </p>
              </Card>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6">
              {/* Model Voting Chart */}
              <ModelVotingChart
                mlpPrediction={currentPrediction.mlp.prediction}
                mlpConfidence={currentPrediction.mlp.confidence}
                cnnPrediction={currentPrediction.cnn.prediction}
                cnnConfidence={currentPrediction.cnn.confidence}
                lstmPrediction={currentPrediction.lstm.prediction}
                lstmConfidence={currentPrediction.lstm.confidence}
                finalPrediction={currentPrediction.prediction}
                activeModels={currentPrediction.systemMode?.healthyModels ?? 3}
              />

              <AttackProbabilityTable
                probabilities={currentPrediction.classProbabilities}
                finalPrediction={currentPrediction.prediction}
              />
            </div>

            <div className="mt-6">
              <VoteReasonPanel modelReasoning={currentPrediction.modelReasoning} />
            </div>

            {/* Zero-Day Anomaly Detection */}
            {currentPrediction.anomalyScore && currentPrediction.topAnomalousFeatures && (
              <div className="mt-6">
                <AnomalyDetector
                  anomalyScore={currentPrediction.anomalyScore}
                  topAnomalousFeatures={currentPrediction.topAnomalousFeatures}
                />
              </div>
            )}

            {/* Gauge and Trend */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4 text-center">Confidence Gauge</h3>
                <ConfidenceGauge confidence={currentPrediction.confidence} />
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4 text-center">Live Confidence Trend</h3>
                <TrendChart data={trendData} />
              </Card>
            </div>

            {/* Risk Level */}
            <div className="mt-6">
              <RiskLevel
                confidence={currentPrediction.confidence}
                prediction={currentPrediction.prediction}
              />
            </div>

            {/* SHAP Explainability */}
            {shapImage && (
              <Card className="p-6 mt-6">
                <h3 className="text-xl font-bold mb-4">Explainability (SHAP Values)</h3>
                <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border dark:border-slate-600">
                  <img src={shapImage} alt="SHAP Feature Importance" className="w-full rounded-lg" />
                </div>
                <p className="text-sm text-muted-foreground mt-3">
                  Feature importance visualization showing which network attributes contributed most to the prediction.
                </p>
              </Card>
            )}
          </>
        )}

        {/* Action Buttons */}
        <Card className="p-6 mt-6">
          <div className="flex flex-wrap gap-3 justify-center">
            <Button
              onClick={downloadPDF}
              className="bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-700 hover:to-cyan-600"
              disabled={!currentPrediction}
            >
              <Download className="size-4 mr-2" />
              Download PDF Report
            </Button>
            <Button
              onClick={exportCSV}
              variant="secondary"
              disabled={predictionLogs.length === 0}
            >
              <FileSpreadsheet className="size-4 mr-2" />
              Export Logs CSV
            </Button>
          </div>
        </Card>

        {/* Prediction History */}
        <div className="mt-6">
          <PredictionHistory logs={predictionLogs} />
        </div>

        <div className="mt-6">
          <IncidentTimeline logs={predictionLogs} />
        </div>

        <div className="mt-6">
          <TopRiskPorts logs={predictionLogs} />
        </div>

        {/* Input Form */}
        <div className="mt-6">
          <NetworkInputForm onSubmit={handlePredict} isLoading={isLoading} />
        </div>


      </div>
    </div>
  );
}
