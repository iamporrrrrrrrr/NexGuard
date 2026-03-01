import React from "react";

// Displays a single proposal awaiting approval
// Props: proposal — { id, ticketTitle, tier, riskScore, riskReasons, summary, diff }
export default function ProposalCard({ proposal }) {
  // TODO:
  // 1. Show tier badge (GREEN / YELLOW / RED)
  // 2. Show risk score + reasons
  // 3. Show proposal summary
  // 4. Link to /diff/:id for full diff view
  // 5. Approve / Reject buttons → call GET /approve/:id or /reject/:id
  //    Note: deployment proposals require checkbox acknowledgment before Approve enabled
  return (
    <div>
      <h3>{proposal?.ticketTitle ?? "Proposal"}</h3>
      <p>Tier: {proposal?.tier}</p>
      <p>TODO: implement proposal card</p>
    </div>
  );
}
