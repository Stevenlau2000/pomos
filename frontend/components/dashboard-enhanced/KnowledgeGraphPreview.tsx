"use client";

import React from "react";
import { Network, CheckCircle2, Circle, AlertCircle } from "lucide-react";

interface KGNode {
  id: string;
  label: string;
  layer: number;
  status: "completed" | "in-progress" | "not-started";
  children?: number;
}

interface KGLayer {
  name: string;
  key: string;
  nodes: KGNode[];
}

const layers: KGLayer[] = [
  {
    name: "板块",
    key: "board",
    nodes: [
      { id: "b1", label: "力学", layer: 0, status: "completed", children: 24 },
      { id: "b2", label: "电磁学", layer: 0, status: "in-progress", children: 18 },
      { id: "b3", label: "热学", layer: 0, status: "completed", children: 12 },
      { id: "b4", label: "光学", layer: 0, status: "not-started", children: 10 },
      { id: "b5", label: "近代物理", layer: 0, status: "not-started", children: 14 },
    ],
  },
  {
    name: "主题",
    key: "theme",
    nodes: [
      { id: "t1", label: "运动学", layer: 1, status: "completed" },
      { id: "t2", label: "动力学", layer: 1, status: "completed" },
      { id: "t3", label: "静电场", layer: 1, status: "in-progress" },
      { id: "t4", label: "静磁场", layer: 1, status: "not-started" },
      { id: "t5", label: "电磁感应", layer: 1, status: "not-started" },
    ],
  },
  {
    name: "概念",
    key: "concept",
    nodes: [
      { id: "c1", label: "牛顿定律", layer: 2, status: "completed" },
      { id: "c2", label: "动量守恒", layer: 2, status: "completed" },
      { id: "c3", label: "高斯定理", layer: 2, status: "in-progress" },
      { id: "c4", label: "安培定律", layer: 2, status: "not-started" },
      { id: "c5", label: "法拉第定律", layer: 2, status: "not-started" },
    ],
  },
];

const statusConfig = {
  completed: {
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
  },
  "in-progress": {
    icon: <AlertCircle className="w-3.5 h-3.5" />,
    color: "text-cyan-500",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/20",
  },
  "not-started": {
    icon: <Circle className="w-3.5 h-3.5" />,
    color: "text-muted-foreground",
    bg: "bg-secondary/30",
    border: "border-border",
  },
};

export default function KnowledgeGraphPreview() {
  return (
    <div className="space-y-5">
      {/* Layer overview */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
          <Network className="w-4 h-4 text-cyan-500" />
        </div>
        <div>
          <h3 className="text-h3 font-display text-foreground">知识图谱</h3>
          <p className="text-caption text-muted-foreground">6 层结构：板块 → 主题 → 概念 → 模型 → 方法 → 易错点</p>
        </div>
      </div>

      {/* Progress overview */}
      <div className="grid grid-cols-6 gap-2">
        {["板块", "主题", "概念", "模型", "方法", "易错点"].map((name, i) => {
          const progress = [85, 72, 58, 45, 33, 20][i];
          return (
            <div key={name} className="text-center">
              <div className="relative w-full h-1.5 bg-border rounded-full overflow-hidden mb-1.5">
                <div
                  className="absolute top-0 left-0 h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${progress}%`,
                    background: i === 0 ? "#00F0C8" : i === 1 ? "#00D4F0" : i === 2 ? "#00B0F0" : i === 3 ? "#008CF0" : i === 4 ? "#0068F0" : "#0044F0",
                  }}
                />
              </div>
              <span className="text-caption text-muted-foreground">{name}</span>
              <div className="text-sm font-mono font-bold text-foreground">{progress}%</div>
            </div>
          );
        })}
      </div>

      {/* Layer detail cards */}
      <div className="space-y-3">
        {layers.map((layer) => (
          <div key={layer.key} className="rounded-lg border border-border bg-secondary/20 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {layer.name}
              </span>
              <span className="text-caption text-muted-foreground">
                {layer.nodes.filter((n) => n.status === "completed").length}/{layer.nodes.length} 完成
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {layer.nodes.map((node) => {
                const config = statusConfig[node.status];
                return (
                  <div
                    key={node.id}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-sm transition-all duration-200 hover:scale-105 cursor-pointer ${config.bg} ${config.border}`}
                  >
                    <span className={config.color}>{config.icon}</span>
                    <span className={`font-medium ${config.color}`}>{node.label}</span>
                    {node.children && (
                      <span className="text-caption text-muted-foreground ml-1">
                        {node.children}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* View full graph button */}
      <button className="w-full py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-all duration-200">
        查看完整知识图谱 →
      </button>
    </div>
  );
}
