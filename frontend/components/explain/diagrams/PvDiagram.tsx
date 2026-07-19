// components/explain/diagrams/PvDiagram.tsx
// p-V 图：按点绘制，cycle=true 时闭合（面积 = 一个周期净功）。
"use client";

import * as React from "react";
import type { DiagramProps } from "@/lib/explain/types";
import { arr } from "../svgUtils";

interface PPoint {
  p: number;
  v: number;
  label?: string;
}

export const PvDiagram: React.FC<DiagramProps> = ({ spec, caption }) => {
  const pts = arr<PPoint>(spec, "points");
  const cycle = spec.cycle === true || spec.cycle === "true";
  const W = 320;
  const H = 200;
  const ox = 44;
  const oy = H - 28;
  const pMax = Math.max(1, ...pts.map((p) => p.p));
  const vMax = Math.max(1, ...pts.map((p) => p.v));
  const sx = (W - ox - 16) / vMax;
  const sy = (oy - 16) / pMax;
  const X = (v: number) => ox + v * sx;
  const Y = (p: number) => oy - p * sy;
  const polyPts = pts.map((p) => `${X(p.v).toFixed(1)},${Y(p.p).toFixed(1)}`).join(" ");
  const loop =
    cycle && pts.length > 1
      ? `${polyPts} ${X(pts[0].v).toFixed(1)},${Y(pts[0].p).toFixed(1)}`
      : polyPts;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={caption ?? "p-V 图"}>
      <rect x={0} y={0} width={W} height={H} fill="#f8fafc" rx={8} />
      <line x1={ox} y1={oy} x2={W - 10} y2={oy} stroke="#cbd5e1" strokeWidth={1} />
      <line x1={ox} y1={oy} x2={ox} y2={12} stroke="#cbd5e1" strokeWidth={1} />
      <text x={ox - 4} y={14} fontSize={9} fill="#94a3b8" textAnchor="end">
        p
      </text>
      <text x={W - 12} y={oy + 12} fontSize={9} fill="#94a3b8" textAnchor="end">
        V
      </text>
      {pts.length > 0 && <polyline points={loop} fill="none" stroke="#2563eb" strokeWidth={2} />}
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={X(p.v)} cy={Y(p.p)} r={3} fill="#1d4ed8" />
          {p.label && (
            <text x={X(p.v) + 4} y={Y(p.p) - 4} fontSize={9} fill="#334155">
              {p.label}
            </text>
          )}
        </g>
      ))}
      <text x={W / 2} y={H - 6} fontSize={10} fill="#94a3b8" textAnchor="middle">
        {caption ?? (cycle ? "循环过程 p-V 图（面积 = 净功）" : "p-V 图")}
      </text>
    </svg>
  );
};
