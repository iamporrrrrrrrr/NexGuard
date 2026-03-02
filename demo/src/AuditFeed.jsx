import React from "react";
import "./AuditFeed.css"; // Optional: Add CSS for styling

// Renders a real-time scrolling audit log
// Props: entries — array from GET /audit/feed
export default function AuditFeed({ entries = [] }) {
  const getColorByEvent = (event) => {
    switch (event) {
      case "PROPOSED":
        return "blue";
      case "APPROVED":
        return "green";
      case "REJECTED":
        return "red";
      case "FAILED":
        return "orange";
      default:
        return "gray";
    }
  };

  return (
    <div>
      <h2>Audit Feed</h2>
      {entries.length === 0 ? (
        <p>No entries yet.</p>
      ) : (
        <ul>
          {entries.map((entry) => (
            <li
              key={entry.id}
              style={{
                borderLeft: `4px solid ${getColorByEvent(entry.event)}`,
                padding: "8px",
                marginBottom: "8px",
              }}
            >
              <p>
                <strong>Event:</strong> {entry.event}
              </p>
              <p>
                <strong>Actor:</strong> {entry.actor}
              </p>
              <p>
                <strong>Timestamp:</strong> {new Date(entry.createdAt).toLocaleString()}
              </p>
              {entry.proposal && (
                <p>
                  <strong>Proposal:</strong> {entry.proposal.ticketTitle} ({entry.proposal.tier})
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
