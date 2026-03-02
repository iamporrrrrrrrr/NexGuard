"use client";
import { useState, useEffect, useRef } from "react";
import { X, Zap, Clock, CheckCircle2, Terminal, ChevronDown, ChevronUp, Check, ExternalLink, AlertTriangle } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

const blastColors = {
  LOW:    { bg: "#f0fdf4", color: "#166534", border: "#bbf7d0" },
  MEDIUM: { bg: "#fffbeb", color: "#92400e", border: "#fde68a" },
  HIGH:   { bg: "#fef2f2", color: "#991b1b", border: "#fecaca" },
};

function ModalHotfixCard({ hotfix, incidentId }) {
  const [showDiff, setShowDiff] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(hotfix.status === "APPLIED");
  const [prUrl, setPrUrl] = useState(null);
  const [error, setError] = useState(null);
  const blast = blastColors[hotfix.blastRadius] || blastColors.LOW;

  const handleApply = async () => {
    setApplying(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/incident/${incidentId}/apply/${hotfix.id}?appliedBy=dashboard-user`,
        { method: "POST" }
      );
      const data = await res.json();
      if (res.ok) {
        setApplied(true);
        setPrUrl(data.prUrl);
      } else {
        setError(data.error || "Apply failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setApplying(false);
    }
  };

  return (
    <div style={{
      border: "1px solid #e5e7eb", borderRadius: 8, padding: "12px 14px",
      marginBottom: 8, background: applied ? "#f0fdf4" : "#fff",
      borderLeft: `3px solid ${applied ? "#22c55e" : "#5865f2"}`,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
            <span style={{
              background: blast.bg, color: blast.color, border: `1px solid ${blast.border}`,
              borderRadius: 4, padding: "1px 8px", fontSize: 11, fontWeight: 700,
            }}>
              {hotfix.blastRadius} blast
            </span>
            <span style={{ fontSize: 12, color: "#9ca3af" }}>
              {Math.round(hotfix.confidence * 100)}% confidence
            </span>
            {applied && (
              <span style={{ fontSize: 12, color: "#166534", fontWeight: 600, display: "flex", alignItems: "center", gap: 3 }}>
                <CheckCircle2 size={12} /> Applied
              </span>
            )}
            {prUrl && (
              <a href={prUrl} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 12, color: "#5865f2", fontWeight: 500, display: "flex", alignItems: "center", gap: 3, textDecoration: "none" }}>
                <ExternalLink size={11} /> View PR
              </a>
            )}
            {error && (
              <span style={{ fontSize: 12, color: "#991b1b", display: "flex", alignItems: "center", gap: 3 }}>
                <AlertTriangle size={11} /> {error}
              </span>
            )}
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 500, color: "#111827" }}>{hotfix.summary}</div>
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <button onClick={() => setShowDiff(v => !v)}
            style={{
              background: "none", border: "1px solid #e5e7eb", borderRadius: 6,
              padding: "4px 10px", fontSize: 12, color: "#6b7280", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 4,
            }}>
            <Terminal size={12} /> Diff {showDiff ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
          {!applied && (
            <button onClick={handleApply} disabled={applying}
              style={{
                background: applying ? "#e5e7eb" : "#5865f2",
                color: applying ? "#9ca3af" : "#fff",
                border: "none", borderRadius: 6, padding: "4px 14px",
                fontSize: 12, fontWeight: 600, cursor: applying ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", gap: 4,
              }}>
              <Check size={12} /> {applying ? "Applying…" : "Apply Hotfix"}
            </button>
          )}
        </div>
      </div>
      {showDiff && (
        <pre style={{
          marginTop: 10, background: "#0f172a", color: "#e2e8f0",
          borderRadius: 6, padding: "10px 14px", fontSize: 12,
          lineHeight: 1.6, overflowX: "auto", fontFamily: "monospace",
          whiteSpace: "pre-wrap", wordBreak: "break-all",
        }}>
          {hotfix.diff}
        </pre>
      )}
    </div>
  );
}

export default function IncidentModal({ isOpen, onClose }) {
  // Form state
  const [description, setDescription] = useState("");
  const [logs, setLogs] = useState("");
  const [repo, setRepo] = useState("iamporrrrrrrrr/demo-app");
  const [reporter, setReporter] = useState("dashboard-user");

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { incidentId, hotfixes }
  const [error, setError] = useState(null);

  // Countdown timer
  const [countdown, setCountdown] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      timerRef.current = setTimeout(() => setCountdown(c => c - 1), 1000);
    }
    return () => clearTimeout(timerRef.current);
  }, [countdown]);

  const handleSubmit = async () => {
    if (!description.trim() || !logs.trim()) return;
    setSubmitting(true);
    setError(null);
    setResult(null);
    setCountdown(45); // Start 45s countdown

    try {
      const res = await fetch(`${API_BASE}/incident`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, logs, repo, reporter }),
      });
      const data = await res.json();
      setCountdown(null);

      if (res.ok) {
        // Fetch full incident with hotfix IDs
        const incRes = await fetch(`${API_BASE}/incident/${data.incidentId}`);
        if (incRes.ok) {
          const inc = await incRes.json();
          setResult({ incidentId: data.incidentId, hotfixes: inc.hotfixes || [] });
        } else {
          setResult({ incidentId: data.incidentId, hotfixes: [] });
        }
      } else {
        setError(data.error || "Failed to declare incident");
      }
    } catch {
      setCountdown(null);
      setError("Network error — is the backend running?");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setDescription("");
    setLogs("");
    setResult(null);
    setError(null);
    setCountdown(null);
    setSubmitting(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
    }}>
      <div style={{
        background: "#fff", borderRadius: 12, width: 640, maxHeight: "85vh",
        overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: "1px solid #e5e7eb",
          background: "#fef2f2",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Zap size={18} color="#ef4444" />
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#111827" }}>
              {result ? "Incident Declared" : "Declare Incident"}
            </h2>
          </div>
          <button onClick={handleClose} style={{
            background: "none", border: "none", cursor: "pointer", color: "#6b7280",
            padding: 4, borderRadius: 6,
          }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "20px" }}>
          {/* Countdown timer */}
          {countdown !== null && countdown > 0 && (
            <div style={{
              background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8,
              padding: "12px 16px", marginBottom: 16, display: "flex",
              alignItems: "center", gap: 10,
            }}>
              <Clock size={16} color="#f59e0b" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#92400e" }}>
                  AI analyzing incident...
                </div>
                <div style={{ fontSize: 12, color: "#b45309" }}>
                  Ranking hotfix candidates within 45s countdown
                </div>
              </div>
              <div style={{
                fontSize: 22, fontWeight: 800, color: "#f59e0b",
                fontFamily: "monospace", minWidth: 40, textAlign: "center",
              }}>
                {countdown}s
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8,
              padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#991b1b",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <AlertTriangle size={14} /> {error}
            </div>
          )}

          {/* Result — show hotfixes */}
          {result ? (
            <div>
              <div style={{
                background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8,
                padding: "12px 16px", marginBottom: 16, display: "flex",
                alignItems: "center", gap: 10,
              }}>
                <CheckCircle2 size={16} color="#22c55e" />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#166534" }}>
                    Incident created — #{result.incidentId.slice(0, 8)}
                  </div>
                  <div style={{ fontSize: 12, color: "#15803d" }}>
                    {result.hotfixes.length} hotfix candidate{result.hotfixes.length !== 1 ? "s" : ""} generated
                  </div>
                </div>
              </div>

              {result.hotfixes.length > 0 && (
                <div>
                  <div style={{
                    fontSize: 12, fontWeight: 700, color: "#6b7280",
                    textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10,
                  }}>
                    Select a hotfix to apply
                  </div>
                  {result.hotfixes.map((h) => (
                    <ModalHotfixCard key={h.id} hotfix={h} incidentId={result.incidentId} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Form */
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                  Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="orders-api returning 500 errors since last deploy"
                  disabled={submitting}
                  style={{
                    width: "100%", padding: "8px 12px", borderRadius: 6,
                    border: "1px solid #d1d5db", fontSize: 13, outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                  Error Logs
                </label>
                <textarea
                  value={logs}
                  onChange={(e) => setLogs(e.target.value)}
                  placeholder="Paste error logs, stack traces, or relevant output..."
                  rows={5}
                  disabled={submitting}
                  style={{
                    width: "100%", padding: "8px 12px", borderRadius: 6,
                    border: "1px solid #d1d5db", fontSize: 12, outline: "none",
                    fontFamily: "monospace", resize: "vertical",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                    Repository
                  </label>
                  <input
                    type="text"
                    value={repo}
                    onChange={(e) => setRepo(e.target.value)}
                    disabled={submitting}
                    style={{
                      width: "100%", padding: "8px 12px", borderRadius: 6,
                      border: "1px solid #d1d5db", fontSize: 13, outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                    Reporter
                  </label>
                  <input
                    type="text"
                    value={reporter}
                    onChange={(e) => setReporter(e.target.value)}
                    disabled={submitting}
                    style={{
                      width: "100%", padding: "8px 12px", borderRadius: 6,
                      border: "1px solid #d1d5db", fontSize: 13, outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>
              <button
                onClick={handleSubmit}
                disabled={submitting || !description.trim() || !logs.trim()}
                style={{
                  background: submitting ? "#fca5a5" : "#ef4444",
                  color: "#fff", border: "none", borderRadius: 7,
                  padding: "10px 20px", fontSize: 14, fontWeight: 700,
                  cursor: submitting ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  marginTop: 4,
                }}
              >
                <Zap size={15} />
                {submitting ? "Analyzing incident..." : "Declare Incident"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
