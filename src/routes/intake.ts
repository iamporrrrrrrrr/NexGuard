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
// Body: TicketInput { title, description, repo, reporter }
const router: Router = Router();

router.post("/", async (req: Request, res: Response) => {
  try {
    // -----------------------------------------------------------------------
    // [0] Validate request body
    // -----------------------------------------------------------------------
    const { title, description, repo, reporter } = req.body as TicketInput;
    if (!title || !description || !repo || !reporter) {
      res.status(400).json({ error: "Missing required fields: title, description, repo, reporter" });
      return;
    }
    const ticket: TicketInput = { title, description, repo, reporter };

    // -----------------------------------------------------------------------
    // [1] DUPLICATE CHECK — skip generation entirely if duplicate found
    // -----------------------------------------------------------------------
    let dupResult = null;
    try {
      dupResult = await checkSimilarity({
        summary: `${title} ${description}`,
        diff: "",
        files_to_modify: [],
      });
    } catch {
      // ML sidecar unavailable — continue without duplicate check
    }

    if (dupResult?.is_duplicate && dupResult.matched_proposal_id) {
      res.status(200).json({
        warning: "Duplicate ticket detected — matched existing proposal",
        matchedProposalId: dupResult.matched_proposal_id,
        similarityScore: dupResult.similarity_score,
      });
      return;
    }

    // -----------------------------------------------------------------------
    // [2] RAG context retrieval
    // -----------------------------------------------------------------------
    let ragContext: string = "";
    try {
      const docs = await retrieve(`${ticket.title} ${ticket.description}`);
      ragContext = docs.map((d) => d.text).join("\n\n");
    } catch {
      // RAG unavailable — proceed without context
    }

    // -----------------------------------------------------------------------
    // [3] Codex proposal generation
    // -----------------------------------------------------------------------
    let proposal: CodexProposal;
    try {
      proposal = await generateProposal(ticket);
    } catch {
      // Mock fallback — stub proposal so the rest of the pipeline can run
      proposal = {
        summary: `Auto-proposal for: ${ticket.title}`,
        diff: `diff --git a/placeholder.ts b/placeholder.ts\n--- a/placeholder.ts\n+++ b/placeholder.ts\n@@ -0,0 +1 @@\n+// TODO: implement ${ticket.title}\n`,
        files_to_modify: ["placeholder.ts"],
        risks: ["Stub proposal — Codex agent not yet implemented"],
        confidence: 0.5,
        what_i_didnt_do: "Full implementation pending",
        test_coverage_affected: false,
      };
    }

    // -----------------------------------------------------------------------
    // [4] ANOMALY CHECK
    // -----------------------------------------------------------------------
    let anomalyResult = null;
    try {
      anomalyResult = await checkAnomaly(proposal);
    } catch {
      // ML sidecar unavailable — skip anomaly check, do not block
    }
    const anomalyFlagged = anomalyResult?.is_anomaly ?? false;

    // -----------------------------------------------------------------------
    // [5] Blast radius scoring — always defaults to RED on exception
    // -----------------------------------------------------------------------
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

    // -----------------------------------------------------------------------
    // [6] Second reviewer pass
    // -----------------------------------------------------------------------
    try {
      await reviewProposal(proposal, riskScore);
    } catch {
      // Reviewer unavailable — continue, risk score stands
    }

    // -----------------------------------------------------------------------
    // [7] Persist proposal to DB
    // -----------------------------------------------------------------------
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

    // -----------------------------------------------------------------------
    // [8] Write PROPOSED audit log
    // -----------------------------------------------------------------------
    await writeAuditLog("PROPOSED", ticket.reporter, saved.id, {
      tier: riskScore.tier,
      score: riskScore.score,
      anomalyFlagged,
      ragContextUsed: ragContext.length > 0,
    });

    // -----------------------------------------------------------------------
    // [9] Embed + store in ChromaDB (non-blocking — failure must not affect response)
    // -----------------------------------------------------------------------
    embedAndStore(
      saved.id,
      `${proposal.summary} ${proposal.diff}`,
      { tier: riskScore.tier, repo: ticket.repo }
    ).catch((err) => console.warn("[intake] embedAndStore failed:", err.message));

    // -----------------------------------------------------------------------
    // [10] Route by tier
    // -----------------------------------------------------------------------
    if (riskScore.tier === "GREEN") {
      try {
        await executeProposal(saved.id);
        await writeAuditLog("AUTO_EXECUTED", "system", saved.id, { tier: "GREEN" });
        await prisma.proposal.update({ where: { id: saved.id }, data: { status: "AUTO_EXECUTED" } });
      } catch (execErr) {
        console.error("[intake] Auto-execution failed:", (execErr as Error).message);
        // Already marked FAILED inside executeProposal
      }
    } else {
      // YELLOW or RED — send approval card + await human decision
      try {
        await sendApprovalCard(saved.id);
      } catch (slackErr) {
        console.warn("[intake] sendApprovalCard failed:", (slackErr as Error).message);
      }
      await writeAuditLog("APPROVAL_SENT", "system", saved.id, { tier: riskScore.tier });
      await prisma.proposal.update({ where: { id: saved.id }, data: { status: "AWAITING_APPROVAL" } });
    }

    // -----------------------------------------------------------------------
    // [11] Return response
    // -----------------------------------------------------------------------
    res.status(201).json({
      proposalId: saved.id,
      tier: riskScore.tier,
      riskScore: riskScore.score,
      anomalyFlagged,
      status: riskScore.tier === "GREEN" ? "AUTO_EXECUTED" : "AWAITING_APPROVAL",
    });
  } catch (err) {
    console.error("[intake] Unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
