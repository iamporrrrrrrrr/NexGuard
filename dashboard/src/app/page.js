"use client";
import { useEffect, useState, useCallback } from "react";
import AuditFeed from "./components/AuditFeed";
import ProposalCard from "./components/ProposalCard";
import RiskChart from "./components/RiskChart";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export default function Home() {
  const [feed, setFeed] = useState([]);
  const [report, setReport] = useState(null);
  const [proposals, setProposals] = useState([]);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [feedRes, reportRes] = await Promise.all([
        fetch(`${API_BASE}/audit/feed`),
        fetch(`${API_BASE}/audit/report`),
      ]);

      if (feedRes.ok) {
        const feedData = await feedRes.json();
        setFeed(feedData.feed || []);

        // Extract unique proposals that are AWAITING_APPROVAL from the feed
        const seen = new Set();
        const pending = [];
        for (const entry of feedData.feed || []) {
          if (
            entry.proposal &&
            !seen.has(entry.proposalId) &&
            entry.event === "APPROVAL_SENT"
          ) {
            seen.add(entry.proposalId);
            // Fetch full proposal details
            try {
              const diffRes = await fetch(`${API_BASE}/diff/${entry.proposalId}`);
              if (diffRes.ok) {
                const prop = await diffRes.json();
                if (prop.status === "AWAITING_APPROVAL") {
                  pending.push(prop);
                }
              }
            } catch {
              // skip
            }
          }
        }
        setProposals(pending);
      }

      if (reportRes.ok) {
        const reportData = await reportRes.json();
        setReport(reportData.summary || null);
      }

      setError(null);
    } catch (err) {
      setError("Cannot reach backend at " + API_BASE);
      console.error("Fetch error:", err);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 28, marginBottom: 4 }}>🛡️ DevGuard Dashboard</h1>
      <p style={{ color: "#6b7280", marginBottom: 24 }}>
        Human-Governed AI Coding Agent Orchestration
      </p>

      {error && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
            fontSize: 13,
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* Summary + Chart row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
        <div style={{ background: "#f8f9fa", borderRadius: 8, padding: 20 }}>
          <h3 style={{ marginTop: 0 }}>📊 Summary</h3>
          {report ? (
            <div style={{ fontSize: 14, lineHeight: 2 }}>
              <p>
                <strong>Total Proposals:</strong> {report.totalProposals}
              </p>
              <p>
                <strong>Approval Rate:</strong> {report.approvalRate}
              </p>
              <p>
                <strong>Avg Risk Score:</strong> {report.avgRiskScore ?? "N/A"}
              </p>
              <p>
                <strong>Fail-Safes Triggered:</strong> {report.failSafeTriggered}
              </p>
              <p>
                <strong>By Tier:</strong> 🟢 {report.byTier?.GREEN || 0} · 🟡{" "}
                {report.byTier?.YELLOW || 0} · 🔴 {report.byTier?.RED || 0}
              </p>
            </div>
          ) : (
            <p style={{ color: "#9ca3af" }}>Loading...</p>
          )}
        </div>

        <div style={{ background: "#f8f9fa", borderRadius: 8, padding: 20 }}>
          <h3 style={{ marginTop: 0 }}>🎯 Risk Distribution</h3>
          {report ? (
            <RiskChart byTier={report.byTier} />
          ) : (
            <p style={{ color: "#9ca3af" }}>Loading...</p>
          )}
        </div>
      </div>

      {/* Pending proposals */}
      {proposals.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3>📋 Proposals Awaiting Approval</h3>
          {proposals.map((p) => (
            <ProposalCard key={p.id} proposal={p} onAction={fetchData} />
          ))}
        </div>
      )}

      {/* Audit Feed */}
      <div style={{ background: "#f8f9fa", borderRadius: 8, padding: 20 }}>
        <h3 style={{ marginTop: 0 }}>📜 Live Audit Feed ({feed.length} events)</h3>
        <AuditFeed entries={feed} />
      </div>
    </div>
  );
}
