# Zero-Day Attack Detection System

## Overview
The Cyber Defense AI system has been extended with advanced anomaly detection capabilities to identify zero-day attacks (previously unseen or unknown attack patterns).

## Detection Techniques

### 1. **Autoencoder Reconstruction Error**
- Simulates a neural network autoencoder that learns to reconstruct normal network traffic
- High reconstruction error indicates the traffic pattern is significantly different from learned normal patterns
- Score range: 0-10 (higher = more anomalous)

### 2. **Isolation Forest Score**
- Tree-based anomaly detection technique
- Measures how easily a data point can be isolated from others
- Score range: 0-100 (higher = more isolated/anomalous)

### 3. **Statistical Deviation Analysis**
- Calculates Z-scores for each network feature against baseline statistics
- Identifies features that deviate significantly from normal distributions
- Measures in standard deviations (σ)

## Baseline Statistics
The system maintains baseline statistics for 30 network features including:
- Traffic metrics (Duration, Packet Rate, Byte Rate)
- Connection metrics (Connection Count, Failed Connections)
- Protocol features (TCP flags: SYN, ACK, FIN, RST, PSH, URG)
- Network attributes (TTL, Window Size, Fragmentation)

## Zero-Day Detection Logic

### Detection Threshold
- Overall anomaly score > 70% triggers zero-day detection
- Traffic must NOT match known attack patterns (DDoS, Brute Force, Ransomware)
- Confidence score increases with anomaly score above threshold

### Scoring Algorithm
```
Overall Score = (Reconstruction Error × 30%) + 
                (Isolation Score × 40%) + 
                (Statistical Deviation × 30%)
```

### Zero-Day Confidence
```
Confidence = min(60 + (Overall Score - 70) × 2, 98)
```

## Key Features

### 1. **Anomaly Detector Component**
- Visual display of overall anomaly score (0-100%)
- Color-coded anomaly levels: Low, Medium, High, Critical
- Individual scores for each detection method
- Top 5 most anomalous features with deviations

### 2. **Feature Deviation Analysis**
Shows for each anomalous feature:
- Feature name
- Expected range (mean ± 2σ)
- Actual value
- Deviation in standard deviations

### 3. **Threat Assessment**
- Immediate investigation recommended for zero-day detections
- System suggests isolation and forensic data collection

## Example Zero-Day Traffic Pattern
```javascript
{
  Duration: 3500,           // Unusually long
  Protocol_Type: 17,        // UDP (unusual for attacks)
  Packet_Rate: 8500,        // High but not DDoS-level
  Connection_Count: 3500,   // Moderate-high
  Error_Rate: 0.45,         // Medium (not extreme)
  URG_Count: 50,            // Unusual urgent flag usage
  Service_Count: 8,         // Multiple services
  TTL: 48                   // Non-standard TTL
}
```

This pattern doesn't match known attacks but has multiple unusual characteristics that trigger zero-day detection.

## Visual Indicators

### Color Coding
- 🟢 **Normal**: Green banner, low anomaly score
- 🔴 **Known Attack**: Red banner (DDoS, Brute Force, Ransomware)
- 🟣 **Zero-Day**: Purple banner, high anomaly score

### Model Predictions
When zero-day is detected:
- MLP Model: Predicts "Zero-Day"
- CNN Model: Predicts "Zero-Day"
- LSTM Model: Predicts "Zero-Day"
- Ensemble: Majority vote = "Zero-Day"

## Testing
Use the **"Load Zero-Day Sample"** button in the Network Input Form to test zero-day detection with pre-configured anomalous traffic patterns.

## Implementation Files
- `/src/app/components/anomaly-detector.tsx` - Anomaly visualization component
- `/src/app/utils/anomaly-detection.ts` - Detection algorithms and logic
- `/src/app/App.tsx` - Integration with ensemble prediction system

## Future Enhancements (For Real Implementation)
1. Connect to actual autoencoder neural network (PyTorch/TensorFlow)
2. Implement real Isolation Forest (sklearn)
3. Update baseline statistics from training data
4. Add online learning to adapt to new patterns
5. Integrate with threat intelligence feeds
6. Add feature attribution using SHAP for zero-day explanations
