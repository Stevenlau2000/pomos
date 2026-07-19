// components/explain/animations/ProjectileAnim.tsx
// 抛体动画：静态虚线轨迹 + 沿轨迹移动的小球（progress 0→1）。
"use client";

import * as React from "react";
import type { AnimationProps } from "@/lib/explain/types";
import { num } from "../svgUtils";

export const ProjectileAnim: React.FC<AnimationProps> = ({ spec, progress }) => {
  const v0 = num(spec.params, "v0", 20);
  const theta = (num(spec.params, "theta", 45) * Math.PI) / 180;
  const g = num(spec.params, "g", 9.8);
  const W = 320;
  const H = 200;
  const ox = 30;
  const oy = H - 30;
  const T = (2 * v0 * Math.sin(theta)) / g || 1;
  const R = (v0 * v0 * Math.sin(2 * theta)) / g || 1;
  const Hmax = (v0 * v0 * Math.sin(theta) ** 2) / (2 * g) || 1;
  const sx = (W - ox - 20) / R;
  const sy = (oy - 20) / Hmax;
  const poly: string[] = [];
  for (let i = 0; i <= 40; i++) {
    const t = (T * i) / 40;
    const x = ox + v0 * Math.cos(theta) * t * sx;
    const y = oy - (v0 * Math.sin(theta) * t - 0.5 * g * t * t) * sy;
    poly.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  const t = progress * T;
  const cx = ox + v0 * Math.cos(theta) * t * sx;
  const cy = oy - (v0 * Math.sin(theta) * t - 0.5 * g * t * t) * sy;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="抛体动画">
      <rect x={0} y={0} width={W} height={H} fill="#f8fafc" rx={8} />
      <line x1={ox} y1={oy} x2={W - 10} y2={oy} stroke="#94a3b8" strokeWidth={1.5} />
      <polyline points={poly.join(" ")} fill="none" stroke="#93c5fd" strokeWidth={1.5} strokeDasharray="3 3" />
      <circle cx={cx} cy={cy} r={6} fill="#dc2626" />
      <text x={W / 2} y={H - 6} fontSize={10} fill="#94a3b8" textAnchor="middle">
        {spec.caption ?? "抛体运动（水平匀速 · 竖直匀加速）"}
      </text>
    </svg>
  );
};
