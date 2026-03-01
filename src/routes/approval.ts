import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { executeProposal } from "../services/executor";
import { getPolicy } from "../config/policy";

// GET /approve/:id  — Approve a proposal (Slack button callback)
// GET /reject/:id   — Reject a proposal (Slack button callback)
// GET /veto/:id     — Veto a YELLOW-tier auto-executed proposal within veto window
// GET /diff/:id     — View full diff for a proposal
const router: Router = Router();

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

    // Trigger executor to apply diff and open PR
    let prUrl: string | null = null;
    try {
      const execResult = await executeProposal(id);
      prUrl = execResult.prUrl;
    } catch (execError) {
      console.error("Executor failed after approval:", execError);
      // Approval is recorded, but execution failed — proposal marked FAILED inside executor
    }

    res.status(200).json({
      success: true,
      message: prUrl ? "Proposal approved and PR created" : "Proposal approved (execution pending)",
      proposalId: id,
      approver,
      proposal: result.proposal,
      ...(prUrl && { prUrl }),
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

router.get("/veto/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const vetoer = (req.query.vetoer as string) || "unknown";
    const reason = (req.query.reason as string) || "No reason provided";

    // Validate proposal exists
    const existingProposal = await prisma.proposal.findUnique({
      where: { id },
      select: { id: true, status: true, tier: true, ticketTitle: true, createdAt: true },
    });

    if (!existingProposal) {
      return res.status(404).json({ error: "Proposal not found" });
    }

    // Only AUTO_EXECUTED YELLOW-tier proposals can be vetoed
    if (existingProposal.status !== "AUTO_EXECUTED") {
      return res.status(400).json({
        error: `Proposal cannot be vetoed. Current status: ${existingProposal.status}`,
      });
    }

    if (existingProposal.tier !== "YELLOW") {
      return res.status(400).json({
        error: `Only YELLOW-tier proposals can be vetoed. This proposal is ${existingProposal.tier}.`,
      });
    }

    // Check veto window from policy
    const policy = getPolicy();
    const vetoWindowHours = policy.risk.yellow.veto_window_hours;
    const elapsedMs = Date.now() - existingProposal.createdAt.getTime();
    const vetoWindowMs = vetoWindowHours * 60 * 60 * 1000;

    if (elapsedMs > vetoWindowMs) {
      return res.status(400).json({
        error: `Veto window expired. The ${vetoWindowHours}-hour window closed at ${new Date(existingProposal.createdAt.getTime() + vetoWindowMs).toISOString()}.`,
      });
    }

    // Use transaction to atomically: create approval (VETOED), update proposal, write audit log
    const result = await prisma.$transaction(async (tx: any) => {
      const approval = await tx.approval.create({
        data: {
          proposalId: id,
          actor: vetoer,
          action: "VETOED",
          reason,
        },
      });

      const updatedProposal = await tx.proposal.update({
        where: { id },
        data: { status: "VETOED" },
      });

      await tx.auditLog.create({
        data: {
          proposalId: id,
          event: "VETOED",
          actor: vetoer,
          metadata: {
            approvalId: approval.id,
            previousStatus: existingProposal.status,
            reason,
            elapsedMinutes: Math.round(elapsedMs / 60000),
          },
        },
      });

      return { approval, proposal: updatedProposal };
    });

    res.status(200).json({
      success: true,
      message: "Proposal vetoed successfully",
      proposalId: id,
      vetoer,
      reason,
      proposal: result.proposal,
    });
  } catch (error) {
    console.error("Error vetoing proposal:", error);
    res.status(500).json({ error: "Failed to veto proposal" });
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

export default router;
