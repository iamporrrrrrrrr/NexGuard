import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import axios from "axios";
import * as crypto from "crypto";

// POST /slack/events — Slack interactive component callback
const router: Router = Router();

// Verify Slack request signature
function verifySlackSignature(
  signingSecret: string,
  requestSignature: string,
  timestamp: string,
  body: string
): boolean {
  // Slack signature verification
  const time = Math.floor(Date.now() / 1000);
  if (Math.abs(time - parseInt(timestamp)) > 60 * 5) {
    // Request is older than 5 minutes
    return false;
  }

  const sigBasestring = `v0:${timestamp}:${body}`;
  const mySignature =
    "v0=" +
    crypto.createHmac("sha256", signingSecret).update(sigBasestring).digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(mySignature, "utf8"),
    Buffer.from(requestSignature, "utf8")
  );
}

router.post("/events", async (req: Request, res: Response) => {
  try {
    // Respond immediately to Slack (they require < 3s response)
    res.status(200).json({ ok: true });

    // Parse Slack payload (url-encoded JSON)
    const payload = JSON.parse(req.body.payload || "{}");
    
    // Slack sends a URL verification challenge on first setup
    if (payload.type === "url_verification") {
      return res.status(200).json({ challenge: payload.challenge });
    }

    // Extract action information
    const action = payload.actions?.[0];
    if (!action) {
      console.warn("No action found in Slack payload");
      return;
    }

    const actionId = action.action_id;
    const user = payload.user?.username || payload.user?.name || "unknown";
    const responseUrl = payload.response_url;
    const originalMessage = payload.message;

    console.log(`Slack action received: ${actionId} from ${user}`);

    // Dispatch based on action_id
    switch (actionId) {
      case "approve_proposal": {
        const proposalId = action.value || extractIdFromUrl(action.url);
        if (proposalId) {
          await handleApproval(proposalId, user, responseUrl, originalMessage);
        }
        break;
      }

      case "reject_proposal": {
        const proposalId = action.value || extractIdFromUrl(action.url);
        if (proposalId) {
          await handleRejection(proposalId, user, responseUrl, originalMessage);
        }
        break;
      }

      case "apply_hotfix": {
        const hotfixId = action.value;
        if (hotfixId) {
          // TODO: Implement hotfix application
          console.log(`Hotfix ${hotfixId} application requested by ${user}`);
        }
        break;
      }

      default:
        console.log(`Unknown action_id: ${actionId}`);
    }
  } catch (error) {
    console.error("Error handling Slack event:", error);
    // Already responded to Slack, just log the error
  }
});

// Helper to extract proposal ID from URL
function extractIdFromUrl(url: string): string | null {
  if (!url) return null;
  const match = url.match(/\/(approve|reject|diff)\/([a-zA-Z0-9-]+)/);
  return match ? match[2] : null;
}

// Update the Slack message to remove buttons and show result
async function updateSlackMessage(
  responseUrl: string | undefined,
  originalMessage: any,
  emoji: string,
  statusText: string,
  user: string
): Promise<void> {
  if (!responseUrl) return;
  try {
    // Keep original blocks but strip the actions block, append a result context block
    const updatedBlocks = (originalMessage?.blocks || [])
      .filter((b: any) => b.type !== "actions")
      .concat([
        { type: "divider" },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `${emoji} *${statusText}* by <@${user}> at <!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} {time}|${new Date().toISOString()}>`,
          },
        },
      ]);

    await axios.post(responseUrl, {
      replace_original: true,
      blocks: updatedBlocks,
      text: `${statusText} by ${user}`,
    });
  } catch (err) {
    console.warn("Failed to update Slack message:", (err as Error).message);
  }
}

// Handle approval action
async function handleApproval(proposalId: string, approver: string, responseUrl?: string, originalMessage?: any): Promise<void> {
  try {
    // Check if already handled (URL button may have fired first)
    const existing = await prisma.proposal.findUnique({ where: { id: proposalId }, select: { status: true, ticketTitle: true } });
    if (!existing || existing.status !== "AWAITING_APPROVAL") {
      console.log(`Proposal ${proposalId} already ${existing?.status ?? "gone"} — skipping Slack handler`);
      await updateSlackMessage(responseUrl, originalMessage, "✅", `Already ${existing?.status?.toLowerCase().replace(/_/g, " ") ?? "handled"}`, approver);
      return;
    }

    const result = await prisma.$transaction(async (tx: any) => {
      const approval = await tx.approval.create({
        data: {
          proposalId,
          actor: approver,
          action: "APPROVED",
          reason: "Approved via Slack interactive component",
        },
      });

      const proposal = await tx.proposal.update({
        where: { id: proposalId },
        data: { status: "APPROVED" },
      });

      await tx.auditLog.create({
        data: {
          proposalId,
          event: "APPROVED",
          actor: approver,
          metadata: { approvalId: approval.id, source: "slack" },
        },
      });

      return { approval, proposal };
    });

    await updateSlackMessage(responseUrl, originalMessage, "✅", "Approved", approver);
    console.log(`✓ Proposal ${proposalId} approved by ${approver} via Slack`);
  } catch (error) {
    console.error(`Failed to approve proposal ${proposalId}:`, error);
  }
}

// Handle rejection action
async function handleRejection(proposalId: string, rejector: string, responseUrl?: string, originalMessage?: any): Promise<void> {
  try {
    // Check if already handled (URL button may have fired first)
    const existing = await prisma.proposal.findUnique({ where: { id: proposalId }, select: { status: true, ticketTitle: true } });
    if (!existing || existing.status !== "AWAITING_APPROVAL") {
      console.log(`Proposal ${proposalId} already ${existing?.status ?? "gone"} — skipping Slack handler`);
      await updateSlackMessage(responseUrl, originalMessage, "⚠️", `Already ${existing?.status?.toLowerCase().replace(/_/g, " ") ?? "handled"}`, rejector);
      return;
    }

    const result = await prisma.$transaction(async (tx: any) => {
      const approval = await tx.approval.create({
        data: {
          proposalId,
          actor: rejector,
          action: "REJECTED",
          reason: "Rejected via Slack interactive component",
        },
      });

      const proposal = await tx.proposal.update({
        where: { id: proposalId },
        data: { status: "REJECTED" },
      });

      await tx.auditLog.create({
        data: {
          proposalId,
          event: "REJECTED",
          actor: rejector,
          metadata: { approvalId: approval.id, source: "slack" },
        },
      });

      return { approval, proposal };
    });

    await updateSlackMessage(responseUrl, originalMessage, "🚫", "Rejected", rejector);
    console.log(`✓ Proposal ${proposalId} rejected by ${rejector} via Slack`);
  } catch (error) {
    console.error(`Failed to reject proposal ${proposalId}:`, error);
  }
}

export default router;
