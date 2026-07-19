// lib/offlineApi.ts
// 离线模式实现：当后端不可达（如 GitHub Pages 静态托管）时，所有 API 调用路由到此模块。
//
// 本次增强改动：
// 1) 学生 / 错题 / 对话 / 设置 全部经 studentStore 读写 IndexedDB（按 student_id 隔离），
//    不再散落 localStorage 拼接 key（架构 §7）。
// 2) 对话走内置「物理教练」启发式，按标点分块模拟打字机式流式输出。
// 3) 新增「生成讲义：xxx」意图：经 lecture 生成四模块 Markdown（联网 LLM / 降级本地）。
// 4) 设置保存：LLM 密钥以 AES-GCM 加密存 IndexedDB，绝不存明文 localStorage。
// 5) 测试连接：真实探测云端 LLM 可用性。
//
// 所有导出函数签名与 lib/api.ts 完全一致，api.ts 据 MODE 自动路由。

import type {
  CreateStudentRequest,
  DailyPlan,
  Dashboard,
  GrowthPoint,
  HealthResponse,
  HistoryMessage,
  Mistake,
  MistakeCreate,
  ModuleTrace,
  NineDim,
  PqRadar,
  SendChatRequest,
  SendChatResponse,
  SettingsResponse,
  Student,
  StudentUpdate,
  TestConnectionResponse,
  TrainingPlan,
  StreamHandlers,
} from "./api";

// 浏览器内生成引擎（真实题目 / 训练 / 解析 / 就绪度推导）
import * as Gen from "./offlineGen";
import {
  BUG_CATEGORIES,
  KG_BOARDS,
  findBoardByKeyword,
  type Board,
  type BugCategory,
} from "./physicsKB";
import {
  seedTwin,
  type TwinDimension,
} from "./twinSchema";
import * as SS from "./studentStore";
import * as Lecture from "./lecture";
import { getLlmConfig } from "./llm";
// 结构化讲解通道：explainChat 内部按意图走云端优先 → 离线降级 → 讲义适配；
// detectChatIntent 为纯函数路由依据（与 api.ts 同源）。
import { explainChat, detectChatIntent, type PomosExplainV1 } from "./explain";

// ---------------------------------------------------------------- 存储工具（仅 lang 允许走 localStorage）
const KEYS = {
  lang: "pomos_lang",
};

function lsGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function lsSet(key: string, val: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, val);
  } catch {
    /* 配额或隐私模式，忽略 */
  }
}

function getCoachLang(): string {
  return (lsGet(KEYS.lang) || "zh").toLowerCase();
}

// ---------------------------------------------------------------- 确定性伪随机
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
function sample<T>(arr: T[], n: number, rng: () => number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  while (out.length < n && copy.length) {
    const i = Math.floor(rng() * copy.length);
    out.push(copy.splice(i, 1)[0]);
  }
  return out;
}

function twinToMap(twin: Array<{ key: string; value: number }>): Record<string, number> {
  const m: Record<string, number> = {};
  for (const d of twin) m[d.key] = d.value;
  return m;
}

// 技术债 ⑤ 收尾：显式导出，便于单测直接构造 Record<string,number> 验证映射。
export function pqFromTwin(twin: Record<string, number>): number {
  const vals: number[] = [];
  for (const d of NINE_DIM_KEYS) {
    const v = Number(twin[d] ?? 0);
    vals.push(Number.isNaN(v) ? 0 : v);
  }
  const mean = vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
  return clamp(0.2 + 0.8 * mean, 0, 0.99);
}

// 九维（认知）key 集合：用于 PQ 推导（学科维不纳入 PQ，保持语义纯净）。
const NINE_DIM_KEYS = [
  "concept",
  "modeling",
  "reasoning",
  "calculation",
  "experiment",
  "transfer",
  "meta",
  "competition",
  "growth",
];

const WEAK_POOL = [
  "转动参考系下的惯性力处理",
  "非静电力做功的符号约定",
  "波动叠加的相位差分析",
  "相对论同时性的相对性",
  "热力学过程的方向判断",
  "量纲分析与标度律",
  "复杂电路的等效化简",
  "变质量系统的动量方程",
];
const REC_POOL = [
  "用能量法重做一遍本周力学题，对比牛顿法",
  "补一组刚体定轴转动的专题训练（3 道）",
  "整理电磁感应中「阻碍」的三种典型情形",
  "用图像法复盘一道热力学循环题",
  "每天 15 分钟口述一道题的物理图像",
  "针对薄弱板块做错题归因，标注 bug 类型",
];

