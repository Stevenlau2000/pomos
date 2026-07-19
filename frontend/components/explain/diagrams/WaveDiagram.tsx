// components/explain/diagrams/WaveDiagram.tsx
// 行波图：y = A·cos(kx − ωt)，按给定 λ / 振幅绘制 2 个周期。
"use client";

import * as React from "react";
import type { DiagramProps } from "@/lib/explain/types";
import { num } from "../svgUtils";

export const WaveDiagram: React.FC<DiagramProps> = ({ spec, caption }) => {
  const lambda = num(spec, "lambda", 6);
  const amp = num(spec, "amplitude", 0.6);
  const W = 320;
  const H = 200;
  const mid = H / 2;
  const A = 60 * amp;
  const periods = 2;
  const k = (2 * Math.PI * periods) / W;
  const pts: string[] = [];
  for (let x = 0; x <= W; x += 2) {
    const y = mid - A * Math.sin(k * x);
    pts.push(`${x},${y.toFixed(1)}`);
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={caption ?? "波形图"}>
      <rect x={0} y={0} width={W} height={H} fill="#f8fafc" rx={8} />
      <line x1={0} y1={mid} x2={W} y2={mid} stroke="#cbd5e1" strokeWidth={1} strokeDasharray="3 3" />
      <polyline points={pts.join(" ")} fill="none" stroke="#2563eb" strokeWidth={2} />
      <text x={W / 2} y={H - 6} fontSize={10} fill="#94a3b8" textAnchor="middle">
        {caption ?? `行波 y = A·cos(kx − ωt)（λ=${lambda}）`}
      </text>
    </svg>
  );
};
