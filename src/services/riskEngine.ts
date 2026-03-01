import axios from "axios";
import { CodexProposal, RiskScore } from "../types";
import { getPolicy } from "../config/policy";

const ML_SIDECAR_URL = process.env.ML_SIDECAR_URL ?? "http://localhost:8001";

// ---------------------------------------------------------------------------
// ML sidecar response types
// ---------------------------------------------------------------------------

interface ClassifierResponse {
  tier: "GREEN" | "YELLOW" | "RED";
  confidence: number;
  all_scores: { GREEN: number; YELLOW: number; RED: number };
}

export interface AnomalyResponse {
  is_anomaly: boolean;
  reconstruction_error: number;
  anomaly_score: number;
  threshold: number;
}

export interface SimilarityResponse {
  is_duplicate: boolean;
  similarity_score: number;
  matched_proposal_id: string | null;
}

// ---------------------------------------------------------------------------
// Rules-based fallback scorer
// ---------------------------------------------------------------------------

function rulesBasedScore(proposal: CodexProposal): RiskScore {
  const policy = getPolicy() as any;
  const alwaysRedPatterns: string[] = policy?.fail_safe?.always_red_patterns ?? [
    "payment", "auth", "migration", "delete", "drop",
  ];

  let score = 0;
  const reasons: string[] = [];
  let failSafeTriggered = false;

  const fileCount = proposal.files_to_modify.length;
  if (fileCount > 10) { score += 40; reasons.push(`Modifies ${fileCount} files`); }
  else if (fileCount > 5) { score += 20; reasons.push(`Modifies ${fileCount} files`); }
  else { score += fileCount * 3; }

  if (proposal.test_coverage_affected) { score += 15; reasons.push("Affects test coverage"); }

  if (proposal.confidence < 0.6) { score += 20; reasons.push(`Low Codex confidence (${proposal.confidence})`); }
  else if (proposal.confidence < 0.8) { score += 10; }

  const haystack = (proposal.diff + proposal.files_to_modify.join(" ")).toLowerCase();
  for (const pattern of alwaysRedPatterns) {
    if (haystack.includes(pattern)) {
      failSafeTriggered = true;
      reasons.push(`Fail-safe pattern matched: "${pattern}"`);
    }
  }

  if (failSafeTriggered) {
    return { tier: "RED", score: 100, reasons, failSafeTriggered: true };
  }

  const tier = score <= 30 ? "GREEN" : score <= 70 ? "YELLOW" : "RED";
  return { tier, score, reasons, failSafeTriggered: false };
}

// ---------------------------------------------------------------------------
// Main scorer — ML-assisted with rules fallback
// Always defaults to RED on any unhandled exception
// ---------------------------------------------------------------------------

export async function scoreRisk(proposal: CodexProposal): Promise<RiskScore> {
  try {
    return await _scoreWithML(proposal);
  } catch {
    return {
      tier: "RED",
      score: 100,
      reasons: ["Risk engine error — defaulting to RED"],
      failSafeTriggered: true,
    };
  }
}

async function _scoreWithML(proposal: CodexProposal): Promise<RiskScore> {
  // TODO:
  // Attempt ML classifier. On unavailable or low confidence, fall back to rules.
  let mlResult: ClassifierResponse | null = null;

  try {
    const res = await axios.post<ClassifierResponse>(
      `${ML_SIDECAR_URL}/classify`,
      { diff: proposal.diff, files: proposal.files_to_modify },
      { timeout: 5000 }
    );
    mlResult = res.data;
  } catch {
    // Sidecar unavailable — fall back silently
  }

  const rulesResult = rulesBasedScore(proposal);

  if (mlResult && mlResult.confidence >= 0.8) {
    return {
      tier: mlResult.tier,
      score: Math.round(mlResult.all_scores["RED"] * 100),
      reasons: [
        `CodeBERT: ${mlResult.tier} (confidence ${mlResult.confidence.toFixed(2)})`,
        ...rulesResult.reasons,
      ],
      failSafeTriggered: rulesResult.failSafeTriggered,
    };
  }

  return {
    ...rulesResult,
    reasons: [
      mlResult
        ? `CodeBERT low confidence (${mlResult.confidence.toFixed(2)}) — using rules-based scorer`
        : "ML sidecar unavailable — using rules-based scorer",
      ...rulesResult.reasons,
    ],
  };
}

// ---------------------------------------------------------------------------
// Anomaly check — called in intake before scoring
// Returns null if sidecar unavailable (non-blocking)
// ---------------------------------------------------------------------------

export async function checkAnomaly(proposal: CodexProposal): Promise<AnomalyResponse | null> {
  try {
    const res = await axios.post<AnomalyResponse>(
      `${ML_SIDECAR_URL}/anomaly`,
      { proposal: { summary: proposal.summary, diff: proposal.diff, files_to_modify: proposal.files_to_modify } },
      { timeout: 5000 }
    );
    return res.data;
  } catch {
    console.warn("[riskEngine] Anomaly sidecar unavailable — skipping");
    return null;
  }
}

// ---------------------------------------------------------------------------
// Duplicate check — called in intake before Codex generation
// Returns null if sidecar unavailable (non-blocking)
// ---------------------------------------------------------------------------

export async function checkSimilarity(proposal: { summary: string; diff: string; files_to_modify: string[] }): Promise<SimilarityResponse | null> {
  try {
    const res = await axios.post<SimilarityResponse>(
      `${ML_SIDECAR_URL}/similarity`,
      { proposal },
      { timeout: 5000 }
    );
    return res.data;
  } catch {
    console.warn("[riskEngine] Similarity sidecar unavailable — skipping");
    return null;
  }
}
