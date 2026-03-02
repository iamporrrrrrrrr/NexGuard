"use client";
import { Shield, Zap, BellRing, GitBranch, Lock, Info } from "lucide-react";

function SettingRow({ label, value, description, valueColor }) {
  return (
    <div
      style={{
        display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        padding: "13px 0", borderBottom: "1px solid #f3f4f6", gap: 20,
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: "#111827", marginBottom: 3 }}>{label}</div>
        {description && <div style={{ fontSize: 12, color: "#9ca3af" }}>{description}</div>}
      </div>
      <span
        style={{
          background: "#f3f4f6", color: valueColor || "#374151",
          borderRadius: 6, padding: "4px 10px", fontSize: 12.5, fontWeight: 600,
          fontFamily: "monospace", whiteSpace: "nowrap", flexShrink: 0,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function SettingSection({ icon: Icon, iconColor = "#5865f2", title, description, children }) {
  return (
    <div
      style={{
        background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10,
        padding: "18px 20px", marginBottom: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <div
          style={{
            width: 32, height: 32, borderRadius: 8, background: `${iconColor}18`,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}
        >
          <Icon size={16} color={iconColor} strokeWidth={1.8} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{title}</div>
          {description && <div style={{ fontSize: 12, color: "#9ca3af" }}>{description}</div>}
        </div>
      </div>
      <div style={{ marginTop: 10 }}>{children}</div>
    </div>
  );
}

function TierChip({ tier }) {
  const cfg = {
    GREEN:  { bg: "#f0fdf4", color: "#166534" },
    YELLOW: { bg: "#fffbeb", color: "#92400e" },
    RED:    { bg: "#fef2f2", color: "#991b1b" },
  }[tier] || {};
  return (
    <span style={{ background: cfg.bg, color: cfg.color, borderRadius: 5, padding: "2px 8px", fontSize: 12, fontWeight: 700, marginRight: 5 }}>
      {tier}
    </span>
  );
}

export default function SettingsView() {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0, letterSpacing: "-0.3px" }}>
            Settings
          </h1>
          <span
            style={{
              background: "#f1f5f9", color: "#64748b", borderRadius: 5,
              padding: "2px 8px", fontSize: 11, fontWeight: 600, border: "1px solid #e2e8f0",
              display: "flex", alignItems: "center", gap: 4,
            }}
          >
            <Lock size={10} /> Read-only in demo
          </span>
        </div>
        <p style={{ color: "#6b7280", fontSize: 14 }}>
          Policy configuration loaded from <code style={{ background: "#f3f4f6", padding: "1px 5px", borderRadius: 4, fontSize: 12 }}>config/policy.yaml</code>
        </p>
      </div>

      {/* Risk tier thresholds */}
      <SettingSection icon={Shield} iconColor="#5865f2" title="Risk Tier Thresholds" description="Score ranges that determine automatic routing">
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          <SettingRow label={<><TierChip tier="GREEN" /> Auto-execute</>} value="0 – 30" description="Change is applied automatically, logged only" valueColor="#166534" />
          <SettingRow label={<><TierChip tier="YELLOW" /> Notify + veto window</>} value="31 – 69" description="Applied after 1-hour veto window unless vetoed/rejected" valueColor="#92400e" />
          <SettingRow label={<><TierChip tier="RED" /> Hard block</>} value="70 – 100" description="Blocked until explicit human approval with acknowledgment" valueColor="#991b1b" />
        </div>
      </SettingSection>

      {/* Approval windows */}
      <SettingSection icon={BellRing} iconColor="#f59e0b" title="Approval Windows" description="Timings for veto and notification delivery">
        <SettingRow label="YELLOW veto window" value="60 minutes" description="Time window to veto a YELLOW-tier change before it auto-executes" />
        <SettingRow label="RED approval timeout" value="No expiry" description="RED proposals remain blocked until manually approved or rejected" />
        <SettingRow label="Incident hotfix countdown" value="45 seconds" description="Time given to rank hotfixes before auto-applying top pick" />
        <SettingRow label="Audit feed poll interval" value="3 seconds" description="How often the dashboard fetches fresh audit log data" />
      </SettingSection>

      {/* ML pipeline */}
      <SettingSection icon={Zap} iconColor="#8b5cf6" title="ML Pipeline" description="Machine learning models and fallback behavior">
        <SettingRow label="Classifier model" value="CodeBERT" description="microsoft/codebert-base fine-tuned on synthetic blast radius data" />
        <SettingRow label="Classifier confidence threshold" value="0.80" description="Below this, falls back to rules-based scoring" />
        <SettingRow label="Anomaly detector" value="PyTorch Autoencoder" description="Trained on GREEN-tier proposal embeddings; anomalies force RED" />
        <SettingRow label="Duplicate threshold" value="0.92" description="Cosine similarity above this skips proposal generation" />
        <SettingRow label="ML sidecar URL" value="http://localhost:8001" description="Python FastAPI sidecar; backend falls back to rules if unavailable" />
        <SettingRow label="Fail-safe default" value="RED" description="Any ML exception defaults the tier to RED — never blocks pipeline" />
      </SettingSection>

      {/* GitHub integration */}
      <SettingSection icon={GitBranch} iconColor="#374151" title="GitHub Integration" description="Repository and PR configuration">
        <SettingRow label="Default branch" value="main" description="Branch used for applying diffs and opening PRs" />
        <SettingRow label="PR auto-create" value="enabled" description="Pull request opened automatically on APPROVED proposals" />
        <SettingRow label="Diff format" value="unified" description="Unified diff format for all code change proposals" />
      </SettingSection>

      {/* About */}
      <div
        style={{
          background: "linear-gradient(135deg, #1a1d2e, #2d2f4a)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 10, padding: "18px 20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Info size={15} color="#a5b4fc" />
          <span style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9" }}>About DevGuard</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
          {[
            { label: "Version", value: "1.0.0" },
            { label: "Backend", value: "Node.js + TypeScript" },
            { label: "Database", value: "PostgreSQL + Prisma" },
            { label: "Queue", value: "BullMQ + Redis" },
            { label: "ML Sidecar", value: "Python 3.11 + FastAPI" },
            { label: "AI Model", value: "gpt-4o" },
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 500 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
