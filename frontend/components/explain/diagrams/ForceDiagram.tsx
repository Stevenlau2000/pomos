// components/explain/diagrams/ForceDiagram.tsx
// 受力分析图：展示每个隔离体及其受力（重力 / 支持力 / 外力 / 摩擦 / 张力）。
"use client";

import * as React from "react";
import type { DiagramProps } from "@/lib/explain/types";
import { arr, Arrow } from "../svgUtils";

interface ForceDef {
  type: string;
  dir: [number, number];
}
interface BodyDef {
  label: string;
  forces: ForceDef[];
}

const FORCE_COLOR: Record<string, string> = {
  gravity: "#ef4444",
  normal: "#3b82f6",
  applied: "#8b5cf6",
  friction: "#f59e0b",
  tension: "#10b981",
};
const FORCE_LABEL: Record<string, string> = {
  gravity: "G",
  normal: "N",
  applied: "F",
  friction: "f",
  tension: "T",
};

export const ForceDiagram: React.FC<DiagramProps> = ({ spec, caption }) => {
  const bodies = arr<BodyDef>(spec, "bodies");
  const W = 320;
  const H = 200;
  const cx = W / 2;
  const cy = H / 2;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={caption ?? "受力分析"}>
      <rect x={0} y={0} width={W} height={H} fill="#f8fafc" rx={8} />
      {bodies.length === 0 && (
        <text x={cx} y={cy} fontSize={12} fill="#94a3b8" textAnchor="middle">
          （无受力体）
        </text>
      )}
      {bodies.map((b, bi) => {
        const bx =
          cx + (bodies.length > 1 ? (bi - (bodies.length - 1) / 2) * 120 : 0);
        return (
          <g key={bi}>
            <circle cx={bx} cy={cy} r={22} fill="#e2e8f0" stroke="#64748b" strokeWidth={1.5} />
            <text x={bx} y={cy + 4} fontSize={10} fill="#334155" textAnchor="middle">
              {b.label}
            </text>
            {b.forces.map((f, fi) => {
              const [dx, dy] = f.dir;
              const len = Math.hypot(dx, dy) || 1;
              const ux = dx / len;
              const uy = dy / len;
              const L = 46;
              const color = FORCE_COLOR[f.type] ?? "#475569";
              const label = f.type;
              return (
                <Arrow
                  key={fi}
                  x1={bx}
                  y1={cy}
                  x2={bx + ux * L}
                  y2={cy + uy * L}
                  color={color}
                  label={FORCE_LABEL[f.type] ?? label}
                />
              );
            })}
          </g>
        );
      })}
      <text x={W / 2} y={H - 8} fontSize={10} fill="#94a3b8" textAnchor="middle">
        {caption ?? "受力分析"}
      </text>
    </svg>
  );
};