interface MockData {
  pq: number;
  radar: PqRadar;
  growth_curve: GrowthPoint[];
  twin: TwinDimension[];
  weak_concepts: string[];
  recommendations: string[];
  board_mastery: Record<string, number>;
}

/** 由九维孪生推导完整的仪表盘数据（板块掌握度 / 雷达均自洽）。 */
export function buildMockFromTwin(id: string, twin: TwinDimension[]): MockData {
  const tq = (k: string) => twin.find((d) => d.key === k)?.value ?? 0.5;
  const pq = pqFromTwin(twinToMap(twin));
  const radar: PqRadar = {
    knowledge: tq("concept"),
    modeling: tq("modeling"),
    scientific_thinking: tq("reasoning"),
    transfer: tq("transfer"),
    competition: tq("competition"),
    growth: tq("growth"),
  };
  const rng = makeRng(hashStr(id || "guest") + 3);
  const growth_curve: GrowthPoint[] = [];
  let p = pq * 0.7;
  const now = Date.now();
  for (let i = 0; i < 10; i++) {
    p = clamp(p + (rng() - 0.35) * 0.07);
    growth_curve.push({
      ts: new Date(now - (10 - i) * 7 * 86400000).toISOString().slice(0, 10),
      pq: Number(p.toFixed(3)),
    });
  }
  growth_curve[growth_curve.length - 1] = {
    ts: growth_curve[growth_curve.length - 1].ts,
    pq,
  };
  const board_mastery = Gen.computeBoardMastery(twin);
  const weak = [...twin].sort((a, b) => a.value - b.value).slice(0, 3).map((d) => d.label);
  const recs = sample(REC_POOL, 3, rng);
  return {
    pq,
    radar,
    growth_curve,
    twin,
    weak_concepts: weak,
    recommendations: recs,
    board_mastery,
  };
}

