import { Router, Request, Response } from "express";
import { TicketInput } from "../types";
import { scoreRisk, checkAnomaly, checkSimilarity } from "../services/riskEngine";
import { writeAuditLog } from "../services/audit";

// POST /intake — Submit a development task
// Body: TicketInput { title, description, repo, reporter }
const router = Router();

router.post("/", async (req: Request, res: Response) => {
  // TODO: implement full pipeline in order:
  //
  // [0] Validate body as TicketInput
  //
  // [1] DUPLICATE CHECK (ML Feature 3) — before generating anything
  //     const dup = await checkSimilarity({ summary: title+description, diff: "", files_to_modify: [] })
  //     If dup?.is_duplicate → return existing matched_proposal_id with warning, skip all generation
  //
  // [2] RAG context retrieval
  //     import { retrieve } from "../agents/rag"
  //     const context = await retrieve(ticket.title + " " + ticket.description)
  //
  // [3] Codex proposal generation
  //     import { generateProposal } from "../agents/codex"
  //     const proposal = await generateProposal(ticket, context)
  //
  // [4] ANOMALY CHECK (ML Feature 2) — after generation, before scoring
  //     const anomaly = await checkAnomaly(proposal)
  //     Track is_anomaly to force tier RED downstream if true
  //
  // [5] Blast radius scoring (ML Feature 1 + rules fallback)
  //     const riskScore = await scoreRisk(proposal)
  //     If anomaly?.is_anomaly → override riskScore.tier = "RED", prepend anomaly warning to reasons
  //
  // [6] Second reviewer pass
  //     import { reviewProposal } from "../agents/reviewer"
  //     const review = await reviewProposal(proposal, riskScore)
  //
  // [7] Persist proposal to DB
  //     import { prisma } from "../lib/prisma"
  //     const saved = await prisma.proposal.create({ data: { ...proposal fields, ...riskScore fields, status: "PENDING" } })
  //
  // [8] Write PROPOSED audit log
  //     await writeAuditLog("PROPOSED", ticket.reporter, saved.id, { tier: riskScore.tier, score: riskScore.score, anomalyFlagged: anomaly?.is_anomaly })
  //
  // [9] Embed + store proposal in ChromaDB for future RAG + similarity lookups
  //     import { embedAndStore } from "../agents/rag"
  //     await embedAndStore(saved.id, proposal.summary + " " + proposal.diff, { tier: riskScore.tier, repo: ticket.repo })
  //
  // [10] Route by tier
  //      GREEN  → executeProposal(saved.id), writeAuditLog("AUTO_EXECUTED", "system", saved.id)
  //      YELLOW → sendApprovalCard(saved.id) with veto window, writeAuditLog("APPROVAL_SENT", "system", saved.id)
  //      RED    → sendApprovalCard(saved.id) hard block,       writeAuditLog("APPROVAL_SENT", "system", saved.id)
  //
  // [11] Return { proposalId: saved.id, tier: riskScore.tier, anomalyFlagged: anomaly?.is_anomaly ?? false }

  res.status(501).json({ error: "Not implemented" });
});

export default router;
