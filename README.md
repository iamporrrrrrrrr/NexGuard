# NexGuard

**Human-Governed AI Coding Agent Orchestration Platform**

NexGuard is a production-ready platform that intercepts AI-generated code changes, scores their blast radius using machine learning, and routes them through a risk-tiered human approval system. Unlike traditional CI/CD pipelines that act *after* deployment, NexGuard operates *before* code reaches version control — providing human oversight of AI agents during the development phase.

## Problem

As AI coding agents (Copilot, Cursor, Codex) shift from auto-complete tools to autonomous code generators, they introduce real risks:

- **Security vulnerabilities** — AI may introduce authentication bypasses or SQL injection
- **System instability** — Breaking changes to critical infrastructure
- **Data loss** — Destructive database migrations or data deletion
- **Compliance violations** — Changes that bypass audit trails or regulatory requirements

NexGuard solves this by making every AI action a **proposal**, not an execution.

## How It Works

A risk engine scores each proposal and assigns one of three tiers:

| Tier | Action | Example |
|------|--------|---------|
| 🟢 GREEN | Auto-execute, log only | Documentation, comments, tests |
| 🟡 YELLOW | Execute + notify with 1-hour veto window | Config updates, performance optimizations |
| 🔴 RED | Hard block until explicit human approval | Auth changes, DB migrations, production config |

Three ML models combine with three GPT-4o agents to create a defense-in-depth system:

1. **AI generates** proposals with full context from RAG (Retrieval-Augmented Generation)
2. **ML scores** blast radius using fine-tuned CodeBERT and anomaly detection
3. **Humans approve** anything risky through Slack interactive cards
4. **System logs** everything in an append-only audit trail for compliance

## Architecture

### Data Flow

```
Ticket Input
    ↓
Similarity Check ── skip if duplicate (threshold 0.92)
    ↓
RAG Context Retrieval (ChromaDB)
    ↓
Codex Proposal Generation (GPT-4o)
    ↓
Anomaly Detection ── force RED if triggered
    ↓
Blast Radius Classification (CodeBERT) ── fallback to rules if confidence < 0.8
    ↓
Reviewer Agent (GPT-4o second pass)
    ↓
Merge Scores → Final Tier
    ↓
GREEN auto-execute | YELLOW/RED → Slack approval card
```

### Components

| Component | Stack | Port |
|-----------|-------|------|
| Backend | Node.js, TypeScript, Express, Prisma, BullMQ | 3000 |
| ML Sidecar | Python 3.11, FastAPI, PyTorch, CodeBERT | 8001 |
| Dashboard | Next.js, React | 3001 |
| Database | PostgreSQL | 5433 |
| Cache/Queue | Redis | 6379 |
| Vector Store | ChromaDB | — |

**External integrations:** OpenAI (GPT-4o), GitHub (Octokit), Slack (Webhooks + Interactive Components)

## AI Agents

| Agent | File | Description |
|-------|------|-------------|
| **Codex** | `agents/codex.ts` | Generates code diffs from natural language tickets using GPT-4o with RAG context |
| **RAG** | `agents/rag.ts` | Embeds tickets and queries ChromaDB for similar past proposals |
| **Reviewer** | `agents/reviewer.ts` | Independent GPT-4o second pass that adjusts risk scores |
| **Incident** | `agents/incident.ts` | Analyzes production logs, generates ranked hotfix candidates (45s countdown) |
| **Communication** | `agents/communication.ts` | Generates PR descriptions, postmortems, and release changelogs |

## ML Models

