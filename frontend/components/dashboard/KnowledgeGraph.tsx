// components/dashboard/KnowledgeGraph.tsx
// 知识图谱（ECharts graph）：五大板块分类，点击节点在外部面板展示详情。
"use client";

import * as React from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { KG_BOARDS, KG_NODES, KG_LINKS, type KGNode } from "@/lib/pomosData";

interface KnowledgeGraphProps {
  onSelect?: (node: KGNode) => void;
  /** 各板块掌握度（0~100），来自后端 twin 推导；提供后按真实掌握度着色 */
  boardMastery?: Record<string, number>;
}

const BOARD_COLORS: Record<string, string> = {
  力学: "#6366f1",
  电磁学: "#0ea5e9",
  热学: "#f59e0b",
  光学: "#10b981",
  近代物理: "#ef4444",
};

const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({ onSelect, boardMastery }) => {
  const data = KG_NODES.map((n) => {
    const mastery = boardMastery && boardMastery[n.board] != null
      ? Math.round(boardMastery[n.board])
      : n.mastery;
    return {
      id: n.id,
      name: n.name,
      category: KG_BOARDS.findIndex((b) => b === n.board),
      symbolSize: 18 + n.importance * 4,
      value: mastery,
      itemStyle: {
        opacity: 0.35 + (mastery / 100) * 0.6,
      },
    };
  });

  const option: EChartsOption = {
    tooltip: {
      formatter: (p: unknown) => {
        const param = p as { dataType?: string; data?: { name?: string; value?: number } };
        if (param.dataType === "edge") return "";
        return `${param.data?.name ?? ""} · 掌握度 ${param.data?.value ?? "?"}`;
      },
    },
    legend: { data: [...KG_BOARDS], top: 4, textStyle: { fontSize: 11 } },
    series: [
      {
        type: "graph",
        layout: "force",
        roam: true,
        label: { show: true, fontSize: 11 },
        draggable: true,
        categories: KG_BOARDS.map((b) => ({ name: b, itemStyle: { color: BOARD_COLORS[b] } })),
        force: { repulsion: 160, edgeLength: 90 },
        lineStyle: { color: "#cbd5e1", curveness: 0.08, width: 1.5 },
        data,
        links: KG_LINKS.map((l) => ({
          source: l.source,
          target: l.target,
          lineStyle: {
            color: l.relation === "transfer" ? "#f59e0b" : "#94a3b8",
            type: l.relation === "transfer" ? "dashed" : "solid",
          },
        })),
      },
    ],
  };

  const handleEvents = React.useMemo(
    () => ({
      click: (params: { dataType?: string; data?: { id?: string } }) => {
        if (params.dataType !== "node" || !params.data?.id) return;
        const node = KG_NODES.find((n) => n.id === params.data?.id);
        if (node && onSelect) onSelect(node);
      },
    }),
    [onSelect],
  );

  return (
    <ReactECharts
      option={option}
      style={{ height: 360 }}
      notMerge
      onEvents={handleEvents}
    />
  );
};

export default KnowledgeGraph;
