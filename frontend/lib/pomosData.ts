// lib/pomosData.ts
// POMOS 工作台示例数据层：在后端未接入（Mock 模式）时驱动各功能视图展示。
// 真实部署后，可由 /api/students/{id}/twin、/api/knowledge-graph 等端点替换。

// ---------- 学生数字孪生：九维 ----------
export interface TwinDimension {
  key: string;
  label: string;
  value: number; // 0-100
  hint: string;
}

export const NINE_DIMS: TwinDimension[] = [
  { key: "knowledgeMastery", label: "知识掌握", value: 72, hint: "已覆盖竞赛大纲 72% 核心考点" },
  { key: "physicsModelMastery", label: "物理建模", value: 64, hint: "能独立完成中等难度建模，复杂耦合偏弱" },
  { key: "mathematicalReadiness", label: "数学准备", value: 81, hint: "微积分/矢量/级数工具熟练" },
  { key: "reasoningAbility", label: "推理能力", value: 70, hint: "演绎链完整，归纳易跳步" },
  { key: "learningBehavior", label: "学习行为", value: 85, hint: "日均有效训练 2.1h，错题复盘率 90%" },
  { key: "motivationState", label: "动机状态", value: 78, hint: "目标清晰（冲击省队），近一周略有波动" },
  { key: "olympiadReadiness", label: "竞赛就绪", value: 58, hint: "省一水平，省队临界" },
  { key: "metacognition", label: "元认知", value: 66, hint: "能自我监控解题卡点" },
  { key: "transferAbility", label: "迁移能力", value: 55, hint: "跨板块综合题（力电磁耦合）偏弱" },
];

// ---------- 知识图谱（六层：板块/主题/概念/模型/方法/误区）----------
export interface KGNode {
  id: string;
  name: string;
  board: string; // 五大板块
  mastery: number; // 0-100
  difficulty: number; // 1-5
  importance: number; // 1-5
}

export interface KGLink {
  source: string;
  target: string;
  relation: "prerequisite" | "transfer";
}

export const KG_BOARDS = ["力学", "电磁学", "热学", "光学", "近代物理"];

export const KG_NODES: KGNode[] = [
  { id: "mech", name: "力学", board: "力学", mastery: 76, difficulty: 3, importance: 5 },
  { id: "kinematics", name: "运动学", board: "力学", mastery: 82, difficulty: 2, importance: 4 },
  { id: "newton", name: "牛顿定律", board: "力学", mastery: 74, difficulty: 3, importance: 5 },
  { id: "energy", name: "能量守恒", board: "力学", mastery: 70, difficulty: 3, importance: 5 },
  { id: "rotation", name: "刚体转动", board: "力学", mastery: 55, difficulty: 4, importance: 5 },
  { id: "oscillation", name: "振动与波", board: "力学", mastery: 60, difficulty: 3, importance: 4 },
  { id: "em", name: "电磁学", board: "电磁学", mastery: 64, difficulty: 4, importance: 5 },
  { id: "electrostatic", name: "静电场", board: "电磁学", mastery: 68, difficulty: 3, importance: 4 },
  { id: "circuit", name: "恒定电流", board: "电磁学", mastery: 72, difficulty: 2, importance: 4 },
  { id: "magnetic", name: "磁场", board: "电磁学", mastery: 58, difficulty: 4, importance: 5 },
  { id: "em_induction", name: "电磁感应", board: "电磁学", mastery: 52, difficulty: 5, importance: 5 },
  { id: "thermo", name: "热学", board: "热学", mastery: 61, difficulty: 3, importance: 3 },
  { id: "optics", name: "光学", board: "光学", mastery: 57, difficulty: 3, importance: 3 },
  { id: "modern", name: "近代物理", board: "近代物理", mastery: 49, difficulty: 4, importance: 4 },
];

