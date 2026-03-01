"""
Feature 1 — Blast Radius Classifier

Fine-tuned CodeBERT (microsoft/codebert-base) that predicts GREEN/YELLOW/RED
from a code diff + file paths. Replaces rules-based scorer when confidence > 0.8.

Saved model path: models/blast_radius_classifier/
"""

from pydantic import BaseModel
from typing import Literal


LABELS = ["GREEN", "YELLOW", "RED"]
MODEL_DIR = "models/blast_radius_classifier"


class ClassifierInput(BaseModel):
    diff: str
    files: list[str]


class ClassifierOutput(BaseModel):
    tier: Literal["GREEN", "YELLOW", "RED"]
    confidence: float
    all_scores: dict[str, float]  # {"GREEN": 0.x, "YELLOW": 0.x, "RED": 0.x}


def load_classifier() -> dict:
    """
    Load fine-tuned CodeBERT model and tokenizer from MODEL_DIR.

    TODO:
    1. from transformers import RobertaTokenizer, RobertaForSequenceClassification
    2. tokenizer = RobertaTokenizer.from_pretrained(MODEL_DIR)
    3. model = RobertaForSequenceClassification.from_pretrained(MODEL_DIR)
    4. model.eval()
    5. Return {"model": model, "tokenizer": tokenizer}
    """
    raise NotImplementedError


def predict_tier(state: dict, body: ClassifierInput) -> ClassifierOutput:
    """
    Run inference on a diff + file list.

    TODO:
    1. Build input text: join files as comma-separated prefix, then append diff
       e.g. "[FILES] orders.py, utils.py [DIFF] --- a/orders.py ..."
    2. Tokenize with truncation (max_length=512)
    3. Forward pass (torch.no_grad())
    4. Softmax logits → probabilities
    5. top class = argmax, confidence = max prob
    6. Return ClassifierOutput
    """
    raise NotImplementedError
