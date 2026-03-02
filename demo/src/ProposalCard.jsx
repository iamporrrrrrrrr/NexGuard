import React, { useState } from "react";
import "./ProposalCard.css"; // Optional: Add CSS for styling

// Displays a single proposal awaiting approval
// Props: proposal — { id, ticketTitle, tier, riskScore, riskReasons, summary, diff }
export default function ProposalCard({ proposal }) {
  const [isAcknowledged, setIsAcknowledged] = useState(false);

  const handleApprove = async () => {
    if (proposal.tier === "RED" && !isAcknowledged) {
      alert("Please acknowledge the risks before approving.");
      return;
    }
    try {
      await fetch(`/approve/${proposal.id}`);
      alert("Proposal approved.");
    } catch (error) {
      console.error("Error approving proposal:", error);
    }
  };

  const handleReject = async () => {
    try {
      await fetch(`/reject/${proposal.id}`);
      alert("Proposal rejected.");
    } catch (error) {
      console.error("Error rejecting proposal:", error);
    }
  };

  return (
    <div className="proposal-card">
      <h3>{proposal.ticketTitle}</h3>
      <p>
        <strong>Tier:</strong> <span className={`tier-badge ${proposal.tier.toLowerCase()}`}>{proposal.tier}</span>
      </p>
      <p>
        <strong>Risk Score:</strong> {proposal.riskScore}
      </p>
      <ul>
        {proposal.riskReasons.map((reason, index) => (
          <li key={index}>{reason}</li>
        ))}
      </ul>
      <p>
        <strong>Summary:</strong> {proposal.summary}
      </p>
      <a href={`/diff/${proposal.id}`} target="_blank" rel="noopener noreferrer">
        View Full Diff
      </a>
      {proposal.tier === "RED" && (
        <div>
          <label>
            <input
              type="checkbox"
              checked={isAcknowledged}
              onChange={(e) => setIsAcknowledged(e.target.checked)}
            />
            I acknowledge the risks.
          </label>
        </div>
      )}
      <button onClick={handleApprove} disabled={proposal.tier === "RED" && !isAcknowledged}>
        Approve
      </button>
      <button onClick={handleReject}>Reject</button>
    </div>
  );
}
