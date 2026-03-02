"""
Fine-tune CodeBERT (microsoft/codebert-base) on synthetic blast radius labels.

Input:  train/data/diffs.jsonl  — {"diff": str, "files": [str], "label": GREEN|YELLOW|RED}
Output: models/blast_radius_classifier/  — HuggingFace model + tokenizer

Split: 80% train / 10% val / 10% test
"""

import json
import os
from collections import Counter
import torch
from torch.utils.data import Dataset, DataLoader
from transformers import RobertaTokenizer, RobertaForSequenceClassification, get_linear_schedule_with_warmup
from sklearn.model_selection import train_test_split

LABELS = {"GREEN": 0, "YELLOW": 1, "RED": 2}
MODEL_NAME = "microsoft/graphcodebert-base"
MODEL_OUTPUT_DIR = "models/blast_radius_classifier"
DATA_PATH = "train/data/diffs.jsonl"

EPOCHS = 10
BATCH_SIZE = 4
LR = 2e-5
MAX_LENGTH = 512


class DiffDataset(Dataset):
    def __init__(self, rows: list[dict], tokenizer):
        self.encodings = []
        self.label_ids = []

        for row in rows:
            files_str = ", ".join(row["files"]) if row.get("files") else "unknown"
            processed_diff = "\n".join(
                "[ADD] " + line[1:] if line.startswith("+") and not line.startswith("+++") else
                "[DEL] " + line[1:] if line.startswith("-") and not line.startswith("---") else
                line
                for line in row["diff"].split("\n")
            )
            text = f"[FILES] {files_str} [DIFF] {processed_diff}"
            enc = tokenizer(
                text,
                truncation=True,
                max_length=MAX_LENGTH,
                padding="max_length",
                return_tensors="pt",
            )
            self.encodings.append({k: v.squeeze(0) for k, v in enc.items()})
            self.label_ids.append(LABELS[row["label"]])

    def __len__(self):
        return len(self.label_ids)

    def __getitem__(self, idx):
        item = {k: v for k, v in self.encodings[idx].items()}
        item["labels"] = torch.tensor(self.label_ids[idx])
        return item


def load_data() -> list[dict]:
    with open(DATA_PATH) as f:
        return [json.loads(line) for line in f if line.strip()]


def train():
    data = load_data()
    print(f"Loaded {len(data)} samples from {DATA_PATH}")

    train_val, test_data = train_test_split(data, test_size=0.1, random_state=42, stratify=[d["label"] for d in data])
    train_data, val_data = train_test_split(train_val, test_size=0.111, random_state=42, stratify=[d["label"] for d in train_val])
    print(f"Split -> train={len(train_data)}, val={len(val_data)}, test={len(test_data)}")

    tokenizer = RobertaTokenizer.from_pretrained(MODEL_NAME)
    model = RobertaForSequenceClassification.from_pretrained(MODEL_NAME, num_labels=3)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model.to(device)
    print(f"Using device: {device}")

    # Class-weighted loss — inverse frequency so minority classes get more weight
    label_counts = Counter(d["label"] for d in train_data)
    total_train = len(train_data)
    class_weights = torch.tensor([
        total_train / (3 * label_counts["GREEN"]),
        total_train / (3 * label_counts["YELLOW"]),
        total_train / (3 * label_counts["RED"]),
    ], dtype=torch.float).to(device)
    loss_fn = torch.nn.CrossEntropyLoss(weight=class_weights)
    print(f"Class weights — GREEN: {class_weights[0]:.3f}, YELLOW: {class_weights[1]:.3f}, RED: {class_weights[2]:.3f}")

    train_loader = DataLoader(DiffDataset(train_data, tokenizer), batch_size=BATCH_SIZE, shuffle=True)
    val_loader = DataLoader(DiffDataset(val_data, tokenizer), batch_size=BATCH_SIZE)
    test_loader = DataLoader(DiffDataset(test_data, tokenizer), batch_size=BATCH_SIZE)

    optimizer = torch.optim.AdamW(model.parameters(), lr=LR, weight_decay=0.01)
    total_steps = len(train_loader) * EPOCHS
    scheduler = get_linear_schedule_with_warmup(
        optimizer,
        num_warmup_steps=total_steps // 10,
        num_training_steps=total_steps,
    )

    best_val_loss = float("inf")

    for epoch in range(EPOCHS):
        # --- Train ---
        model.train()
        total_loss = 0.0
        for batch in train_loader:
            batch = {k: v.to(device) for k, v in batch.items()}
            labels = batch.pop("labels")
            outputs = model(**batch)
            loss = loss_fn(outputs.logits, labels)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            scheduler.step()
            optimizer.zero_grad()
            total_loss += loss.item()

        # --- Validate ---
        model.eval()
        val_loss, correct, total = 0.0, 0, 0
        with torch.no_grad():
            for batch in val_loader:
                batch = {k: v.to(device) for k, v in batch.items()}
                labels = batch.pop("labels")
                outputs = model(**batch)
                val_loss += loss_fn(outputs.logits, labels).item()
                preds = outputs.logits.argmax(dim=-1)
                correct += (preds == labels).sum().item()
                total += len(labels)

        avg_train = total_loss / len(train_loader)
        avg_val = val_loss / len(val_loader)
        acc = correct / total if total > 0 else 0
        print(f"Epoch {epoch + 1}/{EPOCHS} | train_loss={avg_train:.4f} | val_loss={avg_val:.4f} | val_acc={acc:.3f}")

        if avg_val < best_val_loss:
            best_val_loss = avg_val
            os.makedirs(MODEL_OUTPUT_DIR, exist_ok=True)
            model.save_pretrained(MODEL_OUTPUT_DIR)
            tokenizer.save_pretrained(MODEL_OUTPUT_DIR)
            print(f"  Saved best model (val_loss={best_val_loss:.4f})")

    # --- Test ---
    label_names = ["GREEN", "YELLOW", "RED"]
    best_model = RobertaForSequenceClassification.from_pretrained(MODEL_OUTPUT_DIR).to(device)
    best_model.eval()
    per_class: dict[str, dict] = {l: {"correct": 0, "total": 0} for l in label_names}

    with torch.no_grad():
        for batch in test_loader:
            batch = {k: v.to(device) for k, v in batch.items()}
            labels = batch.pop("labels")
            outputs = best_model(**batch)
            preds = outputs.logits.argmax(dim=-1)
            for pred, true in zip(preds, labels):
                name = label_names[true.item()]
                per_class[name]["total"] += 1
                if pred.item() == true.item():
                    per_class[name]["correct"] += 1

    print("\nTest Results:")
    for label, stats in per_class.items():
        acc = stats["correct"] / stats["total"] if stats["total"] > 0 else 0
        print(f"  {label}: {stats['correct']}/{stats['total']} = {acc:.3f}")


if __name__ == "__main__":
    train()
