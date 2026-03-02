# NexGuard — AI/ML Pipeline Context for Claude Code

## Overall AI Architecture

NexGuard has two separate AI layers that serve different roles:

### Layer 1 — OpenAI (cloud, generative)

Three agents using GPT-4o for understanding and generation:

| Agent | File | Role |
|-------|------|------|
| Codex | `src/agents/codex.ts` | Given a ticket, generates the actual code diff + risk summary |
| RAG | `src/agents/rag.ts` | Retrieves relevant past proposals from ChromaDB to give Codex context |
| Reviewer | `src/agents/reviewer.ts` | Second pass — independently re-evaluates the proposal's risk |

These are **generative** — they produce text, diffs, summaries.

### Layer 2 — ML Sidecar (local, discriminative)

Three models running in a Python FastAPI sidecar on port 8001:

| Model | Role | Type |
|-------|------|------|
| Blast Radius Classifier | Reads the diff → predicts GREEN/YELLOW/RED | Fine-tuned classifier |
| Anomaly Detector | Compares diff to "normal safe diffs" → flags anomalies | Unsupervised reconstruction |
| Similarity | Compares new ticket to past proposals → detects duplicates | Cosine distance (no weights) |

These are **discriminative** — they score/classify, produce no text.
Falls back to rules-based scoring if the sidecar is unavailable.

### Why two layers?

GPT-4o is good at understanding intent and generating code but expensive and slow for scoring every proposal. The ML sidecar is cheap and fast for classification. Each is used where it's strongest.

### Why both CodeBERT AND rules-based scoring?

Defense in depth. CodeBERT can be wrong (especially on out-of-distribution code). Rules always catch hardcoded dangerous patterns (`payment`, `migration`, etc.) regardless of ML confidence.

### Why an autoencoder instead of just CodeBERT for anomaly detection?

CodeBERT knows what RED looks like from training. But what about a new kind of dangerous change it was never trained on? The autoencoder doesn't know labels — it only knows what GREEN looks like. Anything structurally unlike GREEN gets flagged, including novel patterns CodeBERT has no label for.

### Why RAG?

Without context, GPT-4o generates generic diffs. With ChromaDB returning similar past proposals, Codex can see how similar changes were handled before and generate more accurate, repo-specific diffs.

---

## Full Pipeline Flow

```
Ticket Input
    │
    ▼
[POST /similarity] ← duplicate check — skip everything if match ≥ 0.92
    │ no duplicate
    ▼
[RAG] ← retrieve relevant past proposals from ChromaDB for context
    │
    ▼
[Codex / GPT-4o] ← generate diff, summary, risk list, confidence
    │
    ▼
[POST /anomaly] ← autoencoder checks if proposal looks unlike normal GREEN proposals
    │ if anomaly → force RED
    ▼
[POST /classify] ← CodeBERT predicts tier
    │ confidence ≥ 0.8 → use ML tier
    │ confidence < 0.8 → use rules-based scorer
    ▼
[Reviewer / GPT-4o] ← second independent pass, merges into final score
    │
    ▼
Final tier
    │
    ├── GREEN  → auto-execute, log only
    ├── YELLOW → execute + Slack notify (1hr veto window)
    └── RED    → hard block → Slack approval card required
```

---

## Three ML Features

### Feature 1: Blast Radius Classifier

Fine-tuned `microsoft/codebert-base` that predicts GREEN/YELLOW/RED from a code diff + file paths.
Replaces the rules-based scorer when model confidence > 0.8.

**Recommended upgrade:** `microsoft/graphcodebert-base` (drop-in replacement, same API, data-flow-aware — strictly better for blast radius reasoning) or `microsoft/codereviewer` (natively pre-trained on unified diff format, best for this task but requires T5 encoder extraction).

Input:
- `diff`: unified diff string
- `files`: array of modified file paths

Output:
- `tier`: GREEN | YELLOW | RED
- `confidence`: 0.0 to 1.0
- `all_scores`: probability for each tier

Training data: synthetically generated via GPT-4o (50 batches × 10 samples = ~500 labeled diffs).
Labels: GREEN = safe changes, YELLOW = logic/dependency changes, RED = auth/payments/migrations/infra.

**Limitation of synthetic data:** GPT-4o generates "textbook" diffs. Real diffs are messier and may differ in distribution. Labels are only as consistent as GPT-4o's judgment at temperature 0.9. For production, real labeled PRs from actual repos would produce a more accurate model.

### Feature 2: Anomaly Detector

Autoencoder trained on embeddings of GREEN proposals only (text-embedding-3-small, 1536-dim).
Flags proposals with high reconstruction error — catches dangerous changes the classifier was never trained to recognize.
Threshold = 95th percentile of training reconstruction errors.