export const KG_LINKS: KGLink[] = [
  { source: "mech", target: "kinematics", relation: "prerequisite" },
  { source: "mech", target: "newton", relation: "prerequisite" },
  { source: "mech", target: "energy", relation: "prerequisite" },
  { source: "mech", target: "rotation", relation: "prerequisite" },
  { source: "mech", target: "oscillation", relation: "prerequisite" },
  { source: "em", target: "electrostatic", relation: "prerequisite" },
  { source: "em", target: "circuit", relation: "prerequisite" },
  { source: "em", target: "magnetic", relation: "prerequisite" },
  { source: "em", target: "em_induction", relation: "prerequisite" },
  { source: "newton", target: "electrostatic", relation: "transfer" },
  { source: "energy", target: "em_induction", relation: "transfer" },
  { source: "rotation", target: "magnetic", relation: "transfer" },
  { source: "oscillation", target: "optics", relation: "transfer" },
];

// ---------- PCDF 八层认知诊断 ----------
export type DiagStatus = "ok" | "warn" | "risk";

export interface PcdfLayer {
  layer: number;
  name: string;
  status: DiagStatus;
  score: number; // 0-100
  note: string;
}

export interface CognitiveBug {
  id: string;
  title: string;
  layer: number;
  severity: 1 | 2 | 3 | 4;
  rootCause: string;
  fix: string;
  recurrence: number;
}

export const PCDF_LAYERS: PcdfLayer[] = [
  { layer: 1, name: "问题表征", status: "ok", score: 84, note: "能准确提取已知量与目标量" },
  { layer: 2, name: "物理图像", status: "warn", score: 68, note: "复杂情境下物理图景构建偏慢" },
  { layer: 3, name: "模型选择", status: "warn", score: 62, note: "刚体+电磁耦合时模型误判" },
  { layer: 4, name: "数学映射", status: "ok", score: 80, note: "方程建立与求解稳定" },
  { layer: 5, name: "求解执行", status: "ok", score: 78, note: "计算准确，偶有符号疏漏" },
  { layer: 6, name: "结果检验", status: "warn", score: 60, note: "量纲/极限检验执行率不足" },
  { layer: 7, name: "概念理解", status: "risk", score: 48, note: "电磁感应「阻碍变化」本质有迷思" },
  { layer: 8, name: "迁移应用", status: "risk", score: 45, note: "跨板块综合题迁移困难" },
];

export const COGNITIVE_BUGS: CognitiveBug[] = [
  {
    id: "bug-em-01",
    title: "电磁感应方向判读错误",
    layer: 7,
    severity: 4,
    rootCause: "对楞次定律「阻碍变化」理解停留在「磁通增大则感应磁场反向」，忽略相对运动视角",
    fix: "用「来拒去留 + 增反减同」双视角复述，配 3 道变式（含导体棒切割）",
    recurrence: 5,
  },
  {
    id: "bug-model-01",
    title: "刚体转动耦合误判",
    layer: 3,
    severity: 3,
    rootCause: "滑轮-重物系统未识别转动惯量贡献，错误套用平动牛顿第二定律",
    fix: "强制走「物理图像→隔离体→转动+平动联立」十阶段，2 道阶梯题",
    recurrence: 3,
  },
  {
    id: "bug-check-01",
    title: "极限检验执行缺失",
    layer: 6,
    severity: 2,
    rootCause: "求解后直接提交，未做特殊值/量纲自检",
    fix: "养成 SOP：解出公式后代入 1-2 个极限（如 θ→0, m→∞）",
    recurrence: 4,
  },
];

// ---------- 竞赛训练：AOCS 周期 + ALOE 今日规划 ----------
export interface TrainingWeek {
  week: number;
  focus: string;
  items: string[];
  load: number; // 训练负荷 0-100
}

export const TRAINING_PLAN: TrainingWeek[] = [
  {
    week: 1,
    focus: "力学综合强化",
    items: ["刚体转动 6 题", "振动与波 4 题", "能量方法专题"],
    load: 70,
  },
  {
    week: 2,
    focus: "电磁学突破（感应）",
    items: ["电磁感应 8 题", "导体棒切割变式 4 题", "错题 bug-em-01 复盘"],
    load: 85,
  },
  {
    week: 3,
    focus: "跨板块综合",
    items: ["力电磁耦合 5 题", "模拟赛 1 套", "元认知复盘"],
    load: 90,
  },
  {
    week: 4,
    focus: "模拟赛与查漏",
    items: ["全真模拟 2 套", "易错点清单", "心态与节奏训练"],
    load: 80,
  },
];

