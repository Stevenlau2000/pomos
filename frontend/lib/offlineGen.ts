// lib/offlineGen.ts
// 浏览器内生成引擎（纯函数，无副作用）：把 physicsKB 的内容转化为
// 真实的竞赛题目 / 针对性训练 / 错题解析 / 就绪度推导 / 周计划。
// 所有公式透明、可解释，离线部署下即可运行。

import {
  PHYSICS_BANK,
  BUG_CATEGORIES,
  KG_BOARDS,
  findBoardByKeyword,
  inferBugCategory,
  type Board,
  type ProblemTemplate,
  type BugCategory,
} from "./physicsKB";
import { findExampleByPoint, searchTextbooks } from "./textbookRetriever";
import type { PcdfLayer } from "./pomosData";

// 讲义四模块结果（与 lib/lecture.ts 的 LectureResult 同源）。
export interface LectureResult {
  topic: string;
  concept: string; // 概念辨析
  derivation: string; // 数理推导
  image: string; // 图像分析
  logic: string; // 逻辑贯通
  markdown: string; // 由 lecture.toMarkdown 装配（离线生成时留空）
  sources: string[]; // 引用教材 / KB 出处
}
// 按知识点 + 难度梯度出题请求（T06）
export interface QuestionRequest {
  subject: string;
  knowledgePoint?: string;
  difficulty: number; // 1-5
  count?: number;
}

// FNV-1a 32-bit 哈希：把任意字符串映射为无符号整数。
// 用于把「板块:难度」等输入稳定地派生为确定性种子（避免 Date.now() 引入的非确定性）。
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ---------- 类型
export interface GeneratedQuestion {
  id: string;
  topic: string;
  board: Board;
  difficulty: number;
  stem: string;
  hint: string;
  solutionPoints: string[];
  keyPoints: string[];
}

export interface GeneratedTraining {
  node: string;
  board: Board;
  mastery: number;
  tier: string;
  objectives: string[];
  problems: GeneratedQuestion[];
  misconceptions: string[];
  summary: string;
}

export interface MistakeAnalysis {
  categoryId: string;
  categoryLabel: string;
  cause: string;
  correctApproach: string;
  prevention: string;
}

// 板块 → 九维（认知）权重映射。导出供 offlineApi.masteryDeltaForBoard 复用，
// 保证「训练回写增量」与「板块掌握度推导」单一数据源，不漂移。
export const BOARD_WEIGHT: Record<Board, Record<string, number>> = {
  力学: { modeling: 1, reasoning: 1, calculation: 0.8, concept: 0.8 },
  电磁学: { modeling: 1, calculation: 1, reasoning: 0.9, transfer: 0.6 },
  热学: { concept: 1, calculation: 0.9, reasoning: 0.8 },
  光学: { concept: 1, modeling: 0.9, reasoning: 0.9 },
  近代物理: { concept: 1, reasoning: 1, calculation: 0.9, competition: 0.7 },
  // ---------- 5 新学科（v2） ----------
  高数: { calculation: 1, reasoning: 0.9, concept: 0.6, meta: 0.4 },
  矢量分析: { calculation: 1, reasoning: 0.9, transfer: 0.6, concept: 0.5 },
  线性代数: { calculation: 1, reasoning: 0.9, modeling: 0.5, meta: 0.4 },
  理论力学: { modeling: 1, reasoning: 1, calculation: 0.8, competition: 0.6 },
  电动力学: { reasoning: 1, calculation: 1, modeling: 0.9, transfer: 0.6, competition: 0.5 },
};

function clamp(v: number, lo = 0, hi = 1): number {
  return Math.max(lo, Math.min(hi, v));
}

// QA 单测（test/offlineGen.test.ts）需要直接构造九维孪生，故显式导出该类型。
export type TwinLike = { key: string; value: number; label?: string }[];

function twinMap(twin: TwinLike): Record<string, number> {
  const m: Record<string, number> = {};
  for (const d of twin) m[d.key] = d.value;
  return m;
}

// ---------------------------------------------------------------- 掌握度分层
export function masteryTier(m: number): { label: string; desc: string; color: string } {
  if (m >= 90) return { label: "精通", desc: "可独立解决该板块压轴综合题", color: "#10b981" };
  if (m >= 75) return { label: "进阶", desc: "掌握大部分考点，偶有限制", color: "#22c55e" };
  if (m >= 60) return { label: "熟练", desc: "常规题稳定，综合题需引导", color: "#0ea5e9" };
  if (m >= 40) return { label: "基础", desc: "核心概念已建立，需系统训练", color: "#f59e0b" };
  return { label: "入门", desc: "刚起步，优先补齐概念与基础题", color: "#ef4444" };
}

