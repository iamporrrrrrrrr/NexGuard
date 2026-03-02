"use client";
import {
  FilePen,
  Zap,
  Send,
  CheckCircle,
  XCircle,
  Ban,
  Rocket,
  AlertTriangle,
  Siren,
  Wrench,
  Package,
} from "lucide-react";

const eventConfig = {
  PROPOSED:           { color: "#3b82f6", Icon: FilePen,       label: "Proposed" },
  AUTO_EXECUTED:      { color: "#22c55e", Icon: Zap,           label: "Auto-Executed" },
  APPROVAL_SENT:      { color: "#f59e0b", Icon: Send,          label: "Approval Sent" },
  APPROVED:           { color: "#16a34a", Icon: CheckCircle,   label: "Approved" },
  REJECTED:           { color: "#ef4444", Icon: XCircle,       label: "Rejected" },
  VETOED:             { color: "#f97316", Icon: Ban,           label: "Vetoed" },
  EXECUTED:           { color: "#22c55e", Icon: Rocket,        label: "Executed" },
  FAILED:             { color: "#dc2626", Icon: AlertTriangle, label: "Failed" },
  INCIDENT_DECLARED:  { color: "#7c3aed", Icon: Siren,         label: "Incident Declared" },
  HOTFIX_APPLIED:     { color: "#06b6d4", Icon: Wrench,        label: "Hotfix Applied" },
  ARTIFACT_GENERATED: { color: "#8b5cf6", Icon: Package,       label: "Artifact Generated" },
};

const tierBadge = {
  GREEN:  { bg: "#f0fdf4", color: "#166534", border: "#bbf7d0" },
  YELLOW: { bg: "#fffbeb", color: "#92400e", border: "#fde68a" },
  RED:    { bg: "#fef2f2", color: "#991b1b", border: "#fecaca" },
};

function relTime(iso) {
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function AuditFeed({ entries = [] }) {
  if (entries.length === 0) {
    return (
      <p style={{ color: "#9ca3af", fontStyle: "italic", padding: "16px 0" }}>
        No audit events yet. Submit a ticket via POST /intake to get started.
      </p>
    );
  }

  return (
    <div style={{ maxHeight: 480, overflowY: "auto", marginRight: -4, paddingRight: 4 }}>
      {entries.map((entry, i) => {
        const cfg = eventConfig[entry.event] || { color: "#94a3b8", Icon: Zap, label: entry.event };
        const tier = entry.proposal?.tier;
        const badge = tier ? tierBadge[tier] : null;

        return (
          <div
            key={entry.id}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              padding: "10px 2px",
              borderBottom: i < entries.length - 1 ? "1px solid #f3f4f6" : "none",
            }}
          >
            {/* Event icon circle */}
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                flexShrink: 0,
                background: `${cfg.color}1a`,
                border: `1.5px solid ${cfg.color}40`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginTop: 1,
              }}
            >
              <cfg.Icon size={15} color={cfg.color} strokeWidth={2} />
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: cfg.color }}>
                  {cfg.label}
                </span>
                {badge && (
                  <span
                    style={{
                      background: badge.bg,
                      color: badge.color,
                      border: `1px solid ${badge.border}`,
                      borderRadius: 4,
                      padding: "1px 6px",
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {tier}
                  </span>
                )}
              </div>
              <div style={{ color: "#374151", fontSize: 13, marginTop: 2 }}>
                {entry.proposal?.ticketTitle || "System event"}
              </div>
              <div style={{ color: "#9ca3af", fontSize: 12, marginTop: 2 }}>
                <strong style={{ color: "#6b7280", fontWeight: 500 }}>{entry.actor}</strong>
                {" · "}
                {relTime(entry.createdAt)}
                {entry.proposal?.repo && (
                  <span style={{ marginLeft: 4, color: "#d1d5db" }}>
                    · {entry.proposal.repo}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