// ---------------------------------------------------------------- 物理知识库（离线教练）
interface Topic {
  keys: string[];
  zh: string;
  q: string;
}
const OFFLINE_KB: Topic[] = [
  { keys: ["微扰", "perturbation", "微扰论"], zh: "微扰论用于求解 H=H₀+V、V≪H₀ 时的近似本征值。\n• 一阶能量修正：ΔEₙ⁽¹⁾ = ⟨n|V|n⟩。\n• 简并微扰需先对简并子空间对角化 V。\n先问：V 相对能级差 Eₙ−Eₘ 是否足够小？", q: "当某 Eₘ→Eₙ 时二级修正 ΔEₙ⁽²⁾ 会发生什么？" },
  { keys: ["牛顿", "newton", "动力学", "受力", "f=ma", "加速度"], zh: "牛顿第二定律 F=ma，是动力学核心。\n• 隔离物体→受力图→坐标系→ΣF=ma。\n• 非惯性系需引入惯性力。\n先问：你选的坐标系是否让分量方程最简？", q: "滑轮质量不可忽略时，张力两侧还相等吗？" },
  { keys: ["动量", "momentum", "冲量", "守恒"], zh: "动量定理 FΔt=Δp；合外力为零时 Σp=const。\n• 碰撞优先列动量守恒；动能守恒区分弹性/非弹性。\n先问：系统是否合外力为零？", q: "完全非弹性碰撞后动能去哪了？动量为何仍守恒？" },
  { keys: ["能量", "energy", "机械能", "功", "势能", "守恒"], zh: "功能关系 W=ΔE；机械能 E=Ek+Ep 在无耗散时守恒。\n• 动能 ½mv²、重力 mgh、弹性 ½kx²。\n先问：哪些力做功？能否用势能把力藏进能量？", q: "单摆最低点速度如何最简求得？小角近似下运动方程？" },
  { keys: ["角动量", "angular momentum", "转动", "刚体", "rotate", "torque"], zh: "角动量 L=r×p；合外力矩为零时 L 守恒。\n• 刚体定轴 L=Iω，M=Iα；平行轴定理 I=I_cm+md²。\n先问：取矩参考点选在哪？", q: "花样滑冰收臂转速为何增大？人在转动杆上爬行时 L 与 ω 如何变？" },
  { keys: ["简谐", "shm", "振动", "谐振", "spring", "周期"], zh: "简谐振动 x¨+ω²x=0，解 x=Acos(ωt+φ)。\n• ω=√(k/m) 或 √(g/l)；能量 E=½kA² 守恒。\n• 受迫振动在 ω→ω₀ 共振。\n先问：恢复力是否正比位移？", q: "两个同频简谐振动同方向叠加，振幅何时最大、何时为零？" },
  { keys: ["波动", "波", "干涉", "衍射", "wave", "interference", "光栅"], zh: "行波 y=Acos(kx−ωt)，波速 v=ω/k=λf。\n• 双缝/光栅主极大 d sinθ=mλ；驻波节点振幅恒为零。\n先问：行波还是驻波？", q: "双缝间距 d 增大，干涉条纹变密还是变疏？" },
  { keys: ["电路", "circuit", "基尔霍夫", "电阻", "欧姆", "rc", "rl"], zh: "基尔霍夫：节点 ΣI=0（KCL），回路 ΣV=0（KVL）。\n• 串联 R 相加，并联 1/R=Σ1/Rᵢ；RC 暂态 τ=RC。\n先问：能否用等效电阻/戴维南化简？", q: "无穷梯形电阻网络如何用自相似性列方程？" },
  { keys: ["电磁感应", "法拉第", "faraday", "磁通", "电感", "lenz"], zh: "法拉第定律 ε=−dΦ/dt；楞次定律定方向。\n• 自感储能 ½LI²；RL 时间常数 τ=L/R；动生 ε=Blv。\n先问：磁通如何变化？", q: "两同轴线圈互感 M，次级开路与短路时初级电流有何不同？" },
  { keys: ["相对论", "relativity", "洛伦兹", "质能", "时间膨胀", "lorentz"], zh: "狭义相对论：光速不变 + 定律协变。\n• 时间膨胀 Δt=γΔτ；长度收缩 L=L₀/γ；γ=1/√(1−v²/c²)。\n• 质能 E=γmc²。\n先问：比较的是同一事件在不同时钟下的测量吗？", q: "双生子佯谬中谁年轻？为何不能简单对称处理？" },
  { keys: ["热力学", "熵", "第一定律", "第二定律", "thermal", "热机"], zh: "第一定律 ΔU=Q−W。\n• 理想气体 pV=nRT；绝热 pV^γ=const。\n• 卡诺效率 η=1−T_c/T_h。\n先问：W 是系统对外还是外界对系统？", q: "可逆卡诺循环四步各是什么？实际热机效率为何必低于卡诺？" },
  { keys: ["量子", "quantum", "薛定谔", "波函数", "势阱", "不确定性", "schrödinger"], zh: "量子态由 ψ 描述，概率密度 |ψ|²；演化 iℏ∂ψ/∂t=Ĥψ。\n• 无限深势阱 Eₙ=n²π²ℏ²/(2mL²)；不确定性 Δx·Δp≥ℏ/2。\n先问：边界条件如何决定能级量子化？", q: "势垒穿透（隧穿）为何违背经典直觉却符合能量守恒？" },
  { keys: ["静电", "电场", "高斯", "电容", "gauss", "coulomb", "电势"], zh: "库仑 F=kq₁q₂/r²；电场 E=F/q；高斯定理 ∮E·dA=Q_enc/ε₀。\n• 电势 V：E=−∇V；平行板 C=ε₀S/d。\n先问：对称性是否允许用高斯定理一步求 E？", q: "导体静电平衡时内部场强为何为零？表面电荷如何分布？" },
  { keys: ["流体", "伯努利", "fluids", "压强", "浮力", "bernoulli"], zh: "静力学 p=ρgh；阿基米德浮力=排开液重。\n• 伯努利 p+½ρv²+ρgh=const 沿流线守恒；连续性 S₁v₁=S₂v₂。\n先问：流动是否理想、定常、不可压缩？", q: "飞机升力能否仅靠「流速大压强小」解释？环量起什么作用？" },
];

function matchTopic(message: string): Topic | null {
  const text = (message || "").toLowerCase();
  let best: Topic | null = null;
  let bestLen = 0;
  for (const topic of OFFLINE_KB) {
    for (const kw of topic.keys) {
      const kwl = kw.toLowerCase();
      if (kwl.length > bestLen && text.includes(kwl)) {
        best = topic;
        bestLen = kwl.length;
      }
    }
  }
  return best;
}

