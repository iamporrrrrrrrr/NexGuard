import OpenAI from "openai";
import { prisma } from "../lib/prisma";

// Communication agent — generates PR descriptions, postmortems, changelogs
// Always reads from AuditLog — never from live state

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Generate a PR description from audit history
export async function generatePRDescription(proposalId: string): Promise<string> {
  try {
    // Fetch proposal and audit logs
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: {
        auditLogs: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    // Build context from audit trail
    const auditTrail = proposal.auditLogs
      .map(
        (log: any) =>
          `[${log.createdAt.toISOString()}] ${log.event} by ${log.actor}${
            log.metadata ? ` - ${JSON.stringify(log.metadata)}` : ""
          }`
      )
      .join("\n");

    const prompt = `You are a technical writer creating a Pull Request description.

**Proposal Details:**
- Title: ${proposal.ticketTitle}
- Description: ${proposal.ticketDescription}
- Tier: ${proposal.tier}
- Risk Score: ${proposal.riskScore}
- Confidence: ${(proposal.confidence * 100).toFixed(0)}%
- Files Modified: ${proposal.filesToModify.join(", ")}

**Summary:**
${proposal.summary}

**Diff:**
\`\`\`diff
${proposal.diff}
\`\`\`

**Audit Trail:**
${auditTrail}

**Risk Assessment:**
${proposal.riskReasons.join("\n- ")}

Please generate a professional PR description with the following sections:
1. ## Summary - What changed and why
2. ## Changes Made - Bullet list of specific changes
3. ## Risk Assessment - Security and stability considerations
4. ## Testing - What was tested (based on audit trail)
5. ## Reviewer Notes - Important things for reviewers to verify

Make it concise, professional, and actionable.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are a technical writer who creates clear, professional PR descriptions.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    return completion.choices[0]?.message?.content || "Failed to generate PR description";
  } catch (error) {
    console.error("Error generating PR description:", error);
    return `# ${proposalId}\n\nFailed to generate AI description. Manual description required.`;
  }
}

// Generate a postmortem from an incident's audit trail
export async function generatePostmortem(incidentId: string): Promise<string> {
  try {
    // Fetch incident with hotfixes and audit logs
    const incident = await prisma.incident.findUnique({
      where: { id: incidentId },
      include: {
        hotfixes: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!incident) {
      throw new Error(`Incident ${incidentId} not found`);
    }

    // Fetch related audit logs
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        event: {
          in: ["INCIDENT_DECLARED", "HOTFIX_APPLIED"],
        },
        createdAt: {
          gte: incident.createdAt,
          lte: incident.resolvedAt || new Date(),
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const auditTrail = auditLogs
      .map(
        (log: any) =>
          `[${log.createdAt.toISOString()}] ${log.event} by ${log.actor}${
            log.metadata ? ` - ${JSON.stringify(log.metadata)}` : ""
          }`
      )
      .join("\n");

    const hotfixesSummary = incident.hotfixes
      .map(
        (hf: any) =>
          `- ${hf.summary} (Confidence: ${(hf.confidence * 100).toFixed(
            0
          )}%, Blast Radius: ${hf.blastRadius}, Status: ${hf.status})`
      )
      .join("\n");

    const prompt = `You are writing a postmortem document for a production incident.

**Incident Details:**
- ID: ${incident.id}
- Description: ${incident.description}
- Status: ${incident.status}
- Reported by: ${incident.reporter}
- Reported at: ${incident.createdAt.toISOString()}
${incident.resolvedAt ? `- Resolved at: ${incident.resolvedAt.toISOString()}` : ""}

**Logs:**
\`\`\`
${incident.logs}
\`\`\`

**Hotfixes Evaluated:**
${hotfixesSummary || "None"}

**Audit Trail:**
${auditTrail || "No audit logs found"}

Generate a professional postmortem with these sections:
1. ## Incident Summary - What happened, when, and impact
2. ## Root Cause - What caused the issue
3. ## Timeline - Key events in chronological order
4. ## Resolution - How it was fixed
5. ## Action Items - Preventive measures for the future
6. ## Lessons Learned - What went well and what to improve

Be factual, blame-free, and focused on improvement.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are a senior SRE writing a professional, constructive postmortem document.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });

    return completion.choices[0]?.message?.content || "Failed to generate postmortem";
  } catch (error) {
    console.error("Error generating postmortem:", error);
    return `# Incident ${incidentId} Postmortem\n\nFailed to generate AI postmortem. Manual documentation required.`;
  }
}

// Generate a changelog from a set of executed proposals
export async function generateChangelog(proposalIds: string[]): Promise<string> {
  try {
    if (proposalIds.length === 0) {
      return "# Changelog\n\nNo proposals provided.";
    }

    // Fetch all proposals with their audit logs
    const proposals = await prisma.proposal.findMany({
      where: {
        id: { in: proposalIds },
        status: "EXECUTED",
      },
      include: {
        auditLogs: {
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (proposals.length === 0) {
      return "# Changelog\n\nNo executed proposals found.";
    }

    const proposalsSummary = proposals
      .map(
        (p: any) =>
          `**${p.ticketTitle}** (${p.tier} tier, Risk: ${p.riskScore})\n  Summary: ${
            p.summary
          }\n  Files: ${p.filesToModify.join(", ")}\n  Executed: ${
            p.updatedAt.toISOString().split("T")[0]
          }`
      )
      .join("\n\n");

    const prompt = `You are generating a changelog for a software release.

**Executed Proposals:**

${proposalsSummary}

Generate a professional changelog in this format:

# Changelog - [Date Range]

## 🚀 Features
- List new features

## 🔧 Improvements  
- List improvements and enhancements

## 🐛 Bug Fixes
- List bug fixes

## ⚠️ Breaking Changes
- List any breaking changes

## 📝 Other Changes
- List other notable changes

Group the proposals by category based on their content. Use clear, user-friendly language. For each item, mention the ticket title and provide a brief explanation of what changed and why it matters to users.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are a technical writer creating a clear, user-friendly changelog.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 1200,
    });

    return completion.choices[0]?.message?.content || "Failed to generate changelog";
  } catch (error) {
    console.error("Error generating changelog:", error);
    return `# Changelog\n\nFailed to generate AI changelog. Manual documentation required.`;
  }
}
