import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";

// Lightweight shape for proposal aggregation (avoids needing generated Prisma types)
interface ProposalRow {
  tier: string;
  status: string;
  riskScore: number;
  failSafeTriggered: boolean;
}

// GET /audit/feed    — Real-time audit log (polled by dashboard)
// GET /audit/report  — Generate compliance report
const router: Router  = Router();

router.get("/feed", async (req: Request, res: Response) => {
  try {
    const since = req.query.since as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

    const feed = await prisma.auditLog.findMany({
      where: since
        ? { createdAt: { gt: new Date(since) } }
        : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        proposal: {
          select: {
            ticketTitle: true,
            tier: true,
            repo: true,
          },
        },
      },
    });

    res.status(200).json({ feed, count: feed.length });
  } catch (error) {
    console.error("Error fetching audit feed:", error);
    res.status(500).json({ error: "Failed to fetch audit feed" });
  }
});

router.get("/report", async (req: Request, res: Response) => {
  try {
    // Determine reporting window (default: last 24 hours)
    const hoursBack = parseInt(req.query.hours as string) || 24;
    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

    // Fetch all proposals in the reporting window
    const proposals: ProposalRow[] = await prisma.proposal.findMany({
      where: { createdAt: { gte: since } },
      select: { tier: true, status: true, riskScore: true, failSafeTriggered: true },
    });

    // Fetch audit logs in the reporting window
    const auditLogs = await prisma.auditLog.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "asc" },
    });

    // Aggregate stats
    const totalProposals = proposals.length;
    const byTier = {
      GREEN: proposals.filter((p) => p.tier === "GREEN").length,
      YELLOW: proposals.filter((p) => p.tier === "YELLOW").length,
      RED: proposals.filter((p) => p.tier === "RED").length,
    };
    const byStatus = {
      PENDING: proposals.filter((p) => p.status === "PENDING").length,
      AUTO_EXECUTED: proposals.filter((p) => p.status === "AUTO_EXECUTED").length,
      AWAITING_APPROVAL: proposals.filter((p) => p.status === "AWAITING_APPROVAL").length,
      APPROVED: proposals.filter((p) => p.status === "APPROVED").length,
      REJECTED: proposals.filter((p) => p.status === "REJECTED").length,
      VETOED: proposals.filter((p) => p.status === "VETOED").length,
      EXECUTED: proposals.filter((p) => p.status === "EXECUTED").length,
      FAILED: proposals.filter((p) => p.status === "FAILED").length,
    };

    const approvedCount = proposals.filter(
      (p) => p.status === "APPROVED" || p.status === "EXECUTED" || p.status === "AUTO_EXECUTED"
    ).length;
    const rejectedCount = proposals.filter((p) => p.status === "REJECTED").length;
    const decidedCount = approvedCount + rejectedCount;
    const approvalRate = decidedCount > 0 ? approvedCount / decidedCount : null;

    const avgRiskScore =
      totalProposals > 0
        ? Math.round(proposals.reduce((sum, p) => sum + p.riskScore, 0) / totalProposals)
        : null;

    const failSafeCount = proposals.filter((p) => p.failSafeTriggered).length;

    res.status(200).json({
      reportingWindow: {
        since: since.toISOString(),
        until: new Date().toISOString(),
        hoursBack,
      },
      summary: {
        totalProposals,
        byTier,
        byStatus,
        approvalRate: approvalRate !== null ? `${(approvalRate * 100).toFixed(1)}%` : "N/A",
        avgRiskScore,
        failSafeTriggered: failSafeCount,
      },
      totalAuditEvents: auditLogs.length,
      auditLogs,
    });
  } catch (error) {
    console.error("Error generating audit report:", error);
    res.status(500).json({ error: "Failed to generate audit report" });
  }
});

export default router;
