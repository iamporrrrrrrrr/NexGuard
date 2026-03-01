import React from "react";

// Renders a real-time scrolling audit log
// Props: entries — array from GET /audit/feed
export default function AuditFeed({ entries = [] }) {
  // TODO:
  // 1. Display each AuditLog entry as a row
  // 2. Color-code by event type (PROPOSED, APPROVED, REJECTED, FAILED, etc.)
  // 3. Show actor, timestamp, proposal title + tier if available
  return (
    <div>
      <h2>Audit Feed</h2>
      {entries.length === 0 && <p>No entries yet.</p>}
      {/* TODO: render entries */}
    </div>
  );
}