export type PlanType = "复习" | "新学" | "训练" | "实验";

export interface DailyPlanItem {
  time: string;
  task: string;
  type: PlanType;
  priority: number; // ALOE Priority Score 0-100
}

export const TODAY_PLAN: DailyPlanItem[] = [
  { time: "19:00", task: "错题 bug-em-01 变式 3 题", type: "复习", priority: 92 },
  { time: "19:45", task: "电磁感应新课：动生+感生电动势推导", type: "新学", priority: 78 },
  { time: "20:30", task: "导体棒切割综合训练 2 题", type: "训练", priority: 70 },
  { time: "21:10", task: "RLC 暂态实验探究设计（SIEE）", type: "实验", priority: 55 },
];

// ---------- 错题本 ----------
export type MistakeStatus = "未掌握" | "巩固中" | "已掌握";

export interface Mistake {
  id: string;
  topic: string;
  summary: string;
  bugId: string;
  date: string;
  recurrence: number;
  status: MistakeStatus;
}

export const MISTAKES: Mistake[] = [
  {
    id: "m-2026-07",
    topic: "电磁感应·导体棒在磁场中切割",
    summary: "求棒稳定速度时忽略安培阻力与重力分量平衡，直接用能量守恒漏算摩擦",
    bugId: "bug-em-01",
    date: "2026-07-02",
    recurrence: 5,
    status: "未掌握",
  },
  {
    id: "m-2026-06",
    topic: "刚体·滑轮-重物系统",
    summary: "未计入滑轮转动惯量，导致加速度算大",
    bugId: "bug-model-01",
    date: "2026-06-18",
    recurrence: 3,
    status: "巩固中",
  },
  {
    id: "m-2026-05",
    topic: "振动·双弹簧耦合振子",
    summary: "简正模式判断错误，未做极限检验",
    bugId: "bug-check-01",
    date: "2026-05-30",
    recurrence: 4,
    status: "已掌握",
  },
];

// ---------- 16 模块 / 五层（架构地图）----------
export type PomosLayer =
  | "Persona"
  | "Cognitive"
  | "Knowledge"
  | "Teaching"
  | "Runtime";

export interface PomosModule {
  id: string;
  code: string;
  name: string;
  layer: PomosLayer;
  desc: string;
}

export const LAYER_META: Record<PomosLayer, { label: string; color: string; blurb: string }> = {
  Persona: { label: "Persona 人格层", color: "#6366f1", blurb: "定义导师身份、使命与教学哲学" },
  Cognitive: { label: "Cognitive 认知层", color: "#0ea5e9", blurb: "建模学生、诊断认知" },
  Knowledge: { label: "Knowledge 知识层", color: "#10b981", blurb: "构建物理知识图谱与思维管线" },
  Teaching: { label: "Teaching 教学层", color: "#f59e0b", blurb: "六种模式、竞赛解码与探究" },
  Runtime: { label: "Runtime 运行时层", color: "#ef4444", blurb: "记忆、评估、多模态与编排大脑" },
};

export const MODULES: PomosModule[] = [
  { id: "m01", code: "01", name: "Identity System", layer: "Persona", desc: "导师身份与人格设定" },
  { id: "m02", code: "02", name: "Mission & Principles", layer: "Persona", desc: "使命与核心原则" },
  { id: "m03", code: "03", name: "Teaching Philosophy", layer: "Persona", desc: "先物理后公式等教学信条" },
  { id: "m04", code: "04", name: "Student Modeling", layer: "Cognitive", desc: "学生数字孪生（九维）" },
  { id: "m05", code: "05", name: "Cognitive Diagnosis", layer: "Cognitive", desc: "PCDF 八层认知诊断" },
  { id: "m06", code: "06", name: "Knowledge Graph", layer: "Knowledge", desc: "六层物理知识图谱" },
  { id: "m07", code: "07", name: "Physics Thinking", layer: "Knowledge", desc: "十阶段物理思维管线" },
  { id: "m08", code: "08", name: "Teaching Strategy", layer: "Teaching", desc: "六模式 + 五级 Hint" },
  { id: "m09", code: "09", name: "Olympiad Problem Intel.", layer: "Teaching", desc: "OPIE 竞赛题解码" },
  { id: "m10", code: "10", name: "Adaptive Coaching", layer: "Teaching", desc: "AOCS 周期训练" },
  { id: "m11", code: "11", name: "Scientific Inquiry", layer: "Teaching", desc: "SIEE 实验探究" },
  { id: "m12", code: "12", name: "Learning Orchestration", layer: "Teaching", desc: "ALOE 学习调度" },
  { id: "m13", code: "13", name: "Memory OS", layer: "Runtime", desc: "CMOS 六层记忆 + DNA" },
  { id: "m14", code: "14", name: "Competency Assessment", layer: "Runtime", desc: "HPCAS · 物理商 PQ" },
  { id: "m15", code: "15", name: "Multimodal Intel.", layer: "Runtime", desc: "UMLIE 多模态识别" },
  { id: "m16", code: "16", name: "Runtime Orchestrator", layer: "Runtime", desc: "系统大脑 · 统一编排" },
];

