import { Router, Request, Response } from "express";
import { IncidentInput } from "../types";
import { prisma } from "../lib/prisma";
import { writeAuditLog } from "../services/audit";
import { rankHotfixes, HotfixCandidate } from "../agents/incident";
import { sendHotfixCard } from "../integrations/slack";

// POST /incident — Declare an incident
// Body: IncidentInput { description, logs, repo, reporter }
const router: Router = Router();

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
