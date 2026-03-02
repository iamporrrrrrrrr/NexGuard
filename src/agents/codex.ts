import OpenAI from "openai";
import { CodexProposal, TicketInput } from "../types";
import { getFileTree } from "../integrations/github";
import { retrieve } from "./rag";

const openai = new OpenAI();

const SYSTEM_PROMPT = `You are DevGuard Codex, an AI code change agent. Given a development ticket and repo context, produce a precise code change proposal.

Respond with valid JSON matching this exact schema:
{
  "summary": "One-paragraph description of what this change does and why",
  "diff": "A valid unified diff string (--- a/file \\n+++ b/file \\n@@ ... @@)",
  "files_to_modify": ["list", "of", "affected", "file", "paths"],
  "risks": ["list of specific risks for this change"],
  "confidence": 0.85,
  "what_i_didnt_do": "What was deliberately left out of scope",
  "test_coverage_affected": false
}

Rules:
- confidence is 0.0–1.0 (how certain the diff is correct and complete)
- Always produce a real unified diff, not pseudocode or placeholders
- Never include secrets, credentials, or hardcoded API keys
- Be conservative: if unsure, flag it in risks and lower confidence`;

export async function generateProposal(ticket: TicketInput, ragContext?: string): Promise<CodexProposal> {
  let fileTree: string[] = [];
  try {
    fileTree = await getFileTree(ticket.repo);
  } catch {
    // Unavailable — proceed without
  }

  let rag = ragContext ?? "";
  if (!rag) {
    try {
      const docs = await retrieve(`${ticket.title} ${ticket.description}`, 3);
      rag = docs.map((d) => `Past proposal context:\n${d.text.slice(0, 500)}`).join("\n\n");
    } catch {
      rag = "";
    }
  }

  const userPrompt = [
    `# Ticket`,
    `Title: ${ticket.title}`,
    `Description: ${ticket.description}`,
    `Repo: ${ticket.repo}`,
    `Reporter: ${ticket.reporter}`,
    ``,
    `# Repository File Tree`,
    fileTree.slice(0, 60).join("\n") || "Not available",
    ``,
    `# Relevant Past Proposals (RAG)`,
    rag || "None available",
    ``,
    `Generate a code change proposal for this ticket.`,
  ].join("\n");

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
  });

  const raw = JSON.parse(response.choices[0]?.message?.content ?? "{}");

  return {
    summary: String(raw.summary ?? ""),
    diff: String(raw.diff ?? ""),
    files_to_modify: Array.isArray(raw.files_to_modify) ? raw.files_to_modify : [],
    risks: Array.isArray(raw.risks) ? raw.risks : [],
    confidence: typeof raw.confidence === "number" ? Math.max(0, Math.min(1, raw.confidence)) : 0.5,
    what_i_didnt_do: String(raw.what_i_didnt_do ?? ""),
    test_coverage_affected: Boolean(raw.test_coverage_affected),
  };
}
