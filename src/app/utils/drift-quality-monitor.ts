export type DriftStatus = 'stable' | 'watch' | 'drifted';
export type HealthStatus = 'healthy' | 'watch' | 'degraded';
export type MonitoringAlertType = 'drift' | 'data_quality' | 'model_quality';
export type MonitoringAlertSeverity = 'info' | 'warn' | 'critical';

export interface FeatureDriftMetric {
  feature: string;
  psi: number;
  ks: number;
  status: DriftStatus;
}

export interface QualityIssue {
  field: string;
  kind: 'missing' | 'range';
  expected: string;
  actual: number | null;
}

export interface DataQualitySnapshot {
  sampleCount: number;
  invalidSamples: number;
  missingFieldRate: number;
  rangeViolationRate: number;
  latestIssues: QualityIssue[];
  status: HealthStatus;
}

export interface ModelQualitySnapshot {
  sampleCount: number;
  averageConfidence: number;
  lowConfidenceRate: number;
  lowTrustRate: number;
  degradedModeRate: number;
  status: HealthStatus;
}

export interface MonitoringAlert {
  id: string;
  timestamp: string;
  type: MonitoringAlertType;
  severity: MonitoringAlertSeverity;
  message: string;
}

interface FeatureWindow {
  baseline: number[];
  recent: number[];
}

interface QualityWindowEntry {
  hasMissing: boolean;
  hasRangeViolation: boolean;
  confidence: number;
  lowTrust: boolean;
  degradedMode: boolean;
}

export interface DriftQualityState {
  monitoredFeatures: string[];
  windows: Record<string, FeatureWindow>;
  baselineReady: boolean;
  baselineSize: number;
  recentSize: number;
  featureDrift: FeatureDriftMetric[];
  dataQuality: DataQualitySnapshot;
  modelQuality: ModelQualitySnapshot;
  alerts: MonitoringAlert[];
  alertSeq: number;
  lastAlertByKey: Record<string, number>;
  previousDriftStatus: Record<string, DriftStatus>;
  previousDataQualityStatus: HealthStatus;
  previousModelQualityStatus: HealthStatus;
  qualityWindow: QualityWindowEntry[];
  consecutiveStableSamples: number;
}

export interface MonitoringUpdateInput {
  confidence: number;
  lowTrust: boolean;
  degradedMode: boolean;
  timestamp: string;
}

const BASELINE_TARGET = 40;
const RECENT_WINDOW = 120;
const QUALITY_WINDOW = 200;
const ALERT_COOLDOWN_MS = 30000;

export const MONITORED_FEATURES = [
  'Duration',
  'Packet_Rate',
  'Byte_Rate',
  'Connection_Count',
  'Active_Connections',
  'Failed_Connections',
  'Error_Rate',
  'Retransmission_Rate',
  'Bytes_Transferred',
  'Bytes_Received',
  'SYN_Count',
  'ACK_Count',
  'RST_Count',
  'Payload_Entropy',
] as const;

const FEATURE_RANGES: Record<string, { min: number; max: number }> = {
  Duration: { min: 0, max: 15000 },
  Packet_Rate: { min: 0, max: 25000 },
  Byte_Rate: { min: 0, max: 1_000_000 },
  Connection_Count: { min: 0, max: 120000 },
  Active_Connections: { min: 0, max: 120000 },
  Failed_Connections: { min: 0, max: 80000 },
  Error_Rate: { min: 0, max: 1 },
  Retransmission_Rate: { min: 0, max: 1 },
  Bytes_Transferred: { min: 0, max: 20_000_000 },
  Bytes_Received: { min: 0, max: 20_000_000 },
  SYN_Count: { min: 0, max: 150000 },
  ACK_Count: { min: 0, max: 150000 },
  RST_Count: { min: 0, max: 150000 },
  Payload_Entropy: { min: 0, max: 16 },
};

const FEATURE_SHIFT_THRESHOLDS: Record<string, { watch: number; drifted: number }> = {
  Duration: { watch: 2000, drifted: 5000 },
  Packet_Rate: { watch: 1200, drifted: 6000 },
  Byte_Rate: { watch: 60000, drifted: 200000 },
  Connection_Count: { watch: 800, drifted: 4000 },
  Active_Connections: { watch: 500, drifted: 2500 },
  Failed_Connections: { watch: 100, drifted: 800 },
  Error_Rate: { watch: 0.2, drifted: 0.5 },
  Retransmission_Rate: { watch: 0.2, drifted: 0.5 },
  Bytes_Transferred: { watch: 50000, drifted: 150000 },
  Bytes_Received: { watch: 70000, drifted: 180000 },
  SYN_Count: { watch: 1000, drifted: 6000 },
  ACK_Count: { watch: 5000, drifted: 20000 },
  RST_Count: { watch: 500, drifted: 3000 },
  Payload_Entropy: { watch: 6.5, drifted: 8.5 },
};

