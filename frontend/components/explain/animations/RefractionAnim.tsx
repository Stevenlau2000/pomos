// components/explain/animations/RefractionAnim.tsx
// 折射动画：光子沿「入射 → 界面点 → 折射」路径移动（progress 前/后段）。
"use client";

import * as React from "react";
import type { AnimationProps } from "@/lib/explain/types";
import { num } from "../svgUtils";

export const RefractionAnim: React.FC<AnimationProps> = ({ spec, progress }) => {
  const n1 = num(spec.params, "n1", 1);
  const n2 = num(spec.params, "n2", 1.5);
  const thetaI = num(spec.params, "thetaI", 45);
  const W = 320;
  const H = 200;
  const px = W / 2;
  const py = H / 2;
  const iRad = (thetaI * Math.PI) / 180;
  const L = 70;
  const ix = px - Math.sin(iRad) * L;
  const iy = py - Math.cos(iRad) * L;
  const s = Math.sin(iRad);
  const rRad = Math.asin(Math.max(-1, Math.min(1, (n1 * s) / n2)));
  const rx = px + Math.sin(rRad) * L;
  const ry = py + Math.cos(rRad) * L;
  let cx = ix;
  let cy = iy;
  if (progress < 0.5) {
    const u = progress / 0.5;
    cx = ix + (px - ix) * u;
    cy = iy + (py - iy) * u;
  } else {
    const u = (progress - 0.5) / 0.5;
    cx = px + (rx - px) * u;
    cy = py + (ry - py) * u;
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="折射动画">
      <rect x={0} y={0} width={W} height={py} fill="#eff6ff" />
      <rect x={0} y={py} width={W} height={H - py} fill="#faf5ff" />
      <line x1={0} y1={py} x2={W} y2={py} stroke="#475569" strokeWidth={1.5} />
      <line x1={px} y1={14} x2={px} y2={H - 14} stroke="#94a3b8" strokeWidth={1} strokeDasharray="4 3" />
      <line x1={ix} y1={iy} x2={px} y2={py} stroke="#dc2626" strokeWidth={2} />
      <line x1={px} y1={py} x2={rx} y2={ry} stroke="#2563eb" strokeWidth={2} />
      <circle cx={cx} cy={cy} r={5} fill="#f59e0b" />
      <text x={W / 2} y={H - 6} fontSize={10} fill="#94a3b8" textAnchor="middle">
        {spec.caption ?? `折射（n₁=${n1} → n₂=${n2}）`}
      </text>
    </svg>
  );
};
