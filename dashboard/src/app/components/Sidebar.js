"use client";
import {
  LayoutDashboard,
  ClipboardList,
  Zap,
  ScrollText,
  Settings,
  Shield,
  Building2,
  ChevronDown,
} from "lucide-react";

const navItems = [
  { label: "Overview",  Icon: LayoutDashboard },
  { label: "Proposals", Icon: ClipboardList },
  { label: "Incidents", Icon: Zap },
  { label: "Audit Log", Icon: ScrollText },
  { label: "Settings",  Icon: Settings },
];

export default function Sidebar({ activePage = "Overview", onNavigate, pendingCount = 0 }) {

  return (
    <div
      style={{
        width: 220,
        minHeight: "100vh",
        background: "#1a1d2e",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: "20px 16px 18px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 34,
              height: 34,
              background: "linear-gradient(135deg, #5865f2, #7c3aed)",
              borderRadius: 9,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Shield size={18} color="#fff" strokeWidth={2.2} />
          </div>
          <div>
            <div
              style={{
                color: "#f1f5f9",
                fontWeight: 700,
                fontSize: 15,
                letterSpacing: "-0.3px",
                lineHeight: 1.2,
              }}
            >
              DevGuard
            </div>
            <div style={{ color: "#64748b", fontSize: 11 }}>AI Governance</div>
          </div>
        </div>
      </div>

      {/* Workspace pill */}
      <div style={{ padding: "14px 8px 6px" }}>
        <div
          style={{
            color: "#475569",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.07em",
            textTransform: "uppercase",
            padding: "0 8px",
            marginBottom: 6,
          }}
        >
          Workspace
        </div>
        <div
          style={{
            padding: "7px 10px",
            borderRadius: 7,
            background: "rgba(255,255,255,0.05)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            cursor: "pointer",
          }}
        >
          <Building2 size={15} color="#94a3b8" />
          <span style={{ color: "#cbd5e1", fontSize: 13, fontWeight: 500 }}>
            devguard-org
          </span>
          <ChevronDown size={13} color="#475569" style={{ marginLeft: "auto" }} />
        </div>
      </div>

      {/* Navigation */}
      <div style={{ padding: "10px 8px 0", flex: 1 }}>
        <div
          style={{
            color: "#475569",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.07em",
            textTransform: "uppercase",
            padding: "0 8px",
            marginBottom: 6,
          }}
        >
          Navigate
        </div>
        {navItems.map((item) => {
          const isActive = activePage === item.label;
          const badge = item.label === "Proposals" && pendingCount > 0 ? pendingCount : null;
          return (
            <div
              key={item.label}
              onClick={() => onNavigate && onNavigate(item.label)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                borderRadius: 7,
                marginBottom: 2,
                cursor: "pointer",
                background: isActive ? "rgba(88,101,242,0.18)" : "transparent",
                transition: "background 0.12s",
              }}
              onMouseEnter={(e) => {
                if (!isActive)
                  e.currentTarget.style.background = "rgba(255,255,255,0.05)";
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.background = "transparent";
              }}
            >
              <item.Icon
                size={16}
                color={isActive ? "#a5b4fc" : "#64748b"}
                style={{ flexShrink: 0 }}
              />
              <span
                style={{
                  color: isActive ? "#a5b4fc" : "#94a3b8",
                  fontSize: 13.5,
                  fontWeight: isActive ? 600 : 400,
                  flex: 1,
                }}
              >
                {item.label}
              </span>
              {badge && (
                <span
                  style={{
                    background: "#ef4444",
                    color: "#fff",
                    borderRadius: 10,
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "1px 7px",
                    minWidth: 20,
                    textAlign: "center",
                  }}
                >
                  {badge}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* User footer */}
      <div
        style={{
          padding: "12px 16px",
          borderTop: "1px solid rgba(255,255,255,0.07)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #5865f2, #a78bfa)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          A
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              color: "#e2e8f0",
              fontSize: 12.5,
              fontWeight: 500,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            Admin
          </div>
          <div style={{ color: "#64748b", fontSize: 11 }}>dashboard-user</div>
        </div>
        <Settings size={15} color="#475569" style={{ cursor: "pointer", flexShrink: 0 }} />
      </div>
    </div>
  );
}