const FEATURE_BASELINES: Record<string, number> = {
  Duration: 450,
  Packet_Rate: 420,
  Byte_Rate: 15000,
  Connection_Count: 180,
  Active_Connections: 120,
  Failed_Connections: 8,
  Error_Rate: 0.06,
  Retransmission_Rate: 0.08,
  Bytes_Transferred: 12000,
  Bytes_Received: 18000,
  SYN_Count: 220,
  ACK_Count: 300,
  RST_Count: 4,
  Payload_Entropy: 3.2,
};

const pushBounded = <T,>(arr: T[], value: T, limit: number): T[] => {
  const next = [...arr, value];
  if (next.length <= limit) return next;
  return next.slice(next.length - limit);
};

const buildSeedBaseline = (feature: string): number[] => {
  const base = FEATURE_BASELINES[feature] ?? 1;
  return Array.from({ length: BASELINE_TARGET }, (_, i) => {
    const wave = Math.sin((i + 1) * 1.37) * 0.03;
    const step = ((i % 3) - 1) * 0.01;
    const factor = 1 + wave + step;
    return Math.max(0, Number((base * factor).toFixed(6)));
  });
};

const statusRank: Record<HealthStatus, number> = {
  healthy: 0,
  watch: 1,
  degraded: 2,
};

const driftRank: Record<DriftStatus, number> = {
  stable: 0,
  watch: 1,
  drifted: 2,
};

const worstDriftStatus = (a: DriftStatus, b: DriftStatus): DriftStatus =>
  driftRank[a] >= driftRank[b] ? a : b;

const instantFeatureStatus = (feature: string, value: number): DriftStatus => {
  const threshold = FEATURE_SHIFT_THRESHOLDS[feature];
  if (!threshold) return 'stable';
  if (value >= threshold.drifted) return 'drifted';
  if (value >= threshold.watch) return 'watch';
  return 'stable';
};

const estimateInstantDriftMetrics = (
  feature: string,
  value: number,
  baseline: number[],
): { status: DriftStatus; psi: number; ks: number } => {
  const status = instantFeatureStatus(feature, value);
  if (status === 'stable') {
    return { status, psi: 0, ks: 0 };
  }

  const mean = baseline.length === 0
    ? 0
    : baseline.reduce((sum, item) => sum + item, 0) / baseline.length;
  const variance = baseline.length === 0
    ? 0
    : baseline.reduce((sum, item) => sum + (item - mean) ** 2, 0) / baseline.length;
  const std = Math.sqrt(variance);
  const z = Math.abs(value - mean) / Math.max(std, 1e-6);

  const basePsi = status === 'watch' ? 0.11 : 0.26;
  const baseKs = status === 'watch' ? 0.15 : 0.25;
  const psi = Number((basePsi + Math.min(0.35, z / 40)).toFixed(4));
  const ks = Number((baseKs + Math.min(0.25, z / 55)).toFixed(4));

  return { status, psi, ks };
};

const histogram = (values: number[], min: number, max: number, bins: number): number[] => {
  const counts = Array.from({ length: bins }, () => 0);
  if (values.length === 0) return counts;
  if (max <= min) {
    counts[0] = values.length;
    return counts;
  }
  const width = (max - min) / bins;
  values.forEach((v) => {
    const idx = Math.min(bins - 1, Math.max(0, Math.floor((v - min) / width)));
    counts[idx] += 1;
  });
  return counts;
};

const calculatePsi = (expected: number[], actual: number[]): number => {
  if (expected.length === 0 || actual.length === 0) return 0;
  const min = Math.min(...expected, ...actual);
  const max = Math.max(...expected, ...actual);
  const bins = 10;
  const expHist = histogram(expected, min, max, bins);
  const actHist = histogram(actual, min, max, bins);
  const expTotal = expected.length;
  const actTotal = actual.length;
  const eps = 1e-6;

  let psi = 0;
  for (let i = 0; i < bins; i += 1) {
    const expRatio = Math.max(expHist[i] / expTotal, eps);
    const actRatio = Math.max(actHist[i] / actTotal, eps);
    psi += (actRatio - expRatio) * Math.log(actRatio / expRatio);
  }
  return Number(Math.min(2, psi).toFixed(4));
};

