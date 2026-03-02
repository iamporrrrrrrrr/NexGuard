"use client";
import { useState } from "react";
import { Bell, Clock, CheckCircle, Zap, Info, X } from "lucide-react";

const notifTypeIcon = {
  approval: { Icon: CheckCircle, color: "#f59e0b" },
  incident: { Icon: Zap,         color: "#ef4444" },
  info:     { Icon: Info,        color: "#3b82f6" },
};

function relTime(iso) {
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export default function TopBar({ isLive, lastUpdated, activePage = "Overview", notifications = [], onMarkAllRead }) {
  const [showNotifs, setShowNotifs] = useState(false);
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div
      style={{
        height: 56,
        background: "#ffffff",
        borderBottom: "1px solid #e5e7eb",
        display: "flex",
        alignItems: "center",
        padding: "0 24px",
        gap: 12,
        flexShrink: 0,
        position: "relative",
        zIndex: 50,
      }}
    >
      {/* Breadcrumb */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "#9ca3af", fontSize: 13 }}>NexGuard</span>
        <span style={{ color: "#d1d5db", fontSize: 13 }}>/</span>
        <span style={{ color: "#111827", fontSize: 13, fontWeight: 600 }}>
          {activePage}
        </span>
      </div>

      {/* Right side */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Live status pill */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 12px",
            borderRadius: 20,
            background: isLive ? "#f0fdf4" : "#fef2f2",
            border: `1px solid ${isLive ? "#bbf7d0" : "#fecaca"}`,
          }}
        >
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: isLive ? "#22c55e" : "#ef4444",
              boxShadow: isLive ? "0 0 0 2px rgba(34,197,94,0.25)" : "none",
            }}
          />
          <span style={{ fontSize: 12, color: isLive ? "#166534" : "#991b1b", fontWeight: 500 }}>
            {isLive ? "Live" : "Offline"}
          </span>
        </div>

        {/* Last updated */}
        {lastUpdated && (
          <span style={{ color: "#9ca3af", fontSize: 12, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4 }}>
            <Clock size={12} />
            {lastUpdated}
          </span>
        )}

        <div style={{ width: 1, height: 22, background: "#e5e7eb" }} />

        {/* Notification bell */}
        <div style={{ position: "relative" }}>
          <div
            onClick={() => setShowNotifs((v) => !v)}
            style={{
              width: 34, height: 34, borderRadius: 8,
              border: `1px solid ${showNotifs ? "#5865f2" : "#e5e7eb"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", background: showNotifs ? "#eef2ff" : "#fff",
              position: "relative", transition: "all 0.15s",
            }}
          >
            <Bell size={16} color={showNotifs ? "#5865f2" : "#6b7280"} />
            {unreadCount > 0 && (
              <div
                style={{
                  position: "absolute", top: 6, right: 6,
                  width: 8, height: 8, borderRadius: "50%",
                  background: "#ef4444", border: "1.5px solid #fff",
                }}
              />
            )}
          </div>

          {/* Notifications dropdown */}
          {showNotifs && (
            <div
              style={{
                position: "absolute", top: 42, right: 0,
                width: 320, background: "#fff",
                border: "1px solid #e5e7eb", borderRadius: 10,
                boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                zIndex: 100, overflow: "hidden",
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 16px", borderBottom: "1px solid #f3f4f6",
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
                  Notifications
                  {unreadCount > 0 && (
                    <span
                      style={{
                        marginLeft: 8, background: "#ef4444", color: "#fff",
                        borderRadius: 10, fontSize: 11, fontWeight: 700,
                        padding: "1px 6px",
                      }}
                    >
                      {unreadCount}
                    </span>
                  )}
                </span>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {unreadCount > 0 && (
                    <button
                      onClick={() => { onMarkAllRead && onMarkAllRead(); }}
                      style={{
                        background: "none", border: "none", color: "#5865f2",
                        fontSize: 12, cursor: "pointer", fontWeight: 500, padding: 0,
                      }}
                    >
                      Mark all read
                    </button>
                  )}
                  <X
                    size={14}
                    color="#9ca3af"
                    style={{ cursor: "pointer" }}
                    onClick={() => setShowNotifs(false)}
                  />
                </div>
              </div>

              {/* Notification list */}
              {notifications.length === 0 ? (
                <div style={{ padding: "20px 16px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
                  No notifications
                </div>
              ) : (
                notifications.map((n, i) => {
                  const cfg = notifTypeIcon[n.type] || notifTypeIcon.info;
                  return (
                    <div
                      key={n.id}
                      style={{
                        display: "flex", gap: 12, padding: "12px 16px",
                        borderBottom: i < notifications.length - 1 ? "1px solid #f9fafb" : "none",
                        background: n.read ? "#fff" : "#fafbff",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "#f9fafb"}
                      onMouseLeave={(e) => e.currentTarget.style.background = n.read ? "#fff" : "#fafbff"}
                    >
                      <div
                        style={{
                          width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                          background: `${cfg.color}18`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                      >
                        <cfg.Icon size={15} color={cfg.color} strokeWidth={2} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: n.read ? 400 : 600, color: "#111827", marginBottom: 2 }}>
                          {n.title}
                        </div>
                        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 3 }}>{n.body}</div>
                        <div style={{ fontSize: 11, color: "#9ca3af" }}>{relTime(n.createdAt)}</div>
                      </div>
                      {!n.read && (
                        <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#5865f2", marginTop: 4, flexShrink: 0 }} />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Avatar */}
        <div
          style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "linear-gradient(135deg, #5865f2, #a78bfa)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0,
          }}
        >
          A
        </div>
      </div>
    </div>
  );
}
