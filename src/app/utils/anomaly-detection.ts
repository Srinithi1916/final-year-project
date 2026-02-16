// Anomaly detection utilities for zero-day attack identification

export interface NetworkFeatureStats {
  mean: number;
  stdDev: number;
  min: number;
  max: number;
}

// Baseline statistics for normal network traffic (learned from training data)
export const BASELINE_STATS: Record<string, NetworkFeatureStats> = {
  Duration: { mean: 200, stdDev: 100, min: 0, max: 1000 },
  Protocol_Type: { mean: 6, stdDev: 2, min: 1, max: 17 },
  Source_Port: { mean: 35000, stdDev: 15000, min: 1, max: 65535 },
  Destination_Port: { mean: 8000, stdDev: 20000, min: 1, max: 65535 },
  Packet_Length: { mean: 700, stdDev: 300, min: 64, max: 1500 },
  Packet_Size: { mean: 900, stdDev: 350, min: 64, max: 1500 },
  Header_Length: { mean: 20, stdDev: 5, min: 20, max: 60 },
  Bytes_Transferred: { mean: 5000, stdDev: 15000, min: 0, max: 100000 },
  Bytes_Received: { mean: 4500, stdDev: 12000, min: 0, max: 100000 },
  Packets_Sent: { mean: 150, stdDev: 300, min: 1, max: 10000 },
  Packets_Received: { mean: 140, stdDev: 280, min: 1, max: 10000 },
  Packet_Rate: { mean: 80, stdDev: 2000, min: 1, max: 20000 },
  Byte_Rate: { mean: 15000, stdDev: 50000, min: 100, max: 600000 },
  Connection_Count: { mean: 10, stdDev: 500, min: 1, max: 10000 },
  Active_Connections: { mean: 8, stdDev: 100, min: 1, max: 8000 },
  Failed_Connections: { mean: 2, stdDev: 100, min: 0, max: 1000 },
  Error_Rate: { mean: 0.05, stdDev: 0.15, min: 0, max: 1 },
  Retransmission_Rate: { mean: 0.08, stdDev: 0.12, min: 0, max: 1 },
  SYN_Count: { mean: 10, stdDev: 500, min: 0, max: 12000 },
  ACK_Count: { mean: 280, stdDev: 500, min: 0, max: 15000 },
  FIN_Count: { mean: 8, stdDev: 50, min: 0, max: 1000 },
  RST_Count: { mean: 1, stdDev: 200, min: 0, max: 6000 },
  PSH_Count: { mean: 100, stdDev: 200, min: 0, max: 5000 },
  URG_Count: { mean: 0, stdDev: 1, min: 0, max: 10 },
  Window_Size: { mean: 45000, stdDev: 20000, min: 1000, max: 65535 },
  TTL: { mean: 64, stdDev: 30, min: 1, max: 255 },
  Fragmentation: { mean: 0.1, stdDev: 0.3, min: 0, max: 1 },
  Same_Source_Port_Rate: { mean: 0.3, stdDev: 0.25, min: 0, max: 1 },
  Same_Dest_Port_Rate: { mean: 0.4, stdDev: 0.3, min: 0, max: 1 },
  Service_Count: { mean: 5, stdDev: 3, min: 1, max: 20 }
};

// Known attack patterns (simplified signatures)
export const KNOWN_ATTACK_PATTERNS = {
  DDoS: {
    highPacketRate: 10000,
    highConnectionCount: 5000,
    highErrorRate: 0.8,
    lowDuration: 10
  },
  BruteForce: {
    highFailedConnections: 500,
    highConnectionCount: 500,
    mediumErrorRate: 0.6,
    specificPorts: [22, 3389, 21, 23]
  },
  Ransomware: {
    highBytesTransferred: 50000,
    longDuration: 1500,
    specificPorts: [445, 135, 139]
  }
};

/**
 * Calculate Z-score for a feature value
 */
export function calculateZScore(value: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return 0;
  return Math.abs((value - mean) / stdDev);
}

/**
 * Calculate statistical deviation across all features
 */
export function calculateStatisticalDeviation(inputData: Record<string, number>): {
  avgDeviation: number;
  maxDeviation: number;
  anomalousFeatures: Array<{ feature: string; deviation: number; actualValue: number }>;
} {
  const deviations: Array<{ feature: string; deviation: number; actualValue: number }> = [];

  Object.keys(inputData).forEach(feature => {
    const stats = BASELINE_STATS[feature];
    if (stats) {
      const zScore = calculateZScore(inputData[feature], stats.mean, stats.stdDev);
      deviations.push({
        feature,
        deviation: zScore,
        actualValue: inputData[feature]
      });
    }
  });

  // Sort by deviation (highest first)
  deviations.sort((a, b) => b.deviation - a.deviation);

  const avgDeviation = deviations.reduce((sum, d) => sum + d.deviation, 0) / deviations.length;
  const maxDeviation = deviations[0]?.deviation || 0;

  return {
    avgDeviation,
    maxDeviation,
    anomalousFeatures: deviations.slice(0, 5) // Top 5 anomalous features
  };
}

