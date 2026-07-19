// components/explain/animations/ChargeInFieldAnim.tsx
// 电荷在电场 / 磁场中运动：电场→类平抛抛物线；磁场→圆弧（axis="magnetic"）。
"use client";

import * as React from "react";
import type { AnimationProps } from "@/lib/explain/types";
import { num, str } from "../svgUtils";

export const ChargeInFieldAnim: React.FC<AnimationProps> = ({ spec, progress }) => {
  const v0 = num(spec.params, "v0", 5);
  const q = num(spec.params, "q", 1);
  const eField = num(spec.params, "eField", 1);
  const mass = num(spec.params, "mass", 1);
  const axis = str(spec.params, "axis", "electric");
  const W = 320;
  const H = 200;
  const x0 = 30;
  const y0 = 40;
  const magnetic = axis === "magnetic";
  const p = progress;
  let cx = x0;
  let cy = y0;
  if (magnetic) {
    const R = 70;
    const ang = p * Math.PI * 0.9; // 约 162°
    cx = x0 + R * (1 - Math.cos(ang));
    cy = y0 + R * Math.sin(ang);
  } else {
    cx = x0 + p * (W - x0 - 30);
    cy = y0 + ((q * eField) / mass) * 30 * p * p * 12;
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="电荷在场中运动">
      <rect x={0} y={0} width={W} height={H} fill="#f8fafc" rx={8} />
      <rect
        x={x0 - 6}
        y={y0 - 6}
        width={W - x0}
        height={H - y0}
        fill={magnetic ? "#fef2f2" : "#eff6ff"}
        stroke="#cbd5e1"
        strokeWidth={1}
        strokeDasharray="4 3"
      />
      <text x={x0 - 10} y={y0 + 4} fontSize={9} fill="#64748b" textAnchor="end">
        {magnetic ? "B" : "E"}
      </text>
      <circle
        cx={Math.max(x0 - 6, Math.min(W - 6, cx))}
        cy={Math.max(y0 - 6, Math.min(H - 6, cy))}
        r={6}
        fill="#dc2626"
      />
      <text x={W / 2} y={H - 6} fontSize={10} fill="#94a3b8" textAnchor="middle">
        {spec.caption ?? (magnetic ? "电荷在磁场中圆周运动" : "电荷在电场中偏转（类平抛）")}
      </text>
    </svg>
  );
};
