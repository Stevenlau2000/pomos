// lib/explain/maps.ts
// 策略模式「数据层」：纯数据，零 React 依赖，可在 Node 中被单测直接 import。
//
// ⚠ 架构文档将 DIAGRAM_REGISTRY / ANIMATION_REGISTRY 列于本文件，
// 但为保持编排层（lib/explain/*）可被 Node 单测直接加载（设计原则 ③ 可测性：
// validateExplain / generateExplainOffline / detectChatIntent 均为纯函数），
// 此处仅放纯数据；组件注册表实际位于各自的渲染层组件
// （DiagramRenderer.tsx / AnimationPlayer.tsx），「新增只加注册项」的策略模式语义不变。
import type { DiagramSpec, AnimationSpec } from "./types";
import { EXPLAIN_PHASES } from "./types";

export { EXPLAIN_PHASES };

/** 讲解意图专用：非流式补全的 maxTokens（架构 §7 / Q8） */
export const EXPLAIN_MAX_TOKENS = 2000;

/** 离线讲解预置图 / 动画参数：按关键词命中后注入对应 step。仅承载纯数据。 */
/**
 * 离线讲解预置图 / 动画参数表。
 * 用显式 `as Array<[string, {...}]>` 强制每个表项在上下文中独立按
 * `DiagramSpec` / `AnimationSpec` 校验，避免 TS 将整个字面量推断为「公共类型」
 * 而把 `params` 中缺失字段补成 `undefined`，进而破坏 `Record<string, number|string>`。
 */
export const OFFLINE_EXPLAIN_TEMPLATES: Map<
  string,
  { diagram?: DiagramSpec; animation?: AnimationSpec }
