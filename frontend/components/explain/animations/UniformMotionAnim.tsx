// components/explain/animations/UniformMotionAnim.tsx
// 匀速 / 匀加速动画：沿轨道移动的小球（a=0 匀速，a>0 加速）。
"use client";

import * as React from "react";
import type { AnimationProps } from "@/lib/explain/types";
import { num } from "../svgUtils";

export const UniformMotionAnim: React.FC<AnimationProps> = ({ spec, progress }) => {
  const v = num(spec.params, "v", 5);
  const a = num(spec.params, "a", 0);
  const tTotal = num(spec.params, "tTotal", 2);
  const W = 320;
  const H = 200;
  const x0 = 30;
  const x1 = W - 30;
  const y = H / 2;
  const denom = v * tTotal + 0.5 * a * tTotal * tTotal || 1;
  const x = x0 + ((x1 - x0) * (v * (progress * tTotal) + 0.5 * a * (progress * tTotal) ** 2)) / denom;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="匀速或匀加速动画">
      <rect x={0} y={0} width={W} height={H} fill="#f8fafc" rx={8} />
      <line x1={x0} y1={y} x2={x1} y2={y} stroke="#94a3b8" strokeWidth={1.5} />
      <circle cx={Math.max(x0, Math.min(x1, x))} cy={y} r={7} fill="#2563eb" />
      <text x={W / 2} y={H - 6} fontSize={10} fill="#94a3b8" textAnchor="middle">
        {spec.caption ?? (a === 0 ? "匀速直线运动" : "匀加速直线运动")}
      </text>
    </svg>
  );
};
