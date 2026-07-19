// components/explain/animations/WaveAnim.tsx
// 波动动画：行波 y = A·cos(kx − ωt) 随 progress 平移（一个周期）。
"use client";

import * as React from "react";
import type { AnimationProps } from "@/lib/explain/types";
import { num } from "../svgUtils";

export const WaveAnim: React.FC<AnimationProps> = ({ spec, progress }) => {
  const lambda = num(spec.params, "lambda", 6);
  const f = num(spec.params, "f", 1);
  const amp = num(spec.params, "amplitude", 0.6);
  const W = 320;
  const H = 200;
  const mid = H / 2;
  const A = 60 * amp;
  const periods = 2;
  const k = (2 * Math.PI * periods) / W;
  const omega = 2 * Math.PI * f;
  const phase = progress * 2 * Math.PI;
  const pts: string[] = [];
  for (let x = 0; x <= W; x += 2) {
    const y = mid - A * Math.sin(k * x - omega * phase);
    pts.push(`${x},${y.toFixed(1)}`);
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="波动动画">
      <rect x={0} y={0} width={W} height={H} fill="#f8fafc" rx={8} />
      <line x1={0} y1={mid} x2={W} y2={mid} stroke="#cbd5e1" strokeWidth={1} strokeDasharray="3 3" />
      <polyline points={pts.join(" ")} fill="none" stroke="#2563eb" strokeWidth={2} />
      <text x={W / 2} y={H - 6} fontSize={10} fill="#94a3b8" textAnchor="middle">
        {spec.caption ?? `波动传播（λ=${lambda}）`}
      </text>
    </svg>
  );
};