> = new Map(
  ([
    [
      "抛体",
    {
      diagram: {
        kind: "trajectory",
        spec: { v0: 20, theta: 45, g: 9.8 },
        caption: "斜抛轨迹：水平匀速、竖直匀加速",
      },
      animation: {
        type: "projectile",
        params: { v0: 20, theta: 45, g: 9.8 },
        durationMs: 2500,
        caption: "抛体运动",
      },
    },
  ],
  [
    "projectile",
    {
      diagram: { kind: "trajectory", spec: { v0: 20, theta: 45, g: 9.8 } },
      animation: { type: "projectile", params: { v0: 20, theta: 45, g: 9.8 } },
    },
  ],
  [
    "受力",
    {
      diagram: {
        kind: "force",
        spec: {
          bodies: [
            {
              label: "物体",
              forces: [
                { type: "gravity", dir: [0, 1] },
                { type: "normal", dir: [0, -1] },
              ],
            },
          ],
        },
        caption: "受力分析",
      },
    },
  ],
  [
    "牛顿",
    {
      diagram: {
        kind: "force",
        spec: {
          bodies: [
            {
              label: "物体",
              forces: [
                { type: "gravity", dir: [0, 1] },
                { type: "applied", dir: [1, 0] },
              ],
            },
          ],
        },
      },
      animation: {
        type: "uniform-motion",
        params: { v: 6, a: 0, tTotal: 2 },
        caption: "匀速直线运动",
      },
    },
  ],
  [
    "匀速",
    {
      diagram: {
        kind: "vt",
        spec: { segments: [{ t0: 0, t1: 3, v: 5 }] },
        caption: "v-t 图（匀速，斜率为 0）",
      },
      animation: { type: "uniform-motion", params: { v: 5, a: 0, tTotal: 2 } },
    },
  ],
  [
    "匀加速",
    {
      diagram: {
        kind: "vt",
        spec: { segments: [{ t0: 0, t1: 3, v: 6 }] },
        caption: "v-t 图（匀加速，斜率 = 加速度）",
      },
      animation: { type: "uniform-motion", params: { v: 0, a: 3, tTotal: 2 } },
    },
  ],
  [
    "折射",
    {
      diagram: {
        kind: "light",
        spec: { type: "refraction", incidentAngle: 45, n1: 1, n2: 1.5 },
        caption: "折射光路（空气 → 玻璃）",
      },
      animation: {
        type: "refraction",
        params: { n1: 1, n2: 1.5, thetaI: 45 },
        durationMs: 2400,
        caption: "折射过程",
      },
    },
  ],
  [
    "反射",
    {
      diagram: {
        kind: "light",
        spec: { type: "reflection", incidentAngle: 45 },
        caption: "反射光路（入射角 = 反射角）",
      },
    },
  ],
  [
    "电场",
    {
      animation: {
        type: "charge-in-field",
        params: { eField: 1, q: 1, v0: 5, mass: 1 },
        durationMs: 2600,
        caption: "电荷在匀强电场中偏转",
      },
    },
  ],
  [
    "磁场",
    {
      animation: {
        type: "charge-in-field",
        params: { eField: 1, q: 1, v0: 5, mass: 1, axis: "magnetic" },
        durationMs: 2600,
        caption: "电荷在磁场中圆周运动",
      },
    },
  ],
  [
    "简谐",
    {
      animation: {
        type: "wave",
        params: { lambda: 6, f: 0.5, amplitude: 0.6 },
        durationMs: 2800,
        caption: "简谐振动（行波类比）",
      },
    },
  ],
  [
    "波动",
    {
      diagram: {
        kind: "wave",
        spec: { lambda: 6, f: 1, amplitude: 0.6 },
        caption: "行波 y = A·cos(kx − ωt)",
      },
      animation: {
        type: "wave",
        params: { lambda: 6, f: 1, amplitude: 0.6 },
        durationMs: 2800,
        caption: "波动传播",
      },
    },
  ],
  [
    "干涉",
    {
      diagram: { kind: "wave", spec: { lambda: 6, f: 1, amplitude: 0.6 } },
    },
  ],
  [
    "卡诺",
    {
      diagram: {
        kind: "pv",
        spec: {
          cycle: true,
          points: [
            { p: 4, v: 1, label: "a" },
            { p: 4, v: 3, label: "b" },
            { p: 1, v: 3, label: "c" },
            { p: 1, v: 1, label: "d" },
          ],
        },
        caption: "卡诺循环 p-V 图",
      },
    },
  ],
  [
    "pv",
    {
      diagram: {
        kind: "pv",
        spec: {
          cycle: true,
          points: [
            { p: 4, v: 1 },
            { p: 4, v: 3 },
            { p: 1, v: 3 },
            { p: 1, v: 1 },
          ],
        },
      },
    },
  ],
  [
    "电路",
    {
      diagram: {
        kind: "circuit",
        spec: {
          components: [
            { type: "battery", label: "E" },
            { type: "resistor", label: "R" },
            { type: "wire" },
            { type: "switch" },
          ],
        },
        caption: "简单闭合电路",
      },
    },
  ],
  [
    "动量",
    {
      diagram: {
        kind: "vt",
        spec: {
          segments: [
            { t0: 0, t1: 2, v: 4 },
            { t0: 2, t1: 4, v: 2 },
          ],
        },
        caption: "碰撞前后 v-t 图",
      },
    },
  ],
  [
    "角动量",
    {
      animation: {
        type: "charge-in-field",
        params: { eField: 0, q: 0, v0: 5, mass: 1, axis: "magnetic" },
        caption: "匀速圆周（角动量守恒）",
      },
    },
  ],
  ] as Array<[string, { diagram?: DiagramSpec; animation?: AnimationSpec }]>),
);

/** 取得某关键词命中的预置图 / 动画（大小写无关） */
export function lookupTemplate(
  keyword: string,
): { diagram?: DiagramSpec; animation?: AnimationSpec } | undefined {
  if (!keyword) return undefined;
  const k = keyword.toLowerCase();
  for (const key of OFFLINE_EXPLAIN_TEMPLATES.keys()) {
    if (key.toLowerCase() === k) return OFFLINE_EXPLAIN_TEMPLATES.get(key);
  }
  return undefined;
}