// ---------------------------------------------------------------- 板块掌握度（由九维推导）
export function computeBoardMastery(twin: TwinLike): Record<Board, number> {
  const m = twinMap(twin);
  const out = {} as Record<Board, number>;
  for (const board of KG_BOARDS) {
    const w = BOARD_WEIGHT[board];
    let wsum = 0;
    let vsum = 0;
    for (const k of Object.keys(w)) {
      const v = m[k] ?? 0;
      wsum += w[k];
      vsum += w[k] * v;
    }
    out[board] = Math.round((wsum > 0 ? vsum / wsum : 0) * 100);
  }
  return out;
}

// ---------------------------------------------------------------- PCDF 八层（由九维推导，替代写死常量）
// 返回结构与 pomosData.ts 的 PcdfLayer 完全一致，故直接复用该类型（单源）。
export function derivePcdfLayers(twin: TwinLike): PcdfLayer[] {
  const m = twinMap(twin);
  const at = (k: string) => Math.round((m[k] ?? 0) * 100);
  const defs: { layer: number; name: string; score: number; note: string }[] = [
    { layer: 1, name: "问题表征", score: at("concept"), note: "从题干提取已知量与目标量" },
    { layer: 2, name: "物理图像", score: at("modeling"), note: "构建情境的物理图景" },
    { layer: 3, name: "模型选择", score: Math.round(((m.modeling ?? 0) * 0.5 + (m.transfer ?? 0) * 0.5) * 100), note: "力电磁耦合时的模型判别" },
    { layer: 4, name: "数学映射", score: at("calculation"), note: "方程建立与求解" },
    { layer: 5, name: "求解执行", score: Math.round(((m.calculation ?? 0) * 0.6 + (m.reasoning ?? 0) * 0.4) * 100), note: "计算与符号规范" },
    { layer: 6, name: "结果检验", score: at("meta"), note: "量纲 / 极限自检" },
    { layer: 7, name: "概念理解", score: at("concept"), note: "概念本质与迷思" },
    { layer: 8, name: "迁移应用", score: at("transfer"), note: "跨板块综合题迁移" },
  ];
  return defs.map((d) => ({
    ...d,
    status: d.score >= 75 ? "ok" : d.score >= 55 ? "warn" : "risk",
  }));
}

// ---------------------------------------------------------------- 竞赛题目生成
function pickProblem(board: Board, difficulty: number): ProblemTemplate {
  const bank = PHYSICS_BANK[board].problems;
  // 优先选难度最接近的题目
  let best = bank[0];
  let bestDiff = Infinity;
  for (const p of bank) {
    const d = Math.abs(p.difficulty - difficulty);
    if (d < bestDiff) {
      bestDiff = d;
      best = p;
    }
  }
  return best;
}

export function generateCompetitionQuestion(
  board: Board,
  difficulty: number,
  rngSeed = hashStr(`${board}:${difficulty}`),
): GeneratedQuestion {
  const p = pickProblem(board, difficulty);
  const pool = PHYSICS_BANK[board].problems;
  // 若有多题且难度匹配，随机换一题增加变化
  let chosen = p;
  if (pool.length > 1) {
    const candidates = pool.filter((x) => Math.abs(x.difficulty - difficulty) <= 1);
    const arr = candidates.length ? candidates : pool;
    const idx = Math.floor((rngSeed % arr.length + arr.length) % arr.length);
    chosen = arr[idx];
  }
  return {
    id: `q-${board}-${difficulty}-${rngSeed}`,
    topic: chosen.topic,
    board,
    difficulty: chosen.difficulty,
    stem: chosen.stem,
    hint: chosen.hint,
    solutionPoints: chosen.solutionPoints,
    keyPoints: chosen.keyPoints,
  };
}

