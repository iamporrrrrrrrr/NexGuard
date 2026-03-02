"use client";
import { useEffect, useState, useCallback } from "react";
import AuditFeed from "./components/AuditFeed";
import ProposalCard from "./components/ProposalCard";
import RiskChart from "./components/RiskChart";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import StatCard from "./components/StatCard";
import ProposalsView from "./components/views/ProposalsView";
import IncidentsView from "./components/views/IncidentsView";
import AuditLogView from "./components/views/AuditLogView";
import SettingsView from "./components/views/SettingsView";
// TODO: Remove dummy data imports when connecting to real backend
import {
  dummyReport, dummyFeed, dummyProposals,
  dummyAllProposals, dummyIncidents, dummyNotifications,
} from "./data/dummyData";
import {
  ClipboardList,
  CheckCircle,
  Target,
  AlertOctagon,
  AlertTriangle,
} from "lucide-react";

// TODO: Set to false to use real backend data
const USE_DUMMY_DATA = false;

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export default function Home() {
  const [feed, setFeed] = useState([]);
  const [report, setReport] = useState(null);
  const [proposals, setProposals] = useState([]);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Navigation & notification state
  const [activePage, setActivePage] = useState("Overview");
  const [notifications, setNotifications] = useState(dummyNotifications);
  // All proposals list — used by ProposalsView (local state for approve/reject mutations)
  const [allProposals, setAllProposals] = useState([]);

  const pendingCount = allProposals.filter((p) => p.status === "AWAITING_APPROVAL").length;

  const handleMarkAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const fetchData = useCallback(async () => {
    // TODO: Remove this block when USE_DUMMY_DATA is false
    if (USE_DUMMY_DATA) {
      setFeed(dummyFeed);
      setReport(dummyReport);
      setProposals(dummyProposals);
      setLastUpdated(new Date().toLocaleTimeString());
      return;
    }

    // Real backend fetch — preserved for when dummy data is removed
    try {
      const [feedRes, reportRes] = await Promise.all([
        fetch(`${API_BASE}/audit/feed`),
        fetch(`${API_BASE}/audit/report`),
      ]);

      if (feedRes.ok) {
        const feedData = await feedRes.json();
        setFeed(feedData.feed || []);

        const seen = new Set();
        const pending = [];
        const all = [];
        for (const entry of feedData.feed || []) {
          if (
            entry.proposal &&
            !seen.has(entry.proposalId)
          ) {
            seen.add(entry.proposalId);
            try {
              const diffRes = await fetch(`${API_BASE}/diff/${entry.proposalId}`);
              if (diffRes.ok) {
                const prop = await diffRes.json();
                all.push(prop);
                if (prop.status === "AWAITING_APPROVAL") pending.push(prop);
              }
            } catch {
              // skip
            }
          }
        }
        setProposals(pending);
        setAllProposals(all);
      }

      if (reportRes.ok) {
        const reportData = await reportRes.json();
        setReport(reportData.summary || null);
      }

      setError(null);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      setError("Cannot reach backend at " + API_BASE);
      console.error("Fetch error:", err);
    }
  }, []);

  // Approve/reject — call backend API, then update local state
  const handleApprove = useCallback(async (id) => {
    try {
      const res = await fetch(`${API_BASE}/approve/${id}?approver=dashboard_user`);
      if (res.ok) {
        setAllProposals((prev) =>
          prev.map((p) => (p.id === id ? { ...p, status: "APPROVED" } : p))
        );
        setProposals((prev) => prev.filter((p) => p.id !== id));
        fetchData();
      } else {
        const err = await res.json();
        console.error("Approve failed:", err);
      }
    } catch (err) {
      console.error("Approve error:", err);
    }
  }, [fetchData]);

  const handleReject = useCallback(async (id) => {
    try {
      const res = await fetch(`${API_BASE}/reject/${id}?rejector=dashboard_user`);
      if (res.ok) {
        setAllProposals((prev) =>
          prev.map((p) => (p.id === id ? { ...p, status: "REJECTED" } : p))
        );
        setProposals((prev) => prev.filter((p) => p.id !== id));
        fetchData();
      } else {
        const err = await res.json();
        console.error("Reject failed:", err);
      }
    } catch (err) {
      console.error("Reject error:", err);
    }
  }, [fetchData]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "#f4f5f7" }}>
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        pendingCount={pendingCount}
      />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <TopBar
          isLive={USE_DUMMY_DATA || !error}
          lastUpdated={lastUpdated}
          activePage={activePage}
          notifications={notifications}
          onMarkAllRead={handleMarkAllRead}
        />

        <main style={{ flex: 1, overflow: "auto", padding: "24px 28px" }}>

          {/* ── Non-overview views ── */}
          {activePage === "Proposals" && (
            <ProposalsView
              allProposals={allProposals}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          )}
          {activePage === "Incidents" && (
            <IncidentsView incidents={dummyIncidents} />
          )}
          {activePage === "Audit Log" && (
            <AuditLogView feed={feed} />
          )}
          {activePage === "Settings" && (
            <SettingsView />
          )}

          {/* ── Overview ── */}
          {activePage === "Overview" && (
            <>
              {/* Page header */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0, letterSpacing: "-0.3px" }}>
                    Overview
                  </h1>
                  {USE_DUMMY_DATA && (
                    <span style={{ background: "#fef3c7", color: "#92400e", borderRadius: 5, padding: "2px 8px", fontSize: 11, fontWeight: 700, border: "1px solid #fde68a" }}>
                      DEMO DATA
                    </span>
                  )}
                </div>
                <p style={{ color: "#6b7280", fontSize: 14, marginTop: 4 }}>
                  Human-governed AI coding agent orchestration platform
                </p>
              </div>

              {/* Error banner */}
              {error && !USE_DUMMY_DATA && (
                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", borderRadius: 8, padding: "10px 14px", marginBottom: 20, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                  <AlertTriangle size={14} /> {error}
                </div>
              )}

              {/* Stat cards */}
              {report && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
                  <StatCard Icon={ClipboardList} label="Total Proposals" value={report.totalProposals} sub="All time" accentColor="#5865f2" />
                  <StatCard Icon={CheckCircle} label="Approval Rate" value={report.approvalRate} sub="Approved / Total" accentColor="#22c55e" />
                  <StatCard Icon={Target} label="Avg Risk Score" value={report.avgRiskScore ?? "N/A"} sub="Lower is safer" accentColor="#f59e0b" />
                  <StatCard Icon={AlertOctagon} label="Fail-Safes" value={report.failSafeTriggered} sub="Auto-blocked to RED" accentColor="#ef4444" />
                </div>
              )}

              {/* Donut chart + Tier breakdown */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
                <div style={{ background: "#fff", borderRadius: 10, padding: "20px 22px", border: "1px solid #e5e7eb" }}>
                  <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 600, color: "#111827" }}>Risk Distribution</h3>
                  {report ? <RiskChart byTier={report.byTier} /> : <p style={{ color: "#9ca3af" }}>Loading...</p>}
                </div>
                <div style={{ background: "#fff", borderRadius: 10, padding: "20px 22px", border: "1px solid #e5e7eb" }}>
                  <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 600, color: "#111827" }}>Tier Breakdown</h3>
                  {report ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {[
                        { key: "GREEN",  label: "Green — Auto-execute",          color: "#22c55e", bg: "#f0fdf4", border: "#bbf7d030" },
                        { key: "YELLOW", label: "Yellow — Notify + veto window", color: "#f59e0b", bg: "#fffbeb", border: "#fde68a30" },
                        { key: "RED",    label: "Red — Blocked until approved",  color: "#ef4444", bg: "#fef2f2", border: "#fecaca30" },
                      ].map(({ key, label, color, bg, border }) => {
                        const val = report.byTier?.[key] || 0;
                        const pct = Math.round((val / (report.totalProposals || 1)) * 100);
                        return (
                          <div key={key} style={{ padding: "12px 14px", borderRadius: 8, background: bg, border: `1px solid ${border}` }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                              <span style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>{label}</span>
                              <span style={{ fontSize: 13, color, fontWeight: 700 }}>
                                {val}<span style={{ color: "#9ca3af", fontWeight: 400 }}> ({pct}%)</span>
                              </span>
                            </div>
                            <div style={{ background: "#e5e7eb", borderRadius: 4, height: 5, overflow: "hidden" }}>
                              <div style={{ width: `${pct}%`, height: 5, background: color, borderRadius: 4, transition: "width 0.4s ease" }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : <p style={{ color: "#9ca3af" }}>Loading...</p>}
                </div>
              </div>

              {/* Proposals awaiting approval — quick-action cards */}
              {pendingCount > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#111827" }}>Awaiting Approval</h3>
                    <span style={{ background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a", borderRadius: 10, fontSize: 11, fontWeight: 700, padding: "2px 8px" }}>
                      {pendingCount} pending
                    </span>
                    <button
                      onClick={() => setActivePage("Proposals")}
                      style={{ marginLeft: "auto", background: "none", border: "1px solid #e5e7eb", borderRadius: 6, padding: "4px 12px", fontSize: 12, color: "#5865f2", cursor: "pointer", fontWeight: 500 }}
                    >
                      View all →
                    </button>
                  </div>
                  {allProposals
                    .filter((p) => p.status === "AWAITING_APPROVAL")
                    .map((p) => (
                      <ProposalCard
                        key={p.id}
                        proposal={p}
                        onApprove={handleApprove}
                        onReject={handleReject}
                      />
                    ))}
                </div>
              )}

              {/* Live Audit Feed */}
              <div style={{ background: "#fff", borderRadius: 10, padding: "20px 22px", border: "1px solid #e5e7eb" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#111827" }}>Live Audit Feed</h3>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: "#9ca3af", fontSize: 12, background: "#f3f4f6", borderRadius: 10, padding: "2px 8px" }}>
                      {feed.length} events
                    </span>
                    <button
                      onClick={() => setActivePage("Audit Log")}
                      style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 6, padding: "4px 12px", fontSize: 12, color: "#5865f2", cursor: "pointer", fontWeight: 500 }}
                    >
                      Full log →
                    </button>
                  </div>
                </div>
                <AuditFeed entries={feed} />
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
