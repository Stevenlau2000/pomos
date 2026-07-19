// components/explain/svgUtils.tsx
// 物理 SVG 图组件共用的小工具：数值/字符串参数读取 + 箭头绘制。
"use client";

import * as React from "react";

/** 从宽松 spec 读取数值参数（缺省 / 非有限数时回退 fallback）。 */
export function num(
  spec: Record<string, unknown>,
  key: string,
  fallback: number,
): number {
  const v = spec[key];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

/** 从宽松 spec 读取字符串参数。 */
export function str(
  spec: Record<string, unknown>,
  key: string,
  fallback = "",
): string {
  const v = spec[key];
  return typeof v === "string" ? v : fallback;
}

/** 从宽松 spec 读取对象数组参数（如 v-t 段、受力体列表）。 */
export function arr<T>(spec: Record<string, unknown>, key: string): T[] {
  const v = spec[key];
  return Array.isArray(v) ? (v as T[]) : [];
}

/** 矢量箭头（SVG <line> + 三角箭头），用于受力 / 光路 / 速度等。 */
export const Arrow: React.FC<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color?: string;
  label?: string;
  width?: number;
  dash?: boolean;
}> = ({ x1, y1, x2, y2, color = "#475569", label, width = 2, dash }) => {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const head = 8;
  const ax = x2 - head * Math.cos(angle - Math.PI / 6);
  const ay = y2 - head * Math.sin(angle - Math.PI / 6);
  const bx = x2 - head * Math.cos(angle + Math.PI / 6);
  const by = y2 - head * Math.sin(angle + Math.PI / 6);
  return (
    <g>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={width}
        strokeDasharray={dash ? "4 3" : undefined}
      />
      <polygon points={`${x2},${y2} ${ax},${ay} ${bx},${by}`} fill={color} />
      {label && (
        <text
          x={(x1 + x2) / 2 + 4}
          y={(y1 + y2) / 2 - 4}
          fontSize={10}
          fill={color}
        >
          {label}
        </text>
      )}
    </g>
  );
};
