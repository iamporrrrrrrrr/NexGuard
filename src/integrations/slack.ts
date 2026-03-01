// Slack Webhooks + Interactive Components

// Send an approval card to Slack for a RED/YELLOW proposal
export async function sendApprovalCard(proposalId: string): Promise<void> {
  // TODO:
  // 1. Fetch proposal from prisma
  // 2. Build Slack Block Kit message with:
  //    - Proposal summary, tier badge, risk reasons
  //    - Approve / Reject buttons (action_id: approve_proposal / reject_proposal)
  //    - Link to /diff/:id
  //    - For YELLOW: include veto window expiry timestamp
  //    - For deployment: checkbox acknowledgment before Approve is enabled
  // 3. POST to SLACK_WEBHOOK_URL
  throw new Error("Not implemented");
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
  // TODO:
  // 1. POST { text: message } to SLACK_WEBHOOK_URL
  throw new Error("Not implemented");
}
