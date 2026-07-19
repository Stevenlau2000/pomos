// components/dashboard/TwinRadar.tsx
// 数字孪生雷达图（ECharts radar）：轴数量由传入孪生维度动态决定（默认 14 维 =
// 9 认知 + 5 学科）。value 约定为 0-100（调用方负责归一化）。
// 与 OverviewView 的 PqRadar（固定六维）解耦，独立渲染全维度画像。
"use client";

import * as React from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";

export interface RadarDim {
  key: string;
  label: string;
  value: number; // 0-100
}

interface TwinRadarProps {
  twin: RadarDim[];
  height?: number;
}

/** 兜底示例（无任何孪生数据时展示，避免雷达塌缩到圆心）。 */
const EXAMPLE: RadarDim[] = [
  { key: "concept", label: "知识掌握", value: 55 },
  { key: "modeling", label: "物理建模", value: 50 },
  { key: "reasoning", label: "推理能力", value: 55 },
  { key: "calculation", label: "数学准备", value: 60 },
  { key: "experiment", label: "实验探究", value: 50 },
  { key: "transfer", label: "迁移能力", value: 40 },
  { key: "meta", label: "元认知", value: 50 },
  { key: "competition", label: "竞赛就绪", value: 35 },
  { key: "growth", label: "成长态势", value: 50 },
  { key: "subject_math", label: "高等数学", value: 50 },
  { key: "subject_vector", label: "矢量分析", value: 45 },
  { key: "subject_linalg", label: "线性代数", value: 50 },
  { key: "subject_theomech", label: "理论力学", value: 40 },
  { key: "subject_electro", label: "电动力学", value: 40 },
];

function colorFor(v: number): string {
  if (v >= 75) return "#10b981";
  if (v >= 60) return "#f59e0b";
  return "#ef4444";
}

const TwinRadar: React.FC<TwinRadarProps> = ({ twin, height = 360 }) => {
  // 全 0（全新学生未初始化）时回退示例，避免雷达塌缩到圆心
  const allZero = twin.length > 0 && twin.every((d) => !(d.value > 0));
  const dims = twin && twin.length > 0 && !allZero ? twin : EXAMPLE;

  // 维度过多时调小字号与半径，保证可读
  const many = dims.length > 10;
  const option: EChartsOption = {
    tooltip: {},
    radar: {
      indicator: dims.map((d) => ({ name: d.label, max: 100 })),
      radius: many ? "58%" : "66%",
      axisName: {
        color: "#64748b",
        fontSize: many ? 9 : 11,
      },
      splitArea: { areaStyle: { color: ["#f8fafc", "#ffffff"] } },
    },
    series: [
      {
        type: "radar",
        data: [
          {
            value: dims.map((d) => d.value),
            name: "学生数字孪生",
            areaStyle: { opacity: 0.25, color: "#6366f1" },
            lineStyle: { color: "#6366f1" },
            itemStyle: { color: "#6366f1" },
          },
        ],
      },
    ],
  };

  // 维度>10 时额外渲染彩色分值标注（雷达轴外不易读，列表补充）
  const legendExtras = many ? (
    <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
      {dims.map((d) => (
        <span
          key={d.key}
          className="rounded-full px-2 py-0.5"
          style={{ backgroundColor: `${colorFor(d.value)}22`, color: colorFor(d.value) }}
        >
          {d.label} {Math.round(d.value)}
        </span>
      ))}
    </div>
  ) : null;

  return (
    <div>
      <ReactECharts option={option} style={{ height }} notMerge />
      {legendExtras}
    </div>
  );
};

export default TwinRadar;
