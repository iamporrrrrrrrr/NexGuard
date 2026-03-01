"use client";
import { useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

const tierStyle = {
  GREEN: { bg: "#dcfce7", color: "#166534" },
  YELLOW: { bg: "#fef9c3", color: "#854d0e" },
  RED: { bg: "#fee2e2", color: "#991b1b" },
};

export default function ProposalCard({ proposal, onAction }) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!proposal) return null;
  const badge = tierStyle[proposal.tier] || { bg: "#f1f5f9", color: "#475569" };

  const handleApprove = async () => {
    if (proposal.tier === "RED" && !acknowledged) {
      alert("Please acknowledge the risks before approving a RED-tier proposal.");
      return;
    }
    setLoading(true);
    try {
      await fetch(`${API_BASE}/approve/${proposal.id}?approver=dashboard-user`);
      if (onAction) onAction();
    } catch (err) {
      console.error("Approve failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setLoading(true);
    try {
      await fetch(`${API_BASE}/reject/${proposal.id}?rejector=dashboard-user&reason=Rejected+from+dashboard`);
      if (onAction) onAction();
    } catch (err) {
      console.error("Reject failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: 16,
        marginBottom: 12,
        borderLeft: `4px solid ${badge.color}`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h4 style={{ margin: 0, fontSize: 15 }}>{proposal.ticketTitle || proposal.title}</h4>
        <span
          style={{
            background: badge.bg,
            color: badge.color,
            borderRadius: 4,
            padding: "2px 10px",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {proposal.tier} &mdash; {proposal.riskScore}/100
        </span>
      </div>

      <p style={{ color: "#4b5563", fontSize: 13, margin: "4px 0" }}>{proposal.summary}</p>

      {proposal.riskReasons && proposal.riskReasons.length > 0 && (
        <ul style={{ fontSize: 12, color: "#6b7280", margin: "6px 0", paddingLeft: 18 }}>
          {proposal.riskReasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}

      <p style={{ fontSize: 12, color: "#9ca3af", margin: "4px 0" }}>
        {proposal.repo} &middot; {proposal.reporter || proposal.actor} &middot;{" "}
        <span style={{ fontWeight: 600 }}>{proposal.status}</span>
      </p>

      <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
        <a
          href={`${API_BASE}/diff/${proposal.id}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 12, color: "#3b82f6" }}
        >
          View Diff
        </a>
      </div>

      {proposal.status === "AWAITING_APPROVAL" && (
        <div style={{ marginTop: 10 }}>
          {proposal.tier === "RED" && (
            <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
              />
              I acknowledge the risks of this RED-tier change.
            </label>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleApprove}
              disabled={loading || (proposal.tier === "RED" && !acknowledged)}
              style={{
                background: loading ? "#94a3b8" : "#22c55e",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                padding: "6px 16px",
                cursor: loading ? "not-allowed" : "pointer",
                fontSize: 13,
              }}
            >
              ✅ Approve
            </button>
            <button
              onClick={handleReject}
              disabled={loading}
              style={{
                background: loading ? "#94a3b8" : "#ef4444",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                padding: "6px 16px",
                cursor: loading ? "not-allowed" : "pointer",
                fontSize: 13,
              }}
            >
              ❌ Reject
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
