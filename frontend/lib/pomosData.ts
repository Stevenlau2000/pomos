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

// 后端 canonical key → 前端展示信息映射
// 后端 key 作为正典（与 backend/app/models.py NINE_DIMS 对齐），
// 前端 label/hint 仅用于 UI 渲染。
export const DIM_MAP: Record<string, { label: string; hint: string }> = {
  concept: { label: "知识掌握", hint: "对物理概念与本质的掌握程度" },
  modeling: { label: "物理建模", hint: "将现实情境抽象为物理模型的能力" },
  reasoning: { label: "推理能力", hint: "因果演绎与逻辑链完整性" },
  calculation: { label: "数学准备", hint: "微积分/矢量/级数等数学工具熟练度" },
  experiment: { label: "实验探究", hint: "实验设计与误差分析能力" },
  transfer: { label: "迁移能力", hint: "跨板块综合题（力电磁耦合）偏弱" },
  meta: { label: "元认知", hint: "能自我监控解题卡点" },
  competition: { label: "竞赛就绪", hint: "竞赛策略与压轴题经验" },
  growth: { label: "成长态势", hint: "持续训练与提升趋势" },
};

export const NINE_DIMS: TwinDimension[] = [
  { key: "concept", label: DIM_MAP.concept.label, value: 72, hint: DIM_MAP.concept.hint },
  { key: "modeling", label: DIM_MAP.modeling.label, value: 64, hint: DIM_MAP.modeling.hint },
  { key: "reasoning", label: DIM_MAP.reasoning.label, value: 70, hint: DIM_MAP.reasoning.hint },
  { key: "calculation", label: DIM_MAP.calculation.label, value: 81, hint: DIM_MAP.calculation.hint },
  { key: "experiment", label: DIM_MAP.experiment.label, value: 78, hint: DIM_MAP.experiment.hint },
  { key: "transfer", label: DIM_MAP.transfer.label, value: 55, hint: DIM_MAP.transfer.hint },
  { key: "meta", label: DIM_MAP.meta.label, value: 66, hint: DIM_MAP.meta.hint },
  { key: "competition", label: DIM_MAP.competition.label, value: 58, hint: DIM_MAP.competition.hint },
  { key: "growth", label: DIM_MAP.growth.label, value: 78, hint: DIM_MAP.growth.hint },
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

// KG_BOARDS 正典定义在 physicsKB.ts（带 Board 字面量类型），此处仅 re-export 保持导出名不变，
// 避免其他 import 改动；真正真相源统一为 physicsKB.ts。
export { KG_BOARDS } from "./physicsKB";

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
  { id: "m01", code: "01", name: "Identity System", layer: "Persona", desc: "导师身份与人格设定（CPhO/IPhO）" },
  { id: "m02", code: "02", name: "Mission & Principles", layer: "Persona", desc: "使命与首性原理等核心原则" },
  { id: "m03", code: "03", name: "Teaching Philosophy", layer: "Persona", desc: "苏格拉底式+脚手架+元认知信条" },
  { id: "m04", code: "04", name: "Student Modeling", layer: "Cognitive", desc: "学生数字孪生 Student Twin（九维）" },
  { id: "m05", code: "05", name: "Cognitive Diagnosis", layer: "Cognitive", desc: "PCDF 八层认知诊断与误区检测" },
  { id: "m06", code: "06", name: "Knowledge Graph", layer: "Knowledge", desc: "六层物理知识图谱（后端待实现）" },
  { id: "m07", code: "07", name: "Physics Thinking", layer: "Knowledge", desc: "十阶段物理思维管线" },
  { id: "m08", code: "08", name: "Teaching Strategy", layer: "Teaching", desc: "六模式 + 五级 Hint 教学策略" },
  { id: "m09", code: "09", name: "Olympiad Problem Intel.", layer: "Teaching", desc: "OPIE 竞赛题检索/生成/解析" },
  { id: "m10", code: "10", name: "Adaptive Coaching", layer: "Teaching", desc: "AOCS 单题多轮自适应教练" },
  { id: "m11", code: "11", name: "Scientific Inquiry", layer: "Teaching", desc: "SIEE 实验设计与误差探究" },
  { id: "m12", code: "12", name: "Learning Orchestration", layer: "Teaching", desc: "ALOE 排程与学习路径规划" },
  { id: "m13", code: "13", name: "Memory OS", layer: "Runtime", desc: "CMOS 六层记忆（按学生隔离）" },
  { id: "m14", code: "14", name: "Competency Assessment", layer: "Runtime", desc: "HPCAS · 物理商 PQ 评估" },
  { id: "m15", code: "15", name: "Multimodal Intel.", layer: "Runtime", desc: "UMLIE 题目图片/公式多模态" },
  { id: "m16", code: "16", name: "Runtime Orchestrator", layer: "Runtime", desc: "LangGraph 统一编排系统大脑" },
];