### Blast Radius Classifier
Fine-tuned [`microsoft/codebert-base`](https://huggingface.co/microsoft/codebert-base) on 500 synthetic diffs (200 GREEN, 150 YELLOW, 150 RED). Predicts GREEN/YELLOW/RED with confidence scores. Falls back to rules-based scoring if confidence < 0.8. Inference < 100ms.

### Anomaly Detector
PyTorch autoencoder (768→384→256→128→256→384→768) trained **only** on GREEN proposal embeddings. Proposals with high reconstruction error are flagged as anomalous and forced to RED tier. Catches novel dangerous patterns unseen during training.

### Similarity Checker
Runtime cosine similarity via OpenAI `text-embedding-3-small` + ChromaDB. Threshold of 0.92 skips duplicate tickets automatically. No saved model weights — computed at inference time.

### Fail-Safe Mechanisms
- ML sidecar unavailable → default to RED tier
- Classifier confidence < 0.8 → fallback to rules-based scoring
- All exceptions → force RED with `failSafeTriggered: true`
- Hardcoded RED patterns: `DROP TABLE`, `rm -rf`, `NODE_TLS_REJECT_UNAUTHORIZED`

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/intake` | POST | Submit a development ticket |
| `/incident` | POST | Declare a production incident |
| `/approve/:id` | GET | Approve a proposal (Slack callback) |
| `/reject/:id` | GET | Reject a proposal (Slack callback) |
| `/veto/:id` | GET | Veto YELLOW-tier auto-execution |
| `/diff/:id` | GET | View proposal diff + metadata |
| `/audit/feed` | GET | Real-time audit log stream |
| `/audit/report` | GET | Generate compliance report |
| `/slack/events` | POST | Slack interactive component callbacks |
| `/health` | GET | System health check |

## Project Structure

```
├── src/                    # Node.js backend (port 3000)
│   ├── index.ts            # Express entry point
│   ├── routes/             # HTTP endpoints (intake, approval, audit, incident, slack)
│   ├── agents/             # AI agents (codex, rag, reviewer, incident, communication)
│   ├── services/           # Core services (riskEngine, executor, audit)
│   ├── integrations/       # External APIs (slack, github)
│   ├── lib/prisma.ts       # Prisma client singleton
│   └── config/policy.ts    # Loads policy.yaml
├── ml/                     # Python ML sidecar (port 8001)
│   ├── main.py             # FastAPI app — /classify /anomaly /similarity /health
│   ├── classify.py         # CodeBERT blast radius classifier
│   ├── anomaly.py          # Autoencoder anomaly detector
│   ├── similarity.py       # Cosine similarity duplicate detection
│   ├── train/              # Training scripts + synthetic data
│   └── models/             # Saved model weights
├── dashboard/              # Next.js frontend
├── prisma/schema.prisma    # Database schema
├── config/policy.yaml      # Risk thresholds and rules
├── demo/seedTickets.ts     # Demo scenarios
└── docker-compose.yml      # Infrastructure (Postgres, Redis, ChromaDB)
```

## Quick Start

```bash
# Install dependencies
pnpm install

# Set up environment
cp .env.example .env   # fill in API keys

# Start infrastructure
docker-compose up -d   # PostgreSQL, Redis, ChromaDB

# Run database migrations
npx prisma migrate dev

# Start backend
npx ts-node src/index.ts

# Start ML sidecar (separate terminal)
cd ml && pip install -r requirements.txt && uvicorn main:app --port 8001

# Start dashboard (separate terminal)
cd dashboard && pnpm install && pnpm dev

# Seed demo data (optional)
npx ts-node demo/seedTickets.ts
```

## Risk Policy Configuration

Risk thresholds are defined in `config/policy.yaml`:

```yaml
risk:
  green:
    max_score: 30       # Score 0-30 → auto-execute
  yellow:
    max_score: 70       # Score 31-70 → notify + 1-hour veto
  red:
    min_score: 71       # Score 71+ → hard block

fail_safe:
  always_red_patterns:
    - "drop table"
    - "rm -rf"
```

## Environment Variables

```
OPENAI_API_KEY=
GITHUB_TOKEN=
SLACK_WEBHOOK_URL=
SLACK_BOT_TOKEN=
NEXGUARD_APP_URL=http://localhost:3000
DATABASE_URL=postgresql://user:pass@localhost:5432/nexguard
REDIS_URL=redis://localhost:6379
CHROMA_PERSIST_DIR=./chroma_db
```

## Key Design Decisions

- **Proposal-first model** — Nothing executes without being scored and routed through the tier system
- **Append-only audit log** — AuditLog records are never updated or deleted, ensuring a tamper-proof trail
- **Atomic transactions** — All multi-table writes use `prisma.$transaction()` for consistency
- **Fail-safe to RED** — Any exception in the scoring pipeline defaults to the most restrictive tier
- **ML + Rules hybrid** — ML provides accuracy; rules-based fallback ensures availability

## License

MIT
