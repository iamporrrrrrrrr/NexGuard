"use client";
import { useState, useEffect } from "react";
import {
  Check,
  X,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  FileText,
  CheckCircle2,
  XCircle,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

const tierConfig = {
  GREEN:  { color: "#22c55e", bg: "#f0fdf4", text: "#166534", border: "#bbf7d0" },
  YELLOW: { color: "#f59e0b", bg: "#fffbeb", text: "#92400e", border: "#fde68a" },
  RED:    { color: "#ef4444", bg: "#fef2f2", text: "#991b1b", border: "#fecaca" },
};

const statusConfig = {
  AUTO_EXECUTED:     { label: "Auto-Executed", color: "#22c55e", bg: "#f0fdf4" },
  APPROVED:          { label: "Approved",      color: "#16a34a", bg: "#f0fdf4" },
  REJECTED:          { label: "Rejected",      color: "#ef4444", bg: "#fef2f2" },
  VETOED:            { label: "Vetoed",         color: "#f97316", bg: "#fff7ed" },
  EXECUTED:          { label: "Executed",       color: "#22c55e", bg: "#f0fdf4" },
  FAILED:            { label: "Failed",         color: "#dc2626", bg: "#fef2f2" },
  AWAITING_APPROVAL: { label: "Awaiting",       color: "#f59e0b", bg: "#fffbeb" },
  PENDING:           { label: "Pending",        color: "#6b7280", bg: "#f9fafb" },
};

function useRelTime(iso) {
  const [text, setText] = useState("");
  useEffect(() => {
    if (!iso) return;
    const update = () => {
      const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
      if (diff < 60) setText(`${diff}s ago`);
      else if (diff < 3600) setText(`${Math.floor(diff / 60)}m ago`);
      else if (diff < 86400) setText(`${Math.floor(diff / 3600)}h ago`);
      else setText(`${Math.floor(diff / 86400)}d ago`);
    };
    update();
    const id = setInterval(update, 15000);
    return () => clearInterval(id);
  }, [iso]);
  return text;
}

// onApprove(id) / onReject(id) when provided triggers dummy mode (no real API call)
export default function ProposalCard({ proposal, onAction, onApprove, onReject }) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [loading, setLoading] = useState(false);
  const [doneAction, setDoneAction] = useState(null);
  const [showFiles, setShowFiles] = useState(false);
  const timeAgo = useRelTime(proposal?.createdAt);

  if (!proposal) return null;

  const isDummy = !!(onApprove || onReject);
  const effectiveStatus = doneAction || proposal.status;
  const t = tierConfig[proposal.tier] || tierConfig.YELLOW;
  const isRed = proposal.tier === "RED";
  const canApprove = !loading && !(isRed && !acknowledged) && !doneAction;

  const handleApprove = async () => {
    if (!canApprove) return;
    setLoading(true);
    if (isDummy) {
      setTimeout(() => { setDoneAction("APPROVED"); setLoading(false); if (onApprove) onApprove(proposal.id); }, 400);
      return;
    }
    try {
      await fetch(`${API_BASE}/approve/${proposal.id}?approver=dashboard-user`);
      if (onAction) onAction();
    } catch (err) { console.error("Approve failed:", err); }
    finally { setLoading(false); }
  };

  const handleReject = async () => {
    if (loading || doneAction) return;
    setLoading(true);
    if (isDummy) {
      setTimeout(() => { setDoneAction("REJECTED"); setLoading(false); if (onReject) onReject(proposal.id); }, 400);
      return;
    }
    try {
      await fetch(`${API_BASE}/reject/${proposal.id}?rejector=dashboard-user&reason=Rejected+from+dashboard`);
      if (onAction) onAction();
    } catch (err) { console.error("Reject failed:", err); }
    finally { setLoading(false); }
  };

  if (doneAction) {
    const isApproved = doneAction === "APPROVED";
    return (
      <div style={{ background: isApproved ? "#f0fdf4" : "#fef2f2", border: `1px solid ${isApproved ? "#bbf7d0" : "#fecaca"}`, borderLeft: `4px solid ${isApproved ? "#22c55e" : "#ef4444"}`, borderRadius: 10, padding: "14px 18px", marginBottom: 12, display: "flex", alignItems: "center", gap: 12 }}>
        {isApproved ? <CheckCircle2 size={20} color="#22c55e" /> : <XCircle size={20} color="#ef4444" />}
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: isApproved ? "#166534" : "#991b1b" }}>{isApproved ? "Approved" : "Rejected"} — {proposal.ticketTitle}</div>
          <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>by dashboard-user · just now</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderLeft: `4px solid ${t.color}`, borderRadius: 10, padding: "16px 18px", marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, flexWrap: "wrap" }}>
            <span style={{ background: t.bg, color: t.text, border: `1px solid ${t.border}`, borderRadius: 5, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>{proposal.tier}</span>
            {effectiveStatus && statusConfig[effectiveStatus] && (
              <span style={{ background: statusConfig[effectiveStatus].bg, color: statusConfig[effectiveStatus].color, borderRadius: 5, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>{statusConfig[effectiveStatus].label}</span>
            )}
            <span style={{ color: "#9ca3af", fontSize: 12 }}>#{proposal.id?.slice(0, 8)} · {proposal.repo}{timeAgo && ` · ${timeAgo}`}</span>
          </div>
          <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#111827", lineHeight: 1.4 }}>{proposal.ticketTitle || proposal.title}</h4>
        </div>
        <div style={{ background: isRed ? "#fef2f2" : "#f8fafc", border: `1px solid ${isRed ? "#fecaca" : "#e5e7eb"}`, borderRadius: 8, padding: "8px 14px", textAlign: "center", flexShrink: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: t.color, lineHeight: 1 }}>{proposal.riskScore}</div>
          <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600, marginTop: 2 }}>RISK</div>
        </div>
      </div>

      <p style={{ color: "#4b5563", fontSize: 13.5, margin: "0 0 12px", lineHeight: 1.65 }}>{proposal.summary}</p>

      {proposal.riskReasons?.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          {proposal.riskReasons.map((r, i) => (
            <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: 5, padding: "2px 8px", fontSize: 12, marginRight: 5, marginBottom: 5 }}>
              <AlertTriangle size={11} strokeWidth={2} /> {r}
            </span>
          ))}
        </div>
      )}

      {proposal.filesToModify?.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <button onClick={() => setShowFiles(!showFiles)} style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 5, padding: "3px 10px", fontSize: 12, color: "#6b7280", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}>
            {showFiles ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            <FileText size={12} />
            {proposal.filesToModify.length} file{proposal.filesToModify.length !== 1 ? "s" : ""} affected
          </button>
          {showFiles && (
            <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 5 }}>
              {proposal.filesToModify.map((f, i) => (
                <span key={i} style={{ background: "#f1f5f9", color: "#475569", borderRadius: 4, padding: "2px 8px", fontSize: 12, fontFamily: "monospace", border: "1px solid #e2e8f0" }}>{f}</span>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: effectiveStatus === "AWAITING_APPROVAL" ? 12 : 0 }}>
        Reported by <strong style={{ color: "#6b7280", fontWeight: 500 }}>{proposal.reporter}</strong>
        {" · "}
        <a href={`${API_BASE}/diff/${proposal.id}`} target="_blank" rel="noopener noreferrer" style={{ color: "#5865f2", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 3 }}>
          View Diff <ArrowUpRight size={12} />
        </a>
      </div>

      {effectiveStatus === "AWAITING_APPROVAL" && (
        <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {isRed && (
            <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "#991b1b", background: "#fef2f2", borderRadius: 6, padding: "7px 12px", cursor: "pointer", flex: "1 1 100%", border: "1px solid #fecaca" }}>
              <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} style={{ cursor: "pointer" }} />
              I acknowledge the risks of this RED-tier change
            </label>
          )}
          <button onClick={handleApprove} disabled={!canApprove} style={{ background: canApprove ? "#22c55e" : "#e5e7eb", color: canApprove ? "#fff" : "#9ca3af", border: "none", borderRadius: 7, padding: "8px 20px", cursor: canApprove ? "pointer" : "not-allowed", fontSize: 13, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Check size={14} strokeWidth={2.5} />
            {loading ? "Approving…" : "Approve"}
          </button>
          <button onClick={handleReject} disabled={loading || !!doneAction} style={{ background: loading ? "#e5e7eb" : "#fee2e2", color: loading ? "#9ca3af" : "#ef4444", border: "1px solid #fecaca", borderRadius: 7, padding: "8px 20px", cursor: loading ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <X size={14} strokeWidth={2.5} />
            {loading ? "Rejecting…" : "Reject"}
          </button>
        </div>
      )}
    </div>
  );
}