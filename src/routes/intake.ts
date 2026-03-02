import { Router, Request, Response } from "express";
import { TicketInput, CodexProposal, RiskScore } from "../types";
import { scoreRisk, checkAnomaly, checkSimilarity } from "../services/riskEngine";
import { writeAuditLog } from "../services/audit";
import { prisma } from "../lib/prisma";
import { generateProposal } from "../agents/codex";
import { retrieve, embedAndStore } from "../agents/rag";
import { reviewProposal } from "../agents/reviewer";
import { sendApprovalCard } from "../integrations/slack";
import { executeProposal } from "../services/executor";

// POST /intake — Submit a development task (mock Jira intake)
// POST /intake/jira — Accept real Jira webhook payloads
// Body: TicketInput { title, description, repo, reporter }
const router: Router = Router();

// ---------------------------------------------------------------------------
// Shared pipeline — processes a TicketInput through the full DevGuard flow
// ---------------------------------------------------------------------------
async function processTicket(ticket: TicketInput): Promise<{
  proposalId: string;
  tier: string;
  riskScore: number;
  anomalyFlagged: boolean;
  status: string;
}> {
  const { title, description } = ticket;

  // [1] DUPLICATE CHECK
  let dupResult = null;
  try {
    dupResult = await checkSimilarity({
      summary: `${title} ${description}`,
      diff: "",
      files_to_modify: [],
    });
  } catch {
    // ML sidecar unavailable
  }

  if (dupResult?.is_duplicate && dupResult.matched_proposal_id) {
    throw Object.assign(
      new Error("Duplicate ticket detected — matched existing proposal"),
      { code: "DUPLICATE", matchedProposalId: dupResult.matched_proposal_id, similarityScore: dupResult.similarity_score }
    );
  }

  // [2] RAG context retrieval
  let ragContext: string = "";
  try {
    const docs = await retrieve(`${ticket.title} ${ticket.description}`);
    ragContext = docs.map((d) => d.text).join("\n\n");
  } catch {
    // RAG unavailable
  }

  // [3] Codex proposal generation
  let proposal: CodexProposal;
  try {
    proposal = await generateProposal(ticket);
  } catch {
    const descLower = description.toLowerCase();
    const complexitySignals = ["refactor", "update", "middleware", "route", "endpoint", "module", "service", "controller", "handler", "config"];
    const matchedSignals = complexitySignals.filter(s => descLower.includes(s));
    const numberMatch = description.match(/(\d+)\s+(file|route|module|endpoint|service)/i);
    const estimatedFiles = numberMatch ? Math.min(parseInt(numberMatch[1]), 15) : Math.max(matchedSignals.length, 1);

    const stubFiles = Array.from({ length: estimatedFiles }, (_, i) =>
      estimatedFiles === 1 ? "placeholder.ts" : `src/module${i + 1}.ts`
    );

    const isTestRelated = descLower.includes("test") || descLower.includes("spec") || descLower.includes("coverage");
    const confidence = estimatedFiles > 5 ? 0.5 : estimatedFiles > 2 ? 0.65 : 0.75;

    proposal = {
      summary: `Auto-proposal for: ${ticket.title}`,
      diff: stubFiles.map(f =>
        `diff --git a/${f} b/${f}\n--- a/${f}\n+++ b/${f}\n@@ -0,0 +1 @@\n+// TODO: implement ${ticket.title}\n`
      ).join("\n"),
      files_to_modify: stubFiles,
      risks: matchedSignals.length > 0
        ? [`Stub proposal — touches ${estimatedFiles} file(s) based on: ${matchedSignals.join(", ")}`]
        : ["Stub proposal — Codex agent not yet implemented"],
      confidence,
      what_i_didnt_do: "Full implementation pending",
      test_coverage_affected: isTestRelated,
    };
  }

  // [4] ANOMALY CHECK
  let anomalyResult = null;
  try {
    anomalyResult = await checkAnomaly(proposal);
  } catch {
    // ML sidecar unavailable
  }
  const anomalyFlagged = anomalyResult?.is_anomaly ?? false;

  // [5] Blast radius scoring
  let riskScore: RiskScore = await scoreRisk(proposal);

  if (anomalyFlagged) {
    riskScore = {
      ...riskScore,
      tier: "RED",
      reasons: [
        `Anomaly detected (score: ${anomalyResult?.anomaly_score?.toFixed(3) ?? "??"})`,
        ...riskScore.reasons,
      ],
      failSafeTriggered: true,
    };
  }

  // [6] Second reviewer pass
  try {
    await reviewProposal(proposal, riskScore);
  } catch {
    // Reviewer unavailable
  }

  // [7] Persist proposal to DB
  const saved = await prisma.proposal.create({
    data: {
      ticketTitle: ticket.title,
      ticketDescription: ticket.description,
      repo: ticket.repo,
      reporter: ticket.reporter,
      summary: proposal.summary,
      diff: proposal.diff,
      filesToModify: proposal.files_to_modify,
      risks: proposal.risks,
      confidence: proposal.confidence,
      whatIDidntDo: proposal.what_i_didnt_do,
      testCoverageAffected: proposal.test_coverage_affected,
      tier: riskScore.tier,
      riskScore: riskScore.score,
      riskReasons: riskScore.reasons,
      failSafeTriggered: riskScore.failSafeTriggered,
      status: "PENDING",
    },
  });

  // [8] Write PROPOSED audit log
  await writeAuditLog("PROPOSED", ticket.reporter, saved.id, {
    tier: riskScore.tier,
    score: riskScore.score,
    anomalyFlagged,
    ragContextUsed: ragContext.length > 0,
  });

  // [9] Embed + store in ChromaDB (non-blocking)
  embedAndStore(
    saved.id,
    `${proposal.summary} ${proposal.diff}`,
    { tier: riskScore.tier, repo: ticket.repo }
  ).catch((err) => console.warn("[intake] embedAndStore failed:", err.message));

  // [10] Route by tier
  if (riskScore.tier === "GREEN") {
    try {
      await executeProposal(saved.id);
      await writeAuditLog("AUTO_EXECUTED", "system", saved.id, { tier: "GREEN" });
      await prisma.proposal.update({ where: { id: saved.id }, data: { status: "AUTO_EXECUTED" } });
    } catch (execErr) {
      console.error("[intake] Auto-execution failed:", (execErr as Error).message);
    }
  } else {
    try {
      await sendApprovalCard(saved.id);
    } catch (slackErr) {
      console.warn("[intake] sendApprovalCard failed:", (slackErr as Error).message);
    }
    await writeAuditLog("APPROVAL_SENT", "system", saved.id, { tier: riskScore.tier });
    await prisma.proposal.update({ where: { id: saved.id }, data: { status: "AWAITING_APPROVAL" } });
  }

  return {
    proposalId: saved.id,
    tier: riskScore.tier,
    riskScore: riskScore.score,
    anomalyFlagged,
    status: riskScore.tier === "GREEN" ? "AUTO_EXECUTED" : "AWAITING_APPROVAL",
  };
}

