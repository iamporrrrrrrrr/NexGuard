"""
Fine-tune CodeBERT (microsoft/codebert-base) on synthetic blast radius labels.

Input:  train/data/diffs.jsonl  — {"diff": str, "files": [str], "label": GREEN|YELLOW|RED}
Output: models/blast_radius_classifier/  — HuggingFace model + tokenizer

Split: 80% train / 10% val / 10% test
"""

import json
import os
import torch
from torch.utils.data import Dataset, DataLoader
from transformers import RobertaTokenizer, RobertaForSequenceClassification
from sklearn.model_selection import train_test_split

LABELS = {"GREEN": 0, "YELLOW": 1, "RED": 2}
MODEL_NAME = "microsoft/codebert-base"
MODEL_OUTPUT_DIR = "models/blast_radius_classifier"
DATA_PATH = "train/data/diffs.jsonl"

EPOCHS = 3
BATCH_SIZE = 8
LR = 2e-5
MAX_LENGTH = 512


class DiffDataset(Dataset):
    """
    TODO:
    1. Load JSONL rows
    2. Build input text: "[FILES] <files> [DIFF] <diff>" (truncated)
    3. Tokenize with RobertaTokenizer
    4. Map label strings to int via LABELS dict
    """

    def __init__(self, rows: list[dict], tokenizer):
        # TODO: implement
        raise NotImplementedError

    def __len__(self):
        raise NotImplementedError

    def __getitem__(self, idx):
        raise NotImplementedError


def load_data() -> list[dict]:
    with open(DATA_PATH) as f:
        return [json.loads(line) for line in f if line.strip()]


def train():
    """
    TODO:
    1. Load data, split 80/10/10
    2. Instantiate tokenizer and RobertaForSequenceClassification(num_labels=3)
    3. Create DataLoaders for train/val
    4. Training loop:
       - AdamW optimizer, linear warmup scheduler
       - Forward pass → cross-entropy loss
       - Backward + optimizer step
       - Eval on val set each epoch (accuracy + loss)
    5. Save best model (lowest val loss) to MODEL_OUTPUT_DIR
    6. Run final eval on test set, print accuracy per class
    """
    raise NotImplementedError


if __name__ == "__main__":
    train()
