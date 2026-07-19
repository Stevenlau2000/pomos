// components/explain/diagrams/LightDiagram.tsx
// 光路图：界面 + 法线 + 入射光线；折射 / 反射由 type 决定（斯涅尔定律算折射角）。
"use client";

import * as React from "react";
import type { DiagramProps } from "@/lib/explain/types";
import { num, str, Arrow } from "../svgUtils";

export const LightDiagram: React.FC<DiagramProps> = ({ spec, caption }) => {
  const kind = str(spec, "type", "refraction");
  const iDeg = num(spec, "incidentAngle", 45);
  const n1 = num(spec, "n1", 1);
  const n2 = num(spec, "n2", 1.5);
  const W = 320;
  const H = 200;
  const px = W / 2;
  const py = H / 2;
  const iRad = (iDeg * Math.PI) / 180;
  const L = 70;
  const ix = px - Math.sin(iRad) * L;
  const iy = py - Math.cos(iRad) * L;
  const rays: React.ReactNode[] = [
    <Arrow key="in" x1={ix} y1={iy} x2={px} y2={py} color="#dc2626" label="入射" />,
  ];
  if (kind === "reflection") {
    const rx = px + Math.sin(iRad) * L;
    const ry = py - Math.cos(iRad) * L;
    rays.push(<Arrow key="re" x1={px} y1={py} x2={rx} y2={ry} color="#2563eb" label="反射" />);
  } else {
    const s = Math.sin(iRad);
    const rRad = Math.asin(Math.max(-1, Math.min(1, (n1 * s) / n2)));
    const rx = px + Math.sin(rRad) * L;
    const ry = py + Math.cos(rRad) * L;
    rays.push(<Arrow key="rf" x1={px} y1={py} x2={rx} y2={ry} color="#2563eb" label="折射" />);
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={caption ?? "光路图"}>
      <rect x={0} y={0} width={W} height={H} fill="#f8fafc" rx={8} />
      <rect x={0} y={0} width={W} height={py} fill="#eff6ff" />
      <line x1={0} y1={py} x2={W} y2={py} stroke="#475569" strokeWidth={1.5} />
      <line x1={px} y1={14} x2={px} y2={H - 14} stroke="#94a3b8" strokeWidth={1} strokeDasharray="4 3" />
      {rays}
      <text x={W / 2} y={H - 6} fontSize={10} fill="#94a3b8" textAnchor="middle">
        {caption ?? (kind === "reflection" ? "反射光路" : "折射光路")}
      </text>
    </svg>
  );
};