// ---------------------------------------------------------------- 知识图谱节点训练生成
export function generateTrainingForNode(
  nodeName: string,
  board: Board,
  mastery: number,
): GeneratedTraining {
  const content = PHYSICS_BANK[board];
  const tier = masteryTier(mastery);
  // 由掌握度决定题量难度：掌握度低先练基础题
  const targetDiff = mastery >= 75 ? 5 : mastery >= 60 ? 4 : mastery >= 40 ? 3 : 2;
  const sorted = [...content.problems].sort((a, b) => a.difficulty - b.difficulty);
  const count = Math.min(5, Math.max(3, sorted.length));
  const problems = sorted.slice(0, count).map((p) => ({
    id: `gen_${nodeName}_${p.id}`,
    topic: p.topic,
    board,
    difficulty: p.difficulty,
    stem: p.stem,
    hint: p.hint,
    solutionPoints: p.solutionPoints,
    keyPoints: p.keyPoints,
  }));
  return {
    node: nodeName,
    board,
    mastery,
    tier: tier.label,
    objectives: content.objectives,
    problems,
    misconceptions: content.misconceptions,
    summary: `针对「${nodeName}」（${board}，掌握度 ${Math.round(mastery)}/${100}，层级「${tier.label}」）生成 ${problems.length} 道由浅入深的梯度题，先巩固基础再上综合。`,
  };
}

// ---------------------------------------------------------------- 错题 AI 解析
export function generateMistakeAnalysis(
  topic: string,
  summary: string,
  category?: BugCategory | null,
): MistakeAnalysis {
  const cat = category ?? inferBugCategory(topic);
  const t = topic || "本题";
  const s = summary || "解题过程出现偏差";
  const cause = `归因类别【${cat.label}】：${cat.desc}。结合「${t}」的具体情境，最可能的根因是——${s}。这类问题常因未先建立清晰的物理图像就急于代入公式而放大。`;
  const correctApproach = [
    `1. 先表征：圈出「${t}」中的已知量、约束与所求量，明确过程类型。`,
    `2. 建图像：用${cat.label === "概念迷思" ? "极限 / 特例" : "隔离体 + 受力 / 能量图"}确认物理图景，再选模型。`,
    `3. 列方程求解：保留符号到最后再代入，避免中途数值污染；注意方向与符号约定。`,
  ].join("\n");
  const prevention = `防错策略（来自分类修复建议）：${cat.fix}。建议把该错题归入「${cat.label}」清单，每周用 1 道变式题巩固，直到能口述正确物理图像。`;
  return {
    categoryId: cat.id,
    categoryLabel: cat.label,
    cause,
    correctApproach,
    prevention,
  };
}

// ---------------------------------------------------------------- 周训练 / 今日规划生成
export function generateWeeklyTraining(
  twin: TwinLike,
  weakConcepts: string[],
  mistakeTopics: string[],
): { weekly: WeeklyOut[]; today: DailyOut[]; rationale: string } {
  const bm = computeBoardMastery(twin);
  const weakBoards = [...KG_BOARDS].sort((a, b) => bm[a] - bm[b]).slice(0, 2);
  const focuses = [
    ...weakBoards,
    "跨板块综合（力电磁耦合）",
    "模拟赛与元认知复盘",
  ];
  const weekly: WeeklyOut[] = focuses.map((focus, i) => {
    const board = (KG_BOARDS as readonly string[]).includes(focus)
      ? (focus as Board)
      : null;
    const mastery = board ? bm[board] : 60;
    const items = board
      ? PHYSICS_BANK[board].objectives.slice(0, 3)
      : ["力电磁耦合 3 题", "错题归因复盘", "限时模拟 1 套"];
    return {
      week: i + 1,
      focus,
      items,
      load: Math.round(clamp((100 - mastery) / 100, 0.2, 0.95) * 100),
    };
  });

  const firstWeak = weakBoards[0];
  const today: DailyOut[] = [
    {
      time: "19:00",
      task: firstWeak ? `专题训练：${firstWeak}（薄弱板块，掌握度 ${bm[firstWeak]}）` : "力学建模专题 3 题",
      type: "训练",
      priority: 95,
    },
    {
      time: "20:00",
      task: mistakeTopics[0]
        ? `复盘错题：${mistakeTopics[0]}`
        : "错题归因与分类（标注 bug 类型）",
      type: "反思",
      priority: 80,
    },
    {
      time: "20:40",
      task: "口述一道题的物理图像（15 min）",
      type: "输出",
      priority: 65,
    },
  ];

  const rationale = `基于你的数字孪生九维画像个性化生成：优先补齐最弱板块（${weakBoards.join(
    "、",
  )}），并安排错题复盘与每日输出以固化直觉。弱项概念：${weakConcepts.slice(0, 2).join("、") || "暂无"}。`;
  return { weekly, today, rationale };
}

export interface WeeklyOut {
  week: number;
  focus: string;
  items: string[];
  load: number;
}
export interface DailyOut {
  time: string;
  task: string;
  type: string;
  priority: number;
}

