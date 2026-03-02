"use client";

export default function StatCard({
  Icon,
  label,
  value,
  sub,
  accentColor = "#5865f2",
}) {
  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: 10,
        padding: "18px 20px",
        border: "1px solid #e5e7eb",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Top accent bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: accentColor,
          borderRadius: "10px 10px 0 0",
        }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div
            style={{
              color: "#6b7280",
              fontSize: 11.5,
              fontWeight: 600,
              marginBottom: 8,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            {label}
          </div>
          <div
            style={{
              color: "#111827",
              fontSize: 28,
              fontWeight: 800,
              lineHeight: 1,
              letterSpacing: "-0.5px",
            }}
          >
            {value}
          </div>
          {sub && (
            <div
              style={{
                color: "#9ca3af",
                fontSize: 12,
                marginTop: 5,
                fontWeight: 400,
              }}
            >
              {sub}
            </div>
          )}
        </div>

        {/* Icon bubble */}
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 11,
            background: `${accentColor}16`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {Icon && <Icon size={21} color={accentColor} strokeWidth={1.8} />}
        </div>
      </div>
    </div>
  );
}
