"""
Feature 1 — Blast Radius Classifier

Fine-tuned GraphCodeBERT (microsoft/graphcodebert-base) that predicts GREEN/YELLOW/RED
from a code diff + file paths. Replaces rules-based scorer when confidence > 0.8.

Upgrade from codebert-base: GraphCodeBERT understands data flow between variables,
giving it better representations of blast radius (what a change propagates to).

Diff preprocessing: +/- lines are replaced with [ADD]/[DEL] tokens so the model
can distinguish added vs removed code (GraphCodeBERT was not trained on raw diff format).

Saved model path: models/blast_radius_classifier/
"""

import torch
from transformers import RobertaTokenizer, RobertaForSequenceClassification
from pydantic import BaseModel
from typing import Literal

LABELS = ["GREEN", "YELLOW", "RED"]
MODEL_DIR = "models/blast_radius_classifier"
MAX_LENGTH = 512


class ClassifierInput(BaseModel):
    diff: str
    files: list[str]


class ClassifierOutput(BaseModel):
    tier: Literal["GREEN", "YELLOW", "RED"]
    confidence: float
    all_scores: dict[str, float]


def _preprocess_diff(diff: str) -> str:
    """Convert unified diff +/- lines to [ADD]/[DEL] tokens.

    Raw diff format (+/-) is out-of-distribution for GraphCodeBERT.
    Replacing with explicit tokens makes the structure legible to the model.
    Skips +++ and --- header lines to avoid corrupting file path context.
    """
    return "\n".join(
        "[ADD] " + line[1:] if line.startswith("+") and not line.startswith("+++") else
        "[DEL] " + line[1:] if line.startswith("-") and not line.startswith("---") else
        line
        for line in diff.split("\n")
    )


def load_classifier() -> dict:
    """Load fine-tuned GraphCodeBERT from MODEL_DIR."""
    tokenizer = RobertaTokenizer.from_pretrained(MODEL_DIR)
    model = RobertaForSequenceClassification.from_pretrained(MODEL_DIR)
    model.eval()
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model.to(device)
    return {"model": model, "tokenizer": tokenizer, "device": device}


def predict_tier(state: dict, body: ClassifierInput) -> ClassifierOutput:
    """Run inference on diff + file list."""
    model = state["model"]
    tokenizer = state["tokenizer"]
    device = state["device"]

    files_str = ", ".join(body.files) if body.files else "unknown"
    processed_diff = _preprocess_diff(body.diff)
    text = f"[FILES] {files_str} [DIFF] {processed_diff}"

    inputs = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        max_length=MAX_LENGTH,
        padding=True,
    )
    inputs = {k: v.to(device) for k, v in inputs.items()}

    with torch.no_grad():
        outputs = model(**inputs)

    probs = torch.softmax(outputs.logits, dim=-1)[0].cpu()
    top_idx = int(probs.argmax().item())

    return ClassifierOutput(
        tier=LABELS[top_idx],
        confidence=float(probs[top_idx].item()),
        all_scores={label: float(probs[i].item()) for i, label in enumerate(LABELS)},
    )
