"""
Intrusion Detection System using Voting-Based Hybrid Neural Network
PyTorch Implementation

This script implements a complete IDS with MLP, CNN, and LSTM models
using ensemble voting for final prediction.
"""

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
import pandas as pd
import numpy as np
import argparse
import json
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix
import joblib
import time
from typing import Tuple, Dict
from pathlib import Path

# Set random seeds for reproducibility
torch.manual_seed(42)
np.random.seed(42)

# Device configuration
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
print(f"Using device: {device}")

# ============================================================================
# 1. DATASET CLASS
# ============================================================================

class IntrusionDataset(Dataset):
    """PyTorch Dataset for network intrusion data"""
    
    def __init__(self, X, y):
        self.X = torch.FloatTensor(X)
        self.y = torch.FloatTensor(y)
    
    def __len__(self):
        return len(self.X)
    
    def __getitem__(self, idx):
        return self.X[idx], self.y[idx]


# ============================================================================
# 2. MODEL ARCHITECTURES
# ============================================================================

class MLP(nn.Module):
    """Multi-Layer Perceptron for intrusion detection"""
    
    def __init__(self, input_dim):
        super(MLP, self).__init__()
        self.network = nn.Sequential(
            nn.Linear(input_dim, 64),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(64, 32),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(32, 1),
            nn.Sigmoid()
        )
    
    def forward(self, x):
        return self.network(x)


