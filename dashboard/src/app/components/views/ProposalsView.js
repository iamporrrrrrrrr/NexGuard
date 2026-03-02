"use client";
import { useState } from "react";
import ProposalCard from "../ProposalCard";

const tabs = [
  { key: "ALL",              label: "All" },
  { key: "AWAITING_APPROVAL",label: "Awaiting Approval" },
  { key: "APPROVED",         label: "Approved" },
  { key: "AUTO_EXECUTED",    label: "Auto-Executed" },
  { key: "REJECTED",         label: "Rejected" },
];

const statusMatch = {
  ALL:               () => true,
  AWAITING_APPROVAL: (p) => p.status === "AWAITING_APPROVAL",
  APPROVED:          (p) => p.status === "APPROVED" || p.status === "EXECUTED",
  AUTO_EXECUTED:     (p) => p.status === "AUTO_EXECUTED",
  REJECTED:          (p) => p.status === "REJECTED" || p.status === "VETOED",
};

const tierOrder = { RED: 0, YELLOW: 1, GREEN: 2 };

export default function ProposalsView({ allProposals = [], onApprove, onReject }) {
  const [activeTab, setActiveTab] = useState("ALL");
  const [tierFilter, setTierFilter] = useState("ALL");

  const filtered = allProposals
    .filter(statusMatch[activeTab] || (() => true))
    .filter((p) => tierFilter === "ALL" || p.tier === tierFilter)
    .sort((a, b) => (tierOrder[a.tier] ?? 3) - (tierOrder[b.tier] ?? 3));

  const countFor = (key) => allProposals.filter(statusMatch[key] || (() => true)).length;

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: "0 0 4px", letterSpacing: "-0.3px" }}>
          Proposals
        </h1>
        <p style={{ color: "#6b7280", fontSize: 14 }}>
          All AI-generated code change proposals and their approval status
        </p>
      </div>

      {/* Tab bar */}
      <div
        style={{
          display: "flex", gap: 4, marginBottom: 16,
          background: "#f3f4f6", borderRadius: 9, padding: 4, width: "fit-content",
        }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const count = countFor(tab.key);
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer",
                background: isActive ? "#fff" : "transparent",
                color: isActive ? "#111827" : "#6b7280",
                fontSize: 13, fontWeight: isActive ? 600 : 400,
                boxShadow: isActive ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
                transition: "all 0.15s",
              }}
            >
              {tab.label}
              <span
                style={{
                  background: isActive ? "#f3f4f6" : "transparent",
                  color: isActive ? "#374151" : "#9ca3af",
                  borderRadius: 10, fontSize: 11, fontWeight: 600,
                  padding: "0 5px", minWidth: 18, textAlign: "center",
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tier filter chips */}
      <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
        {[
          { key: "ALL",    label: "All tiers",  color: "#6b7280", bg: "#f3f4f6", active: "#111827", activeBg: "#e5e7eb" },
          { key: "RED",    label: "Red",         color: "#991b1b", bg: "#fef2f2", active: "#991b1b", activeBg: "#fecaca" },
          { key: "YELLOW", label: "Yellow",      color: "#92400e", bg: "#fffbeb", active: "#92400e", activeBg: "#fde68a" },
          { key: "GREEN",  label: "Green",       color: "#166534", bg: "#f0fdf4", active: "#166534", activeBg: "#bbf7d0" },
        ].map(({ key, label, color, bg, active, activeBg }) => {
          const isActive = tierFilter === key;
          return (
            <button
              key={key}
              onClick={() => setTierFilter(key)}
              style={{
                padding: "4px 12px", borderRadius: 20, border: "none", cursor: "pointer",
                background: isActive ? activeBg : bg,
                color: isActive ? active : color,
                fontSize: 12, fontWeight: isActive ? 700 : 500,
                outline: isActive ? `2px solid ${activeBg}` : "none",
                transition: "all 0.15s",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Proposal list */}
      {filtered.length === 0 ? (
        <div
          style={{
            background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10,
            padding: "40px 20px", textAlign: "center",
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 10 }}>🎉</div>
          <div style={{ fontSize: 14, color: "#6b7280" }}>No proposals match this filter</div>
        </div>
      ) : (
        filtered.map((p) => (
          <ProposalCard
            key={p.id}
            proposal={p}
            onApprove={p.status === "AWAITING_APPROVAL" ? onApprove : undefined}
            onReject={p.status === "AWAITING_APPROVAL" ? onReject : undefined}
          />
        ))
      )}
    </div>
  );
}
