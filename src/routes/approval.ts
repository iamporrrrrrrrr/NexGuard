import { Router, Request, Response } from "express";

// GET /approve/:id  — Approve a proposal (Slack button callback)
// GET /reject/:id   — Reject a proposal (Slack button callback)
// GET /diff/:id     — View full diff for a proposal
const router = Router();

router.get("/approve/:id", async (req: Request, res: Response) => {
  // TODO:
  // 1. Validate proposal exists and is AWAITING_APPROVAL
  // 2. Use prisma.$transaction to:
  //    a. Create Approval record (action: APPROVED)
  //    b. Update proposal status to APPROVED
  //    c. Write APPROVED audit log
  // 3. Trigger executor to apply the diff and open PR
  // 4. Return confirmation
  res.status(501).json({ error: "Not implemented" });
});

router.get("/reject/:id", async (req: Request, res: Response) => {
  // TODO:
  // 1. Validate proposal exists and is AWAITING_APPROVAL
  // 2. Use prisma.$transaction to:
  //    a. Create Approval record (action: REJECTED)
  //    b. Update proposal status to REJECTED
  //    c. Write REJECTED audit log
  // 3. Return confirmation
  res.status(501).json({ error: "Not implemented" });
});

router.get("/diff/:id", async (req: Request, res: Response) => {
  // TODO:
  // 1. Fetch proposal by id
  // 2. Return proposal.diff
  res.status(501).json({ error: "Not implemented" });
});

export default router;
