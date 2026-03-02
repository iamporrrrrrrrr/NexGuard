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
      // Mock fallback — generate a stub proposal proportional to the ticket complexity
      // Count keywords that suggest more files affected
      const descLower = description.toLowerCase();
      const complexitySignals = ["refactor", "update", "middleware", "route", "endpoint", "module", "service", "controller", "handler", "config"];
      const matchedSignals = complexitySignals.filter(s => descLower.includes(s));
      // Extract any numbers that hint at file count (e.g. "update 6 route files")
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

    // Description-based RED override — catch dangerous intents the diff scan may miss
    if (riskScore.tier !== "RED") {
      const descLower = `${title} ${description}`.toLowerCase();
      const redKeywordGroups: { match: (s: string) => boolean; label: string }[] = [
        { match: (s) => /remove.{0,20}(auth|guard|jwt|throttl|rate.?limit)/.test(s), label: "removes security mechanism" },
        { match: (s) => /(plaintext|plain.text).{0,15}password|store.{0,20}password.{0,20}(plain|raw|direct)/.test(s), label: "plaintext password storage" },
        { match: (s) => /hardcod.{0,15}(key|secret|credential|api|password)/.test(s), label: "hardcoded credentials" },
        { match: (s) => /backdoor/.test(s), label: "backdoor" },
        { match: (s) => /\beval\s*\(|use eval/.test(s), label: "eval() usage" },
        { match: (s) => /child.?process|exec.{0,10}(script|command|user|arbitrary)/.test(s), label: "shell command execution" },
        { match: (s) => /disable.{0,15}(tls|ssl|cert)|node.tls.reject/.test(s), label: "TLS verification disabled" },
        { match: (s) => /(bypass|disable|remove).{0,15}cors|origin.{0,10}wildcard|allow.{0,10}all.{0,10}origin/.test(s), label: "CORS bypass" },
        { match: (s) => /console\.log.{0,30}(password|credential|secret|token)/.test(s), label: "credential logging" },
        { match: (s) => /remove.{0,20}(validation|validatepipe|validation.?pipe)/.test(s), label: "removes input validation" },
        { match: (s) => /delete.{0,10}all.{0,10}(user|session|data)|nuke.{0,10}(user|data)/.test(s), label: "destructive data deletion" },
        { match: (s) => /(expose|return|log).{0,20}(stack.?trace|exception\.stack)/.test(s), label: "stack trace exposure" },
        { match: (s) => /string.{0,10}concat.{0,20}(sql|query)|sql.{0,20}string.{0,10}concat/.test(s), label: "SQL string concatenation" },
        { match: (s) => /expose.{0,20}(database.?url|connection.?string|env.?var.{0,10}(in.response|api|endpoint))/.test(s), label: "exposes secrets via API" },
        { match: (s) => /(remove|skip|without).{0,20}test(s|\b)|no.{0,10}test.step/.test(s), label: "skips test execution" },
      ];

      for (const { match, label } of redKeywordGroups) {
        if (match(descLower)) {
          riskScore = {
            ...riskScore,
            tier: "RED",
            score: Math.max(riskScore.score, 85),
            reasons: [`Description indicates high-risk intent: ${label}`, ...riskScore.reasons],
            failSafeTriggered: true,
          };
          break;
        }
      }
    }

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
