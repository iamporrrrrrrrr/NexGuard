import React from "react";

// Displays tier distribution (GREEN / YELLOW / RED counts) as a chart
// Props: proposals — array of proposals with tier field
export default function RiskChart({ proposals = [] }) {
  // TODO:
  // 1. Count proposals by tier
  // 2. Render a bar or pie chart (e.g. recharts or chart.js)
  const counts = proposals.reduce(
    (acc, p) => {
      acc[p.tier] = (acc[p.tier] ?? 0) + 1;
      return acc;
    },
    { GREEN: 0, YELLOW: 0, RED: 0 }
  );

  return (
    <div>
      <h2>Risk Distribution</h2>
      <p>GREEN: {counts.GREEN}</p>
      <p>YELLOW: {counts.YELLOW}</p>
      <p>RED: {counts.RED}</p>
      {/* TODO: replace with actual chart */}
    </div>
  );
}