class CNN(nn.Module):
    """1D Convolutional Neural Network for intrusion detection"""
    
    def __init__(self, input_dim):
        super(CNN, self).__init__()
        self.conv_layer = nn.Sequential(
            nn.Conv1d(in_channels=1, out_channels=32, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool1d(kernel_size=2)
        )
        # Calculate flattened size
        self.flatten_size = (input_dim // 2) * 32
        self.fc = nn.Sequential(
            nn.Linear(self.flatten_size, 64),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(64, 1),
            nn.Sigmoid()
        )
    
    def forward(self, x):
        # Reshape for Conv1D: (batch_size, 1, input_dim)
        x = x.unsqueeze(1)
        x = self.conv_layer(x)
        x = x.view(x.size(0), -1)  # Flatten
        x = self.fc(x)
        return x


class LSTM(nn.Module):
    """Long Short-Term Memory network for intrusion detection"""
    
    def __init__(self, input_dim, hidden_size=64):
        super(LSTM, self).__init__()
        self.hidden_size = hidden_size
        self.lstm = nn.LSTM(input_dim, hidden_size, batch_first=True)
        self.fc = nn.Sequential(
            nn.Linear(hidden_size, 32),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(32, 1),
            nn.Sigmoid()
        )
    
    def forward(self, x):
        # Reshape for LSTM: (batch_size, sequence_length, features)
        # We'll use sequence_length = 1 for tabular data
        x = x.unsqueeze(1)
        lstm_out, _ = self.lstm(x)
        # Take the last output
        last_output = lstm_out[:, -1, :]
        output = self.fc(last_output)
        return output


# ============================================================================
# 3. ENSEMBLE VOTING CLASS
# ============================================================================

class VotingEnsemble:
    """Ensemble model using majority voting"""
    
    def __init__(self, mlp_model, cnn_model, lstm_model):
        self.mlp = mlp_model
        self.cnn = cnn_model
        self.lstm = lstm_model
        self.models = [self.mlp, self.cnn, self.lstm]
    
    def predict(self, X):
        """Make predictions using majority voting"""
        self.mlp.eval()
        self.cnn.eval()
        self.lstm.eval()
        
        with torch.no_grad():
            X = X.to(device)
            
            # Get predictions from each model
            mlp_probs = self.mlp(X).cpu().numpy()
            cnn_probs = self.cnn(X).cpu().numpy()
            lstm_probs = self.lstm(X).cpu().numpy()
            
            # Convert probabilities to binary predictions
            mlp_pred = (mlp_probs >= 0.5).astype(int)
            cnn_pred = (cnn_probs >= 0.5).astype(int)
            lstm_pred = (lstm_probs >= 0.5).astype(int)
            
            # Majority voting
            votes = mlp_pred + cnn_pred + lstm_pred
            final_predictions = (votes >= 2).astype(int)
            
            # Confidence score (average probability)
            avg_probs = (mlp_probs + cnn_probs + lstm_probs) / 3
            
            return final_predictions.flatten(), avg_probs.flatten(), {
                'mlp': mlp_probs.flatten(),
                'cnn': cnn_probs.flatten(),
                'lstm': lstm_probs.flatten()
            }


# ============================================================================
# 4. DATA PREPROCESSING
# ============================================================================

def create_sample_dataset(n_samples=10000):
    """Create a sample network intrusion dataset"""
    np.random.seed(42)
    
    # Generate synthetic features
    data = {
        'Duration': np.random.randint(0, 1000, n_samples),
        'Protocol': np.random.choice(['TCP', 'UDP', 'ICMP'], n_samples),
        'Service': np.random.choice(['HTTP', 'FTP', 'SSH', 'DNS'], n_samples),
        'Flag': np.random.choice(['SF', 'S0', 'REJ', 'RSTR'], n_samples),
        'Src_Bytes': np.random.randint(0, 10000, n_samples),
        'Dst_Bytes': np.random.randint(0, 10000, n_samples),
        'Count': np.random.randint(0, 500, n_samples),
        'Srv_Count': np.random.randint(0, 500, n_samples),
        'Serror_Rate': np.random.uniform(0, 1, n_samples),
        'Rerror_Rate': np.random.uniform(0, 1, n_samples),
        'Same_Srv_Rate': np.random.uniform(0, 1, n_samples),
        'Diff_Srv_Rate': np.random.uniform(0, 1, n_samples),
        # Irrelevant columns (will be dropped)
        'IP_Address': [f"192.168.1.{np.random.randint(1,255)}" for _ in range(n_samples)],
        'Timestamp': pd.date_range(start='2024-01-01', periods=n_samples, freq='s'),
        'Attack_Type': np.random.choice(['DoS', 'Probe', 'U2R', 'R2L', 'Normal'], n_samples)
    }
    
    df = pd.DataFrame(data)
    
    # Create label: 1 if Attack_Type != 'Normal', else 0
    df['Label'] = (df['Attack_Type'] != 'Normal').astype(int)
    
    return df


def generate_auto_dataset_csv(output_path: str, n_rows: int = 5000):
    """Generate and persist synthetic dataset as CSV for app use."""
    auto_df = create_sample_dataset(n_samples=n_rows)
    out_path = Path(output_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    auto_df.to_csv(out_path, index=False)
    print(f"Auto-generated dataset saved to '{out_path.as_posix()}' ({len(auto_df)} rows)")
    return auto_df, out_path.as_posix()


def load_dataset(dataset_path: str, fallback_samples: int = 10000):
    """Load dataset from CSV when available, else fallback to synthetic data."""
    csv_path = Path(dataset_path)
    if csv_path.exists():
        df = pd.read_csv(csv_path)

        if 'Label' not in df.columns:
            if 'Attack_Type' in df.columns:
                df['Label'] = (df['Attack_Type'].astype(str).str.lower() != 'normal').astype(int)
            else:
                raise ValueError(
                    f"Dataset '{dataset_path}' must include either 'Label' or 'Attack_Type' column."
                )
        else:
            df['Label'] = pd.to_numeric(df['Label'], errors='coerce').fillna(0)
            df['Label'] = (df['Label'] > 0).astype(int)

        return df, f"csv:{dataset_path}"

    print(f"Dataset not found at '{dataset_path}'. Falling back to synthetic dataset.")
    return create_sample_dataset(n_samples=fallback_samples), "synthetic"


def preprocess_data(df, preprocessor=None, is_training=True):
    """Preprocess the intrusion detection data"""
    
    # Drop irrelevant columns
    columns_to_drop = [
        'IP_Address',
        'Source_IP',
        'Destination_IP',
        'Timestamp',
        'Attack_Type',
    ]
    df_processed = df.drop(columns=[col for col in columns_to_drop if col in df.columns])
    
    # Separate features and target
    X = df_processed.drop(columns=['Label'], errors='ignore')
    if 'Label' in df_processed.columns:
        y = df_processed['Label'].values
    else:
        y = np.zeros(len(df_processed), dtype=int)
    
    # Identify numeric and categorical columns
    numeric_features = X.select_dtypes(include=['int64', 'float64']).columns.tolist()
    categorical_features = X.select_dtypes(include=['object']).columns.tolist()
    
    if is_training:
        # Create preprocessor
        preprocessor = ColumnTransformer(
            transformers=[
                ('num', StandardScaler(), numeric_features),
                ('cat', OneHotEncoder(drop='first', sparse_output=False, handle_unknown='ignore'), 
                 categorical_features)
            ])
        
        X_transformed = preprocessor.fit_transform(X)
        
        # Save preprocessor
        joblib.dump(preprocessor, 'preprocessor.pkl')
        print("Preprocessor saved to 'preprocessor.pkl'")
    else:
        X_transformed = preprocessor.transform(X)
    
    return X_transformed, y, preprocessor


# ============================================================================
# 5. TRAINING FUNCTION
# ============================================================================

def train_model(model, train_loader, criterion, optimizer, epochs=50, model_name="Model"):
    """Train a single model"""
    model.to(device)
    model.train()
    
    print(f"\nTraining {model_name}...")
    for epoch in range(epochs):
        total_loss = 0
        for batch_X, batch_y in train_loader:
            batch_X, batch_y = batch_X.to(device), batch_y.to(device)
            
            # Forward pass
            outputs = model(batch_X).squeeze()
            loss = criterion(outputs, batch_y)
            
            # Backward pass
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            
            total_loss += loss.item()
        
        if (epoch + 1) % 10 == 0:
            avg_loss = total_loss / len(train_loader)
            print(f"  Epoch [{epoch+1}/{epochs}], Loss: {avg_loss:.4f}")
    
    print(f"{model_name} training completed!")
    return model


# ============================================================================
# 6. EVALUATION FUNCTION
# ============================================================================

def evaluate_ensemble(ensemble, test_loader, y_test):
    """Evaluate the ensemble model"""
    all_predictions = []
    all_confidences = []
    
    for batch_X, _ in test_loader:
        predictions, confidences, _ = ensemble.predict(batch_X)
        all_predictions.extend(predictions)
        all_confidences.extend(confidences)
    
    all_predictions = np.array(all_predictions)
    
    # Calculate metrics
    accuracy = accuracy_score(y_test, all_predictions)
    precision = precision_score(y_test, all_predictions)
    recall = recall_score(y_test, all_predictions)
    f1 = f1_score(y_test, all_predictions)
    cm = confusion_matrix(y_test, all_predictions)
    
    print("\n" + "="*60)
    print("ENSEMBLE MODEL EVALUATION RESULTS")
    print("="*60)
    print(f"Accuracy:  {accuracy:.4f} ({accuracy*100:.2f}%)")
    print(f"Precision: {precision:.4f}")
    print(f"Recall:    {recall:.4f}")
    print(f"F1-Score:  {f1:.4f}")
    print("\nConfusion Matrix:")
    print(f"  TN: {cm[0][0]}  FP: {cm[0][1]}")
    print(f"  FN: {cm[1][0]}  TP: {cm[1][1]}")
    print("="*60)
    
    return {
        'accuracy': accuracy,
        'precision': precision,
        'recall': recall,
        'f1': f1,
        'confusion_matrix': cm
    }


def write_training_metrics(metrics: Dict, output_path: str, metadata: Dict):
    """Persist training metrics for React UI consumption."""
    payload = {
        'accuracy': float(metrics['accuracy']),
        'accuracy_percent': round(float(metrics['accuracy']) * 100, 2),
        'precision': float(metrics['precision']),
        'recall': float(metrics['recall']),
        'f1': float(metrics['f1']),
        'confusion_matrix': metrics['confusion_matrix'].tolist(),
        **metadata,
    }

    out_path = Path(output_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, indent=2), encoding='utf-8')
    print(f"Training metrics saved to '{out_path.as_posix()}'")


# ============================================================================
# 7. INFERENCE FUNCTION
# ============================================================================

def predict_intrusion(sample_data, ensemble, preprocessor):
    """Predict whether a network sample is an attack or normal"""
    
    # Preprocess the sample
    X_processed, _, _ = preprocess_data(sample_data, preprocessor, is_training=False)
    X_tensor = torch.FloatTensor(X_processed)
    
    # Make prediction
    start_time = time.time()
    predictions, confidences, individual_probs = ensemble.predict(X_tensor)
    inference_time = (time.time() - start_time) * 1000  # Convert to ms
    
    result = []
    for i, pred in enumerate(predictions):
        result.append({
            'prediction': 'ATTACK' if pred == 1 else 'NORMAL',
            'confidence': confidences[i],
            'mlp_probability': individual_probs['mlp'][i],
            'cnn_probability': individual_probs['cnn'][i],
            'lstm_probability': individual_probs['lstm'][i],
            'inference_time_ms': inference_time / len(predictions)
        })
    
    return result


# ============================================================================
# 8. MAIN TRAINING PIPELINE
# ============================================================================

def main(
    dataset_path: str = 'dist/datasets/cyberfeddefender_dataset.csv',
    epochs: int = 50,
    metrics_output_path: str = 'public/pytorch-training-metrics.json',
    fallback_samples: int = 10000,
    auto_generated_rows: int = 5000,
    auto_dataset_csv_path: str = 'public/datasets/auto_generated_dataset.csv',
):
    # Configuration
    BATCH_SIZE = 32
    EPOCHS = epochs
    LEARNING_RATE = 0.001
    
    print("="*60)
    print("INTRUSION DETECTION SYSTEM - VOTING-BASED NEURAL NETWORK")
    print("="*60)
    
    # 1. Create/Load Dataset
    print("\n[1/8] Loading dataset...")
    df, dataset_source = load_dataset(dataset_path, fallback_samples=fallback_samples)
    print(f"Dataset shape: {df.shape}")
    print(f"Dataset source: {dataset_source}")
    print(f"Attack samples: {int(df['Label'].sum())}, Normal samples: {int((1-df['Label']).sum())}")

    # 1b. Generate additional auto dataset as CSV (5000 rows by default)
    auto_df, auto_dataset_output = generate_auto_dataset_csv(
        output_path=auto_dataset_csv_path,
        n_rows=auto_generated_rows,
    )
    
    # 2. Preprocess Data
    print("\n[2/8] Preprocessing data...")
    X, y, preprocessor = preprocess_data(df, is_training=True)
    input_dim = X.shape[1]
    print(f"Input dimension after preprocessing: {input_dim}")
    
    # 3. Split Data
    print("\n[3/8] Splitting data...")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    print(f"Training samples: {len(X_train)}, Test samples: {len(X_test)}")
    
    # 4. Create DataLoaders
    print("\n[4/8] Creating data loaders...")
    train_dataset = IntrusionDataset(X_train, y_train)
    test_dataset = IntrusionDataset(X_test, y_test)
    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True)
    test_loader = DataLoader(test_dataset, batch_size=BATCH_SIZE, shuffle=False)
    
    # 5. Initialize Models
    print("\n[5/8] Initializing models...")
    mlp_model = MLP(input_dim)
    cnn_model = CNN(input_dim)
    lstm_model = LSTM(input_dim)
    
    # Loss and optimizers
    criterion = nn.BCELoss()
    mlp_optimizer = optim.Adam(mlp_model.parameters(), lr=LEARNING_RATE)
    cnn_optimizer = optim.Adam(cnn_model.parameters(), lr=LEARNING_RATE)
    lstm_optimizer = optim.Adam(lstm_model.parameters(), lr=LEARNING_RATE)
    
    # 6. Train Models
    print("\n[6/8] Training models...")
    mlp_model = train_model(mlp_model, train_loader, criterion, mlp_optimizer, 
                            epochs=EPOCHS, model_name="MLP")
    cnn_model = train_model(cnn_model, train_loader, criterion, cnn_optimizer, 
                            epochs=EPOCHS, model_name="CNN")
    lstm_model = train_model(lstm_model, train_loader, criterion, lstm_optimizer, 
                             epochs=EPOCHS, model_name="LSTM")
    
    # 7. Create Ensemble
    print("\n[7/8] Creating ensemble...")
    ensemble = VotingEnsemble(mlp_model, cnn_model, lstm_model)
    
    # 8. Evaluate
    print("\n[8/8] Evaluating ensemble...")
    metrics = evaluate_ensemble(ensemble, test_loader, y_test)

    training_metadata = {
        'dataset_rows': int(len(df)),
        'auto_generated_rows': int(len(auto_df)),
        'total_dataset_rows': int(len(df) + len(auto_df)),
        'train_rows': int(len(X_train)),
        'test_rows': int(len(X_test)),
        'dataset_source': dataset_source,
        'auto_dataset_csv': auto_dataset_output,
        'epochs': int(EPOCHS),
        'trained_at': pd.Timestamp.utcnow().isoformat(),
    }
    write_training_metrics(metrics, metrics_output_path, training_metadata)
    
    # 9. Save Models
    print("\nSaving models...")
    torch.save({
        'mlp_state_dict': mlp_model.state_dict(),
        'cnn_state_dict': cnn_model.state_dict(),
        'lstm_state_dict': lstm_model.state_dict(),
        'input_dim': input_dim,
        'metrics': metrics
    }, 'cyber_defense_torch_parts.pth')
    print("Models saved to 'cyber_defense_torch_parts.pth'")
    
    # 10. Example Prediction
    print("\n" + "="*60)
    print("EXAMPLE PREDICTION")
    print("="*60)
    try:
        # Use one row from the loaded dataset to keep schema aligned.
        test_sample = df.head(1).copy()
        if 'Label' in test_sample.columns:
            test_sample = test_sample.drop(columns=['Label'])
        results = predict_intrusion(test_sample, ensemble, preprocessor)

        for i, result in enumerate(results):
            print(f"\nSample {i+1}:")
            print(f"  Final Prediction: {result['prediction']}")
            print(f"  Confidence: {result['confidence']*100:.2f}%")
            print(f"  MLP Probability: {result['mlp_probability']:.4f}")
            print(f"  CNN Probability: {result['cnn_probability']:.4f}")
            print(f"  LSTM Probability: {result['lstm_probability']:.4f}")
            print(f"  Inference Time: {result['inference_time_ms']:.2f}ms")
    except Exception as exc:
        print(f"Example prediction skipped due to schema mismatch: {exc}")
    
    print("\n" + "="*60)
    print("TRAINING COMPLETE!")
    print("="*60)
    print("\nSaved files:")
    print("  - cyber_defense_torch_parts.pth (PyTorch models)")
    print("  - preprocessor.pkl (Data preprocessor)")
    print(f"  - {metrics_output_path} (React training metrics)")
    

# ============================================================================
# 9. LOAD AND INFERENCE EXAMPLE
# ============================================================================

def load_and_predict():
    """Example of loading saved models and making predictions"""
    
    print("\n" + "="*60)
    print("LOADING SAVED MODELS FOR INFERENCE")
    print("="*60)
    
    # Load preprocessor
    preprocessor = joblib.load('preprocessor.pkl')
    print("Preprocessor loaded")
    
    # Load model checkpoint
    checkpoint = torch.load('cyber_defense_torch_parts.pth', map_location=device)
    input_dim = checkpoint['input_dim']
    
    # Initialize models
    mlp_model = MLP(input_dim)
    cnn_model = CNN(input_dim)
    lstm_model = LSTM(input_dim)
    
    # Load state dicts
    mlp_model.load_state_dict(checkpoint['mlp_state_dict'])
    cnn_model.load_state_dict(checkpoint['cnn_state_dict'])
    lstm_model.load_state_dict(checkpoint['lstm_state_dict'])
    
    mlp_model.to(device)
    cnn_model.to(device)
    lstm_model.to(device)
    
    print("Models loaded successfully")
    
    # Create ensemble
    ensemble = VotingEnsemble(mlp_model, cnn_model, lstm_model)
    
    # Test prediction
    test_sample = pd.DataFrame({
        'Duration': [200],
        'Protocol': ['UDP'],
        'Service': ['DNS'],
        'Flag': ['S0'],
        'Src_Bytes': [100],
        'Dst_Bytes': [50],
        'Count': [5],
        'Srv_Count': [3],
        'Serror_Rate': [0.1],
        'Rerror_Rate': [0.0],
        'Same_Srv_Rate': [0.5],
        'Diff_Srv_Rate': [0.2],
        'IP_Address': ['10.0.0.50'],
        'Timestamp': [pd.Timestamp.now()],
        'Attack_Type': ['Unknown']
    })
    
    results = predict_intrusion(test_sample, ensemble, preprocessor)
    
    print("\nPrediction Result:")
    print(f"  Status: {results[0]['prediction']}")
    print(f"  Confidence: {results[0]['confidence']*100:.2f}%")
    print("="*60)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Train voting-based PyTorch intrusion model and export metrics for React UI.",
    )
    parser.add_argument(
        '--dataset-path',
        default='dist/datasets/cyberfeddefender_dataset.csv',
        help="Path to CSV dataset file.",
    )
    parser.add_argument(
        '--epochs',
        type=int,
        default=8,
        help="Training epochs for each model (MLP/CNN/LSTM).",
    )
    parser.add_argument(
        '--metrics-out',
        default='public/pytorch-training-metrics.json',
        help="Output JSON path for frontend metrics.",
    )
    parser.add_argument(
        '--fallback-samples',
        type=int,
        default=10000,
        help="Synthetic sample size when CSV dataset path is missing.",
    )
    parser.add_argument(
        '--auto-generated-rows',
        type=int,
        default=5000,
        help="Rows to generate for auto-generated CSV dataset.",
    )
    parser.add_argument(
        '--auto-dataset-csv',
        default='public/datasets/auto_generated_dataset.csv',
        help="Output CSV path for auto-generated dataset.",
    )
    args = parser.parse_args()

    # Run main training pipeline
    main(
        dataset_path=args.dataset_path,
        epochs=args.epochs,
        metrics_output_path=args.metrics_out,
        fallback_samples=args.fallback_samples,
        auto_generated_rows=args.auto_generated_rows,
        auto_dataset_csv_path=args.auto_dataset_csv,
    )
    
    
