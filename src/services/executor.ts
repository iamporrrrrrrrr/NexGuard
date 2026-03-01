// Applies approved diffs to the repo and opens a Pull Request

import { prisma } from "../lib/prisma";
import { writeAuditLog } from "./audit";
import { createBranch, applyDiff, openPR } from "../integrations/github";
import { generatePRDescription } from "../agents/communication";

// Sanitise a string into a valid git branch name segment
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

// ---------------------------------------------------------------------------
// executeProposal
// ---------------------------------------------------------------------------

// Apply a proposal's diff to the repo and open a PR
export async function executeProposal(proposalId: string): Promise<{ prUrl: string }> {
  // 1. Fetch proposal from DB
  const proposal = await prisma.proposal.findUniqueOrThrow({
    where: { id: proposalId },
  });

  const branch = `devguard/${slugify(proposal.ticketTitle)}-${proposalId.slice(0, 8)}`;

  try {
    // 2. Create branch off main
    await createBranch(proposal.repo, branch);

    // 3 + 4. Apply diff (commits each changed file to the branch)
    await applyDiff(
      proposal.repo,
      branch,
      proposal.diff,
      `fix: ${proposal.ticketTitle} [DevGuard]`
    );

    // 5. Generate PR description from audit trail (falls back to summary if not yet implemented)
    let prBody: string;
    try {
      prBody = await generatePRDescription(proposalId);
    } catch {
      prBody = `**DevGuard Auto-PR**\n\n${proposal.summary}\n\n> Proposal ID: ${proposalId}`;
    }

    // 6. Open PR
    const prUrl = await openPR(
      proposal.repo,
      branch,
      `[DevGuard] ${proposal.ticketTitle}`,
      prBody
    );

    // 7. Update proposal status + write audit log atomically
    await prisma.$transaction([
      prisma.proposal.update({
        where: { id: proposalId },
        data: { status: "EXECUTED" },
      }),
      prisma.auditLog.create({
        data: {
          proposalId,
          event: "EXECUTED",
          actor: "system",
          metadata: { prUrl, branch },
        },
      }),
    ]);

    return { prUrl };
  } catch (err) {
    // Mark as FAILED and log — never leave proposal in a dangling state
    await prisma.$transaction([
      prisma.proposal.update({
        where: { id: proposalId },
        data: { status: "FAILED" },
      }),
      prisma.auditLog.create({
        data: {
          proposalId,
          event: "FAILED",
          actor: "system",
          metadata: { error: (err as Error).message, branch },
        },
      }),
    ]);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// executeHotfix
// ---------------------------------------------------------------------------

// Apply a hotfix to the repo (incident mode)
export async function executeHotfix(hotfixId: string, appliedBy: string): Promise<{ prUrl: string }> {
  // 1. Fetch hotfix + parent incident from DB
  const hotfix = await prisma.hotfix.findUniqueOrThrow({
    where: { id: hotfixId },
    include: { incident: true },
  });

  const branch = `devguard/hotfix-${hotfix.incidentId.slice(0, 8)}-${hotfixId.slice(0, 8)}`;

  // 2. Create branch, apply diff, open emergency PR
  await createBranch(hotfix.incident.repo, branch);

  await applyDiff(
    hotfix.incident.repo,
    branch,
    hotfix.diff,
    `hotfix: ${hotfix.summary} [DevGuard emergency]`
  );

  const prBody = [
    `**🚨 DevGuard Emergency Hotfix**`,
    ``,
    `**Incident:** ${hotfix.incident.description}`,
    `**Hotfix:** ${hotfix.summary}`,
    `**Blast Radius:** ${hotfix.blastRadius}`,
    `**Confidence:** ${(hotfix.confidence * 100).toFixed(0)}%`,
    `**Applied by:** ${appliedBy}`,
    ``,
    `> Hotfix ID: ${hotfixId} | Incident ID: ${hotfix.incidentId}`,
  ].join("\n");

  const prUrl = await openPR(
    hotfix.incident.repo,
    branch,
    `[DevGuard HOTFIX] ${hotfix.summary}`,
    prBody
  );

  // 3 + 4. Update hotfix status + write audit log atomically
  await prisma.$transaction([
    prisma.hotfix.update({
      where: { id: hotfixId },
      data: {
        status: "APPLIED",
        appliedBy,
        appliedAt: new Date(),
      },
    }),
    prisma.auditLog.create({
      data: {
        event: "HOTFIX_APPLIED",
        actor: appliedBy,
        metadata: { hotfixId, incidentId: hotfix.incidentId, prUrl, branch },
      },
    }),
  ]);

  return { prUrl };
}
