"""
Train the anomaly detector autoencoder using GPT-4o-generated GREEN-tier proposals.

Step 1: Use GPT-4o to generate 1000 realistic GREEN-tier code diffs (cached).
Step 2: Embed them via OpenAI text-embedding-3-small (1536-dim).
Step 3: Split 80/20 into train/test sets.
Step 4: Train the autoencoder, reporting per-epoch loss + accuracy on both sets.
Step 5: Generate RED-tier anomalous samples & measure detection accuracy.
Step 6: Save model + threshold.

Usage:
    cd ml
    python train/train_autoencoder_synthetic.py

Output:
    models/anomaly_detector.pt                — trained autoencoder weights
    models/anomaly_threshold.json             — 95th-percentile reconstruction error threshold
    train/data/green_diffs_generated.jsonl    — GPT-4o generated GREEN diffs (cached)
    train/data/red_diffs_generated.jsonl      — GPT-4o generated RED diffs for testing
"""

import json
import os
import sys
import time

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset
from openai import OpenAI

# Import the Autoencoder definition from anomaly.py
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from anomaly import Autoencoder, EMBEDDING_DIM

MODEL_PATH = "models/anomaly_detector.pt"
THRESHOLD_PATH = "models/anomaly_threshold.json"
EMBEDDINGS_CACHE = "train/data/green_embeddings_1k.pt"
RED_EMBEDDINGS_CACHE = "train/data/red_embeddings.pt"
GENERATED_DIFFS_PATH = "train/data/green_diffs_generated.jsonl"
RED_DIFFS_PATH = "train/data/red_diffs_generated.jsonl"
EXISTING_DIFFS_PATH = "train/data/diffs.jsonl"

EPOCHS = 50
BATCH_SIZE = 32
LR = 1e-3
TRAIN_SPLIT = 0.8
TARGET_GREEN_SAMPLES = 1000
TARGET_RED_SAMPLES = 100   # for detection-accuracy test
SAMPLES_PER_BATCH = 20     # GPT-4o generates 20 per call

client = OpenAI()


# ---------------------------------------------------------------------------
# Step 1: Generate or load GREEN / RED tier sample diffs via GPT-4o
# ---------------------------------------------------------------------------

GREEN_SYSTEM_PROMPT = """You are a code diff generator for an ML training dataset.
Generate realistic unified diffs (--- a/... +++ b/... format) that represent
safe, low-risk code changes (GREEN tier).

Return a JSON object with a "diffs" key containing an array of objects:
{"diffs": [{"summary": "...", "diff": "...", "files": ["..."]}]}

GREEN-tier means: documentation, docstrings, comments, tests, type hints,
linting fixes, formatting, minor renames, config tweaks, README updates,
accessibility improvements, dead code removal. Nothing that touches business
logic, auth, payments, migrations, or infrastructure.

Make diffs varied: different languages (Python, TypeScript, Java, Go, Rust, C#,
Ruby, Kotlin, Swift, PHP), different lengths (5-80 lines), different scenarios.
Each diff MUST be unique — vary file names, function names, class names, etc.
Be realistic and diverse."""

RED_SYSTEM_PROMPT = """You are a code diff generator for an ML training dataset.
Generate realistic unified diffs (--- a/... +++ b/... format) that represent
DANGEROUS, high-risk code changes (RED tier).

Return a JSON object with a "diffs" key containing an array of objects:
{"diffs": [{"summary": "...", "diff": "...", "files": ["..."]}]}

RED-tier means: database schema drops, auth removal, payment logic changes,
infrastructure config changes, secret key exposure, disabling security middleware,
removing rate limiters, deleting encryption, modifying CI/CD pipelines to skip
tests, mass file deletions, privilege escalation, disabling logging/audit trails.

Make diffs varied and realistic. Each diff MUST be unique."""

