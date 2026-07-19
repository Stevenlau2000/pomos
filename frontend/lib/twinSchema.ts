// lib/twinSchema.ts
// 版本化九维数字孪生维度注册表：9 认知维度（v1）+ 5 新学科维度（v2）。
// 提供 mergeBaseline(twin)：向后兼容地补齐历史 9 维数据缺失的新学科基线（值取 0.5，不重置、不破坏历史）。
// 这是「维度」单源定义，所有渲染（TwinView/TwinRadar）与生成（offlineGen/lecture）统一引用。

export type TwinGroup = "cognitive" | "subject";

/** 扩展后的孪生维度（含可选 group/since，用于区分 v1 认知维与 v2 学科维）。 */
export interface TwinDimension {
  key: string;
  label: string;
  value: number; // 0-1
  hint: string;
  group?: TwinGroup;
  since?: string; // "v1"=认知九维 / "v2"=新学科维度
}

/** 14 维注册表（9 认知 + 5 学科）。顺序即为雷达/卡片默认展示顺序。
 *  此为「维度模板」：不含 value，value 由 seedTwin / mergeBaseline 在运行时补入。 */
export const TWIN_SCHEMA: Array<Omit<TwinDimension, "value">> = [
  // ---------- 9 认知维度（v1） ----------
  { key: "concept", label: "知识掌握", hint: "对物理概念与本质的掌握程度", group: "cognitive", since: "v1" },
  { key: "modeling", label: "物理建模", hint: "将现实情境抽象为物理模型的能力", group: "cognitive", since: "v1" },
  { key: "reasoning", label: "推理能力", hint: "因果演绎与逻辑链完整性", group: "cognitive", since: "v1" },
  { key: "calculation", label: "数学准备", hint: "微积分/矢量/级数等数学工具熟练度", group: "cognitive", since: "v1" },
  { key: "experiment", label: "实验探究", hint: "实验设计与误差分析能力", group: "cognitive", since: "v1" },
  { key: "transfer", label: "迁移能力", hint: "跨板块综合题（力电磁耦合）偏弱", group: "cognitive", since: "v1" },
  { key: "meta", label: "元认知", hint: "能自我监控解题卡点", group: "cognitive", since: "v1" },
  { key: "competition", label: "竞赛就绪", hint: "竞赛策略与压轴题经验", group: "cognitive", since: "v1" },
  { key: "growth", label: "成长态势", hint: "持续训练与提升趋势", group: "cognitive", since: "v1" },
  // ---------- 5 新学科维度（v2） ----------
  { key: "subject_math", label: "高等数学", hint: "极限/级数/微分方程等高等数学基础", group: "subject", since: "v2" },
  { key: "subject_vector", label: "矢量分析", hint: "梯度/散度/旋度与场论计算", group: "subject", since: "v2" },
  { key: "subject_linalg", label: "线性代数", hint: "矩阵/行列式/线性空间与变换", group: "subject", since: "v2" },
  { key: "subject_theomech", label: "理论力学", hint: "分析力学/拉格朗日量与哈密顿量", group: "subject", since: "v2" },
  { key: "subject_electro", label: "电动力学", hint: "麦克斯韦方程组与电磁场理论", group: "subject", since: "v2" },
];

// 新学生基线中心值（历史 9 维沿用相近区间，新学科从 0.4~0.5 起步）。
const COG_BASE: Record<string, number> = {
  concept: 0.55,
  modeling: 0.5,
  reasoning: 0.55,
  calculation: 0.6,
  experiment: 0.5,
  transfer: 0.4,
  meta: 0.5,
  competition: 0.35,
  growth: 0.5,
};
const SUBJ_BASE: Record<string, number> = {
  subject_math: 0.5,
  subject_vector: 0.45,
  subject_linalg: 0.5,
  subject_theomech: 0.4,
  subject_electro: 0.4,
};

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function makeRng(seed: number): () => number {
  let s = seed || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
function clamp(v: number, lo = 0, hi = 1): number {
  return Math.max(lo, Math.min(hi, v));
}

/** 新建学生的 14 维基线：由 name+id 派生稳定随机，处于起步阶段、非全 0、非噪声。 */
export function seedTwin(id: string, name: string): TwinDimension[] {
  const rng = makeRng(hashStr(`${name || id}`));
  return TWIN_SCHEMA.map((d) => {
    const base = d.group === "subject" ? SUBJ_BASE[d.key] ?? 0.5 : COG_BASE[d.key] ?? 0.5;
    return { ...d, value: Number(clamp(base + (rng() - 0.5) * 0.12, 0.2, 0.92).toFixed(3)) };
  });
}

/** 向后兼容合并：补齐历史 9 维 twin 缺失的新学科维度（值取 0.5），不重置、不破坏既有数据。 */
export function mergeBaseline(twin: TwinDimension[]): TwinDimension[] {
  const have = new Set(twin.map((d) => d.key));
  const out: TwinDimension[] = twin.map((d) => ({ ...d }));
  for (const d of TWIN_SCHEMA) {
    if (!have.has(d.key)) {
      out.push({ ...d, value: 0.5 });
    }
  }
  return out;
}
