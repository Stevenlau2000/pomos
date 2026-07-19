// components/explain/diagrams/TrajectoryDiagram.tsx
// 抛体轨迹图：水平匀速 + 竖直匀加速的抛物线，标注初速度与顶点。
"use client";

import * as React from "react";
import type { DiagramProps } from "@/lib/explain/types";
import { num, Arrow } from "../svgUtils";

export const TrajectoryDiagram: React.FC<DiagramProps> = ({ spec, caption }) => {
  const v0 = num(spec, "v0", 20);
  const theta = (num(spec, "theta", 45) * Math.PI) / 180;
  const g = num(spec, "g", 9.8);
  const W = 320;
  const H = 200;
  const ox = 30;
  const oy = H - 30;
  const T = (2 * v0 * Math.sin(theta)) / g || 1;
  const R = (v0 * v0 * Math.sin(2 * theta)) / g || 1;
  const Hmax = (v0 * v0 * Math.sin(theta) ** 2) / (2 * g) || 1;
  const sx = (W - ox - 20) / R;
  const sy = (oy - 20) / Hmax;
  const pts: string[] = [];
  const N = 48;
  for (let i = 0; i <= N; i++) {
    const t = (T * i) / N;
    const x = ox + v0 * Math.cos(theta) * t * sx;
    const y = oy - (v0 * Math.sin(theta) * t - 0.5 * g * t * t) * sy;
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  const apexX = ox + ((v0 * v0 * Math.sin(2 * theta)) / (2 * g)) * sx;
  const apexY = oy - Hmax * sy;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={caption ?? "运动轨迹"}>
      <rect x={0} y={0} width={W} height={H} fill="#f8fafc" rx={8} />
      <line x1={ox} y1={oy} x2={W - 10} y2={oy} stroke="#cbd5e1" strokeWidth={1} />
      <line x1={ox} y1={oy} x2={ox} y2={14} stroke="#cbd5e1" strokeWidth={1} />
      <polyline points={pts.join(" ")} fill="none" stroke="#2563eb" strokeWidth={2} />
      <circle cx={apexX} cy={apexY} r={3} fill="#2563eb" />
      <Arrow
        x1={ox}
        y1={oy}
        x2={ox + Math.cos(theta) * 36}
        y2={oy - Math.sin(theta) * 36}
        color="#16a34a"
        label="v₀"
      />
      <text x={W / 2} y={H - 6} fontSize={10} fill="#94a3b8" textAnchor="middle">
        {caption ?? "抛体轨迹：水平匀速 · 竖直匀加速"}
      </text>
    </svg>
  );
};
