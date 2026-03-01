import { Router, Request, Response } from "express";

// POST /slack/events — Slack interactive component callback
const router = Router();

router.post("/events", async (req: Request, res: Response) => {
  // TODO:
  // 1. Parse Slack payload (url-encoded JSON in req.body.payload)
  // 2. Verify Slack signing secret
  // 3. Dispatch by action_id:
  //    - "approve_proposal" → call approval logic
  //    - "reject_proposal"  → call rejection logic
  //    - "apply_hotfix"     → call hotfix application logic
  // 4. Respond with 200 immediately (Slack requires < 3s response)
  res.status(200).send();
});

export default router;
