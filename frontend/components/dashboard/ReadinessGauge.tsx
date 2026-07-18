// components/dashboard/ReadinessGauge.tsx
// 备赛就绪度仪表：省一 / 省队 / IPhO 三档概率。
"use client";

import * as React from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import type { Readiness } from "@/lib/api";

interface ReadinessGaugeProps {
  data?: Readiness;
}

const EXAMPLE: Readiness = {
  province_top: 0.86,
  province_team: 0.47,
  ipho: 0.12,
};

const ReadinessGauge: React.FC<ReadinessGaugeProps> = ({ data }) => {
  const d = data ?? EXAMPLE;
  const option: EChartsOption = {
    series: [
      {
        type: "gauge",
        startAngle: 210,
        endAngle: -30,
        min: 0,
        max: 100,
        radius: "92%",
        center: ["50%", "58%"],
        progress: { show: true, width: 12, roundCap: true },
        axisLine: {
          roundCap: true,
          lineStyle: {
            width: 12,
            color: [
              [d.ipho, "#ef4444"],
              [d.province_team, "#f59e0b"],
              [d.province_top, "#10b981"],
              [1, "#e5e7eb"],
            ],
          },
        },
        pointer: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        anchor: { show: false },
        title: { show: true, offsetCenter: [0, "30%"], fontSize: 11, color: "#999" },
        detail: {
          valueAnimation: true,
          offsetCenter: [0, "-5%"],
          fontSize: 26,
          fontWeight: "bold",
          formatter: "{value}",
          color: "#111",
        },
        data: [{ value: Math.round(d.province_top * 100), name: "省一概率 %" }],
      },
    ],
  };
  return <ReactECharts option={option} style={{ height: 220 }} notMerge />;
};

export default ReadinessGauge;
