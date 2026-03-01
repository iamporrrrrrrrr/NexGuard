"use client";

const eventColors = {
  PROPOSED: "#3b82f6",
  AUTO_EXECUTED: "#22c55e",
  APPROVAL_SENT: "#eab308",
  APPROVED: "#16a34a",
  REJECTED: "#ef4444",
  VETOED: "#f97316",
  EXECUTED: "#22c55e",
  FAILED: "#dc2626",
  INCIDENT_DECLARED: "#7c3aed",
  HOTFIX_APPLIED: "#06b6d4",
  ARTIFACT_GENERATED: "#8b5cf6",
};

const tierBadge = {
  GREEN: { bg: "#dcfce7", color: "#166534" },
  YELLOW: { bg: "#fef9c3", color: "#854d0e" },
  RED: { bg: "#fee2e2", color: "#991b1b" },
};

export default function AuditFeed({ entries = [] }) {
  if (entries.length === 0) {
    return (
      <p style={{ color: "#9ca3af", fontStyle: "italic", padding: "16px 0" }}>
        No audit events yet. Submit a ticket via POST /intake to get started.
      </p>
    );
  }

  return (
    <div style={{ maxHeight: 500, overflowY: "auto" }}>
      {entries.map((entry) => {
        const tier = entry.proposal?.tier;
        const badge = tier ? tierBadge[tier] : null;
        return (
          <div
            key={entry.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 0",
              borderBottom: "1px solid #e5e7eb",
              borderLeft: `4px solid ${eventColors[entry.event] || "#94a3b8"}`,
              paddingLeft: 12,
            }}
          >
            {badge && (
              <span
                style={{
                  background: badge.bg,
                  color: badge.color,
                  borderRadius: 4,
                  padding: "2px 8px",
                  fontSize: 11,
                  fontWeight: 700,
                  minWidth: 54,
                  textAlign: "center",
                }}
              >
                {tier}
              </span>
            )}
            <span style={{ fontWeight: 600, fontSize: 13, color: eventColors[entry.event] || "#475569" }}>
              {entry.event}
            </span>
            <span style={{ color: "#4b5563", fontSize: 13, flex: 1 }}>
              {entry.proposal?.ticketTitle || "System event"}
            </span>
            <span style={{ color: "#9ca3af", fontSize: 12, whiteSpace: "nowrap" }}>
              {entry.actor} &middot; {new Date(entry.createdAt).toLocaleTimeString()}
            </span>
          </div>
        );
      })}
    </div>
  );
}
