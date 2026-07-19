// components/explain/DiagramRenderer.tsx
// 图表渲染器（策略模式）：diagram.kind → 注册表对应 SVG 组件（懒加载）。
// 纯物理图走手写 SVG；kind="mermaid" 复用 MermaidView 通用渲染。
"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import type { DiagramKind, DiagramProps, DiagramSpec } from "@/lib/explain/types";
import MermaidView from "./MermaidView";

const ForceDiagram = dynamic(() => import("./diagrams/ForceDiagram").then((m) => m.ForceDiagram), {
  ssr: false,
});
const TrajectoryDiagram = dynamic(
  () => import("./diagrams/TrajectoryDiagram").then((m) => m.TrajectoryDiagram),
  { ssr: false },
);
const VtDiagram = dynamic(() => import("./diagrams/VtDiagram").then((m) => m.VtDiagram), {
  ssr: false,
});
const CircuitDiagram = dynamic(
  () => import("./diagrams/CircuitDiagram").then((m) => m.CircuitDiagram),
  { ssr: false },
);
const LightDiagram = dynamic(
  () => import("./diagrams/LightDiagram").then((m) => m.LightDiagram),
  { ssr: false },
);
const PvDiagram = dynamic(() => import("./diagrams/PvDiagram").then((m) => m.PvDiagram), {
  ssr: false,
});
const WaveDiagram = dynamic(
  () => import("./diagrams/WaveDiagram").then((m) => m.WaveDiagram),
  { ssr: false },
);

const REGISTRY: Partial<Record<DiagramKind, React.ComponentType<DiagramProps>>> = {
  force: ForceDiagram,
  trajectory: TrajectoryDiagram,
  vt: VtDiagram,
  circuit: CircuitDiagram,
  light: LightDiagram,
  pv: PvDiagram,
  wave: WaveDiagram,
};

export const DiagramRenderer: React.FC<{ spec: DiagramSpec }> = ({ spec }) => {
  // mermaid 走通用渲染器（懒加载 mermaid 库）
  if (spec.kind === "mermaid") {
    const code = String(((spec.spec as Record<string, unknown>)?.code ?? ""));
    return (
      <div className="my-3 rounded-md border border-border bg-card p-3">
        <MermaidView code={code} />
      </div>
    );
  }
  const Cmp = REGISTRY[spec.kind];
  if (!Cmp) {
    return (
      <div className="my-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
        未知图表类型：{spec.kind}
      </div>
    );
  }
  return (
    <div className="my-3 rounded-md border border-border bg-card p-3">
      <Cmp spec={spec.spec} caption={spec.caption} />
      {spec.caption && (
        <p className="mt-1 text-center text-[11px] text-muted-foreground">{spec.caption}</p>
      )}
    </div>
  );
};
