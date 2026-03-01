import { IncidentInput } from "../types";

export interface HotfixCandidate {
  summary: string;
  diff: string;
  confidence: number;
  blastRadius: "LOW" | "MEDIUM" | "HIGH";
}

// Incident mode: rank hotfix candidates within 45-second countdown
export async function rankHotfixes(incident: IncidentInput): Promise<HotfixCandidate[]> {
  // TODO:
  // 1. Parse incident logs to identify root cause signals
  // 2. Fetch relevant files from GitHub via github integration
  // 3. Call OpenAI gpt-4o to generate multiple ranked hotfix diffs
  // 4. Score each hotfix's blast radius
  // 5. Return sorted candidates (highest confidence first)
  // Note: must complete within 45 seconds (see policy.yaml incident.countdown_seconds)
  // Mock fallback: return empty array
  throw new Error("Not implemented");
}
