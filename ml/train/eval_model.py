"""Quick eval of the saved blast radius classifier on the held-out test set."""
import json
import torch
from collections import Counter
from sklearn.model_selection import train_test_split
from transformers import RobertaTokenizer, RobertaForSequenceClassification
from torch.utils.data import Dataset, DataLoader

LABELS = {"GREEN": 0, "YELLOW": 1, "RED": 2}
LABEL_NAMES = ["GREEN", "YELLOW", "RED"]
MODEL_DIR = "models/blast_radius_classifier"
DATA_PATH = "train/data/diffs.jsonl"
MAX_LENGTH = 512
BATCH_SIZE = 8


class DiffDataset(Dataset):
    def __init__(self, rows, tokenizer):
        self.encodings, self.label_ids = [], []
        for row in rows:
            files_str = ", ".join(row["files"]) if row.get("files") else "unknown"
            processed_diff = "\n".join(
                "[ADD] " + line[1:] if line.startswith("+") and not line.startswith("+++") else
                "[DEL] " + line[1:] if line.startswith("-") and not line.startswith("---") else line
                for line in row["diff"].split("\n")
            )
            text = f"[FILES] {files_str} [DIFF] {processed_diff}"
            enc = tokenizer(text, truncation=True, max_length=MAX_LENGTH, padding="max_length", return_tensors="pt")
            self.encodings.append({k: v.squeeze(0) for k, v in enc.items()})
            self.label_ids.append(LABELS[row["label"]])

    def __len__(self):
        return len(self.label_ids)

    def __getitem__(self, idx):
        item = dict(self.encodings[idx])
        item["labels"] = torch.tensor(self.label_ids[idx])
        return item


def main():
    with open(DATA_PATH) as f:
        data = [json.loads(l) for l in f if l.strip()]

    counts = Counter(d["label"] for d in data)
    print(f"Total samples: {len(data)}")
    print(f"Distribution: GREEN={counts['GREEN']}  YELLOW={counts['YELLOW']}  RED={counts['RED']}")

    _, test_data = train_test_split(
        data, test_size=0.1, random_state=42, stratify=[d["label"] for d in data]
    )
    print(f"Test set: {len(test_data)} samples\n")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")

    tokenizer = RobertaTokenizer.from_pretrained(MODEL_DIR)
    model = RobertaForSequenceClassification.from_pretrained(MODEL_DIR).to(device)
    model.eval()

    loader = DataLoader(DiffDataset(test_data, tokenizer), batch_size=BATCH_SIZE)
    per_class = {l: {"correct": 0, "total": 0} for l in LABEL_NAMES}
    all_correct, all_total = 0, 0

    with torch.no_grad():
        for batch in loader:
            labels = batch.pop("labels").to(device)
            batch = {k: v.to(device) for k, v in batch.items()}
            preds = model(**batch).logits.argmax(dim=-1)
            for pred, true in zip(preds, labels):
                name = LABEL_NAMES[true.item()]
                per_class[name]["total"] += 1
                if pred.item() == true.item():
                    per_class[name]["correct"] += 1
                    all_correct += 1
            all_total += len(labels)

    print(f"\nOverall accuracy: {all_correct}/{all_total} = {all_correct / all_total:.3f}")
    print("\nPer-class accuracy:")
    for label, s in per_class.items():
        acc = s["correct"] / s["total"] if s["total"] else 0
        bar = "█" * int(acc * 20)
        print(f"  {label:6s}: {s['correct']:3d}/{s['total']:3d} = {acc:.3f}  {bar}")


if __name__ == "__main__":
    main()