function offlineTutor(message: string, lang: string): string {
  const topic = matchTopic(message);
  if (topic) {
    const body = topic.zh;
    return `【POMOS 离线教练】\n${body}\n\n💡 苏格拉底追问：${topic.q}`;
  }
  return (
    "【POMOS 离线教练】我暂时没有针对该问题的专题笔记，但可以辅导这些方向：\n" +
    "微扰论、牛顿定律、动量与能量、转动与角动量、简谐振动、波动与干涉、电路、" +
    "电磁感应、相对论、热力学、量子基础、静电场、流体。\n" +
    "把题目或想弄清的概念告诉我，我会先帮你建立物理图像，再上公式。"
  );
}

// ---------------------------------------------------------------- 导师生成意图识别
function extractBoard(text: string): Board | null {
  const mb = text.match(/（([^）]+?)\s*板块）/) || text.match(/\(([^)]+?)\s*板块\)/);
  if (mb && (KG_BOARDS as readonly string[]).includes(mb[1].trim())) return mb[1].trim() as Board;
  return findBoardByKeyword(text);
}

function inferDifficulty(text: string): number {
  if (/压轴|决赛|ipho|国家|高难|很难|复赛/.test(text)) return 5;
  if (/省赛|进阶|综合|较难/.test(text)) return 4;
  if (/入门|基础|简单|初赛|热身/.test(text)) return 2;
  return 3;
}

function fmtQuestion(q: Gen.GeneratedQuestion): string {
  return [
    "【POMOS 竞赛导师 · 生成题目】",
    `**${q.topic}**（${q.board} · 难度 ${"★".repeat(q.difficulty)}）`,
    "",
    q.stem,
    "",
    `> 💡 提示：${q.hint}`,
  ].join("\n");
}

function fmtTraining(t: Gen.GeneratedTraining): string {
  const lines: string[] = [];
  lines.push("【POMOS 竞赛导师 · 针对性训练】");
  lines.push(`针对「${t.node}」（${t.board} · 掌握度 ${Math.round(t.mastery)}/100 · 层级「${t.tier}」）`);
  lines.push("");
  lines.push("🎯 训练目标");
  t.objectives.forEach((o) => lines.push(`• ${o}`));
  lines.push("");
  lines.push("📚 梯度题（由浅入深）");
  t.problems.forEach((p, i) => {
    lines.push(`**第 ${i + 1} 题 · ${p.topic}（难度 ${"★".repeat(p.difficulty)}）**`);
    lines.push(p.stem);
    lines.push(`> 提示：${p.hint}`);
  });
  lines.push("");
  lines.push("⚠️ 常见误区");
  t.misconceptions.forEach((c) => lines.push(`• ${c}`));
  lines.push("");
  lines.push(t.summary);
  return lines.join("\n");
}

/** 若消息是生成意图（讲解已生成题 / 出题 / 训练计划 / 生成讲义），返回导师生成内容；否则返回 null 走常规辅导。 */
async function mentorGenerate(message: string, studentId: string): Promise<string | null> {
  const text = message || "";
  // 讲解已生成的题目（页面会把题干与参考答案要点一并带来）
  if (/讲解这道题/.test(text) && /参考答案要点/.test(text)) {
    const stemStart = text.indexOf("讲解这道题：") + "讲解这道题：".length;
    const idx = text.indexOf("【参考答案要点】");
    const stem = text.slice(stemStart, idx).trim();
    const points = text
      .slice(idx + "【参考答案要点】".length)
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    return [
      "【POMOS 竞赛导师 · 题目讲解】",
      stem,
      "",
      "📐 求解思路：",
      ...points.map((p, i) => `${i + 1}. ${p}`),
      "",
      "建议你先独立写出完整过程再对照要点自检；卡住时告诉我具体哪一步。",
    ].join("\n");
  }
  // 生成讲义：「生成讲义：xxx」或「生成讲义：xxx」
  const lecMatch = text.match(/生成讲义[:：]\s*([^\n]+)/);
  if (lecMatch) {
    const topic = lecMatch[1].trim();
    const r = await Lecture.generateLecture(topic, { studentId, knowledgePoint: topic });
    return Lecture.toMarkdown(r);
  }
  const isTrain = /训练计划|针对性训练|生成训练|训练方案|训练建议/.test(text);
  const isQuestion = /出题|生成题目|给我一道|来道题|练一道|一道题|考题|押一道/.test(text);
  if (!isTrain && !isQuestion) return null;

  const board = extractBoard(text);
  const nodeMatch = text.match(/「([^」]+)」/);
  const node = nodeMatch ? nodeMatch[1] : board ? `${board}核心` : "核心考点";

  if (isTrain) {
    const bm = Gen.computeBoardMastery(await getTwin(studentId));
    const mastery = board ? (bm[board] ?? 60) : 60;
    const t = Gen.generateTrainingForNode(node, board ?? "力学", mastery);
    return fmtTraining(t);
  }
  // 出题
  const b = board ?? "力学";
  const diff = inferDifficulty(text);
  const q = Gen.generateCompetitionQuestion(b, diff);
  return fmtQuestion(q);
}

