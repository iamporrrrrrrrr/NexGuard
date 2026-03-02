import React from "react";
import { PieChart, Pie, Cell, Tooltip, Legend } from "recharts";

// Displays tier distribution (GREEN / YELLOW / RED counts) as a chart
// Props: proposals — array of proposals with tier field
export default function RiskChart({ proposals = [] }) {
  const counts = proposals.reduce(
    (acc, p) => {
      acc[p.tier] = (acc[p.tier] ?? 0) + 1;
      return acc;
    },
    { GREEN: 0, YELLOW: 0, RED: 0 }
  );

  const data = [
    { name: "GREEN", value: counts.GREEN },
    { name: "YELLOW", value: counts.YELLOW },
    { name: "RED", value: counts.RED },
  ];

  const COLORS = ["#00C49F", "#FFBB28", "#FF8042"];

  return (
    <div>
      <h2>Risk Distribution</h2>
      <PieChart width={400} height={400}>
        <Pie
          data={data}
          cx={200}
          cy={200}
          labelLine={false}
          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
          outerRadius={150}
          fill="#8884d8"
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </div>
  );
}