// ---------- 模块详细内容（模块地图详情面板）----------
export interface ModuleDetail {
  role: string;   // 核心职责详述（1-2 句）
  methods: string[]; // 关键算法/框架/能力点
  io: string;     // 输入 → 输出
  deps: string[]; // 依赖模块 id（如 ["m04","m05"]）
}

export const MODULE_DETAIL: Record<string, ModuleDetail> = {
  m01: { role: "定义 POMOS 作为物理竞赛导师的身份、口吻与服务边界（CPhO/IPhO 导向）。", methods: ["静态 persona 字典（身份/口吻/边界）", "CPhO/IPhO 竞赛语境设定"], io: "配置 → 导师人格设定", deps: ["m02","m03"] },
  m02: { role: "阐明培养物理直觉与建模能力的使命，以及首性原理等核心原则。", methods: ["使命陈述", "首性原理 / 少即是多等原则清单"], io: "配置 → 使命与原则", deps: ["m01"] },
  m03: { role: "确立「先物理后公式」、苏格拉底式提问 + 脚手架 + 元认知的教学信条。", methods: ["苏格拉底式提问", "脚手架递进", "元认知反思"], io: "配置 → 教学哲学信条", deps: ["m02"] },
  m04: { role: "维护学生数字孪生 Student Twin，刻画 concept/modeling 等九维能力画像。", methods: ["九维 Student Twin", "twin_to_radar 降维聚合", "apply_student_update 增量更新"], io: "做题/训练记录 → 九维分数 + 雷达画像", deps: ["m05","m14"] },
  m05: { role: "基于 PCDF 八层认知模型诊断学生，检测错误概念并定位卡点层级。", methods: ["PCDF 八层诊断", "detect_misconceptions 误区检测", "严重度/根因/复发率标注"], io: "作答与错题 → 八层分数 + 误区清单", deps: ["m04","m14"] },
  m06: { role: "构建六层物理知识图谱（概念/关系/方法/情境/条件/反例），支撑薄弱点定位。", methods: ["六层 KG（板块/主题/概念/模型/方法/误区）", "prerequisite/transfer 关系边", "前端 demo 渲染节点与边"], io: "物理知识库 → 图谱节点 + 关系（后端未实现，当前返回硬编码示范节点）", deps: ["m04"] },
  m07: { role: "十阶段物理思维管线，引导学生从物理图像到数学表达的系统化推演。", methods: ["十阶段思维链（表征→图像→模型→数学映射→求解→检验→概念→迁移）", "思维过程可视化"], io: "题目/思路 → 分步思维轨迹", deps: ["m05","m06"] },
  m08: { role: "六教学模式+五级 Hint 的规则引擎：按学情路由讲授/探究/支架/对练/复盘/拓展，并生成递进提示。", methods: ["六模式决策表 route_mode", "五级 Hint 梯度 generate_hint(方向→思路→关键步骤→近完整→答案)", "select_strategy 策略装配", "错误概念驱动 +1 级支架"], io: "学情(九维 twin + 诊断) + 目标 → 教学模式 + 初始 Hint 等级", deps: ["m04","m05"] },
  m09: { role: "OPIE 竞赛题智能检索/生成/改编与解析，提供高质量题源。", methods: ["OPIE 竞赛题解码（考点/难度/解法映射）", "题源检索与改编", "解析生成"], io: "考点/难度需求 → 竞赛题 + 解析", deps: ["m06","m14"] },
  m10: { role: "AOCS 单题多轮自适应教练：诊断→引导→反馈→强化的状态机，按作答推进 Hint 等级并决定下一步动作。", methods: ["AOCS 状态机 aocs_transition", "evaluate_answer 作答评估(correct/partial/wrong)", "build_feedback 反馈拼装", "连对 2 次收敛结课"], io: "学生作答 + 策略 → 结构化反馈(turn/feedback/hint_level/action)", deps: ["m08","m05"] },
  m11: { role: "SIEE 实验探究，支持实验设计、误差分析与数据处理。", methods: ["SIEE 探究流程（提问→假设→设计→实施→解释）", "误差分析与不确定度", "数据拟合/可视化"], io: "实验目标 → 探究方案 + 误差报告", deps: ["m06","m07"] },
  m12: { role: "ALOE 学习编排，负责排程、复习曲线与个性化学习路径规划。", methods: ["ALOE 学习调度（优先级评分）", "艾宾浩斯复习曲线", "周计划/日计划生成"], io: "学情 + 目标 → 学习计划与排程", deps: ["m05","m10"] },
  m13: { role: "CMOS 六层记忆系统，按学生隔离存储并支持巩固与检索。", methods: ["CMOS 六层（sensory/working/episodic/semantic/procedural/metacognitive）", "多租户分片（get_memory/remember_turn）", "write/read/append/snapshot"], io: "对话/事件 → 六层记忆存取与巩固", deps: ["m16"] },
  m14: { role: "HPCAS 物理商 PQ 评估，九维加权出 PQ、雷达、成长曲线与就绪度。", methods: ["HPCAS 物理商 PQ", "九维加权 compute_assessment", "雷达六轴 + 成长曲线 + 省队/IPhO 就绪度"], io: "九维画像 → PQ 分数 + 雷达 + 就绪度", deps: ["m04","m05"] },
  m15: { role: "UMLIE 多模态识别，解析题目图片/手绘/公式 OCR 与图表理解。", methods: ["题目图片/手绘 OCR", "公式识别（LaTeX）", "图表/示意图理解"], io: "图片/手写 → 结构化题目文本", deps: ["m06","m14"] },
  m16: { role: "LangGraph 统一编排大脑，意图分发 → 模块调度 → 响应装配。", methods: ["LangGraph 状态图（classify→dispatch→assemble→assess）", "无 langgraph 退化链", "模块路由与上下文装配"], io: "用户请求 → 编排后的响应", deps: ["m01","m02","m03","m04","m05","m06","m07","m08","m09","m10","m11","m12","m13","m14","m15"] },
};

