// components/explain/diagrams/VtDiagram.tsx
// v-t 图：按分段（t0→t1 内 v 恒定）绘制折线，斜率即加速度。
"use client";

import * as React from "react";
import type { DiagramProps } from "@/lib/explain/types";
import { arr } from "../svgUtils";

interface Seg {
  t0: number;
  t1: number;
  v: number;
}

export const VtDiagram: React.FC<DiagramProps> = ({ spec, caption }) => {
  const segs = arr<Seg>(spec, "segments");
  const W = 320;
  const H = 200;
  const ox = 36;
  const oy = H - 28;
  const tMax = segs.reduce((m, s) => Math.max(m, s.t1), 1) || 1;
  const vMax = Math.max(1, ...segs.map((s) => Math.abs(s.v)));
  const sx = (W - ox - 16) / tMax;
  const sy = (oy - 16) / vMax;
  const X = (t: number) => ox + t * sx;
  const Y = (v: number) => oy - v * sy;
  const poly: string[] = [];
  segs.forEach((s) => {
    poly.push(`${X(s.t0).toFixed(1)},${Y(s.v).toFixed(1)}`);
    poly.push(`${X(s.t1).toFixed(1)},${Y(s.v).toFixed(1)}`);
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={caption ?? "v-t 图"}>
      <rect x={0} y={0} width={W} height={H} fill="#f8fafc" rx={8} />
      <line x1={ox} y1={oy} x2={W - 10} y2={oy} stroke="#cbd5e1" strokeWidth={1} />
      <line x1={ox} y1={oy} x2={ox} y2={12} stroke="#cbd5e1" strokeWidth={1} />
      <text x={ox - 4} y={14} fontSize={9} fill="#94a3b8" textAnchor="end">
        v
      </text>
      <text x={W - 12} y={oy + 12} fontSize={9} fill="#94a3b8" textAnchor="end">
        t
      </text>
      {segs.length > 0 && (
        <polyline points={poly.join(" ")} fill="none" stroke="#2563eb" strokeWidth={2} />
      )}
      <text x={W / 2} y={H - 6} fontSize={10} fill="#94a3b8" textAnchor="middle">
        {caption ?? "v-t 图（斜率 = 加速度）"}
      </text>
    </svg>
  );
};
