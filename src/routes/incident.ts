import { Router, Request, Response } from "express";

// POST /incident — Declare an incident
// Body: IncidentInput { description, logs, repo, reporter }
const router = Router();

router.post("/", async (req: Request, res: Response) => {
  // TODO:
  // 1. Validate request body as IncidentInput
  // 2. Persist incident to DB via prisma.incident.create
  // 3. Write INCIDENT_DECLARED audit log entry
  // 4. Call incident agent to rank hotfix candidates (45-second countdown)
  // 5. Persist hotfixes to DB via prisma.hotfix.createMany
  // 6. Post Slack card with ranked hotfixes for human selection
  // 7. Return incident id and hotfix candidates
  res.status(501).json({ error: "Not implemented" });
});

export default router;