GREEN_PROMPTS = [
    f"Generate {SAMPLES_PER_BATCH} GREEN-tier diffs: docstrings, comments, type hints across Python and TypeScript.",
    f"Generate {SAMPLES_PER_BATCH} GREEN-tier diffs: unit tests, integration tests, snapshot tests in Python, Go, Rust.",
    f"Generate {SAMPLES_PER_BATCH} GREEN-tier diffs: linting fixes, import sorting, formatting, .gitignore, config cleanups.",
    f"Generate {SAMPLES_PER_BATCH} GREEN-tier diffs: README updates, CHANGELOG entries, LICENSE headers, markdown fixes.",
    f"Generate {SAMPLES_PER_BATCH} GREEN-tier diffs: variable renames, dead code removal, unused import cleanup in Java, C#, Kotlin.",
    f"Generate {SAMPLES_PER_BATCH} GREEN-tier diffs: adding logging statements, improving error messages, better exception text.",
    f"Generate {SAMPLES_PER_BATCH} GREEN-tier diffs: CSS/SCSS styling tweaks, accessibility aria labels, alt text for images.",
    f"Generate {SAMPLES_PER_BATCH} GREEN-tier diffs: test fixture updates, mock data changes, test helper refactors.",
    f"Generate {SAMPLES_PER_BATCH} GREEN-tier diffs: dependency version bumps in package.json, requirements.txt, go.mod.",
    f"Generate {SAMPLES_PER_BATCH} GREEN-tier diffs: adding return type annotations, generic type params, interface docs in TypeScript.",
]

RED_PROMPTS = [
    f"Generate {SAMPLES_PER_BATCH} RED-tier diffs: dropping database tables, removing auth middleware, disabling JWT verification.",
    f"Generate {SAMPLES_PER_BATCH} RED-tier diffs: exposing API keys, removing rate limiters, disabling CORS, skipping input validation.",
    f"Generate {SAMPLES_PER_BATCH} RED-tier diffs: modifying payment processing, changing billing logic, altering transaction handling.",
    f"Generate {SAMPLES_PER_BATCH} RED-tier diffs: deleting encryption, removing audit logs, disabling security headers, privilege escalation.",
    f"Generate {SAMPLES_PER_BATCH} RED-tier diffs: CI/CD pipeline changes that skip tests, remove linting, bypass code review checks.",
]


def _load_jsonl(path: str) -> list[dict]:
    """Load diffs from a JSONL file."""
    diffs = []
    if not os.path.exists(path):
        return diffs
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                diffs.append(json.loads(line))
            except Exception:
                pass
    return diffs


