// lib/explain/types.ts
// 讲解结构化契约 —— 云端 / 离线 / 讲义 三源同源。全部为可 JSON 序列化纯对象。
// 单一类型源：所有 explain 相关类型定义在此，组件 / 编排层 / 生成器统一从此 import。

/** 六阶段固定骨架（顺序以此渲染，模块可空但顺序固定） */
export const EXPLAIN_PHASES = [
  "问题拆解",
  "概念辨析",
  "数理推导",
  "图像分析",
  "结论",
  "易错点",
] as const;

export type ExplainPhase = (typeof EXPLAIN_PHASES)[number];

/** 图表类型：物理专有图走手写 SVG，mermaid 走通用渲染 */
export type DiagramKind =
  | "force" // 受力分析
  | "trajectory" // 抛体 / 运动轨迹
  | "vt" // v-t 图
  | "circuit" // 电路简图
  | "light" // 折射 / 反射光路
  | "pv" // p-V 图
  | "wave" // 波动
  | "mermaid"; // 通用图（复用既有 Mermaid）

/** 动画类型（首版覆盖 5 种） */
export type AnimationType =
  | "projectile" // 抛体
  | "uniform-motion" // 匀速 / 匀加速
  | "wave" // 波动
  | "charge-in-field" // 电荷在电场 / 磁场中偏转
  | "refraction"; // 折射

/** 图表描述：spec 由 diagram.kind 决定具体形状（见各 SVG 组件 props） */
export interface DiagramSpec {
  kind: DiagramKind;
  /** 各 kind 的具体参数对象（discriminated by kind），宽松承载，前端按 kind 解析 */
  spec: Record<string, unknown>;
  caption?: string;
}

/** 动画 DSL：type 白名单 + params（数值 / 字符串），前端校验后驱动 RAF 渲染 */
export interface AnimationSpec {
  type: AnimationType;
  // 各类型 param 异构且部分可选；离线模板字面量在联合推断时会产生 `?: undefined` 标记，
  // 故索引签名需容纳 undefined，避免与 DiagramSpec/AnimationSpec 契约冲突。
  params: Record<string, string | number | undefined>;
  /** 一个周期时长（ms），默认按物理时长映射 */
  durationMs?: number;
  caption?: string;
}

/** 单个讲解步骤（可寻址 id 供 P2-3 追问「这一步为什么」） */
export interface ExplainStep {
  id: string; // 如 "s1" ~ "s6"
  phase: ExplainPhase;
  heading: string; // 步骤小标题
  text: string; // 展开式讲解（含 reasoning）
  formulas?: string[]; // KaTeX：$$...$$ / $...$
  diagram?: DiagramSpec | null;
  animation?: AnimationSpec | null;
  misconception?: string | null; // 易错点（高亮）
  sourceRefs?: string[]; // 教材引用标签
}

/** 顶层讲解结构（前端渲染契约） */
export interface PomosExplainV1 {
  schema_version: "1.0";
  title: string;
  mode: "cloud" | "offline" | "lecture";
  steps: ExplainStep[];
  sources?: string[];
  offline_fallback?: boolean; // 云端失败回退离线时为 true
}

/** 图组件统一 props（DIAGRAM_REGISTRY 策略表使用） */
export interface DiagramProps {
  spec: Record<string, unknown>;
  caption?: string;
}

/** 动画渲染器统一 props（ANIMATION_REGISTRY 策略表使用） */
export interface AnimationProps {
  spec: AnimationSpec;
  /** 0..1 归一化进度（RAF 驱动） */
  progress: number;
}

/** UI 层 ChatMessage 扩展（与 api.ts 存储类型分离，见 §6） */
export interface ChatMessageExplain {
  role: "user" | "mentor";
  content: string;
  explain?: PomosExplainV1; // 优先渲染；缺省走 markdown
}
