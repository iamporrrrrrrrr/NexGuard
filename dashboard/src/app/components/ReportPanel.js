"use client";
import { useState } from "react";
import { FileText, RefreshCw, ClipboardList, CheckCircle, Target, AlertOctagon, Shield, BarChart3 } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

function StatBox({ icon: Icon, label, value, color }) {
  return (
    <div style={{
      background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8,
      padding: "14px 16px", display: "flex", alignItems: "center", gap: 12,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 8,
        background: `${color}12`, display: "flex",
        alignItems: "center", justifyContent: "center",
      }}>
        <Icon size={18} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#111827", lineHeight: 1 }}>
          {value ?? "—"}
        </div>
        <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500, marginTop: 2 }}>
          {label}
        </div>
      </div>
    </div>
  );
}

export default function ReportPanel() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hours, setHours] = useState(24);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/audit/report?hours=${hours}`);
      if (res.ok) {
        const data = await res.json();
        setReport(data.summary);
      } else {
        setError("Failed to generate report");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10,
      padding: "20px 22px", marginBottom: 24,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <FileText size={16} color="#5865f2" />
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#111827" }}>
            Compliance Report
          </h3>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <select
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            style={{
              border: "1px solid #d1d5db", borderRadius: 6, padding: "4px 8px",
              fontSize: 12, color: "#374151", outline: "none", background: "#fff",
            }}
          >
            <option value={1}>Last 1 hour</option>
            <option value={6}>Last 6 hours</option>
            <option value={24}>Last 24 hours</option>
            <option value={168}>Last 7 days</option>
            <option value={720}>Last 30 days</option>
          </select>
          <button
            onClick={generate}
            disabled={loading}
            style={{
              background: loading ? "#e5e7eb" : "#5865f2", color: loading ? "#9ca3af" : "#fff",
              border: "none", borderRadius: 6, padding: "5px 14px",
              fontSize: 12, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: 5,
            }}
          >
            {loading ? <RefreshCw size={12} style={{ animation: "spin 1s linear infinite" }} /> : <BarChart3 size={12} />}
            {loading ? "Generating…" : "Generate Report"}
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6,
          padding: "8px 12px", fontSize: 12, color: "#991b1b", marginBottom: 12,
        }}>
          {error}
        </div>
      )}

      {report && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
            <StatBox icon={ClipboardList} label="Total Proposals" value={report.totalProposals} color="#5865f2" />
            <StatBox icon={CheckCircle} label="Approval Rate" value={report.approvalRate} color="#22c55e" />
            <StatBox icon={Target} label="Avg Risk Score" value={report.avgRiskScore ?? "N/A"} color="#f59e0b" />
            <StatBox icon={AlertOctagon} label="Fail-Safes" value={report.failSafeTriggered} color="#ef4444" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {/* Tier breakdown */}
            <div style={{
              background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "14px 16px",
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                By Tier
              </div>
              {[
                { key: "GREEN",  color: "#22c55e", label: "Green" },
                { key: "YELLOW", color: "#f59e0b", label: "Yellow" },
                { key: "RED",    color: "#ef4444", label: "Red" },
              ].map(({ key, color, label }) => (
                <div key={key} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                    <span style={{ color: "#374151" }}>{label}</span>
                  </div>
                  <span style={{ fontWeight: 700, color }}>{report.byTier?.[key] || 0}</span>
                </div>
              ))}
            </div>

            {/* Status breakdown */}
            <div style={{
              background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "14px 16px",
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                By Status
              </div>
              {["AUTO_EXECUTED", "APPROVED", "EXECUTED", "REJECTED", "AWAITING_APPROVAL", "PENDING", "FAILED"].map((s) => {
                const count = report.byStatus?.[s] || 0;
                if (count === 0) return null;
                return (
                  <div key={s} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13 }}>
                    <span style={{ color: "#374151" }}>{s.replace(/_/g, " ")}</span>
                    <span style={{ fontWeight: 600, color: "#111827" }}>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {!report && !loading && (
        <div style={{
          textAlign: "center", padding: "24px 0", color: "#9ca3af", fontSize: 13,
        }}>
          Click "Generate Report" to view compliance statistics
        </div>
      )}

      {/* Spin animation keyframes */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
