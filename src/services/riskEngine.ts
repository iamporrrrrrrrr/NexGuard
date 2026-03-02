import axios from "axios";
import { CodexProposal, RiskScore } from "../types";
import { getPolicy, PolicyConfig } from "../config/policy";

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
// Security pattern scanner — checks diff lines for dangerous changes
// ---------------------------------------------------------------------------

function scanDiffForSecurityPatterns(diff: string): { score: number; reasons: string[] } {
  const lines = diff.split("\n");
  const removedLines = lines
    .filter((l) => l.startsWith("-") && !l.startsWith("---"))
    .map((l) => l.slice(1).toLowerCase());
  const addedLines = lines
    .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
    .map((l) => l.slice(1).toLowerCase());

  let score = 0;
  const reasons: string[] = [];

  // Removing security mechanisms is dangerous
  const securityRemovals: { pattern: string; label: string }[] = [
    { pattern: "useguards",        label: "removes auth guard" },
    { pattern: "throttleguard",    label: "removes throttling guard" },
    { pattern: "@throttle",        label: "removes rate-limit decorator" },
    { pattern: "bcrypt",           label: "removes bcrypt hashing" },
    { pattern: ".hash(",           label: "removes password hashing" },
    { pattern: "validatepipe",     label: "removes validation pipe" },
    { pattern: "validationpipe",   label: "removes validation pipe" },
    { pattern: "jwtauthguard",     label: "removes JWT auth guard" },
    { pattern: "rolesguard",       label: "removes roles guard" },
    { pattern: "whitelist: true",  label: "removes input whitelisting" },
    { pattern: "npm test",         label: "removes test step" },
    { pattern: "run: npm test",    label: "removes test step" },
  ];
  for (const { pattern, label } of securityRemovals) {
    if (removedLines.some((l) => l.includes(pattern))) {
      score += 45;
      reasons.push(`Security removal detected: ${label}`);
    }
  }

  // Adding dangerous patterns
  const dangerousAdditions: { pattern: string; label: string }[] = [
    { pattern: "eval(",                           label: "eval() of arbitrary input" },
    { pattern: "child_process",                   label: "child_process usage" },
    { pattern: "exec(script",                     label: "user script execution" },
    { pattern: "child_process.exec(",             label: "shell command execution" },
    { pattern: "node_tls_reject_unauthorized",    label: "TLS verification disabled" },
    { pattern: "password: dto.password",          label: "plaintext password storage" },
    { pattern: "password: body.password",         label: "plaintext password storage" },
    { pattern: ": dto.password",                  label: "plaintext password stored" },
    { pattern: "origin: '*'",                     label: "wildcard CORS origin" },
    { pattern: "backdoor",                        label: "backdoor credential" },
    { pattern: "stack: exception.stack",          label: "stack trace exposed to client" },
    { pattern: "stack: err.stack",                label: "stack trace exposed to client" },
  ];
  for (const { pattern, label } of dangerousAdditions) {
    if (addedLines.some((l) => l.includes(pattern))) {
      score += 65;
      reasons.push(`Dangerous pattern added: ${label}`);
    }
  }

  return { score, reasons };
}

// ---------------------------------------------------------------------------
// Trivially-safe description detector
// Returns true for changes that are clearly minor and non-security-related
// by description wording, so we don't blindly trust ML RED for them.
// ---------------------------------------------------------------------------

function isTriviallyGreenDescription(description: string): boolean {
  const d = description.toLowerCase();
  return (
    /fix\s+(typo|spelling|whitespace|indentation|indent)/.test(d) ||
    /spelling\s+(fix|mistake|error|correction)/.test(d) ||
    /add\s+missing\s+await/.test(d) ||
    /missing\s+await/.test(d) ||
    /off.by.one/.test(d) ||
    /replace\s+(let|var)\s+with\s+const/.test(d) ||
    /\bnamed\s+constant/.test(d) ||
    /magic\s+number/.test(d) ||
    /\bnull\s+check\b/.test(d) ||
    /\bbump\b.{0,20}\bto\b.{0,20}(fix|patch|cve|security|vulnerability)/.test(d) ||
    /upgrade\s+\w+\s+from.{0,30}to.{0,30}(fix|cve|security|vulnerability)/.test(d) ||
    /cache.control\s+header/.test(d) ||
    /default\s+(value|port|fallback)/.test(d) ||
    /fix\s+memory\s+leak/.test(d) ||
    /fix\s+off.by.one/.test(d) ||
    /update\s+readme/.test(d) ||
    /add\s+index\s+to/.test(d) ||
    /add\s+(a\s+)?database\s+index/.test(d)
  );
}

// ---------------------------------------------------------------------------
// Rules-based fallback scorer
// ---------------------------------------------------------------------------

function rulesBasedScore(proposal: CodexProposal): RiskScore {
  const policy = getPolicy();
  const alwaysRedPatterns = policy.fail_safe.always_red_patterns;

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

  // Diff size contributes to complexity score — medium diffs are YELLOW not GREEN
  const diffLines = proposal.diff.split("\n");
  const changedLineCount = diffLines.filter(
    (l) => (l.startsWith("+") && !l.startsWith("+++")) || (l.startsWith("-") && !l.startsWith("---"))
  ).length;
  if (changedLineCount > 20) { score += 20; reasons.push(`Large diff (${changedLineCount} changed lines)`); }
  else if (changedLineCount > 8) { score += 12; reasons.push(`Moderate diff (${changedLineCount} changed lines)`); }

  // Security pattern scan on the generated diff
  const securityScan = scanDiffForSecurityPatterns(proposal.diff);
  score += securityScan.score;
  reasons.push(...securityScan.reasons);

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

export async function scoreRisk(proposal: CodexProposal, originalDescription?: string): Promise<RiskScore> {
  try {
    return await _scoreWithML(proposal, originalDescription);
  } catch {
    return {
      tier: "RED",
      score: 100,
      reasons: ["Risk engine error — defaulting to RED"],
      failSafeTriggered: true,
    };
  }
}

async function _scoreWithML(proposal: CodexProposal, originalDescription?: string): Promise<RiskScore> {
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

  if (mlResult) {
    // Asymmetric confidence thresholds:
    // RED/GREEN: trust ML at >= 0.60
    // YELLOW: require >= 0.82 — model over-classifies Codex-generated simple diffs as YELLOW
    const threshold = mlResult.tier === "YELLOW" ? 0.82 : 0.60;

    if (mlResult.confidence >= threshold) {
      // Guard: don't trust ML RED when rules found no security patterns and
      // the description is trivially safe. The classifier can misfire on
      // Codex-generated diffs that are out-of-distribution from training data.
      if (
        mlResult.tier === "RED" &&
        !rulesResult.failSafeTriggered &&
        rulesResult.score < 50 &&
        originalDescription &&
        isTriviallyGreenDescription(originalDescription)
      ) {
        return {
          ...rulesResult,
          reasons: [
            `CodeBERT RED (${mlResult.confidence.toFixed(2)}) overridden — trivially-safe description with no diff security patterns`,
            ...rulesResult.reasons,
          ],
        };
      }

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
  }

  return {
    ...rulesResult,
    reasons: [
      mlResult
        ? `CodeBERT ${mlResult.tier} (${mlResult.confidence.toFixed(2)}) below threshold — using rules-based scorer`
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