// ---------------------------------------------------------------- 按知识点 + 梯度出题（T06）
// 按具体知识点（如「刚体转动·平行轴定理」）定向产出 ≥3 道梯度题，难度围绕请求值上下铺开。
export function generateQuestionsByPoint(req: QuestionRequest): GeneratedQuestion[] {
  const board = (KG_BOARDS as readonly string[]).includes(req.subject)
    ? (req.subject as Board)
    : (findBoardByKeyword(`${req.subject} ${req.knowledgePoint ?? ""}`) ?? "力学");
  const base = req.knowledgePoint?.trim() || req.subject.trim();
  const count = Math.max(3, Math.min(6, req.count ?? 3));
  const mid = clamp(Math.round(req.difficulty), 1, 5);
  const ex = req.knowledgePoint?.trim() ? findExampleByPoint(req.knowledgePoint as string) : null;

  const out: GeneratedQuestion[] = [];
  for (let i = 0; i < count; i++) {
    // 梯度：以请求难度为中点，向两侧铺开，保证 ≥3 档差异化
    const diff = clamp(mid + (i - Math.floor((count - 1) / 2)), 1, 5);
    let topic = `（${board}）${base}`;
    let stem = "";
    let hint = "";
    let solutionPoints: string[] = [];
    let keyPoints: string[] = [base];
    if (ex) {
      // 命中教材典型例题：围绕它变形，难度不同给不同提示层级
      topic = `${ex.topic}（变式 ${i + 1}）`;
      stem = ex.stem;
      hint =
        diff >= 4
          ? "先独立写出完整过程，再对照解析自检卡点。"
          : diff >= 3
            ? ex.solution
            : `提示：回顾「${base}」的核心公式，先建立物理图像再列式。`;
      solutionPoints = [ex.solution];
    } else {
      const q = generateCompetitionQuestion(board, diff, hashStr(`${board}:${base}:${i}`));
      topic = q.topic;
      stem = q.stem;
      hint = q.hint;
      solutionPoints = q.solutionPoints;
      keyPoints = q.keyPoints;
    }
    out.push({
      id: `qpt-${board}-${hashStr(base + i)}`,
      topic,
      board,
      difficulty: diff,
      stem,
      hint,
      solutionPoints,
      keyPoints,
    });
  }
  return out;
}

// ---------------------------------------------------------------- 离线四模块讲义（降级用，T07）
// 复用教材库检索结果，装配「概念辨析 / 数理推导 / 图像分析 / 逻辑贯通」四模块。
// markdown 字段留空，由 lib/lecture.ts 的 toMarkdown 统一装配（保证标题与 LECTURE_SECTIONS 一致）。
export function generateLectureOffline(
  topic: string,
  ctx?: { knowledgePoint?: string; studentId?: string },
): LectureResult {
  const q = ctx?.knowledgePoint?.trim() || topic.trim();
  const hits = searchTextbooks(q, 5);
  const src = hits.map((h) => h.example?.source ?? `${h.textbook.title}·${h.chapter.title}`);
  const pt = hits.find((h) => h.point)?.point;
  const ex = hits.find((h) => h.example)?.example;

  const concept = pt
    ? `**${pt.title}**：\n${pt.summary}\n\n核心要点：${pt.keywords.join("、")}。`
    : `围绕「${q}」建立物理图像：先明确已知量与所求量，再判断所属模型与适用定律。`;

  const derivation = ex
    ? `以典型例题「${ex.topic}」为例（难度 ${"★".repeat(ex.difficulty)}）：\n${ex.solution}`
    : `按「表征→建模→数学映射→求解」四步推演「${q}」的标准过程，注意符号与量纲约定。`;

  const image = pt
    ? `建议绘制「${pt.title}」的情境图：建立坐标系、标注已知量与方向，用图像确认物理图景后再列式。`
    : `绘制「${q}」的情境图（受力图 / 电路图 / 光路图 / 场线图），用图像辅助判断方向、相位与边界条件。`;

  const logic = ex
    ? `本题可迁移到「${pt?.title ?? q}」同类问题：核心判据一致，差异仅在参数与边界；建议再用 1 道变式题巩固。`
    : `「${q}」与相邻板块（力电磁耦合 / 矢量场 / 分析力学）存在方法级共通：能量法、对称性与边界条件可跨情境复用。`;

  return {
    topic: q,
    concept,
    derivation,
    image,
    logic,
    markdown: "",
    sources: Array.from(new Set(src)),
  };
}

export { BUG_CATEGORIES, KG_BOARDS, findBoardByKeyword };