const calculateKs = (expected: number[], actual: number[]): number => {
  if (expected.length === 0 || actual.length === 0) return 0;
  const a = [...expected].sort((x, y) => x - y);
  const b = [...actual].sort((x, y) => x - y);
  const points = [...a, ...b].sort((x, y) => x - y);
  let ai = 0;
  let bi = 0;
  let maxDiff = 0;

  points.forEach((value) => {
    while (ai < a.length && a[ai] <= value) ai += 1;
    while (bi < b.length && b[bi] <= value) bi += 1;
    const cdfA = ai / a.length;
    const cdfB = bi / b.length;
    maxDiff = Math.max(maxDiff, Math.abs(cdfA - cdfB));
  });
  return Number(maxDiff.toFixed(4));
};

const evaluateDriftStatus = (psi: number, ks: number): DriftStatus => {
  if (psi >= 0.25 || ks >= 0.25) return 'drifted';
  if (psi >= 0.1 || ks >= 0.15) return 'watch';
  return 'stable';
};

const evaluateDataQualityStatus = (missingRate: number, rangeRate: number): HealthStatus => {
  if (missingRate >= 0.03 || rangeRate >= 0.05) return 'degraded';
  if (missingRate >= 0.01 || rangeRate >= 0.02) return 'watch';
  return 'healthy';
};

const evaluateModelQualityStatus = (
  avgConfidence: number,
  lowTrustRate: number,
  degradedRate: number,
): HealthStatus => {
  if (avgConfidence < 70 || lowTrustRate >= 0.35 || degradedRate >= 0.4) return 'degraded';
  if (avgConfidence < 82 || lowTrustRate >= 0.2 || degradedRate >= 0.25) return 'watch';
  return 'healthy';
};

const withAlert = (
  state: DriftQualityState,
  key: string,
  alert: Omit<MonitoringAlert, 'id'>,
  nowMs: number,
): DriftQualityState => {
  const lastAt = state.lastAlertByKey[key] ?? 0;
  if (nowMs - lastAt < ALERT_COOLDOWN_MS) return state;

  const entry: MonitoringAlert = {
    ...alert,
    id: `monitor-${state.alertSeq + 1}`,
  };

  return {
    ...state,
    alertSeq: state.alertSeq + 1,
    alerts: [entry, ...state.alerts].slice(0, 120),
    lastAlertByKey: {
      ...state.lastAlertByKey,
      [key]: nowMs,
    },
  };
};

export const createInitialDriftQualityState = (
  features: string[] = [...MONITORED_FEATURES],
): DriftQualityState => {
  const windows = features.reduce(
    (acc, feature) => {
      acc[feature] = { baseline: buildSeedBaseline(feature), recent: [] };
      return acc;
    },
    {} as Record<string, FeatureWindow>,
  );

  const previousDriftStatus = features.reduce(
    (acc, feature) => {
      acc[feature] = 'stable';
      return acc;
    },
    {} as Record<string, DriftStatus>,
  );

  return {
    monitoredFeatures: features,
    windows,
    baselineReady: true,
    baselineSize: BASELINE_TARGET,
    recentSize: 0,
    featureDrift: features.map((feature) => ({ feature, psi: 0, ks: 0, status: 'stable' })),
    dataQuality: {
      sampleCount: 0,
      invalidSamples: 0,
      missingFieldRate: 0,
      rangeViolationRate: 0,
      latestIssues: [],
      status: 'healthy',
    },
    modelQuality: {
      sampleCount: 0,
      averageConfidence: 0,
      lowConfidenceRate: 0,
      lowTrustRate: 0,
      degradedModeRate: 0,
      status: 'healthy',
    },
    alerts: [],
    alertSeq: 0,
    lastAlertByKey: {},
    previousDriftStatus,
    previousDataQualityStatus: 'healthy',
    previousModelQualityStatus: 'healthy',
    qualityWindow: [],
    consecutiveStableSamples: 0,
  };
};

