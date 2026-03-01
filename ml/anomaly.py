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


def load_autoencoder() -> dict:
    """
    Load trained autoencoder weights and threshold from disk.

    TODO:
    1. Instantiate Autoencoder()
    2. Load state dict from MODEL_PATH
    3. model.eval()
    4. Load threshold float from THRESHOLD_PATH
    5. Return {"model": model, "threshold": threshold}
    """
    raise NotImplementedError


def _embed_proposal(proposal: ProposalText) -> list[float]:
    """
    Embed proposal text using text-embedding-3-small.

    TODO:
    1. Concatenate summary + file list + first 2000 chars of diff
    2. Call client.embeddings.create(model="text-embedding-3-small", input=text)
    3. Return embedding vector (list of 1536 floats)
    """
    raise NotImplementedError


def detect_anomaly(state: dict, body: AnomalyInput) -> AnomalyOutput:
    """
    TODO:
    1. Embed the proposal via _embed_proposal
    2. Convert to torch.Tensor, forward pass through autoencoder
    3. Compute MSE reconstruction error
    4. anomaly_score = reconstruction_error / threshold
    5. is_anomaly = reconstruction_error > threshold
    6. Return AnomalyOutput
    """
    raise NotImplementedError
