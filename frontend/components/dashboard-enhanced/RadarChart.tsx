"use client";

import React, { useEffect, useRef } from "react";

const dimensions = [
  "概念理解",
  "逻辑推理",
  "物理建模",
  "数学计算",
  "实验设计",
  "知识广度",
  "记忆与识别",
  "迁移能力",
  "创造性思维",
];

const studentData = [82, 75, 68, 90, 55, 72, 85, 60, 48];
const targetData = [90, 85, 80, 95, 75, 85, 90, 80, 70];

export default function RadarChart() {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<any>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !chartRef.current) return;

    const initChart = async () => {
      const echarts = await import("echarts");
      const chart = echarts.init(chartRef.current!);
      chartInstance.current = chart;

      const isDark = document.documentElement.getAttribute("data-theme") === "dark";

      const option = {
        backgroundColor: "transparent",
        tooltip: {
          trigger: "item",
          backgroundColor: isDark ? "rgba(15, 15, 25, 0.95)" : "rgba(255, 255, 255, 0.95)",
          borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)",
          textStyle: {
            color: isDark ? "#e2e8f0" : "#1e293b",
            fontFamily: '"Plus Jakarta Sans", "Noto Sans SC", sans-serif',
          },
        },
        legend: {
          data: ["当前水平", "目标水平"],
          bottom: 0,
          textStyle: {
            color: isDark ? "#94a3b8" : "#64748b",
            fontFamily: '"Plus Jakarta Sans", "Noto Sans SC", sans-serif',
            fontSize: 12,
          },
          itemWidth: 12,
          itemHeight: 12,
          itemGap: 24,
        },
        radar: {
          indicator: dimensions.map((name) => ({
            name,
            max: 100,
          })),
          shape: "polygon",
          radius: "65%",
          center: ["50%", "48%"],
          splitNumber: 5,
          axisName: {
            color: isDark ? "#94a3b8" : "#64748b",
            fontFamily: '"Plus Jakarta Sans", "Noto Sans SC", sans-serif',
            fontSize: 11,
            fontWeight: 500,
          },
          splitLine: {
            lineStyle: {
              color: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.06)",
            },
          },
          splitArea: {
            show: true,
            areaStyle: {
              color: [
                isDark ? "rgba(0, 240, 200, 0.02)" : "rgba(0, 240, 200, 0.03)",
                isDark ? "rgba(0, 240, 200, 0.04)" : "rgba(0, 240, 200, 0.05)",
              ].concat(Array(3).fill("transparent")),
            },
          },
          axisLine: {
            lineStyle: {
              color: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.06)",
            },
          },
        },
        series: [
          {
            name: "能力评估",
            type: "radar",
            data: [
              {
                value: studentData,
                name: "当前水平",
                symbol: "circle",
                symbolSize: 6,
                lineStyle: {
                  color: "#00F0C8",
                  width: 2,
                },
                areaStyle: {
                  color: {
                    type: "radial",
                    x: 0.5,
                    y: 0.5,
                    r: 0.5,
                    colorStops: [
                      { offset: 0, color: "rgba(0, 240, 200, 0.25)" },
                      { offset: 1, color: "rgba(0, 240, 200, 0.05)" },
                    ],
                  },
                },
                itemStyle: {
                  color: "#00F0C8",
                  borderColor: "#00F0C8",
                  borderWidth: 2,
                },
              },
              {
                value: targetData,
                name: "目标水平",
                symbol: "none",
                lineStyle: {
                  color: "#F0C800",
                  width: 2,
                  type: "dashed",
                },
                itemStyle: {
                  color: "#F0C800",
                },
              },
            ],
            animationDuration: 1200,
            animationEasing: "cubicOut",
          },
        ],
      };

      chart.setOption(option);

      const handleResize = () => chart.resize();
      window.addEventListener("resize", handleResize);

      // Listen for theme changes
      const observer = new MutationObserver(() => {
        const newIsDark = document.documentElement.getAttribute("data-theme") === "dark";
        chart.setOption({
          tooltip: {
            backgroundColor: newIsDark ? "rgba(15, 15, 25, 0.95)" : "rgba(255, 255, 255, 0.95)",
            borderColor: newIsDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)",
            textStyle: { color: newIsDark ? "#e2e8f0" : "#1e293b" },
          },
          legend: {
            textStyle: { color: newIsDark ? "#94a3b8" : "#64748b" },
          },
          radar: {
            axisName: { color: newIsDark ? "#94a3b8" : "#64748b" },
            splitLine: { lineStyle: { color: newIsDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.06)" } },
            splitArea: {
              areaStyle: {
                color: [
                  newIsDark ? "rgba(0, 240, 200, 0.02)" : "rgba(0, 240, 200, 0.03)",
                  newIsDark ? "rgba(0, 240, 200, 0.04)" : "rgba(0, 240, 200, 0.05)",
                ].concat(Array(3).fill("transparent")),
              },
            },
            axisLine: { lineStyle: { color: newIsDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.06)" } },
          },
        });
      });

      observer.observe(document.documentElement, { attributes: true });

      return () => {
        window.removeEventListener("resize", handleResize);
        observer.disconnect();
        chart.dispose();
      };
    };

    const cleanup = initChart();
    return () => {
      cleanup?.then?.((fn) => fn?.());
      if (chartInstance.current) {
        chartInstance.current.dispose();
      }
    };
  }, []);

  return (
    <div className="w-full h-full min-h-[380px]" ref={chartRef} />
  );
}
