"use client";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const COLORS = { GREEN: "#22c55e", YELLOW: "#f59e0b", RED: "#ef4444" };

const CustomTooltip = ({ active, payload }) => {
  if (active && payload?.length) {
    const { name, value } = payload[0];
    return (
      <div
        style={{
          background: "#1a1d2e",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 7,
          padding: "6px 12px",
          color: "#f1f5f9",
          fontSize: 12,
        }}
      >
        <strong>{name}</strong>: {value}
      </div>
    );
  }
  return null;
};

export default function RiskChart({ byTier }) {
  if (!byTier) return <p style={{ color: "#9ca3af" }}>No data</p>;

  const data = [
    { name: "GREEN",  value: byTier.GREEN  || 0 },
    { name: "YELLOW", value: byTier.YELLOW || 0 },
    { name: "RED",    value: byTier.RED    || 0 },
  ];

  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <p style={{ color: "#9ca3af" }}>No proposals yet.</p>;

  return (
    <div style={{ position: "relative" }}>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={58}
            outerRadius={88}
            paddingAngle={3}
            dataKey="value"
            strokeWidth={0}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={COLORS[entry.name]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Center label */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -52%)",
          textAlign: "center",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            fontSize: 26,
            fontWeight: 800,
            color: "#111827",
            lineHeight: 1,
          }}
        >
          {total}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "#9ca3af",
            fontWeight: 600,
            marginTop: 3,
            letterSpacing: "0.05em",
          }}
        >
          TOTAL
        </div>
      </div>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 16,
          marginTop: 10,
        }}
      >
        {data.map((d) => (
          <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: COLORS[d.name],
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 12, color: "#6b7280" }}>
              {d.name} ({d.value})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
