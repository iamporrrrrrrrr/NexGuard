// Communication agent — generates PR descriptions, postmortems, changelogs
// Always reads from AuditLog — never from live state

// Generate a PR description from audit history
export async function generatePRDescription(proposalId: string): Promise<string> {
  // TODO:
  // 1. Fetch audit logs for proposalId from prisma
  // 2. Build prompt with audit trail + proposal diff
  // 3. Call OpenAI gpt-4o to write a structured PR description
  throw new Error("Not implemented");
}

// Generate a postmortem from an incident's audit trail
export async function generatePostmortem(incidentId: string): Promise<string> {
  // TODO:
  // 1. Fetch incident + hotfixes + audit logs from prisma
  // 2. Call OpenAI gpt-4o to produce a postmortem document
  throw new Error("Not implemented");
}

// Generate a changelog from a set of executed proposals
export async function generateChangelog(proposalIds: string[]): Promise<string> {
  // TODO:
  // 1. Fetch audit logs for all proposalIds
  // 2. Call OpenAI gpt-4o to summarize as a changelog
  throw new Error("Not implemented");
}