**Requires:** at least 10 GREEN proposals submitted through `/intake` before training (embeddings fetched from ChromaDB).

Input:
- `proposal`: `{ summary, diff, files_to_modify }`

Output:
- `is_anomaly`: boolean
- `reconstruction_error`: float
- `anomaly_score`: normalized float (0–3+, above 1.0 = anomaly)
- `threshold`: float

Effect on pipeline: if `is_anomaly` is true, force tier to RED and add warning to approval card.

### Feature 3: Semantic Similarity (Duplicate Detection)

Cosine similarity between new proposal embedding and stored historical proposal embeddings.
Prevents Codex from regenerating near-identical proposals for similar tickets.
Threshold: 0.92 similarity score. No saved model — computed at runtime.

Input:
- `proposal`: `{ summary, diff, files_to_modify }`

Output:
- `is_duplicate`: boolean
- `similarity_score`: float
- `matched_proposal_id`: string | null

Effect on pipeline: if `is_duplicate` is true, skip generation and return the existing proposal with a warning.

---

## ML Sidecar Endpoints

```
POST /classify      # Feature 1 — CodeBERT classifier
POST /anomaly       # Feature 2 — Autoencoder anomaly detection
POST /similarity    # Feature 3 — Duplicate detection
GET  /health        # Model load status: {"status":"ok","classifier_loaded":bool,"autoencoder_loaded":bool}
```

---

## Fallback Behavior

- `/classify` unavailable or confidence < 0.8 → use rules-based scorer in `src/services/riskEngine.ts`
- `/anomaly` unavailable → skip anomaly check, log warning, do not block
- `/similarity` unavailable → skip duplicate check, proceed normally
- Any ML error → fail safe to RED, never block the pipeline

Rules-based scorer triggers (from `config/policy.yaml`):
- File count > 10 → +40 score
- File count > 5 → +20 score
- Test coverage affected → +15 score
- Codex confidence < 0.6 → +20 score
- Keyword match (`payment`, `auth`, `migration`, `delete`, `drop`) → force RED

---

## Models

- Blast radius classifier: `microsoft/codebert-base` fine-tuned, saved to `models/blast_radius_classifier/`
- Anomaly detector: custom PyTorch autoencoder (1536→512→128→512→1536), saved to `models/anomaly_detector.pt`
- Anomaly threshold: 95th-percentile reconstruction error, saved to `models/anomaly_threshold.json`
- Similarity: no saved model, computed at runtime using OpenAI embeddings + ChromaDB cosine distance

---

## Full Setup, Training & Usage Guide

### Prerequisites

- Docker Desktop running
- Node.js + pnpm installed
- Python 3.11 installed
- OpenAI API key in `.env`

---

### Phase 1 — Infrastructure

```bash
# From project root
docker-compose up -d postgres redis
pnpm install
pnpm db:migrate
pnpm dev        # Node backend on port 3000
```

---

### Phase 2 — Python Virtual Environment (do once)

**Always activate the venv before any ML work in a new terminal.**

```powershell
cd competition/DLW/ml

# Create venv (first time only)
python -m venv venv

# Activate (every new terminal session)
.\venv\Scripts\Activate.ps1     # PowerShell
# or
venv\Scripts\activate.bat       # Command Prompt

# Install dependencies (first time only, after activating)
pip install -r requirements.txt
```

You'll know it's active when your prompt shows `(venv)`.
To deactivate: `deactivate`

**Note:** Port conflict — if another Postgres is running on 5432 locally, Docker maps to 5433.
DATABASE_URL should be `postgresql://user:pass@localhost:5433/nexguard`

---

### Phase 3 — Train GraphCodeBERT Classifier

```powershell
# With venv active, from ml/ directory:

# Step 1 — Generate ~500 labeled diffs via GPT-4o
python train/generate_data.py
# → train/data/diffs.jsonl
# Takes ~5 min, costs OpenAI credits

# Step 2 — Fine-tune GraphCodeBERT (downloads ~500MB on first run)
python train/train_classifier.py
# → models/blast_radius_classifier/
# Trains 3 epochs, prints val_acc per epoch
# Prints per-class test accuracy (GREEN/YELLOW/RED) at the end
```

---

### Phase 4 — Start ML Sidecar (classifier only)

```powershell
# With venv active, from ml/ directory:
python main.py

# Verify:
curl http://localhost:8001/health
# → {"status":"ok","classifier_loaded":true,"autoencoder_loaded":false}
```

---

### Phase 5 — Populate ChromaDB for Autoencoder

