import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { executeProposal, executeHotfix } from "../services/executor";

// GET /approve/:id  — Approve a proposal (Slack button callback)
// GET /reject/:id   — Reject a proposal (Slack button callback)
// GET /diff/:id     — View full diff for a proposal
const router = Router();

router.get("/approve/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const approver = req.query.approver as string || "unknown";

    // Validate proposal exists and status
    const existingProposal = await prisma.proposal.findUnique({
      where: { id },
      select: { id: true, status: true, ticketTitle: true },
    });

    if (!existingProposal) {
      return res.status(404).json({ error: "Proposal not found" });
    }

    if (existingProposal.status !== "AWAITING_APPROVAL") {
      return res.status(400).json({
        error: `Proposal cannot be approved. Current status: ${existingProposal.status}`,
      });
    }

    // Use transaction to atomically: create approval, update proposal, write audit log
    const result = await prisma.$transaction(async (tx: any) => {
      // Create Approval record
      const approval = await tx.approval.create({
        data: {
          proposalId: id,
          actor: approver,
          action: "APPROVED",
          reason: "Human approval via Slack",
        },
      });

      // Update proposal status
      const updatedProposal = await tx.proposal.update({
        where: { id },
        data: { status: "APPROVED" },
      });

      // Write APPROVED audit log
      await tx.auditLog.create({
        data: {
          proposalId: id,
          event: "APPROVED",
          actor: approver,
          metadata: {
            approvalId: approval.id,
            previousStatus: existingProposal.status,
          },
        },
      });

      return { approval, proposal: updatedProposal };
    });

    // Fire-and-forget: execute the proposal (create branch + apply diff + open PR)
    executeProposal(id).catch((execErr) =>
      console.error("[approval] executeProposal failed:", (execErr as Error).message)
    );

    res.status(200).json({
      success: true,
      message: "Proposal approved — executing diff and opening PR",
      proposalId: id,
      approver,
    });
  } catch (error) {
    console.error("Error approving proposal:", error);
    res.status(500).json({ error: "Failed to approve proposal" });
  }
});

router.get("/reject/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const rejector = req.query.rejector as string || "unknown";
    const reason = req.query.reason as string || "No reason provided";

    // Validate proposal exists and status
    const existingProposal = await prisma.proposal.findUnique({
      where: { id },
      select: { id: true, status: true, ticketTitle: true },
    });

    if (!existingProposal) {
      return res.status(404).json({ error: "Proposal not found" });
    }

    if (existingProposal.status !== "AWAITING_APPROVAL") {
      return res.status(400).json({
        error: `Proposal cannot be rejected. Current status: ${existingProposal.status}`,
      });
    }

    // Use transaction to atomically: create approval, update proposal, write audit log
    const result = await prisma.$transaction(async (tx: any) => {
      // Create Approval record with REJECTED action
      const approval = await tx.approval.create({
        data: {
          proposalId: id,
          actor: rejector,
          action: "REJECTED",
          reason,
        },
      });

      // Update proposal status
      const updatedProposal = await tx.proposal.update({
        where: { id },
        data: { status: "REJECTED" },
      });

      // Write REJECTED audit log
      await tx.auditLog.create({
        data: {
          proposalId: id,
          event: "REJECTED",
          actor: rejector,
          metadata: {
            approvalId: approval.id,
            previousStatus: existingProposal.status,
            reason,
          },
        },
      });

      return { approval, proposal: updatedProposal };
    });

    res.status(200).json({
      success: true,
      message: "Proposal rejected successfully",
      proposalId: id,
      rejector,
      reason,
      proposal: result.proposal,
    });
  } catch (error) {
    console.error("Error rejecting proposal:", error);
    res.status(500).json({ error: "Failed to reject proposal" });
  }
});

router.get("/diff/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Fetch proposal by id
    const proposal = await prisma.proposal.findUnique({
      where: { id },
      select: {
        id: true,
        ticketTitle: true,
        summary: true,
        diff: true,
        tier: true,
        riskScore: true,
        riskReasons: true,
        confidence: true,
        filesToModify: true,
        status: true,
        createdAt: true,
      },
    });

    if (!proposal) {
      return res.status(404).json({ error: "Proposal not found" });
    }

    // Return proposal details with diff
    res.status(200).json({
      id: proposal.id,
      title: proposal.ticketTitle,
      summary: proposal.summary,
      diff: proposal.diff,
      tier: proposal.tier,
      riskScore: proposal.riskScore,
      riskReasons: proposal.riskReasons,
      confidence: proposal.confidence,
      filesToModify: proposal.filesToModify,
      status: proposal.status,
      createdAt: proposal.createdAt,
    });
  } catch (error) {
    console.error("Error fetching diff:", error);
    res.status(500).json({ error: "Failed to fetch diff" });
  }
});

// POST /hotfix/:id/apply — Apply a selected hotfix (Slack button callback)
router.get("/hotfix/:id/apply", async (req: Request, res: Response) => {
  const { id } = req.params;
  const actor = (req.query.actor as string) ?? "unknown";
  try {
    executeHotfix(id, actor).catch((err) =>
      console.error("[approval] executeHotfix failed:", (err as Error).message)
    );
    res.json({ ok: true, hotfixId: id, actor });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
