import { CodexProposal, RiskScore } from "../types";

// Second AI reviewer pass — validates and critiques the Codex proposal
export async function reviewProposal(
  proposal: CodexProposal,
  riskScore: RiskScore
): Promise<{ approved: boolean; comments: string[] }> {
  // TODO:
  // 1. Build prompt with proposal diff, risks, and risk score
  // 2. Call OpenAI gpt-4o asking it to critically review
  // 3. Return reviewer verdict and comments
  // Mock fallback: return approved = true, empty comments
  throw new Error("Not implemented");
}
