"use client";
import { useState, useEffect, useCallback } from "react";
import { Zap, CheckCircle2, Clock, ChevronDown, ChevronUp, Terminal, Check, AlertTriangle, Plus, ExternalLink } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

const blastColors = {
  LOW:    { bg: "#f0fdf4", color: "#166534", border: "#bbf7d0" },
  MEDIUM: { bg: "#fffbeb", color: "#92400e", border: "#fde68a" },
  HIGH:   { bg: "#fef2f2", color: "#991b1b", border: "#fecaca" },
};

function relTime(iso) {
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function HotfixCard({ hotfix, incidentId, onApply }) {
  const [showDiff, setShowDiff] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(hotfix.status === "APPLIED");
  const [prUrl, setPrUrl] = useState(null);
  const [applyError, setApplyError] = useState(null);
  const blast = blastColors[hotfix.blastRadius] || blastColors.LOW;

  const handleApply = async () => {
    setApplying(true);
    setApplyError(null);
    try {
      const res = await fetch(
        `${API_BASE}/incident/${incidentId}/apply/${hotfix.id}?appliedBy=dashboard-user`,
        { method: "POST" }
      );
      const data = await res.json();
      if (res.ok) {
        setApplied(true);
        setPrUrl(data.prUrl);
        if (onApply) onApply(hotfix.id);
      } else {
        setApplyError(data.error || "Failed to apply");
      }
    } catch (err) {
      setApplyError("Network error");
    } finally {
      setApplying(false);
    }
  };

  return (
    <div
      style={{
        border: "1px solid #e5e7eb", borderRadius: 8, padding: "12px 14px",
        marginBottom: 8, background: applied ? "#f0fdf4" : "#fff",
        borderLeft: `3px solid ${applied ? "#22c55e" : "#5865f2"}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
            <span
              style={{
                background: blast.bg, color: blast.color, border: `1px solid ${blast.border}`,
                borderRadius: 4, padding: "1px 8px", fontSize: 11, fontWeight: 700,
              }}
            >
              {hotfix.blastRadius} blast
            </span>
            <span style={{ fontSize: 12, color: "#9ca3af" }}>
              {Math.round(hotfix.confidence * 100)}% confidence
            </span>
            {applied && (
              <span style={{ fontSize: 12, color: "#166534", fontWeight: 600, display: "flex", alignItems: "center", gap: 3 }}>
                <CheckCircle2 size={12} /> Applied{hotfix.appliedBy ? ` by ${hotfix.appliedBy}` : ""}
              </span>
            )}
            {prUrl && (
              <a
                href={prUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 12, color: "#5865f2", fontWeight: 500, display: "flex", alignItems: "center", gap: 3, textDecoration: "none" }}
              >
                <ExternalLink size={11} /> View PR
              </a>
            )}
            {applyError && (
              <span style={{ fontSize: 12, color: "#991b1b", fontWeight: 500, display: "flex", alignItems: "center", gap: 3 }}>
                <AlertTriangle size={11} /> {applyError}
              </span>
            )}
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 500, color: "#111827" }}>{hotfix.summary}</div>
        </div>

        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <button
            onClick={() => setShowDiff((v) => !v)}
            style={{
              background: "none", border: "1px solid #e5e7eb", borderRadius: 6,
              padding: "4px 10px", fontSize: 12, color: "#6b7280",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
            }}
          >
            <Terminal size={12} />
            Diff
            {showDiff ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>

          {!applied && (
            <button
              onClick={handleApply}
              disabled={applying}
              style={{
                background: applying ? "#e5e7eb" : "#5865f2",
                color: applying ? "#9ca3af" : "#fff",
                border: "none", borderRadius: 6, padding: "4px 14px",
                fontSize: 12, fontWeight: 600, cursor: applying ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", gap: 4,
              }}
            >
              <Check size={12} />
              {applying ? "Applying…" : "Apply Hotfix"}
            </button>
          )}
        </div>
      </div>

      {showDiff && (
        <pre
          style={{
            marginTop: 10, background: "#0f172a", color: "#e2e8f0",
            borderRadius: 6, padding: "10px 14px", fontSize: 12,
            lineHeight: 1.6, overflowX: "auto", fontFamily: "monospace",
            whiteSpace: "pre-wrap", wordBreak: "break-all",
          }}
        >
          {hotfix.diff}
        </pre>
      )}
    </div>
  );
}

function IncidentCard({ incident, onRefresh }) {
  const [showLogs, setShowLogs] = useState(false);
  const [hotfixes, setHotfixes] = useState(incident.hotfixes || []);
  const [isActive, setIsActive] = useState(incident.status === "ACTIVE");
  const [resolving, setResolving] = useState(false);

  const handleApply = (hotfixId) => {
    setHotfixes((prev) =>
      prev.map((h) => h.id === hotfixId ? { ...h, status: "APPLIED", appliedBy: "dashboard-user", appliedAt: new Date().toISOString() } : h)
    );
  };

  const handleResolve = async () => {
    setResolving(true);
    try {
      const res = await fetch(`${API_BASE}/incident/${incident.id}/resolve?actor=dashboard-user`, { method: "POST" });
      if (res.ok) {
        setIsActive(false);
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      console.error("Resolve error:", err);
    } finally {
      setResolving(false);
    }
  };

  return (
    <div
      style={{
        background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10,
        padding: "18px 20px", marginBottom: 16,
        borderLeft: `4px solid ${isActive ? "#ef4444" : "#22c55e"}`,
      }}
    >
      {/* Incident header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
            <span
              style={{
                display: "flex", alignItems: "center", gap: 4,
                background: isActive ? "#fef2f2" : "#f0fdf4",
                color: isActive ? "#991b1b" : "#166534",
                border: `1px solid ${isActive ? "#fecaca" : "#bbf7d0"}`,
                borderRadius: 5, padding: "2px 9px", fontSize: 12, fontWeight: 700,
              }}
            >
              {isActive ? <Zap size={11} /> : <CheckCircle2 size={11} />}
              {isActive ? "Active" : "Resolved"}
            </span>
            <span style={{ color: "#9ca3af", fontSize: 12 }}>
              #{incident.id.slice(0, 8)} · {incident.repo} · {relTime(incident.createdAt)}
            </span>
          </div>
          <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#111827", lineHeight: 1.4 }}>
            {incident.description}
          </h4>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#6b7280" }}>
            Reported by <strong style={{ fontWeight: 500 }}>{incident.reporter}</strong>
            {incident.resolvedAt && (
              <span style={{ color: "#22c55e" }}> · Resolved {relTime(incident.resolvedAt)}</span>
            )}
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end", flexShrink: 0 }}>
          <div
            style={{
              background: isActive ? "#fef2f2" : "#f0fdf4", border: `1px solid ${isActive ? "#fecaca" : "#bbf7d0"}`,
              borderRadius: 8, padding: "8px 14px", textAlign: "center",
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 800, color: isActive ? "#ef4444" : "#22c55e", lineHeight: 1 }}>
              {hotfixes.length}
            </div>
            <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600, marginTop: 2 }}>HOTFIXES</div>
          </div>
          {isActive && (
            <button
              onClick={handleResolve}
              disabled={resolving}
              style={{
                background: resolving ? "#e5e7eb" : "#22c55e",
                color: resolving ? "#9ca3af" : "#fff",
                border: "none", borderRadius: 6, padding: "5px 14px",
                fontSize: 12, fontWeight: 600, cursor: resolving ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", gap: 4,
              }}
            >
              <CheckCircle2 size={12} />
              {resolving ? "Resolving…" : "Resolve"}
            </button>
          )}
        </div>
      </div>

      {/* Logs toggle */}
      <button
        onClick={() => setShowLogs((v) => !v)}
        style={{
          background: "none", border: "1px solid #e5e7eb", borderRadius: 6,
          padding: "4px 12px", fontSize: 12, color: "#6b7280",
          cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
          marginBottom: 12,
        }}
      >
        <Terminal size={12} />
        {showLogs ? "Hide" : "Show"} error logs
        {showLogs ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      </button>

      {showLogs && (
        <pre
          style={{
            background: "#0f172a", color: "#f87171", borderRadius: 6,
            padding: "10px 14px", fontSize: 12, lineHeight: 1.6,
            overflowX: "auto", fontFamily: "monospace", marginBottom: 12,
            whiteSpace: "pre-wrap", wordBreak: "break-all",
          }}
        >
          {incident.logs}
        </pre>
      )}

      {/* Hotfixes */}
      {hotfixes.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
            AI-Generated Hotfixes
          </div>
          {hotfixes.map((h) => (
            <HotfixCard key={h.id} hotfix={h} incidentId={incident.id} onApply={handleApply} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function IncidentsView({ onDeclareIncident }) {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchIncidents = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/incident`);
      if (res.ok) {
        const data = await res.json();
        setIncidents(data.incidents || []);
      }
    } catch (err) {
      console.error("Fetch incidents error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIncidents();
    const interval = setInterval(fetchIncidents, 5000);
    return () => clearInterval(interval);
  }, [fetchIncidents]);

  const active = incidents.filter((i) => i.status === "ACTIVE");
  const resolved = incidents.filter((i) => i.status === "RESOLVED");

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0, letterSpacing: "-0.3px" }}>
            Incidents
          </h1>
          {active.length > 0 && (
            <span
              style={{
                background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca",
                borderRadius: 10, fontSize: 12, fontWeight: 700, padding: "2px 10px",
                display: "flex", alignItems: "center", gap: 4,
              }}
            >
              <Zap size={11} /> {active.length} active
            </span>
          )}
          <button
            onClick={onDeclareIncident}
            style={{
              marginLeft: "auto", background: "#ef4444", color: "#fff",
              border: "none", borderRadius: 7, padding: "7px 16px",
              fontSize: 13, fontWeight: 600, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 5,
            }}
          >
            <Plus size={14} /> Declare Incident
          </button>
        </div>
        <p style={{ color: "#6b7280", fontSize: 14 }}>
          Production incidents and AI-ranked hotfix proposals with 45s countdown
        </p>
      </div>

      {loading ? (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "50px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 15, color: "#9ca3af" }}>Loading incidents...</div>
        </div>
      ) : incidents.length === 0 ? (
        <div
          style={{
            background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10,
            padding: "50px 20px", textAlign: "center",
          }}
        >
          <CheckCircle2 size={36} color="#22c55e" style={{ margin: "0 auto 12px" }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: "#111827", marginBottom: 4 }}>All clear</div>
          <div style={{ fontSize: 13, color: "#9ca3af" }}>No active incidents. Everything is running smoothly.</div>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#ef4444", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10, display: "flex", alignItems: "center", gap: 5 }}>
                <Zap size={12} /> Active ({active.length})
              </div>
              {active.map((i) => <IncidentCard key={i.id} incident={i} onRefresh={fetchIncidents} />)}
            </div>
          )}
          {resolved.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#22c55e", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10, display: "flex", alignItems: "center", gap: 5 }}>
                <CheckCircle2 size={12} /> Resolved ({resolved.length})
              </div>
              {resolved.map((i) => <IncidentCard key={i.id} incident={i} onRefresh={fetchIncidents} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