The autoencoder trains on real GREEN proposals, not synthetic data.
Need at least 10 GREEN proposals submitted through the system first.

```bash
# From project root (separate terminal, Node backend must be running):
npx ts-node demo/seedTickets.ts

# Or submit manually:
curl -X POST http://localhost:3000/intake \
  -H "Content-Type: application/json" \
  -d '{"title":"Add docstrings to utils","description":"Document all public functions","repo":"nexguard-org/demo-app","reporter":"alice"}'
```

Submit enough GREEN tickets (docstrings, comments, tests, minor renames) until you have 10+.

---

### Phase 6 — Train Autoencoder

```powershell
# With venv active, from ml/ directory:
python train/train_autoencoder.py
# Fetches GREEN embeddings from ChromaDB
# Trains 50 epochs
# → models/anomaly_detector.pt
# → models/anomaly_threshold.json (95th-percentile reconstruction error)
```

---

### Phase 7 — Restart Sidecar with All Models

```powershell
# Ctrl+C the running sidecar, then:
python main.py

# Verify both models loaded:
curl http://localhost:8001/health
# → {"status":"ok","classifier_loaded":true,"autoencoder_loaded":true}
```

---

### Phase 8 — Test End-to-End

```bash
# GREEN — should auto-execute, riskReasons shows "GraphCodeBERT: GREEN"
curl -X POST http://localhost:3000/intake \
  -H "Content-Type: application/json" \
  -d '{"title":"Add docstrings to utils","description":"Document all public functions","repo":"nexguard-org/demo-app","reporter":"alice"}'

# RED — should block and send Slack card
curl -X POST http://localhost:3000/intake \
  -H "Content-Type: application/json" \
  -d '{"title":"Migrate payments to Stripe v3","description":"Update all Stripe API calls including webhook handling","repo":"nexguard-org/demo-app","reporter":"bob"}'
```

Check `riskReasons` in the response:
- `"GraphCodeBERT: GREEN (confidence 0.91)"` → ML is active and confident
- `"GraphCodeBERT low confidence (0.61) — using rules-based scorer"` → ML ran but fell back
- `"ML sidecar unavailable — using rules-based scorer"` → sidecar not running

---

### Measuring Accuracy

**Classifier (after train_classifier.py):**
Printed automatically — per-class accuracy for GREEN, YELLOW, RED on the held-out test set.

**Classifier at runtime:**
```bash
curl -X POST http://localhost:8001/classify \
  -H "Content-Type: application/json" \
  -d '{"diff":"--- a/readme.md\n+++ b/readme.md\n@@ -1 +1 @@\n-Helo\n+Hello","files":["readme.md"]}'
# Watch: confidence ≥ 0.8 = ML result used, < 0.8 = rules fallback
```

**Anomaly detector:**
```bash
# Should NOT flag (normal GREEN change):
curl -X POST http://localhost:8001/anomaly \
  -H "Content-Type: application/json" \
  -d '{"proposal":{"summary":"Fix typo","diff":"--- a/readme.md\n+++ b/readme.md\n@@ -1 +1 @@\n-Helo\n+Hello","files_to_modify":["readme.md"]}}'
# → is_anomaly: false, anomaly_score < 1.0

# Should flag (nothing like normal GREEN proposals):
curl -X POST http://localhost:8001/anomaly \
  -H "Content-Type: application/json" \
  -d '{"proposal":{"summary":"Drop all tables","diff":"--- a/db.py\n+++ b/db.py\n@@ -1 +1 @@\n+db.execute(\"DROP TABLE users CASCADE\")","files_to_modify":["db.py","migrations/reset.sql"]}}'
# → is_anomaly: true, anomaly_score > 1.0
```

**View live DB state during demo:**
```bash
pnpm db:studio   # opens http://localhost:5555
# Check: Proposal (tier + status), AuditLog (riskReasons shows which scorer ran)
```

---

## Training Data

- Classifier: ~500 synthetic labeled diffs generated by GPT-4o, split 80/10/10 train/val/test
- Autoencoder: embeddings of all GREEN-tier historical proposals from ChromaDB (grows with real usage)
- Similarity: embeddings of all stored proposals (grows over time, no separate training step)

---

## ML Sidecar Tech Stack

- Python 3.11, FastAPI
- PyTorch, HuggingFace transformers (CodeBERT / RoBERTa architecture)
- OpenAI SDK (text-embedding-3-small for anomaly + similarity)
- chromadb (vector store for similarity + autoencoder training data)
- scikit-learn (train/val/test split)
- Runs on port 8001, separate `requirements.txt` and `Dockerfile` from Node.js backend