// ---------------------------------------------------------------------------
// POST / — Direct DevGuard intake (also works as manual Jira mock)
// ---------------------------------------------------------------------------
router.post("/", async (req: Request, res: Response) => {
  try {
    const { title, description, repo, reporter } = req.body as TicketInput;
    if (!title || !description || !repo || !reporter) {
      res.status(400).json({ error: "Missing required fields: title, description, repo, reporter" });
      return;
    }

    const result = await processTicket({ title, description, repo, reporter });
    res.status(201).json(result);
  } catch (err: any) {
    if (err.code === "DUPLICATE") {
      res.status(200).json({
        warning: err.message,
        matchedProposalId: err.matchedProposalId,
        similarityScore: err.similarityScore,
      });
      return;
    }
    console.error("[intake] Unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /jira — Accept real Jira Cloud webhook payloads
// Jira Automation: "When issue created → send web request to https://<ngrok>/intake/jira"
// ---------------------------------------------------------------------------
router.post("/jira", async (req: Request, res: Response) => {
  try {
    const payload = req.body;
    const issue = payload?.issue;

    if (!issue?.fields) {
      res.status(400).json({ error: "Invalid Jira webhook payload — expected issue.fields" });
      return;
    }

    const fields = issue.fields;

    // Map Jira fields → DevGuard TicketInput
    const ticket: TicketInput = {
      title: fields.summary || "Untitled",
      description:
        // Jira Cloud sends ADF (Atlassian Document Format) — extract text content
        typeof fields.description === "string"
          ? fields.description
          : extractAdfText(fields.description) || fields.summary || "",
      repo: extractRepo(fields),
      reporter:
        fields.reporter?.displayName ||
        fields.creator?.displayName ||
        "jira-user",
    };

    if (!ticket.repo) {
      res.status(400).json({
        error: "Could not determine repo. Add a label like 'repo:org/name' to the Jira issue, or set a 'Repository' custom field.",
      });
      return;
    }

    console.log(`[Jira] ${payload.webhookEvent || "webhook"}: ${issue.key} → "${ticket.title}" → ${ticket.repo}`);

    const result = await processTicket(ticket);

    res.status(201).json({
      ...result,
      source: "jira",
      jiraKey: issue.key,
      jiraUrl: issue.self ? issue.self.replace("/rest/api/3/issue/", "/browse/") : null,
    });
  } catch (err: any) {
    if (err.code === "DUPLICATE") {
      res.status(200).json({
        warning: err.message,
        source: "jira",
        matchedProposalId: err.matchedProposalId,
        similarityScore: err.similarityScore,
      });
      return;
    }
    console.error("[intake/jira] Unhandled error:", err);
    res.status(500).json({ error: "Failed to process Jira webhook" });
  }
});

// ---------------------------------------------------------------------------
// Jira field extraction helpers
// ---------------------------------------------------------------------------

function extractRepo(fields: any): string {
  // 1. Label like "repo:devguard-org/demo-app"
  const repoLabel = fields.labels?.find((l: string) => l.startsWith("repo:"));
  if (repoLabel) return repoLabel.replace("repo:", "");

  // 2. Custom field named "Repository" (common Jira setup)
  for (const key of Object.keys(fields)) {
    if (key.startsWith("customfield_") && typeof fields[key] === "string" && fields[key].includes("/")) {
      return fields[key];
    }
  }

  // 3. Component name with repo pattern
  const component = fields.components?.[0]?.name;
  if (component?.includes("/")) return component;

  // 4. Project key mapping (configure per team)
  const projectMappings: Record<string, string> = {
    DEV: "iamporrrrrrrrr/demo-app",
    INFRA: "iamporrrrrrrrr/demo-app",
    PLATFORM: "iamporrrrrrrrr/demo-app",
  };
  return projectMappings[fields.project?.key] || "iamporrrrrrrrr/demo-app";
}

// Extract plain text from Jira ADF (Atlassian Document Format)
function extractAdfText(adf: any): string {
  if (!adf || typeof adf !== "object") return "";
  let text = "";
  if (adf.text) text += adf.text;
  if (Array.isArray(adf.content)) {
    for (const node of adf.content) {
      text += extractAdfText(node);
      if (node.type === "paragraph" || node.type === "heading") text += "\n";
    }
  }
  return text.trim();
}

export default router;
