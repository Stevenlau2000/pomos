// components/dashboard/PqRadar.tsx
// PQ 能力雷达图（ECharts radar）：六维能力知识/建模/科学思维/迁移/竞赛/成长。
"use client";

import * as React from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import type { PqRadar as PqRadarData } from "@/lib/api";

interface PqRadarProps {
  data?: PqRadarData;
}

/** 兜底示例数据（后端无数据时展示） */
const EXAMPLE: PqRadarData = {
  knowledge: 62,
  modeling: 55,
  scientific_thinking: 70,
  transfer: 48,
  competition: 60,
  growth: 75,
};

const INDICATORS = [
  { name: "知识", key: "knowledge" },
  { name: "建模", key: "modeling" },
  { name: "科学思维", key: "scientific_thinking" },
  { name: "迁移", key: "transfer" },
  { name: "竞赛", key: "competition" },
  { name: "成长", key: "growth" },
] as const;

const PqRadar: React.FC<PqRadarProps> = ({ data }) => {
  // 全 0（新学生未初始化）时回退示例，避免雷达塌缩到圆心
  const allZero = data ? INDICATORS.every((it) => !(data[it.key] > 0)) : false;
  const d = data && !allZero ? data : EXAMPLE;
  const option: EChartsOption = {
    tooltip: {},
    radar: {
      indicator: INDICATORS.map((it) => ({ name: it.name, max: 100 })),
      radius: "65%",
    },
    series: [
      {
        type: "radar",
        data: [
          {
            value: INDICATORS.map((it) => d[it.key]),
            name: "PQ 能力",
            areaStyle: { opacity: 0.25 },
          },
        ],
      },
    ],
  };
  return (
    <ReactECharts option={option} style={{ height: 320 }} notMerge />
  );
};

export default PqRadar;
