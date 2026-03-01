"use client";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

const COLORS = { GREEN: "#22c55e", YELLOW: "#eab308", RED: "#ef4444" };

export default function RiskChart({ byTier }) {
  if (!byTier) return <p style={{ color: "#9ca3af" }}>No data</p>;

  const data = [
    { name: "GREEN", value: byTier.GREEN || 0 },
    { name: "YELLOW", value: byTier.YELLOW || 0 },
    { name: "RED", value: byTier.RED || 0 },
  ];

  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <p style={{ color: "#9ca3af" }}>No proposals yet.</p>;

  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
          outerRadius={90}
          dataKey="value"
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={COLORS[entry.name]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