export const updateDriftQualityState = (
  prev: DriftQualityState,
  inputData: Record<string, number>,
  meta: MonitoringUpdateInput,
): DriftQualityState => {
  const nowMs = Date.now();
  let next: DriftQualityState = {
    ...prev,
    windows: Object.fromEntries(
      Object.entries(prev.windows).map(([feature, window]) => [
        feature,
        { baseline: [...window.baseline], recent: [...window.recent] },
      ]),
    ) as Record<string, FeatureWindow>,
    dataQuality: { ...prev.dataQuality, latestIssues: [...prev.dataQuality.latestIssues] },
    modelQuality: { ...prev.modelQuality },
    previousDriftStatus: { ...prev.previousDriftStatus },
    qualityWindow: [...prev.qualityWindow],
    consecutiveStableSamples: prev.consecutiveStableSamples,
  };

  const issues: QualityIssue[] = [];
  const numericValues: Record<string, number> = {};
  const instantStatusByFeature: Record<string, DriftStatus> = {};

  next.monitoredFeatures.forEach((feature) => {
    const raw = inputData[feature];
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      issues.push({
        field: feature,
        kind: 'missing',
        expected: 'finite number',
        actual: null,
      });
      return;
    }

    numericValues[feature] = value;
    const window = next.windows[feature];
    if (window.baseline.length < BASELINE_TARGET) {
      window.baseline = pushBounded(window.baseline, value, BASELINE_TARGET);
    }
    instantStatusByFeature[feature] = instantFeatureStatus(feature, value);

    const range = FEATURE_RANGES[feature];
    if (range && (value < range.min || value > range.max)) {
      issues.push({
        field: feature,
        kind: 'range',
        expected: `${range.min}..${range.max}`,
        actual: value,
      });
    }
  });

  const anomalousFeatureCount = Object.values(instantStatusByFeature).filter(
    (status) => status !== 'stable',
  ).length;
  const stableSample = anomalousFeatureCount === 0;
  next.consecutiveStableSamples = stableSample ? next.consecutiveStableSamples + 1 : 0;

  next.monitoredFeatures.forEach((feature) => {
    const value = numericValues[feature];
    if (!Number.isFinite(value)) return;
    const window = next.windows[feature];
    const baselineMean =
      window.baseline.length === 0
        ? value
        : window.baseline.reduce((sum, item) => sum + item, 0) / window.baseline.length;
    const status = instantStatusByFeature[feature] ?? 'stable';

    let recentValue = value;
    if (anomalousFeatureCount >= 4 && status !== 'stable') {
      // Keep recent window resilient to burst attacks, so drift can recover after normal traffic resumes.
      recentValue = baselineMean + (value - baselineMean) * 0.18;
    }
    window.recent = pushBounded(window.recent, recentValue, RECENT_WINDOW);
  });

  if (next.consecutiveStableSamples >= 5) {
    next.monitoredFeatures.forEach((feature) => {
      const window = next.windows[feature];
      const baselineTail = window.baseline.slice(-Math.min(16, window.baseline.length));
      window.recent = [...baselineTail];
    });
  }

  const hasMissing = issues.some((issue) => issue.kind === 'missing');
  const hasRangeViolation = issues.some((issue) => issue.kind === 'range');
  next.qualityWindow = pushBounded(
    next.qualityWindow,
    {
      hasMissing,
      hasRangeViolation,
      confidence: meta.confidence,
      lowTrust: meta.lowTrust,
      degradedMode: meta.degradedMode,
    },
    QUALITY_WINDOW,
  );

  const baselineReady = next.monitoredFeatures.every(
    (feature) => next.windows[feature].baseline.length >= BASELINE_TARGET,
  );
  next.baselineReady = baselineReady;
  next.baselineSize = baselineReady
    ? BASELINE_TARGET
    : Math.min(...next.monitoredFeatures.map((feature) => next.windows[feature].baseline.length));
  next.recentSize = Math.min(...next.monitoredFeatures.map((feature) => next.windows[feature].recent.length));

  const featureDrift = next.monitoredFeatures.map((feature) => {
    const window = next.windows[feature];
    const latestValue = Number(inputData[feature] ?? 0);
    const instantMetrics = estimateInstantDriftMetrics(feature, latestValue, window.baseline);
    if (!baselineReady || window.recent.length < 8) {
      return {
        feature,
        psi: instantMetrics.psi,
        ks: instantMetrics.ks,
        status: instantMetrics.status,
      };
    }
    const psi = calculatePsi(window.baseline, window.recent);
    const ks = calculateKs(window.baseline, window.recent);
    const distributionStatus = evaluateDriftStatus(psi, ks);
    const status = worstDriftStatus(distributionStatus, instantMetrics.status);
    return {
      feature,
      psi: Number(Math.max(psi, instantMetrics.psi).toFixed(4)),
      ks: Number(Math.max(ks, instantMetrics.ks).toFixed(4)),
      status,
    };
  });
  next.featureDrift = featureDrift;

  featureDrift.forEach((metric) => {
    const previous = next.previousDriftStatus[metric.feature];
    next.previousDriftStatus[metric.feature] = metric.status;
    if (driftRank[metric.status] > driftRank[previous] && metric.status !== 'stable') {
      next = withAlert(
        next,
        `drift-${metric.feature}-${metric.status}`,
        {
          timestamp: meta.timestamp,
          type: 'drift',
          severity: metric.status === 'drifted' ? 'critical' : 'warn',
          message: `${metric.feature} drift moved to ${metric.status.toUpperCase()} (PSI ${metric.psi.toFixed(3)}, KS ${metric.ks.toFixed(3)}).`,
        },
        nowMs,
      );
    }
  });

  const driftedCount = featureDrift.filter((item) => item.status === 'drifted').length;
  if (driftedCount >= 3) {
    next = withAlert(
      next,
      'multi-feature-drift',
      {
        timestamp: meta.timestamp,
        type: 'drift',
        severity: 'critical',
        message: `${driftedCount} monitored features are heavily drifted. Retraining/threshold review recommended.`,
      },
      nowMs,
    );
  }

  const missingRate =
    next.qualityWindow.length === 0
      ? 0
      : next.qualityWindow.filter((entry) => entry.hasMissing).length / next.qualityWindow.length;
  const rangeRate =
    next.qualityWindow.length === 0
      ? 0
      : next.qualityWindow.filter((entry) => entry.hasRangeViolation).length / next.qualityWindow.length;
  const invalidSamples = next.qualityWindow.filter(
    (entry) => entry.hasMissing || entry.hasRangeViolation,
  ).length;
  const dataStatus = evaluateDataQualityStatus(missingRate, rangeRate);

  next.dataQuality = {
    sampleCount: next.qualityWindow.length,
    invalidSamples,
    missingFieldRate: Number((missingRate * 100).toFixed(2)),
    rangeViolationRate: Number((rangeRate * 100).toFixed(2)),
    latestIssues: issues.slice(0, 8),
    status: dataStatus,
  };

  if (statusRank[dataStatus] > statusRank[next.previousDataQualityStatus]) {
    next = withAlert(
      next,
      `data-quality-${dataStatus}`,
      {
        timestamp: meta.timestamp,
        type: 'data_quality',
        severity: dataStatus === 'degraded' ? 'critical' : 'warn',
        message: `Data quality status changed to ${dataStatus.toUpperCase()} (missing ${next.dataQuality.missingFieldRate}%, range ${next.dataQuality.rangeViolationRate}%).`,
      },
      nowMs,
    );
  }
  next.previousDataQualityStatus = dataStatus;

  const avgConfidence =
    next.qualityWindow.length === 0
      ? 0
      : next.qualityWindow.reduce((sum, entry) => sum + entry.confidence, 0) / next.qualityWindow.length;
  const lowConfidenceRate =
    next.qualityWindow.length === 0
      ? 0
      : next.qualityWindow.filter((entry) => entry.confidence < 75).length / next.qualityWindow.length;
  const lowTrustRate =
    next.qualityWindow.length === 0
      ? 0
      : next.qualityWindow.filter((entry) => entry.lowTrust).length / next.qualityWindow.length;
  const degradedRate =
    next.qualityWindow.length === 0
      ? 0
      : next.qualityWindow.filter((entry) => entry.degradedMode).length / next.qualityWindow.length;
  const modelStatus = evaluateModelQualityStatus(avgConfidence, lowTrustRate, degradedRate);

  next.modelQuality = {
    sampleCount: next.qualityWindow.length,
    averageConfidence: Number(avgConfidence.toFixed(2)),
    lowConfidenceRate: Number((lowConfidenceRate * 100).toFixed(2)),
    lowTrustRate: Number((lowTrustRate * 100).toFixed(2)),
    degradedModeRate: Number((degradedRate * 100).toFixed(2)),
    status: modelStatus,
  };

  if (statusRank[modelStatus] > statusRank[next.previousModelQualityStatus]) {
    next = withAlert(
      next,
      `model-quality-${modelStatus}`,
      {
        timestamp: meta.timestamp,
        type: 'model_quality',
        severity: modelStatus === 'degraded' ? 'critical' : 'warn',
        message: `Model quality likely degraded (${modelStatus.toUpperCase()}). Avg confidence ${next.modelQuality.averageConfidence}%, low trust ${next.modelQuality.lowTrustRate}%.`,
      },
      nowMs,
    );
  }
  next.previousModelQualityStatus = modelStatus;

  return next;
};
