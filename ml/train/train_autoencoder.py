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
    """Fetch embeddings of all GREEN-tier proposals from ChromaDB."""
    client = chromadb.HttpClient(
        host=os.environ.get("CHROMA_HOST", "localhost"),
        port=int(os.environ.get("CHROMA_PORT", "8002")),
    )
    try:
        collection = client.get_collection(CHROMA_COLLECTION)
    except Exception:
        print(f"Collection '{CHROMA_COLLECTION}' not found. Run the intake pipeline first to populate proposals.")
        return []

    results = collection.get(where={"tier": "GREEN"}, include=["embeddings"])
    embeddings = results.get("embeddings") or []
    print(f"Fetched {len(embeddings)} GREEN embeddings from ChromaDB")
    return embeddings


def compute_threshold(model: nn.Module, embeddings: torch.Tensor) -> float:
    """Compute 95th-percentile reconstruction error as the anomaly threshold."""
    model.eval()
    errors = []
    with torch.no_grad():
        for i in range(0, len(embeddings), BATCH_SIZE):
            batch = embeddings[i : i + BATCH_SIZE]
            reconstructed = model(batch)
            mse = nn.functional.mse_loss(reconstructed, batch, reduction="none").mean(dim=1)
            errors.extend(mse.tolist())

    errors.sort()
    threshold = errors[int(len(errors) * 0.95)]
    print(f"95th-percentile reconstruction error (threshold): {threshold:.6f}")
    return threshold


def train():
    embeddings_raw = fetch_green_embeddings()
    if len(embeddings_raw) < 10:
        print(f"Only {len(embeddings_raw)} GREEN embeddings found — need at least 10. Exiting.")
        return

    embeddings = torch.tensor(embeddings_raw, dtype=torch.float32)
    dataset = TensorDataset(embeddings)
    loader = DataLoader(dataset, batch_size=BATCH_SIZE, shuffle=True)

    model = Autoencoder(EMBEDDING_DIM)
    criterion = nn.MSELoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=LR)

    print(f"Training autoencoder on {len(embeddings)} samples for {EPOCHS} epochs...")
    for epoch in range(EPOCHS):
        model.train()
        total_loss = 0.0
        for (batch,) in loader:
            reconstructed = model(batch)
            loss = criterion(reconstructed, batch)
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            total_loss += loss.item()

        if (epoch + 1) % 10 == 0 or epoch == 0:
            print(f"Epoch {epoch + 1}/{EPOCHS} | loss={total_loss / len(loader):.6f}")

    threshold = compute_threshold(model, embeddings)

    torch.save(model.state_dict(), MODEL_PATH)
    with open(THRESHOLD_PATH, "w") as f:
        json.dump({"threshold": threshold}, f)

    print(f"\n✓ Autoencoder saved to {MODEL_PATH}")
    print(f"✓ Threshold ({threshold:.6f}) saved to {THRESHOLD_PATH}")


if __name__ == "__main__":
    os.makedirs("models", exist_ok=True)
    train()
