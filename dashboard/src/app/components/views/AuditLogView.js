"use client";
import { useState } from "react";
import AuditFeed from "../AuditFeed";
import {
  FilePen, Zap, Send, CheckCircle, XCircle, Ban, Rocket,
  AlertTriangle, Siren, Wrench, Package, Filter, X,
} from "lucide-react";

const ALL_EVENTS = [
  { key: "ALL",              label: "All",             Icon: Filter },
  { key: "PROPOSED",         label: "Proposed",        Icon: FilePen },
  { key: "AUTO_EXECUTED",    label: "Auto-Executed",   Icon: Zap },
  { key: "APPROVAL_SENT",    label: "Approval Sent",   Icon: Send },
  { key: "APPROVED",         label: "Approved",        Icon: CheckCircle },
  { key: "REJECTED",         label: "Rejected",        Icon: XCircle },
  { key: "VETOED",           label: "Vetoed",          Icon: Ban },
  { key: "EXECUTED",         label: "Executed",        Icon: Rocket },
  { key: "FAILED",           label: "Failed",          Icon: AlertTriangle },
  { key: "INCIDENT_DECLARED",label: "Incident",        Icon: Siren },
  { key: "HOTFIX_APPLIED",   label: "Hotfix",          Icon: Wrench },
];

const eventColors = {
  PROPOSED: "#3b82f6", AUTO_EXECUTED: "#22c55e", APPROVAL_SENT: "#f59e0b",
  APPROVED: "#16a34a", REJECTED: "#ef4444", VETOED: "#f97316",
  EXECUTED: "#22c55e", FAILED: "#dc2626", INCIDENT_DECLARED: "#7c3aed",
  HOTFIX_APPLIED: "#06b6d4", ARTIFACT_GENERATED: "#8b5cf6",
};

const tierFilters = [
  { key: "ALL",    label: "All Tiers" },
  { key: "GREEN",  label: "Green" },
  { key: "YELLOW", label: "Yellow" },
  { key: "RED",    label: "Red" },
];

export default function AuditLogView({ feed = [] }) {
  const [eventFilter, setEventFilter] = useState("ALL");
  const [tierFilter, setTierFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  const filtered = feed.filter((entry) => {
    if (eventFilter !== "ALL" && entry.event !== eventFilter) return false;
    if (tierFilter !== "ALL" && entry.proposal?.tier !== tierFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !entry.event?.toLowerCase().includes(q) &&
        !entry.actor?.toLowerCase().includes(q) &&
        !entry.proposal?.ticketTitle?.toLowerCase().includes(q) &&
        !entry.proposal?.repo?.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: "0 0 4px", letterSpacing: "-0.3px" }}>
          Audit Log
        </h1>
        <p style={{ color: "#6b7280", fontSize: 14 }}>
          Append-only record of all AI actions, approvals, and system events
        </p>
      </div>

      {/* Filter bar */}
      <div
        style={{
          background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10,
          padding: "14px 16px", marginBottom: 16,
          display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap",
        }}
      >
        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 200px", minWidth: 180 }}>
          <input
            type="text"
            placeholder="Search events, actors, tickets…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%", padding: "7px 32px 7px 12px",
              border: "1px solid #e5e7eb", borderRadius: 7, fontSize: 13,
              color: "#111827", outline: "none", background: "#f9fafb",
              fontFamily: "inherit",
            }}
          />
          {search && (
            <X
              size={14}
              color="#9ca3af"
              style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", cursor: "pointer" }}
              onClick={() => setSearch("")}
            />
          )}
        </div>

        {/* Tier filter */}
        <div style={{ display: "flex", gap: 4 }}>
          {tierFilters.map(({ key, label }) => {
            const isActive = tierFilter === key;
            const tierColorMap = { GREEN: "#22c55e", YELLOW: "#f59e0b", RED: "#ef4444" };
            const c = tierColorMap[key];
            return (
              <button
                key={key}
                onClick={() => setTierFilter(key)}
                style={{
                  padding: "5px 11px", borderRadius: 6, border: "none", cursor: "pointer",
                  background: isActive ? (c ? `${c}22` : "#e5e7eb") : "#f3f4f6",
                  color: isActive ? (c || "#111827") : "#6b7280",
                  fontSize: 12, fontWeight: isActive ? 700 : 400,
                  transition: "all 0.12s",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        <span style={{ color: "#9ca3af", fontSize: 12 }}>
          {filtered.length} of {feed.length} events
        </span>
      </div>

      {/* Event type filter chips — horizontal scroll */}
      <div
        style={{
          display: "flex", gap: 6, marginBottom: 16, overflowX: "auto", marginTop: 4, paddingTop: 4, paddingLeft: 2,
          paddingBottom: 4, scrollbarWidth: "none",
        }}
      >
        {ALL_EVENTS.map(({ key, label, Icon }) => {
          const isActive = eventFilter === key;
          const color = key === "ALL" ? "#5865f2" : (eventColors[key] || "#6b7280");
          return (
            <button
              key={key}
              onClick={() => setEventFilter(key)}
              style={{
                display: "flex", alignItems: "center", gap: 5, padding: "5px 12px",
                borderRadius: 20, border: "none", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
                background: isActive ? `${color}22` : "#fff",
                color: isActive ? color : "#6b7280",
                boxShadow: isActive ? `0 0 0 1.5px ${color}` : "0 0 0 1px #e5e7eb",
                fontSize: 12, fontWeight: isActive ? 700 : 400,
                transition: "all 0.12s",
              }}
            >
              <Icon size={12} />
              {label}
            </button>
          );
        })}
      </div>

      {/* Audit feed */}
      <div
        style={{
          background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10,
          padding: "16px 20px",
        }}
      >
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 0", color: "#9ca3af", fontSize: 14 }}>
            No events match your filters
          </div>
        ) : (
          <AuditFeed entries={filtered} />
        )}
      </div>
    </div>
  );
}
