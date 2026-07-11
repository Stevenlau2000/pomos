// components/dashboard/LearningCurve.tsx
// 学习曲线（ECharts line）：来自后端 growth_curve 的 PQ 随时间变化。
"use client";

import * as React from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import type { GrowthPoint } from "@/lib/api";

interface LearningCurveProps {
  data?: GrowthPoint[];
}

/** 兜底示例数据 */
const EXAMPLE: GrowthPoint[] = [
  { ts: "2026-01", pq: 40 },
  { ts: "2026-02", pq: 48 },
  { ts: "2026-03", pq: 53 },
  { ts: "2026-04", pq: 61 },
  { ts: "2026-05", pq: 70 },
  { ts: "2026-06", pq: 78 },
];

const LearningCurve: React.FC<LearningCurveProps> = ({ data }) => {
  const points = data && data.length > 0 ? data : EXAMPLE;
  const option: EChartsOption = {
    tooltip: { trigger: "axis" },
    grid: { left: 40, right: 20, top: 30, bottom: 30 },
    xAxis: { type: "category", data: points.map((p) => p.ts) },
    yAxis: { type: "value", min: 0, max: 100 },
    series: [
      {
        name: "PQ",
        type: "line",
        smooth: true,
        data: points.map((p) => p.pq),
        areaStyle: { opacity: 0.15 },
      },
    ],
  };
  return (
    <ReactECharts option={option} style={{ height: 320 }} notMerge />
  );
};

export default LearningCurve;