// ---------- 模块实现状态登记（如实反映运行时接线情况）----------
// live = 已在 POMOS 运行时真正接好并可工作；stub = 架构占位，待实装。
export type ModuleStatus = "live" | "stub";

export interface ModuleInfo {
  status: ModuleStatus;
  file: string; // 主要实现位置（后端模块或编排/记忆层）
  note: string;
}

export const MODULE_STATUS: Record<string, ModuleInfo> = {
  m01: { status: "stub", file: "backend/app/modules/m01_identity.py", note: "身份设定占位" },
  m02: { status: "stub", file: "backend/app/modules/m02_mission.py", note: "使命原则占位" },
  m03: { status: "stub", file: "backend/app/modules/m03_philosophy.py", note: "教学哲学占位" },
  m04: { status: "live", file: "backend/app/chat.py + models.py", note: "九维 Student Twin 已接入编排与画像闭环" },
  m05: { status: "live", file: "backend/app/modules/m05_diagnosis.py", note: "PCDF 八层 + 误区检测已实装" },
  m06: { status: "live", file: "backend/app/modules/m06_knowledge_graph.py", note: "知识图谱已在前端渲染（六层）" },
  m07: { status: "stub", file: "backend/app/modules/m07_physics_thinking.py", note: "物理思维管线占位" },
  m08: { status: "stub", file: "backend/app/modules/m08_teaching_strategy.py", note: "六模式 + 五级 Hint 占位" },
  m09: { status: "stub", file: "backend/app/modules/m09_olympiad_problem.py", note: "OPIE 竞赛题解码占位" },
  m10: { status: "stub", file: "backend/app/modules/m10_olympiad_coaching.py", note: "AOCS 自适应教练占位" },
  m11: { status: "stub", file: "backend/app/modules/m11_scientific_inquiry.py", note: "SIEE 实验探究占位" },
  m12: { status: "stub", file: "backend/app/modules/m12_learning_orchestration.py", note: "ALOE 学习编排占位" },
  m13: { status: "live", file: "backend/app/memory.py", note: "CMOS 六层记忆已实装" },
  m14: { status: "live", file: "backend/app/modules/assessment_engine.py", note: "HPCAS · 物理商 PQ 评估引擎已实装" },
  m15: { status: "stub", file: "backend/app/modules/m15_multimodal.py", note: "UMLIE 多模态识别占位" },
  m16: { status: "live", file: "backend/app/orchestrator.py", note: "LangGraph 统一编排大脑已实装" },
};

// ---------- 测评总览 ----------
export const SAMPLE_PQ = 81;
export const SAMPLE_RADAR = {
  knowledge: 72,
  modeling: 64,
  scientific_thinking: 70,
  transfer: 55,
  competition: 58,
  growth: 78,
};
export const SAMPLE_GROWTH = [
  { ts: "2026-04", pq: 58 },
  { ts: "2026-05", pq: 65 },
  { ts: "2026-06", pq: 71 },
  { ts: "2026-07", pq: 81 },
];
export const SAMPLE_READINESS = {
  province_top: 0.86,
  province_team: 0.47,
  ipho: 0.12,
};