def _append_jsonl(path: str, items: list[dict]):
    """Append items to a JSONL file."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "a") as f:
        for item in items:
            f.write(json.dumps(item) + "\n")


def _generate_diffs(system_prompt: str, prompts: list[str], needed: int, label: str) -> list[dict]:
    """Use GPT-4o to generate code diffs."""
    all_diffs = []
    prompt_idx = 0
    max_attempts = len(prompts) * (needed // SAMPLES_PER_BATCH + 2)

    while len(all_diffs) < needed and prompt_idx < max_attempts:
        prompt = prompts[prompt_idx % len(prompts)]
        # Add variation suffix to avoid identical prompts
        cycle = prompt_idx // len(prompts)
        if cycle > 0:
            prompt += f" Variation {cycle + 1}: use completely different file names, function names, and scenarios than before."

        try:
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"},
                temperature=0.95,
                max_tokens=4096,
            )
            data = json.loads(response.choices[0].message.content)

            if isinstance(data, list):
                samples = data
            elif "diffs" in data:
                samples = data["diffs"]
            else:
                samples = next((v for v in data.values() if isinstance(v, list)), [])

            valid = []
            for item in samples:
                if isinstance(item, dict) and "diff" in item:
                    if "files" not in item:
                        item["files"] = ["unknown.py"]
                    if "summary" not in item:
                        item["summary"] = f"{label} change to {', '.join(item['files'])}"
                    valid.append(item)

            all_diffs.extend(valid)
            print(f"    [{label}] Batch {prompt_idx + 1}: +{len(valid)} diffs (total: {len(all_diffs)}/{needed})")

        except Exception as e:
            print(f"    [{label}] Batch {prompt_idx + 1} failed: {e}")
            time.sleep(2)

        prompt_idx += 1
        # Brief pause to respect rate limits
        if prompt_idx % 5 == 0:
            time.sleep(1)

    return all_diffs[:needed]


def get_proposals(target: int, cache_path: str, system_prompt: str, prompts: list[str], label: str) -> list[dict]:
    """Get proposals from cache or generate new ones via GPT-4o."""
    cached = _load_jsonl(cache_path)
    if len(cached) >= target:
        print(f"  Loaded {len(cached)} cached {label} diffs from {cache_path}")
        return cached[:target]

    needed = target - len(cached)
    print(f"  Have {len(cached)} cached {label} diffs, generating {needed} more...")
    generated = _generate_diffs(system_prompt, prompts, needed, label)
    _append_jsonl(cache_path, generated)
    combined = cached + generated
    print(f"  Total {label} diffs: {len(combined)}")
    return combined[:target]


# ---------------------------------------------------------------------------
# Step 2: Embed proposals via OpenAI
# ---------------------------------------------------------------------------

def embed_proposals(proposals: list[dict], cache_path: str) -> torch.Tensor:
    """Embed proposals via OpenAI text-embedding-3-small (1536-dim). Batches of 512."""
    if os.path.exists(cache_path):
        t = torch.load(cache_path, map_location="cpu", weights_only=True)
        if t.shape[0] >= len(proposals):
            print(f"  Loaded cached embeddings from {cache_path} ({t.shape})")
            return t[:len(proposals)]
        print(f"  Cache has {t.shape[0]} embeddings but need {len(proposals)}, re-embedding...")

    print(f"  Embedding {len(proposals)} proposals via text-embedding-3-small...")
    texts = []
    for p in proposals:
        text = (
            f"{p.get('summary', '')}\n"
            f"Files: {', '.join(p.get('files', []))}\n"
            f"{p.get('diff', '')[:2000]}"
        )
        texts.append(text)

    # Batch embed in chunks of 512 (API limit is 2048, but keep it smaller)
    all_embeddings = []
    for i in range(0, len(texts), 512):
        batch_texts = texts[i:i + 512]
        response = client.embeddings.create(model="text-embedding-3-small", input=batch_texts)
        all_embeddings.extend([item.embedding for item in response.data])
        print(f"    Embedded {min(i + 512, len(texts))}/{len(texts)}")

    tensor = torch.tensor(all_embeddings, dtype=torch.float32)
    print(f"  Embeddings shape: {tensor.shape}")

    os.makedirs(os.path.dirname(cache_path), exist_ok=True)
    torch.save(tensor, cache_path)
    return tensor


# ---------------------------------------------------------------------------
# Step 3-6: Train, evaluate, save
# ---------------------------------------------------------------------------

def compute_errors(model: nn.Module, data: torch.Tensor) -> torch.Tensor:
    """Compute per-sample reconstruction errors (MSE)."""
    model.eval()
    errors = []
    with torch.no_grad():
        for i in range(0, len(data), BATCH_SIZE):
            batch = data[i:i + BATCH_SIZE]
            recon = model(batch)
            mse = nn.functional.mse_loss(recon, batch, reduction="none").mean(dim=1)
            errors.append(mse)
    return torch.cat(errors)


def compute_accuracy(model: nn.Module, green: torch.Tensor, red: torch.Tensor, threshold: float) -> dict:
    """Compute detection accuracy: GREEN should be below threshold, RED above."""
    green_errors = compute_errors(model, green)
    red_errors = compute_errors(model, red)

    green_correct = (green_errors <= threshold).sum().item()
    red_correct = (red_errors > threshold).sum().item()

    green_acc = green_correct / len(green) * 100 if len(green) > 0 else 0
    red_acc = red_correct / len(red) * 100 if len(red) > 0 else 0
    total_acc = (green_correct + red_correct) / (len(green) + len(red)) * 100

    return {
        "green_acc": green_acc,
        "red_acc": red_acc,
        "total_acc": total_acc,
        "green_correct": green_correct,
        "green_total": len(green),
        "red_correct": red_correct,
        "red_total": len(red),
        "green_mean_err": green_errors.mean().item(),
        "red_mean_err": red_errors.mean().item(),
    }


def train():
    print("=" * 70)
    print("  DevGuard Anomaly Detector — Training Pipeline (1000 samples)")
    print("=" * 70)

    # ---- Step 1: Acquire data ----
    print("\n[Step 1] Acquiring training data via GPT-4o...")
    green_proposals = get_proposals(
        TARGET_GREEN_SAMPLES, GENERATED_DIFFS_PATH,
        GREEN_SYSTEM_PROMPT, GREEN_PROMPTS, "GREEN"
    )
    red_proposals = get_proposals(
        TARGET_RED_SAMPLES, RED_DIFFS_PATH,
        RED_SYSTEM_PROMPT, RED_PROMPTS, "RED"
    )

    if len(green_proposals) < 50:
        print(f"ERROR: Only {len(green_proposals)} GREEN proposals — need at least 50.")
        return

    # ---- Step 2: Embed ----
    print(f"\n[Step 2] Embedding proposals...")
    green_emb = embed_proposals(green_proposals, EMBEDDINGS_CACHE)
    red_emb = embed_proposals(red_proposals, RED_EMBEDDINGS_CACHE)

    # ---- Step 3: Train/test split ----
    n_train = int(len(green_emb) * TRAIN_SPLIT)
    perm = torch.randperm(len(green_emb))
    green_emb = green_emb[perm]  # shuffle

    train_emb = green_emb[:n_train]
    test_emb = green_emb[n_train:]

    print(f"\n[Step 3] Data split:")
    print(f"  Train (GREEN): {len(train_emb)}")
    print(f"  Test  (GREEN): {len(test_emb)}")
    print(f"  Test  (RED):   {len(red_emb)}")

    # ---- Step 4: Train with per-epoch reporting ----
    print(f"\n[Step 4] Training autoencoder for {EPOCHS} epochs (batch_size={BATCH_SIZE}, lr={LR})...")
    print(f"{'':>7} {'Train':>10} {'Test':>10} {'':>3} {'GREEN':>10} {'RED':>10} {'Total':>10}")
    print(f"{'Epoch':>7} {'Loss':>10} {'Loss':>10} {'|':>3} {'Acc%':>10} {'Acc%':>10} {'Acc%':>10}")
    print("-" * 70)

    dataset = TensorDataset(train_emb)
    loader = DataLoader(dataset, batch_size=BATCH_SIZE, shuffle=True)

    model = Autoencoder(EMBEDDING_DIM)
    criterion = nn.MSELoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=LR)

    # We need a threshold for accuracy — start with a guess, refine each epoch
    best_total_acc = 0.0
    best_model_state = None
    best_threshold = 0.0

    for epoch in range(EPOCHS):
        # --- Train ---
        model.train()
        total_loss = 0.0
        for (batch,) in loader:
            recon = model(batch)
            loss = criterion(recon, batch)
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            total_loss += loss.item()
        train_loss = total_loss / len(loader)

        # --- Evaluate ---
        model.eval()
        test_errors = compute_errors(model, test_emb)
        test_loss = test_errors.mean().item()

        # Compute threshold on train set (95th percentile)
        train_errors = compute_errors(model, train_emb)
        sorted_errors = train_errors.sort()[0]
        p95_idx = min(int(len(sorted_errors) * 0.95), len(sorted_errors) - 1)
        epoch_threshold = sorted_errors[p95_idx].item()

        # Compute accuracy with this threshold
        acc = compute_accuracy(model, test_emb, red_emb, epoch_threshold)

        print(
            f"{epoch + 1:>7} {train_loss:>10.6f} {test_loss:>10.6f} {'|':>3} "
            f"{acc['green_acc']:>9.1f}% {acc['red_acc']:>9.1f}% {acc['total_acc']:>9.1f}%"
        )

        # Track best model
        if acc["total_acc"] >= best_total_acc:
            best_total_acc = acc["total_acc"]
            best_model_state = {k: v.clone() for k, v in model.state_dict().items()}
            best_threshold = epoch_threshold

    print("-" * 70)

    # ---- Step 5: Final evaluation with best model ----
    print(f"\n[Step 5] Best model — Total Accuracy: {best_total_acc:.1f}%")
    model.load_state_dict(best_model_state)
    final_acc = compute_accuracy(model, test_emb, red_emb, best_threshold)

    print(f"  Threshold: {best_threshold:.6f}")
    print(f"  GREEN test:  {final_acc['green_correct']}/{final_acc['green_total']} correct ({final_acc['green_acc']:.1f}%)"
          f"  — mean error: {final_acc['green_mean_err']:.6f}")
    print(f"  RED test:    {final_acc['red_correct']}/{final_acc['red_total']} correct ({final_acc['red_acc']:.1f}%)"
          f"  — mean error: {final_acc['red_mean_err']:.6f}")
    print(f"  Overall:     {final_acc['total_acc']:.1f}%")

    # ---- Step 6: Save ----
    print(f"\n[Step 6] Saving model & threshold...")
    os.makedirs(os.path.dirname(MODEL_PATH) or ".", exist_ok=True)
    torch.save(model.state_dict(), MODEL_PATH)
    with open(THRESHOLD_PATH, "w") as f:
        json.dump({"threshold": best_threshold}, f)

    print(f"\n{'=' * 70}")
    print(f"  Model saved to:     {MODEL_PATH}")
    print(f"  Threshold saved to: {THRESHOLD_PATH}")
    print(f"  Best accuracy:      {best_total_acc:.1f}%")
    print(f"  Training samples:   {len(train_emb)} GREEN")
    print(f"  Test samples:       {len(test_emb)} GREEN + {len(red_emb)} RED")
    print(f"{'=' * 70}")


if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.dirname(__file__)))  # cd to ml/
    train()
