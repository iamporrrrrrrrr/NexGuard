import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { generateChangelog } from "../agents/communication";

// GET /audit/feed    — Real-time audit log (polled by dashboard)
// GET /audit/report  — Generate compliance report
const router = Router();

router.get("/feed", async (_req: Request, res: Response) => {
  try {
    const feed = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        proposal: {
          select: { ticketTitle: true, tier: true, repo: true },
        },
      },
    });
    res.json(feed);
  } catch (err) {
    console.error("[audit/feed]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/report", async (_req: Request, res: Response) => {
  try {
    const [tierStats, statusStats, total] = await Promise.all([
      prisma.proposal.groupBy({ by: ["tier"], _count: { _all: true } }),
      prisma.proposal.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.proposal.count(),
    ]);

    const executed = await prisma.proposal.findMany({
      where: { status: { in: ["EXECUTED", "AUTO_EXECUTED"] } },
      select: { id: true },
    });

    const changelog = executed.length > 0
      ? await generateChangelog(executed.map((p) => p.id))
      : "No executed proposals yet.";

    res.json({
      total,
      byTier: Object.fromEntries(tierStats.map((s) => [s.tier, s._count._all])),
      byStatus: Object.fromEntries(statusStats.map((s) => [s.status, s._count._all])),
      changelog,
    });
  } catch (err) {
    console.error("[audit/report]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
