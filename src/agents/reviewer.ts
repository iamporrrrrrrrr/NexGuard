import OpenAI from "openai";
import { CodexProposal, RiskScore } from "../types";

const openai = new OpenAI();

const SYSTEM_PROMPT = `You are NexGuard Reviewer, a senior security engineer doing a final review of an AI-generated code change.

Respond with valid JSON:
{
  "approved": true,
  "comments": ["list of specific concerns or observations"]
}

Focus on: security issues, unintended side effects, missing error handling, scope creep, hardcoded values.
Be skeptical but fair. Set approved=false only for serious security or correctness issues.`;

export async function reviewProposal(
  proposal: CodexProposal,
  riskScore: RiskScore
): Promise<{ approved: boolean; comments: string[] }> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          `# Proposal`,
          `Summary: ${proposal.summary}`,
          `Confidence: ${proposal.confidence}`,
          `Files: ${proposal.files_to_modify.join(", ")}`,
          ``,
          `# Risk Score`,
          `Tier: ${riskScore.tier} (${riskScore.score}/100)`,
          `Reasons: ${riskScore.reasons.join("; ")}`,
          `Fail-safe triggered: ${riskScore.failSafeTriggered}`,
          ``,
          `# Diff`,
          "```diff",
          proposal.diff.slice(0, 3000),
          "```",
          ``,
          `# Codex-identified Risks`,
          proposal.risks.join("\n"),
        ].join("\n"),
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });

  const raw = JSON.parse(response.choices[0]?.message?.content ?? "{}");
  return {
    approved: Boolean(raw.approved ?? true),
    comments: Array.isArray(raw.comments) ? raw.comments : [],
  };
}
