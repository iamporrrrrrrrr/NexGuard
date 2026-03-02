import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { executeHotfix, executeProposal } from "../services/executor";
import { getPolicy } from "../config/policy";

// GET /approve/:id  — Approve a proposal (Slack button callback)
// GET /reject/:id   — Reject a proposal (Slack button callback)
// GET /veto/:id     — Veto a YELLOW-tier auto-executed proposal within veto window
// GET /diff/:id     — View full diff for a proposal
const router: Router = Router();

function wantsBrowserHtml(req: Request): boolean {
  const accept = req.headers.accept || "";
  return accept.includes("text/html");
}

function renderHtmlPage(
  title: string,
  emoji: string,
  message: string,
  detail: string = "",
): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title} — NexGuard</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#0f172a;color:#e2e8f0}
.card{background:#1e293b;border-radius:16px;padding:48px;text-align:center;max-width:480px;box-shadow:0 25px 50px rgba(0,0,0,.5)}
.emoji{font-size:64px;margin-bottom:16px}.title{font-size:24px;font-weight:700;margin-bottom:8px}.detail{color:#94a3b8;font-size:14px;margin-top:12px}
.close{margin-top:24px;color:#64748b;font-size:13px}</style></head>
<body><div class="card"><div class="emoji">${emoji}</div><div class="title">${title}</div><p>${message}</p>${detail ? `<p class="detail">${detail}</p>` : ""}<p class="close">You can close this tab.</p></div></body></html>`;
}

router.get("/approve/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const approver = (req.query.approver as string) || "unknown";

    // Validate proposal exists and status
    const existingProposal = await prisma.proposal.findUnique({
      where: { id },
      select: { id: true, status: true, ticketTitle: true },
    });

    if (!existingProposal) {
      if (wantsBrowserHtml(req))
        return res
          .status(404)
          .send(renderHtmlPage("Not Found", "❌", "Proposal not found."));
      return res.status(404).json({ error: "Proposal not found" });
    }

    if (existingProposal.status !== "AWAITING_APPROVAL") {
      if (wantsBrowserHtml(req))
        return res
          .status(400)
          .send(
            renderHtmlPage(
              "Already Handled",
              "⚠️",
              `This proposal was already ${existingProposal.status.toLowerCase().replace(/_/g, " ")}.`,
            ),
          );
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

    if (wantsBrowserHtml(req)) {
      return res
        .status(200)
        .send(
          renderHtmlPage(
            "Proposal Approved",
            "✅",
            `"${existingProposal.ticketTitle}" has been approved by ${approver}.`,
            prUrl
              ? `PR created: <a href="${prUrl}" style="color:#38bdf8">${prUrl}</a>`
              : "Execution pending.",
          ),
        );
    }
    res.status(200).json({
      success: true,
      message: prUrl
        ? "Proposal approved and PR created"
        : "Proposal approved (execution pending)",
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
    const rejector = (req.query.rejector as string) || "unknown";
    const reason = (req.query.reason as string) || "No reason provided";

    // Validate proposal exists and status
    const existingProposal = await prisma.proposal.findUnique({
      where: { id },
      select: { id: true, status: true, ticketTitle: true },
    });

    if (!existingProposal) {
      if (wantsBrowserHtml(req))
        return res
          .status(404)
          .send(renderHtmlPage("Not Found", "❌", "Proposal not found."));
      return res.status(404).json({ error: "Proposal not found" });
    }

    if (existingProposal.status !== "AWAITING_APPROVAL") {
      if (wantsBrowserHtml(req))
        return res
          .status(400)
          .send(
            renderHtmlPage(
              "Already Handled",
              "⚠️",
              `This proposal was already ${existingProposal.status.toLowerCase().replace(/_/g, " ")}.`,
            ),
          );
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

    if (wantsBrowserHtml(req)) {
      return res
        .status(200)
        .send(
          renderHtmlPage(
            "Proposal Rejected",
            "🚫",
            `"${existingProposal.ticketTitle}" has been rejected by ${rejector}.`,
            reason !== "No reason provided" ? `Reason: ${reason}` : "",
          ),
        );
    }
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
      select: {
        id: true,
        status: true,
        tier: true,
        ticketTitle: true,
        createdAt: true,
      },
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
      if (wantsBrowserHtml(req))
        return res
          .status(404)
          .send(renderHtmlPage("Not Found", "❌", "Proposal not found."));
      return res.status(404).json({ error: "Proposal not found" });
    }

    // If browser request (from Slack button), render HTML diff page
    if (wantsBrowserHtml(req)) {
      const tierColors: Record<string, string> = {
        GREEN: "#22c55e",
        YELLOW: "#eab308",
        RED: "#ef4444",
      };
      const tierColor = tierColors[proposal.tier] || "#64748b";
      const escapedDiff = proposal.diff
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Diff — ${proposal.ticketTitle}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;padding:24px}
.header{max-width:960px;margin:0 auto 24px}
.tier{display:inline-block;padding:4px 12px;border-radius:6px;font-weight:700;font-size:13px;color:#fff;background:${tierColor}}
h1{font-size:22px;margin:12px 0 4px}
.meta{color:#94a3b8;font-size:14px;margin-bottom:8px}
.summary{background:#1e293b;border-radius:8px;padding:16px;margin:12px 0;font-size:14px;line-height:1.6}
.risks{margin:12px 0}.risks li{color:#fbbf24;font-size:13px;margin-left:20px;margin-bottom:4px}
.diff-container{max-width:960px;margin:0 auto;background:#1e293b;border-radius:8px;overflow:auto}
pre{padding:16px;font-family:'Fira Code','Cascadia Code',monospace;font-size:13px;line-height:1.5;white-space:pre;tab-size:4}
.line-add{color:#4ade80;background:rgba(34,197,94,.1)}.line-del{color:#f87171;background:rgba(239,68,68,.1)}.line-hunk{color:#60a5fa;font-weight:700}
.files{color:#94a3b8;font-size:13px;margin:8px 0}.files code{background:#334155;padding:2px 6px;border-radius:4px;margin-right:6px;font-size:12px}
.status{display:inline-block;padding:3px 10px;border-radius:4px;font-size:12px;font-weight:600;background:#334155;margin-left:8px}
</style></head><body>
<div class="header">
  <span class="tier">${proposal.tier}</span>
  <span class="status">${proposal.status}</span>
  <span class="meta" style="float:right">Risk ${proposal.riskScore}/100 · Confidence ${(proposal.confidence * 100).toFixed(0)}%</span>
  <h1>${proposal.ticketTitle}</h1>
  <div class="summary">${proposal.summary}</div>
  <div class="files">Files: ${proposal.filesToModify.map((f: string) => `<code>${f}</code>`).join("")}</div>
  ${proposal.riskReasons.length ? `<ul class="risks">${proposal.riskReasons.map((r: string) => `<li>${r}</li>`).join("")}</ul>` : ""}
</div>
<div class="diff-container"><pre>${escapedDiff
        .split("\n")
        .map((line: string) => {
          if (line.startsWith("+"))
            return `<span class="line-add">${line}</span>`;
          if (line.startsWith("-"))
            return `<span class="line-del">${line}</span>`;
          if (line.startsWith("@@"))
            return `<span class="line-hunk">${line}</span>`;
          return line;
        })
        .join("\n")}</pre></div>
</body></html>`;
      return res.status(200).type("html").send(html);
    }

    // JSON response for API consumers
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

// POST /hotfix/:id/apply — Apply a selected hotfix (Slack button callback)
router.get("/hotfix/:id/apply", async (req: Request, res: Response) => {
  const { id } = req.params;
  const actor = (req.query.actor as string) ?? "unknown";
  try {
    executeHotfix(id, actor).catch((err) =>
      console.error("[approval] executeHotfix failed:", (err as Error).message),
    );
    res.json({ ok: true, hotfixId: id, actor });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