function chunkText(text: string, size = 6): string[] {
  const chunks: string[] = [];
  let buf = "";
  for (const ch of text || "") {
    buf += ch;
    if ("。！？!?；;\n".includes(ch) || buf.length >= size) {
      chunks.push(buf);
      buf = "";
    }
  }
  if (buf) chunks.push(buf);
  return chunks;
}

function buildTrace(message: string): ModuleTrace[] {
  const topic = matchTopic(message);
  const label = topic ? topic.keys[0] : "general";
  return [
    { module: "offline_tutor", action: "retrieve", ts: new Date().toISOString() },
    { module: "knowledge_graph", action: "recall", ts: new Date().toISOString() },
    { module: "assessment", action: `topic:${label}`, ts: new Date().toISOString() },
  ];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- 学生存储（经 studentStore）
async function bumpPq(id: string, pq: number): Promise<void> {
  const list = await SS.loadStudents();
  const s = list.find((x) => x.student_id === id);
  if (s) {
    s.pq = Number(pq.toFixed(3));
    await SS.upsertStudent(s);
  }
}

// ---------------------------------------------------------------- 错题（经 studentStore）
function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("图片读取失败"));
    r.readAsDataURL(file);
  });
}

// ---------------------------------------------------------------- 确定性 mock 数据
// 技术债 ⑤ 收尾：显式导出，便于单测直接构造 NineDim[] 验证推导自洽性。
export async function getTwin(studentId: string): Promise<NineDim[]> {
  const twin = await SS.loadTwin(studentId);
  return twin as unknown as NineDim[];
}

// ---------------------------------------------------------------- 导出 API（与 api.ts 同签名）
export function getHealth(): Promise<HealthResponse> {
  return Promise.resolve({
    status: "ok",
    version: "offline",
    runtime: "browser",
    modules_loaded: 16,
    llm_provider: "offline-tutor",
    llm_model: "pomos-offline-tutor",
    mock_mode: true,
  });
}

export async function createStudent(input: CreateStudentRequest): Promise<Student> {
  const list = await SS.loadStudents();
  const id = `stu_${Math.random().toString(36).slice(2, 10)}`;
  const twin = seedTwin(id, input.name);
  await SS.saveTwin(id, twin);
  const stu: Student = {
    student_id: id,
    name: input.name,
    grade: input.grade || "",
    created_at: new Date().toISOString(),
    pq: pqFromTwin(twinToMap(twin)),
  };
  await SS.upsertStudent(stu);
  return stu;
}

export async function getStudents(): Promise<Student[]> {
  return SS.loadStudents();
}

export async function deleteStudent(studentId: string): Promise<{ ok: boolean }> {
  await SS.deleteStudentData(studentId);
  return { ok: true };
}

export async function updateStudent(
  studentId: string,
  data: { name?: string; grade?: string },
): Promise<Student> {
  const list = await SS.loadStudents();
  const s = list.find((x) => x.student_id === studentId);
  if (!s) return Promise.reject(new Error("学生不存在（离线）"));
  if (data.name !== undefined) s.name = data.name;
  if (data.grade !== undefined) s.grade = data.grade;
  await SS.upsertStudent(s);
  return s;
}

export async function sendChat(input: SendChatRequest): Promise<SendChatResponse> {
  const text = (await mentorGenerate(input.message, input.student_id)) ?? offlineTutor(input.message, getCoachLang());
  const upd = await buildStudentUpdate(input.student_id);
  return Promise.resolve({
    session_id: `off_${Date.now()}`,
    reply: text,
    module_trace: buildTrace(input.message),
    student_update: upd,
  });
}

