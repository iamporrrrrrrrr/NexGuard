"""
Train the anomaly detector autoencoder on embeddings of GREEN-tier proposals.

The autoencoder learns to reconstruct "normal" proposals.
Anomalous proposals will have high reconstruction error.

Input:  Embeddings of all GREEN proposals — fetched from ChromaDB at runtime
Output: models/anomaly_detector.pt        — trained autoencoder weights
        models/anomaly_threshold.json     — 95th-percentile reconstruction error
"""

import json
import os
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset
import chromadb

# Import the Autoencoder definition from anomaly.py
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from anomaly import Autoencoder, EMBEDDING_DIM

MODEL_PATH = "models/anomaly_detector.pt"
THRESHOLD_PATH = "models/anomaly_threshold.json"
CHROMA_COLLECTION = "proposals"

EPOCHS = 50
BATCH_SIZE = 32
LR = 1e-3


def fetch_green_embeddings() -> list[list[float]]:
    """
    TODO:
    1. Connect to ChromaDB (PersistentClient)
    2. Get the proposals collection
    3. Query all documents where metadata.tier == "GREEN"
    4. Return list of embedding vectors
    """
    raise NotImplementedError


def compute_threshold(model: nn.Module, embeddings: torch.Tensor) -> float:
    """
    TODO:
    1. Run all embeddings through autoencoder (no_grad)
    2. Compute per-sample MSE reconstruction error
    3. Return 95th percentile as the anomaly threshold
    """
    raise NotImplementedError


def train():
    """
    TODO:
    1. Fetch GREEN embeddings via fetch_green_embeddings()
    2. Convert to torch.Tensor
    3. Create TensorDataset + DataLoader
    4. Instantiate Autoencoder, MSELoss, Adam optimizer
    5. Training loop:
       - Forward pass → reconstruct
       - MSE loss between input and reconstruction
       - Backward + step
       - Print epoch loss
    6. Compute threshold via compute_threshold()
    7. Save model state dict to MODEL_PATH
    8. Save threshold as JSON to THRESHOLD_PATH
    """
    raise NotImplementedError


if __name__ == "__main__":
    os.makedirs("models", exist_ok=True)
    train()
