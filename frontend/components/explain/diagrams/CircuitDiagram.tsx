// components/explain/diagrams/CircuitDiagram.tsx
// 简单闭合电路：电源（左）+ 电阻（上）+ 开关（右）+ 电流方向（顺时针）。
"use client";

import * as React from "react";
import type { DiagramProps } from "@/lib/explain/types";
import { arr, str } from "../svgUtils";

interface Comp {
  type: string;
  label?: string;
}

export const CircuitDiagram: React.FC<DiagramProps> = ({ spec, caption }) => {
  const comps = arr<Comp>(spec, "components");
  const W = 320;
  const H = 200;
  const x0 = 60;
  const y0 = 50;
  const x1 = 260;
  const y1 = 150;
  const midY = (y0 + y1) / 2;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={caption ?? "电路简图"}>
      <rect x={0} y={0} width={W} height={H} fill="#f8fafc" rx={8} />
      <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill="none" stroke="#334155" strokeWidth={2} />
      {/* 电源（左） */}
      <line x1={x0} y1={y0 + 18} x2={x0} y2={y0 + 32} stroke="#334155" strokeWidth={3} />
      <line x1={x0} y1={y0 + 22} x2={x0} y2={y0 + 28} stroke="#334155" strokeWidth={4} />
      <text x={x0 - 6} y={midY} fontSize={9} fill="#334155" textAnchor="end">
        电源
      </text>
      {/* 电阻（上） */}
      <rect x={(x0 + x1) / 2 - 14} y={y0 - 6} width={28} height={12} fill="#fff" stroke="#334155" strokeWidth={2} />
      <text x={(x0 + x1) / 2} y={y0 - 10} fontSize={9} fill="#334155" textAnchor="middle">
        R
      </text>
      {/* 开关（右） */}
      <line x1={x1} y1={midY - 12} x2={x1} y2={midY} stroke="#334155" strokeWidth={2} />
      <line
        x1={x1}
        y1={midY}
        x2={x1}
        y2={midY + 12}
        stroke="#334155"
        strokeWidth={2}
        transform={`rotate(-35 ${x1} ${midY})`}
      />
      <text x={x1 + 6} y={midY} fontSize={9} fill="#334155">
        开关
      </text>
      <text x={(x0 + x1) / 2} y={y1 + 16} fontSize={9} fill="#2563eb" textAnchor="middle">
        I（顺时针）
      </text>
      {comps.length > 0 && (
        <text x={W / 2} y={H - 6} fontSize={10} fill="#94a3b8" textAnchor="middle">
          {caption ?? comps.map((c) => c.label ?? c.type).join(" · ")}
        </text>
      )}
      {comps.length === 0 && (
        <text x={W / 2} y={H - 6} fontSize={10} fill="#94a3b8" textAnchor="middle">
          {caption ?? "简单闭合电路"}
        </text>
      )}
    </svg>
  );
};