export async function streamChat(
  input: SendChatRequest,
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const intent = detectChatIntent(input.message);
  // 讲解 / 讲义意图：走结构化讲解通道（云端优先 → 离线降级 → 讲义适配），
  // 其余（问导师 / 出题 / 训练 / 讲解题目）保持原 markdown 流式通道。
  if (intent === "explain" || intent === "lecture") {
    return streamExplain(input, handlers, signal);
  }
  const full =
    (await mentorGenerate(input.message, input.student_id)) ?? offlineTutor(input.message, getCoachLang());
  return streamMarkdown(input, full, handlers, signal);
}

/** 原始 markdown 流式通道（问导师 / 出题 / 训练 / 讲解题目）：打字机式分块 + 历史持久化。 */
async function streamMarkdown(
  input: SendChatRequest,
  full: string,
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const chunks = chunkText(full);
  for (const c of chunks) {
    if (signal?.aborted) {
      handlers.onError?.("已取消生成");
      return;
    }
    handlers.onDelta?.(c);
    await sleep(16);
  }
  const trace = buildTrace(input.message);
  handlers.onMeta?.({
    session_id: `off_${Date.now()}`,
    module_trace: trace,
    intent: "offline",
  });
  const upd = await buildStudentUpdate(input.student_id);
  handlers.onAssessment?.(upd);

  const hist = await SS.loadHistory(input.student_id);
  hist.push({ role: "user", content: input.message, created_at: new Date().toISOString() });
  hist.push({ role: "assistant", content: full, created_at: new Date().toISOString() });
  await SS.saveHistory(input.student_id, hist);
  await bumpPq(input.student_id, upd.pq);

  handlers.onDone?.({ session_id: `off_${Date.now()}` });
}

/**
 * 结构化讲解通道：经 explainChat 生成 PomosExplainV1（云端优先 → 离线降级 → 讲义适配），
 * 流式揭示标题（兼容旧测试「未中止时 onDelta 被调用」），并把 explain 持久化到历史。
 * 中止检查先于任何生成，保证回归 ②（abort 后 onError 被调用、onDelta 不被调用）。
 */
async function streamExplain(
  input: SendChatRequest,
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  // 中止检查先于任何生成（保证回归 ②）
  if (signal?.aborted) {
    handlers.onError?.("已取消生成");
    return;
  }
  const explain = await explainChat(
    { student_id: input.student_id, message: input.message },
    {
      onError: (d) => handlers.onError?.(d),
      onMeta: handlers.onMeta as ((m: unknown) => void) | undefined,
      onAssessment: handlers.onAssessment as ((u: unknown) => void) | undefined,
      onDone: handlers.onDone as (() => void) | undefined,
    },
    signal,
  );
  // 讲解生成失败（被中止 / 云端与离线均不可用）：回退原始离线教练 markdown 流
  if (!explain) {
    const full =
      (await mentorGenerate(input.message, input.student_id)) ??
      offlineTutor(input.message, getCoachLang());

    return streamMarkdown(input, full, handlers, signal);
  }
  // 流式揭示标题，保证 onDelta 被调用（回归 ⑤，兼容旧测试）
  handlers.onDelta?.(explain.title);
  // 结构化讲解已通过 explainChat 内部触发的 handlers.onExplain 交付
  //（page.tsx 据此把 explain 写入末尾导师气泡并渲染 ExplainCard），此处不再重复触发。
  const trace = buildTrace(input.message);
  handlers.onMeta?.({
    session_id: `off_${Date.now()}`,
    module_trace: trace,
    intent: explain.mode === "lecture" ? "lecture" : "explain",
  });
  const upd = await buildStudentUpdate(input.student_id);
  handlers.onAssessment?.(upd);

  const hist = await SS.loadHistory(input.student_id);
  hist.push({ role: "user", content: input.message, created_at: new Date().toISOString() });
  hist.push({
    role: "assistant",
    content: explain.title,
    created_at: new Date().toISOString(),
    explain,
  });
  await SS.saveHistory(input.student_id, hist);
  await bumpPq(input.student_id, upd.pq);

  handlers.onDone?.({ session_id: `off_${Date.now()}` });
}

export async function getDashboard(studentId: string): Promise<Dashboard> {
  const twin = await SS.loadTwin(studentId);
  const d = buildMockFromTwin(studentId, twin);
  const s = (await SS.loadStudents()).find((x) => x.student_id === studentId);
  return {
    student_id: studentId,
    name: s?.name || "学员",
    grade: s?.grade,
    pq: d.pq,
    radar: d.radar,
    growth_curve: d.growth_curve,
    twin: d.twin as unknown as NineDim[],
    weak_concepts: d.weak_concepts,
    recommendations: d.recommendations,
    board_mastery: d.board_mastery,
  };
}

