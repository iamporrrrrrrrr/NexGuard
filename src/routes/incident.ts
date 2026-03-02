import { Router, Request, Response } from "express";
import { IncidentInput } from "../types";
import { prisma } from "../lib/prisma";
import { writeAuditLog } from "../services/audit";
import { rankHotfixes, HotfixCandidate } from "../agents/incident";
import { sendHotfixCard } from "../integrations/slack";
import { executeHotfix } from "../services/executor";

// ---------------------------------------------------------------------------
// Incident routes
// ---------------------------------------------------------------------------
const router: Router = Router();

// ── GET / — List all incidents (with hotfixes) ──────────────────────────
router.get("/", async (_req: Request, res: Response) => {
  try {
    const incidents = await prisma.incident.findMany({
      orderBy: { createdAt: "desc" },
      include: { hotfixes: { orderBy: { confidence: "desc" } } },
    });
    res.json({ incidents });
  } catch (err) {
    console.error("[incident] list error:", err);
    res.status(500).json({ error: "Failed to list incidents" });
  }
});

// ── GET /:id — Single incident with hotfixes ────────────────────────────
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const incident = await prisma.incident.findUnique({
      where: { id: req.params.id },
      include: { hotfixes: { orderBy: { confidence: "desc" } } },
    });
    if (!incident) {
      res.status(404).json({ error: "Incident not found" });
      return;
    }
    res.json(incident);
  } catch (err) {
    console.error("[incident] get error:", err);
    res.status(500).json({ error: "Failed to get incident" });
  }
});

// ── POST /:id/apply/:hotfixId — Apply a hotfix (creates branch + PR) ───
router.post("/:id/apply/:hotfixId", async (req: Request, res: Response) => {
  try {
    const { id, hotfixId } = req.params;
    const appliedBy = (req.query.appliedBy as string) || "dashboard-user";

    // Verify hotfix belongs to this incident
    const hotfix = await prisma.hotfix.findUnique({ where: { id: hotfixId } });
    if (!hotfix || hotfix.incidentId !== id) {
      res.status(404).json({ error: "Hotfix not found for this incident" });
      return;
    }
    if (hotfix.status === "APPLIED") {
      res.status(409).json({ error: "Hotfix already applied" });
      return;
    }

    const { prUrl } = await executeHotfix(hotfixId, appliedBy);
    res.json({ success: true, prUrl, hotfixId });
  } catch (err) {
    console.error("[incident] apply hotfix error:", err);
    res.status(500).json({ error: "Failed to apply hotfix", detail: (err as Error).message });
  }
});

// ── POST /:id/resolve — Manually resolve an incident ────────────────────
router.post("/:id/resolve", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const actor = (req.query.actor as string) || "dashboard-user";

    const incident = await prisma.incident.findUnique({ where: { id } });
    if (!incident) {
      res.status(404).json({ error: "Incident not found" });
      return;
    }
    if (incident.status === "RESOLVED") {
      res.status(409).json({ error: "Incident already resolved" });
      return;
    }

    await prisma.incident.update({
      where: { id },
      data: { status: "RESOLVED", resolvedAt: new Date() },
    });

    await writeAuditLog("INCIDENT_DECLARED", actor, undefined, {
      incidentId: id,
      action: "RESOLVED",
    });

    res.json({ success: true, incidentId: id, status: "RESOLVED" });
  } catch (err) {
    console.error("[incident] resolve error:", err);
    res.status(500).json({ error: "Failed to resolve incident" });
  }
});

// ── POST / — Declare a new incident ─────────────────────────────────────
router.post("/", async (req: Request, res: Response) => {
  try {
    // 1. Validate request body
    const { description, logs, repo, reporter } = req.body as IncidentInput;
    if (!description || !logs || !repo || !reporter) {
      res.status(400).json({ error: "Missing required fields: description, logs, repo, reporter" });
      return;
    }

    const input: IncidentInput = { description, logs, repo, reporter };

    // 2. Persist incident to DB
    const incident = await prisma.incident.create({
      data: {
        description,
        logs,
        repo,
        reporter,
        status: "ACTIVE",
      },
    });

    // 3. Write INCIDENT_DECLARED audit log
    await writeAuditLog("INCIDENT_DECLARED", reporter, undefined, {
      incidentId: incident.id,
      repo,
    });

    // 4. Rank hotfix candidates within 45-second countdown
    //    Falls back to empty array if agent not yet implemented
    let candidates: HotfixCandidate[] = [];
    try {
      const COUNTDOWN_MS = 45_000;
      candidates = await Promise.race<HotfixCandidate[]>([
        rankHotfixes(input),
        new Promise<HotfixCandidate[]>((_, reject) =>
          setTimeout(() => reject(new Error("Incident agent timed out after 45s")), COUNTDOWN_MS)
        ),
      ]);
    } catch (agentErr) {
      console.warn("[incident] rankHotfixes failed or timed out:", (agentErr as Error).message);
      // Fail safe: continue with empty candidates rather than blocking response
    }

    // 5. Persist hotfix candidates to DB
    if (candidates.length > 0) {
      await prisma.hotfix.createMany({
        data: candidates.map((c) => ({
          incidentId: incident.id,
          summary: c.summary,
          diff: c.diff,
          confidence: c.confidence,
          blastRadius: c.blastRadius,
          status: "PENDING",
        })),
      });
    }

    // 6. Post Slack card with ranked hotfixes for human selection
    try {
      await sendHotfixCard(incident.id);
    } catch (slackErr) {
      console.warn("[incident] sendHotfixCard failed:", (slackErr as Error).message);
      // Non-fatal — incident is still recorded even if Slack is unavailable
    }

    // 7. Return incident id and hotfix candidates
    res.status(201).json({
      incidentId: incident.id,
      status: incident.status,
      hotfixCandidates: candidates.map((c, i) => ({
        rank: i + 1,
        summary: c.summary,
        confidence: c.confidence,
        blastRadius: c.blastRadius,
      })),
    });
  } catch (err) {
    console.error("[incident] Unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
