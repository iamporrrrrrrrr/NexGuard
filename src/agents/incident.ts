import OpenAI from "openai";
import { IncidentInput } from "../types";
import { getFileTree } from "../integrations/github";

const openai = new OpenAI();

export interface HotfixCandidate {
  summary: string;
  diff: string;
  confidence: number;
  blastRadius: "LOW" | "MEDIUM" | "HIGH";
}

const SYSTEM_PROMPT = `You are DevGuard Incident Agent. Given an incident and error logs, generate 3 ranked hotfix candidates.

Respond with valid JSON:
{
  "hotfixes": [
    {
      "summary": "One-line description of the fix",
      "diff": "valid unified diff",
      "confidence": 0.85,
      "blastRadius": "LOW"
    }
  ]
}

Rules:
- Rank by confidence descending (highest first)
- blastRadius: LOW = 1-2 files, no schema/auth/payment; MEDIUM = 3-5 files or logic changes; HIGH = schema, auth, payments, or broad changes
- Prefer minimal blast-radius fixes when confidence is comparable
- This is an emergency — generate focused, targeted fixes only`;

// Incident mode: rank hotfix candidates within 45-second countdown
export async function rankHotfixes(incident: IncidentInput): Promise<HotfixCandidate[]> {
  let fileTree: string[] = [];
  try {
    fileTree = await getFileTree(incident.repo);
  } catch {
    // Unavailable — proceed without
  }

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          `# Incident`,
          `Description: ${incident.description}`,
          `Reporter: ${incident.reporter}`,
          `Repo: ${incident.repo}`,
          ``,
          `# Error Logs`,
          "```",
          incident.logs.slice(0, 2000),
          "```",
          ``,
          `# Repository File Tree`,
          fileTree.slice(0, 40).join("\n") || "Not available",
          ``,
          `Generate 3 hotfix candidates ranked by confidence.`,
        ].join("\n"),
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });

  const raw = JSON.parse(response.choices[0]?.message?.content ?? "{}");
  const hotfixes: HotfixCandidate[] = Array.isArray(raw.hotfixes) ? raw.hotfixes : [];

  return hotfixes
    .filter((h) => h.summary && h.diff)
    .sort((a, b) => b.confidence - a.confidence);
}