export async function getTraining(studentId: string): Promise<TrainingPlan> {
  const twin = await SS.loadTwin(studentId);
  const d = buildMockFromTwin(studentId, twin);
  const gen = Gen.generateWeeklyTraining(d.twin, d.weak_concepts, []);
  return {
    weekly: gen.weekly,
    today: gen.today,
    rationale: gen.rationale,
  };
}

// ---------------------------------------------------------------- 生成 / 反馈（供视图直接调用）
export function getBugCategories(): BugCategory[] {
  return BUG_CATEGORIES;
}

export function generateCompetitionQuestion(board: Board, difficulty: number): Gen.GeneratedQuestion {
  return Gen.generateCompetitionQuestion(board, difficulty);
}

export function generateTrainingForNode(
  nodeName: string,
  board: Board,
  mastery: number,
): Gen.GeneratedTraining {
  return Gen.generateTrainingForNode(nodeName, board, mastery);
}

export function generateMistakeAnalysis(
  topic: string,
  summary: string,
  categoryId?: string,
): Gen.MistakeAnalysis {
  const cat = categoryId ? BUG_CATEGORIES.find((c) => c.id === categoryId) ?? null : null;
  return Gen.generateMistakeAnalysis(topic, summary, cat);
}

/** 完成某板块训练后回写九维增量并 bump PQ，返回最新评估。 */
export async function applyMasteryDelta(
  studentId: string,
  delta: Record<string, number>,
): Promise<StudentUpdate> {
  const twin = await SS.loadTwin(studentId);
  let changed = false;
  for (const d of twin) {
    if (delta[d.key] != null) {
      d.value = Number(clamp(d.value + delta[d.key], 0, 1).toFixed(3));
      changed = true;
    }
  }
  if (changed) await SS.saveTwin(studentId, twin);
  const d = buildMockFromTwin(studentId, twin);
  return {
    pq: d.pq,
    mastery_delta: delta,
    weak_concepts: d.weak_concepts,
    recommendations: d.recommendations,
  };
}

export async function getMistakes(studentId: string): Promise<Mistake[]> {
  return SS.loadMistakes(studentId);
}

export async function createMistake(studentId: string, data: MistakeCreate): Promise<Mistake> {
  const m: Mistake = {
    id: `mis_${Math.random().toString(36).slice(2, 10)}`,
    topic: data.topic,
    summary: data.summary,
    bug_id: data.bug_id ?? null,
    status: data.status || "未掌握",
    recurrence: 0,
    created_at: new Date().toISOString(),
    image_path: null,
    analysis: data.analysis ?? null,
  };
  await SS.saveMistake(m);
  return m;
}

export async function updateMistake(
  studentId: string,
  id: string,
  data: { status?: string; summary?: string; analysis?: string; bug_id?: string },
): Promise<Mistake> {
  const list = await SS.loadMistakes(studentId);
  const m = list.find((x) => x.id === id);
  if (!m) return Promise.reject(new Error("错题不存在（离线）"));
  if (data.status !== undefined) m.status = data.status;
  if (data.summary !== undefined) m.summary = data.summary;
  if (data.analysis !== undefined) m.analysis = data.analysis;
  if (data.bug_id !== undefined) m.bug_id = data.bug_id;
  await SS.saveMistake(m);
  return m;
}

export async function deleteMistake(studentId: string, id: string): Promise<{ ok: boolean }> {
  await SS.deleteMistakeById(id);
  return { ok: true };
}

export async function uploadMistakeImage(
  studentId: string,
  mistakeId: string,
  file: File,
): Promise<{ image_path: string }> {
  const dataUrl = await fileToDataURL(file);
  const list = await SS.loadMistakes(studentId);
  const m = list.find((x) => x.id === mistakeId);
  if (m) {
    m.image_path = dataUrl;
    await SS.saveMistake(m);
  }
  return { image_path: dataUrl };
}

export async function getChatHistory(studentId: string): Promise<{ messages: HistoryMessage[] }> {
  return { messages: await SS.loadHistory(studentId) };
}

