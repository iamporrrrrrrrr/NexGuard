"""
Feature 2 — Anomaly Detector

Autoencoder trained on embeddings of normal (GREEN) proposals.
Uses text-embedding-3-small (1536-dim) as input.
Flags proposals with reconstruction error above the 95th-percentile threshold.

Saved model path: models/anomaly_detector.pt
Threshold stored alongside model as models/anomaly_threshold.json
"""

import json
import torch
import torch.nn as nn
from pydantic import BaseModel
from openai import OpenAI

EMBEDDING_DIM = 1536
MODEL_PATH = "models/anomaly_detector.pt"
THRESHOLD_PATH = "models/anomaly_threshold.json"

client = OpenAI()


class ProposalText(BaseModel):
    summary: str
    diff: str
    files_to_modify: list[str]


class AnomalyInput(BaseModel):
    proposal: ProposalText


class AnomalyOutput(BaseModel):
    is_anomaly: bool
    reconstruction_error: float
    anomaly_score: float   # normalized: 0–3+, above 1.0 = anomaly
    threshold: float


class Autoencoder(nn.Module):
    """
    Simple symmetric autoencoder: 1536 → 512 → 128 → 512 → 1536.

    TODO: tune hidden dims if needed after training experiments.
    """

    def __init__(self, input_dim: int = EMBEDDING_DIM):
        super().__init__()
        self.encoder = nn.Sequential(
            nn.Linear(input_dim, 512),
            nn.ReLU(),
            nn.Linear(512, 128),
            nn.ReLU(),
        )
        self.decoder = nn.Sequential(
            nn.Linear(128, 512),
            nn.ReLU(),
            nn.Linear(512, input_dim),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.decoder(self.encoder(x))


def load_autoencoder() -> dict | None:
    """Load trained autoencoder weights and threshold from disk. Returns None if not trained yet."""
    import os
    if not os.path.exists(MODEL_PATH) or not os.path.exists(THRESHOLD_PATH):
        return None
    model = Autoencoder()
    model.load_state_dict(torch.load(MODEL_PATH, map_location="cpu"))
    model.eval()
    with open(THRESHOLD_PATH) as f:
        threshold = float(json.load(f)["threshold"])
    return {"model": model, "threshold": threshold}


def _embed_proposal(proposal: ProposalText) -> list[float]:
    """Embed proposal text using text-embedding-3-small."""
    text = (
        f"{proposal.summary}\n"
        f"Files: {', '.join(proposal.files_to_modify)}\n"
        f"{proposal.diff[:2000]}"
    )
    response = client.embeddings.create(model="text-embedding-3-small", input=text)
    return response.data[0].embedding


def detect_anomaly(state: dict, body: AnomalyInput) -> AnomalyOutput:
    """Score reconstruction error against the trained threshold."""
    embedding = _embed_proposal(body.proposal)
    tensor = torch.tensor(embedding, dtype=torch.float32).unsqueeze(0)

    model = state["model"]
    threshold = state["threshold"]

    with torch.no_grad():
        reconstructed = model(tensor)

    error = float(nn.functional.mse_loss(reconstructed, tensor).item())
    score = error / threshold if threshold > 0 else 0.0

    return AnomalyOutput(
        is_anomaly=error > threshold,
        reconstruction_error=error,
        anomaly_score=score,
        threshold=threshold,
    )