// ---------- 模块实现状态登记（如实反映运行时接线情况）----------
// live = 已在 POMOS 运行时真正接好并可工作；stub = 架构占位，待实装。
export type ModuleStatus = "live" | "stub";

export interface ModuleInfo {
  status: ModuleStatus;
  file: string; // 主要实现位置（后端模块或编排/记忆层）
  note: string;
}

export const MODULE_STATUS: Record<string, ModuleInfo> = {
  m01: { status: "live", file: "backend/app/modules/m01_identity.py", note: "导师身份/口吻/服务边界（能/不能做什么）已实装：build_identity 双语输出 persona/tone/scope/service_boundary" },
  m02: { status: "live", file: "backend/app/modules/m02_mission.py", note: "使命与首性原理等核心原则已实装：build_mission 双语输出 mission/principles" },
  m03: { status: "live", file: "backend/app/modules/m03_philosophy.py", note: "苏格拉底式提问+脚手架+元认知三类信条已实装（每类含 zh/en 文本）" },
  m04: { status: "live", file: "backend/app/modules/m04_student_model.py", note: "九维 Student Twin 已接入编排与画像闭环（growth 增量含硬编码基线，待接真实成长模型）" },
  m05: { status: "live", file: "backend/app/modules/m05_diagnosis.py", note: "PCDF 八层 + detect_misconceptions 误区检测已实装，输出八层分数与 bug 清单" },
  m06: { status: "live", file: "backend/app/modules/m06_knowledge_graph.py", note: "六层 KG 引擎已实装：内置知识库(app.data.kg_core) + 按 twin 薄弱维定位 top-N 节点及 prerequisite 路径" },
  m07: { status: "live", file: "backend/app/modules/m07_physics_thinking.py", note: "十阶段物理思维管线已实装：trace_thinking 基于题面启发式生成十阶段提示（不调 LLM）" },
  m08: { status: "live", file: "backend/app/modules/m08_teaching_strategy.py", note: "六模式+五级 Hint 规则引擎已实装（纯规则，不接 LLM）" },
  m09: { status: "live", file: "backend/app/modules/m09_olympiad_problem.py", note: "OPIE 竞赛题已实装：题库检索/难度匹配/参数改编（考点不变、难度档位匹配），双语题目与解析" },
  m10: { status: "live", file: "backend/app/modules/m10_olympiad_coaching.py", note: "AOCS 单题多轮自适应状态机已实装（纯规则，多轮连贯需调用方回传 student_ctx.aocs_state）" },
  m11: { status: "live", file: "backend/app/modules/m11_scientific_inquiry.py", note: "SIEE 实验探究已实装：实验设计模板 + 不确定度模型(A类 s/√n、B类 Δ/√3) + 拟合建议(逐差法/最小二乘)" },
  m12: { status: "live", file: "backend/app/modules/m12_learning_orchestration.py", note: "ALOE 学习编排已实装：优先级评分(薄弱维多→高) + 艾宾浩斯复习间隔的周/日计划" },
  m13: { status: "live", file: "backend/app/memory.py", note: "CMOS 六层记忆已实装，按 student_id 多租户分片读写巩固" },
  m14: { status: "live", file: "backend/app/modules/assessment_engine.py", note: "HPCAS 由 orchestrator._assess 调用 assessment_engine（heuristic/llm 双路径）产出 PQ/雷达/就绪度；m14_competency_assessment.py 仅占位" },
  m15: { status: "live", file: "backend/app/modules/m15_multimodal.py", note: "UMLIE 本地规则增强已实装：公式 LaTeX 本地校验（括号配对/命令白名单/环境闭合）+ 图片类型分类（受力图/电路图/光路图/波形图等）+ 结构化处理建议；图片深度 OCR 仍需外部服务" },
  m16: { status: "live", file: "backend/app/orchestrator.py", note: "真正的 LangGraph 编排在 orchestrator.py（classify→dispatch→assemble→assess，含退化链）；m16_runtime_orchestrator.py 为静态占位" },
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