export async function testConnection(): Promise<TestConnectionResponse> {
  const cfg = await getLlmConfig();
  if (!cfg) {
    return {
      ok: false,
      detail: "未配置 LLM 密钥（请在设置中填写，将回退本地生成）",
      mock_mode: true,
    };
  }
  try {
    const res = await fetch(`${cfg.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 5,
        stream: false,
      }),
    });
    if (!res.ok) {
      return { ok: false, detail: `连接失败：HTTP ${res.status}`, mock_mode: false };
    }
    return { ok: true, detail: "连接成功，云端 LLM 可用。", mock_mode: false };
  } catch (e) {
    return {
      ok: false,
      detail: `连接失败：${String(e)}（将回退本地生成）`,
      mock_mode: false,
    };
  }
}

export async function getSettings(): Promise<SettingsResponse> {
  const s = await SS.loadSettings();
  return {
    llm_provider: s.llm_provider,
    llm_base_url: s.llm_base_url,
    llm_model: s.llm_model,
    llm_temperature: s.llm_temperature,
    llm_max_tokens: s.llm_max_tokens,
    coach_language: s.coach_language,
    llm_api_key: "", // 不以明文返回（密钥仅在 IndexedDB 加密存储）
  };
}

const KEY_FIELDS = [
  "openai_api_key",
  "deepseek_api_key",
  "dashscope_api_key",
  "moonshot_api_key",
  "zhipu_api_key",
  "gemini_api_key",
  "anthropic_api_key",
  "llm_api_key",
];

export async function putSettings(data: Partial<SettingsResponse>): Promise<SettingsResponse> {
  const patch: Partial<SS.SettingsRecord> = {};
  if (data.llm_provider !== undefined) patch.llm_provider = data.llm_provider;
  if (data.llm_base_url !== undefined) patch.llm_base_url = data.llm_base_url;
  if (data.llm_model !== undefined) patch.llm_model = data.llm_model;
  if (data.llm_temperature !== undefined) patch.llm_temperature = data.llm_temperature;
  if (data.llm_max_tokens !== undefined) patch.llm_max_tokens = data.llm_max_tokens;
  if (data.coach_language !== undefined) patch.coach_language = data.coach_language;

  // 提取任意供应商密钥字段 → AES-GCM 加密存 IndexedDB
  let keyToSave: string | undefined;
  for (const k of KEY_FIELDS) {
    const v = (data as Record<string, unknown>)[k];
    if (typeof v === "string" && v.trim() && v.trim() !== "••••") {
      keyToSave = v.trim();
      break;
    }
  }
  if (keyToSave) await SS.saveLlmKeyEncrypted(keyToSave);

  await SS.saveSettings(patch);
  if (data.coach_language) lsSet(KEYS.lang, data.coach_language);
  return getSettings();
}

/** 生成四模块讲义（路由到 lecture，联网 LLM / 降级本地）。 */
export async function generateLecture(
  topic: string,
  ctx: { studentId?: string; knowledgePoint?: string; board?: string },
): Promise<Lecture.LectureResult> {
  return Lecture.generateLecture(topic, ctx);
}

// ---------------------------------------------------------------- 训练回写（板块 → 九维增量）
// 完成某板块训练后，返回应回写到九维（认知）孪生的正向增量。
// 增量权重取自 offlineGen.BOARD_WEIGHT（单一数据源），按权重归一后乘总增益，
// 保证每次训练对「板块相关维度」温和提升（0~1，单维 ≤ DELTA_GAIN），不会越过 1。
const DELTA_GAIN = 0.02; // 完成一次板块训练对 PB 相关维度的总增量上限

export function masteryDeltaForBoard(board: Board): Record<string, number> {
  const w: Record<string, number> = (Gen.BOARD_WEIGHT as Record<Board, Record<string, number>>)[board] ?? {};
  const wsum = Object.values(w).reduce((a, b) => a + b, 0) || 1;
  const out: Record<string, number> = {};
  for (const k of Object.keys(w)) {
    out[k] = Number((DELTA_GAIN * (w[k] / wsum)).toFixed(4));
  }
  return out;
}

// ================================================================ 内部辅助（供 api.ts 调用）
export async function buildStudentUpdate(studentId: string): Promise<StudentUpdate> {
  const twin = await SS.loadTwin(studentId);
  const d = buildMockFromTwin(studentId, twin);
  return {
    pq: Number(d.pq.toFixed(3)),
    mastery_delta: {},
    weak_concepts: d.weak_concepts,
    recommendations: d.recommendations,
  };
}