/**
 * Simulate autoencoder reconstruction error
 * In a real system, this would be the actual neural network reconstruction loss
 */
export function calculateReconstructionError(inputData: Record<string, number>): number {
  // Simulate by calculating how much the input deviates from expected patterns
  const { avgDeviation } = calculateStatisticalDeviation(inputData);
  
  // Normalize to 0-10 range
  const error = Math.min(avgDeviation * 1.5, 10);
  
  return error;
}

/**
 * Simulate Isolation Forest score
 * In a real system, this would use sklearn's IsolationForest
 */
export function calculateIsolationScore(inputData: Record<string, number>): number {
  // Simulate isolation score based on feature density
  const { maxDeviation } = calculateStatisticalDeviation(inputData);
  
  // Convert to 0-100 scale (higher = more isolated/anomalous)
  const score = Math.min((maxDeviation / 5) * 100, 100);
  
  return score;
}

/**
 * Check if traffic matches any known attack pattern
 */
export function matchesKnownPattern(inputData: Record<string, number>): {
  matches: boolean;
  attackType: string | null;
  confidence: number;
} {
  const packetRate = inputData.Packet_Rate || 0;
  const connectionCount = inputData.Connection_Count || 0;
  const errorRate = inputData.Error_Rate || 0;
  const failedConnections = inputData.Failed_Connections || 0;
  const bytesTransferred = inputData.Bytes_Transferred || 0;
  const duration = inputData.Duration || 0;
  const destPort = inputData.Destination_Port || 0;

  // Check DDoS pattern
  if (packetRate > KNOWN_ATTACK_PATTERNS.DDoS.highPacketRate || 
      (connectionCount > KNOWN_ATTACK_PATTERNS.DDoS.highConnectionCount && 
       errorRate > KNOWN_ATTACK_PATTERNS.DDoS.highErrorRate)) {
    return { matches: true, attackType: 'DDoS', confidence: 85 + Math.random() * 12 };
  }

  // Check Brute Force pattern
  if ((failedConnections > KNOWN_ATTACK_PATTERNS.BruteForce.highFailedConnections || 
       connectionCount > KNOWN_ATTACK_PATTERNS.BruteForce.highConnectionCount) && 
       errorRate > KNOWN_ATTACK_PATTERNS.BruteForce.mediumErrorRate) {
    return { matches: true, attackType: 'Brute Force', confidence: 78 + Math.random() * 18 };
  }

  // Check Ransomware pattern
  if (bytesTransferred > KNOWN_ATTACK_PATTERNS.Ransomware.highBytesTransferred && 
      duration > KNOWN_ATTACK_PATTERNS.Ransomware.longDuration) {
    return { matches: true, attackType: 'Ransomware', confidence: 80 + Math.random() * 15 };
  }

  // Check if it's normal traffic (low deviations)
  const { avgDeviation } = calculateStatisticalDeviation(inputData);
  if (avgDeviation < 2) {
    return { matches: true, attackType: 'Normal', confidence: 75 + Math.random() * 20 };
  }

  return { matches: false, attackType: null, confidence: 0 };
}

/**
 * Main zero-day detection function
 */
export function detectZeroDay(inputData: Record<string, number>): {
  isZeroDay: boolean;
  overallScore: number;
  reconstructionError: number;
  isolationScore: number;
  statisticalDeviation: number;
  confidence: number;
  topAnomalousFeatures: Array<{
    feature: string;
    deviation: number;
    expectedRange: string;
    actualValue: number;
  }>;
} {
  // Check if it matches known patterns
  const knownPattern = matchesKnownPattern(inputData);
  
  // Calculate anomaly metrics
  const reconstructionError = calculateReconstructionError(inputData);
  const isolationScore = calculateIsolationScore(inputData);
  const { avgDeviation, anomalousFeatures } = calculateStatisticalDeviation(inputData);

  // Calculate overall anomaly score (0-100)
  const overallScore = (
    (reconstructionError / 10) * 30 + // 30% weight
    (isolationScore / 100) * 40 +      // 40% weight
    (Math.min(avgDeviation / 5, 1)) * 30 // 30% weight
  ) * 100;

  // Zero-day threshold: high anomaly score + doesn't match known patterns
  const ZERO_DAY_THRESHOLD = 70;
  const isZeroDay = !knownPattern.matches && overallScore > ZERO_DAY_THRESHOLD;

  // Confidence in zero-day detection
  const confidence = isZeroDay 
    ? Math.min(60 + (overallScore - ZERO_DAY_THRESHOLD) * 2, 98)
    : 0;

  // Format top anomalous features
  const topAnomalousFeatures = anomalousFeatures.map(f => {
    const stats = BASELINE_STATS[f.feature];
    return {
      feature: f.feature,
      deviation: f.deviation,
      expectedRange: `${(stats.mean - 2 * stats.stdDev).toFixed(1)} - ${(stats.mean + 2 * stats.stdDev).toFixed(1)}`,
      actualValue: f.actualValue
    };
  });

  return {
    isZeroDay,
    overallScore,
    reconstructionError,
    isolationScore,
    statisticalDeviation: avgDeviation,
    confidence,
    topAnomalousFeatures
  };
}
