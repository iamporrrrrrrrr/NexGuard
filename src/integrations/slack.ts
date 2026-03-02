import axios from "axios";
import { prisma } from "../lib/prisma";

// Slack Webhooks + Interactive Components

// Send an approval card to Slack for a RED/YELLOW proposal
export async function sendApprovalCard(proposalId: string): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  const appUrl = process.env.DEVGUARD_APP_URL || "http://localhost:3000";

  if (!webhookUrl) {
    console.warn(
      "SLACK_WEBHOOK_URL not configured. Skipping approval card for proposal:",
      proposalId
    );
    return;
  }

  try {
    // Fetch proposal from prisma
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      select: {
        id: true,
        ticketTitle: true,
        summary: true,
        tier: true,
        riskScore: true,
        riskReasons: true,
        confidence: true,
        filesToModify: true,
        repo: true,
        reporter: true,
        status: true,
        testCoverageAffected: true,
        createdAt: true,
      },
    });

    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    // Tier badge emoji
    const tierMap: Record<string, string> = {
      GREEN: ":large_green_circle:",
      YELLOW: ":large_yellow_circle:",
      RED: ":red_circle:",
    };
    const tierEmoji = tierMap[proposal.tier] || ":white_circle:";

    // Build Slack Block Kit message
    const blocks: any[] = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${tierEmoji} ${proposal.tier} Tier Proposal Awaiting Approval`,
          emoji: true,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Ticket:*\n${proposal.ticketTitle}`,
          },
          {
            type: "mrkdwn",
            text: `*Risk Score:*\n${proposal.riskScore}/100`,
          },
          {
            type: "mrkdwn",
            text: `*Confidence:*\n${(proposal.confidence * 100).toFixed(0)}%`,
          },
          {
            type: "mrkdwn",
            text: `*Reporter:*\n${proposal.reporter}`,
          },
        ],
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Summary:*\n${proposal.summary}`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Files to Modify:*\n${proposal.filesToModify.map((f: string) => `\`${f}\``).join(", ")}`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Risk Reasons:*\n${proposal.riskReasons.map((r: string) => `• ${r}`).join("\n")}`,
        },
      },
      {
        type: "divider",
      },
    ];

    // Add veto window for YELLOW tier
    if (proposal.tier === "YELLOW") {
      const vetoExpiry = new Date(proposal.createdAt);
      vetoExpiry.setHours(vetoExpiry.getHours() + 1); // 1 hour veto window
      
      blocks.push({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `:warning: *YELLOW tier:* Auto-executes at ${vetoExpiry.toLocaleTimeString()} unless vetoed`,
          },
        ],
      });
    }

    // Add deployment acknowledgment checkbox for deployment-related proposals
    const isDeployment = proposal.filesToModify.some((f: string) =>
      f.match(/deploy|docker|k8s|terraform|config/i)
    );

    if (isDeployment) {
      blocks.push({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: ":warning: *Deployment detected:* Please review carefully before approving",
          },
        ],
      });
    }

    // Action buttons
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: ":white_check_mark: Approve",
            emoji: true,
          },
          style: "primary",
          value: proposal.id,
          action_id: "approve_proposal",
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: ":x: Reject",
            emoji: true,
          },
          style: "danger",
          value: proposal.id,
          action_id: "reject_proposal",
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: ":mag: View Diff",
            emoji: true,
          },
          url: `${appUrl}/diff/${proposal.id}`,
          action_id: "view_diff",
        },
      ],
    });

    // Send to Slack
    await axios.post(webhookUrl, {
      blocks,
      text: `${proposal.tier} Tier Proposal: ${proposal.ticketTitle} awaiting approval`,
    });

    console.log(`✓ Approval card sent to Slack for proposal ${proposalId}`);
  } catch (error) {
    console.error("Failed to send approval card:", error);
    // Don't throw - Slack notifications should not break the main flow
  }
}

// Send a hotfix selection card to Slack (incident mode)
export async function sendHotfixCard(incidentId: string): Promise<void> {
  // TODO:
  // 1. Fetch incident + hotfix candidates from prisma
  // 2. Build Slack Block Kit message with ranked hotfix options
  // 3. POST to SLACK_WEBHOOK_URL
  throw new Error("Not implemented");
}

// Send a plain notification to Slack
export async function notify(message: string): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn(
      "SLACK_WEBHOOK_URL not configured. Skipping notification:",
      message
    );
    return;
  }

  try {
    await axios.post(webhookUrl, {
      text: message,
    });
    console.log("✓ Slack notification sent:", message.substring(0, 50) + "...");
  } catch (error) {
    console.error("Failed to send Slack notification:", error);
    // Don't throw - notifications should not break the main flow
  }
}
