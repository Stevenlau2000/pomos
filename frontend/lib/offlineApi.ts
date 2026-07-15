// lib/offlineApi.ts
// 离线模式实现：当后端不可达（如 GitHub Pages 静态托管）时，所有 API 调用路由到此模块。
//
// 设计：
// - 学生 / 错题 / 对话历史 / 设置 全部持久化在浏览器 localStorage。
// - 对话走内置「物理教练」启发式（移植自后端 llm.py 的 offline_tutor 知识库），
//   并按标点分块模拟打字机式流式输出。
// - 仪表盘 / 评估 / 训练计划 由确定性生成器基于学生标识产生稳定 mock 数据，
//   保证测试人员看到完整、合理的图表与画像。
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
  Readiness,
  SendChatRequest,
  SendChatResponse,
  SettingsResponse,
  Student,
  StudentUpdate,
  TestConnectionResponse,
  TrainingPlan,
  StreamHandlers,
} from "./api";

// ---------------------------------------------------------------- 存储工具
const KEYS = {
  students: "pomos_offline_students",
  mistakes: (id: string) => `pomos_offline_mistakes_${id}`,
  history: (id: string) => `pomos_offline_history_${id}`,
  settings: "pomos_offline_settings",
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

// ---------------------------------------------------------------- 物理知识库（移植自后端）
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
  { keys: ["流体", "伯努利", "fluids", "压强", "浮力", "bernoulli"], zh: "静力学 p=ρgh；阿基米德浮力=排开液重。\n• 伯努利 p+½ρv²+ρgh=const 沿流线守恒；连续性 S₁v₁=S₂v₂。\n先问：流动是否理想、定常、不可压缩？", q: "飞机升力能否仅靠‘流速大压强小’解释？环量起什么作用？" },
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

// ---------------------------------------------------------------- 学生存储
function ensureStudents(): Student[] {
  const raw = lsGet(KEYS.students);
  if (raw) {
    try {
      return JSON.parse(raw) as Student[];
    } catch {
      /* fallthrough */
    }
  }
  // 用当前本地会话（page.tsx 管理的 studentId / student）播种一个默认学生
  const id = lsGet("pomos_student_id") || "local-guest";
  let name = "小宇";
  let grade = "高二 · 物理竞赛";
  const sp = lsGet("pomos_student");
  if (sp) {
    try {
      const p = JSON.parse(sp);
      name = p.name || name;
      grade = p.grade || grade;
    } catch {
      /* ignore */
    }
  }
  const seed: Student[] = [
    { student_id: id, name, grade, created_at: new Date().toISOString(), pq: mockPq(id) },
  ];
  lsSet(KEYS.students, JSON.stringify(seed));
  return seed;
}

function saveStudents(list: Student[]): void {
  lsSet(KEYS.students, JSON.stringify(list));
}

function findStudent(id: string): Student | undefined {
  return ensureStudents().find((s) => s.student_id === id);
}

function mockPq(id: string): number {
  return Number((0.42 + makeRng(hashStr(id || "guest"))() * 0.45).toFixed(3));
}

function bumpPq(id: string, pq: number): void {
  const list = ensureStudents();
  const s = list.find((x) => x.student_id === id);
  if (s) {
    s.pq = Number(pq.toFixed(3));
    saveStudents(list);
  }
}

// ---------------------------------------------------------------- 对话历史
function getHistory(id: string): HistoryMessage[] {
  const raw = lsGet(KEYS.history(id));
  if (!raw) return [];
  try {
    return JSON.parse(raw) as HistoryMessage[];
  } catch {
    return [];
  }
}
function setHistory(id: string, msgs: HistoryMessage[]): void {
  lsSet(KEYS.history(id), JSON.stringify(msgs.slice(-200)));
}

// ---------------------------------------------------------------- 错题
function getMistakesStore(id: string): Mistake[] {
  const raw = lsGet(KEYS.mistakes(id));
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Mistake[];
  } catch {
    return [];
  }
}
function setMistakesStore(id: string, list: Mistake[]): void {
  lsSet(KEYS.mistakes(id), JSON.stringify(list));
}

function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("图片读取失败"));
    r.readAsDataURL(file);
  });
}

// ---------------------------------------------------------------- 设置
function getSettingsStore(): SettingsResponse {
  const raw = lsGet(KEYS.settings);
  const base: SettingsResponse = {
    llm_provider: "",
    llm_base_url: "",
    llm_model: "",
    llm_temperature: 0.7,
    llm_max_tokens: 1200,
    coach_language: "zh",
    cors_origins: "",
  };
  if (!raw) return base;
  try {
    return { ...base, ...(JSON.parse(raw) as SettingsResponse) };
  } catch {
    return base;
  }
}

// ---------------------------------------------------------------- 确定性 mock 数据
const NINE_DIMS: { key: string; label: string; hint: string }[] = [
  { key: "concept", label: "概念理解", hint: "对物理概念与本质的掌握程度" },
  { key: "modeling", label: "建模能力", hint: "把现实问题翻译为物理模型" },
  { key: "reasoning", label: "推理能力", hint: "因果演绎与逻辑链完整性" },
  { key: "calculation", label: "计算能力", hint: "数学求解与数值处理规范" },
  { key: "experiment", label: "实验探究", hint: "误差、图像与数据处理" },
  { key: "transfer", label: "迁移能力", hint: "跨情境类比与综合应用" },
  { key: "meta", label: "元认知", hint: "自我监控与错题反思" },
  { key: "competition", label: "竞赛素养", hint: "竞赛策略与压轴题经验" },
  { key: "growth", label: "成长态势", hint: "持续训练与提升趋势" },
];
const BOARDS = ["力学", "电磁学", "热学", "光学", "近代物理"];
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
  "整理电磁感应中‘阻碍’的三种典型情形",
  "用图像法复盘一道热力学循环题",
  "每天 15 分钟口述一道题的物理图像",
  "针对薄弱板块做错题归因，标注 bug 类型",
];

interface MockData {
  pq: number;
  radar: PqRadar;
  growth_curve: GrowthPoint[];
  readiness: Readiness;
  twin: NineDim[];
  weak_concepts: string[];
  recommendations: string[];
  board_mastery: Record<string, number>;
}
const mockCache = new Map<string, MockData>();

function mockDashboard(id: string): MockData {
  const cached = mockCache.get(id);
  if (cached) return cached;
  const rng = makeRng(hashStr(id || "guest"));
  const pq = 0.42 + rng() * 0.45;
  const dim = () => Number((0.3 + rng() * 0.65).toFixed(3));
  const radar: PqRadar = {
    knowledge: dim(),
    modeling: dim(),
    scientific_thinking: dim(),
    transfer: dim(),
    competition: dim(),
    growth: dim(),
  };
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
  const readiness: Readiness = {
    province_top: Number((0.4 + rng() * 0.5).toFixed(3)),
    province_team: Number((0.3 + rng() * 0.5).toFixed(3)),
    ipho: Number((0.15 + rng() * 0.45).toFixed(3)),
  };
  const twin: NineDim[] = NINE_DIMS.map((d) => ({
    key: d.key,
    label: d.label,
    value: dim(),
    hint: d.hint,
  }));
  const board_mastery: Record<string, number> = {};
  for (const b of BOARDS) board_mastery[b] = Number((0.3 + rng() * 0.6).toFixed(3));
  const data: MockData = {
    pq: Number(pq.toFixed(3)),
    radar,
    growth_curve,
    readiness,
    twin,
    weak_concepts: sample(WEAK_POOL, 2 + Math.floor(rng() * 2), rng),
    recommendations: sample(REC_POOL, 3, rng),
    board_mastery,
  };
  mockCache.set(id, data);
  return data;
}

function mockTraining(id: string): TrainingPlan {
  const rng = makeRng(hashStr(id || "guest") + 7);
  const focuses = ["力学建模", "电磁综合", "热学循环", "波动光学", "近代物理", "竞赛策略"];
  const weekly = Array.from({ length: 4 }, (_, w) => ({
    week: w + 1,
    focus: focuses[Math.floor(rng() * focuses.length)],
    items: sample(REC_POOL, 3, rng),
    load: 4 + Math.floor(rng() * 6),
  }));
  const today: DailyPlan[] = [
    { time: "19:00", task: "专题训练：转动参考系", type: "练习", priority: 1 },
    { time: "20:00", task: "复盘今日错题，标注 bug 类型", type: "反思", priority: 2 },
    { time: "20:40", task: "口述一道题的物理图像（15 min）", type: "输出", priority: 3 },
  ];
  return {
    weekly,
    today,
    rationale: "基于离线评估画像生成：优先补齐薄弱板块，保持每日输出以固化直觉。",
  };
}

// ================================================================ 导出 API（与 api.ts 同签名）
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

export function createStudent(input: CreateStudentRequest): Promise<Student> {
  const list = ensureStudents();
  const stu: Student = {
    student_id: `stu_${Math.random().toString(36).slice(2, 10)}`,
    name: input.name,
    grade: input.grade || "",
    created_at: new Date().toISOString(),
    pq: mockPq(`stu_${input.name}`),
  };
  list.push(stu);
  saveStudents(list);
  return Promise.resolve(stu);
}

export function getStudents(): Promise<Student[]> {
  return Promise.resolve(ensureStudents());
}

export function deleteStudent(studentId: string): Promise<{ ok: boolean }> {
  const list = ensureStudents().filter((s) => s.student_id !== studentId);
  saveStudents(list);
  lsSet(KEYS.mistakes(studentId), "[]");
  lsSet(KEYS.history(studentId), "[]");
  return Promise.resolve({ ok: true });
}

export function updateStudent(
  studentId: string,
  data: { name?: string; grade?: string },
): Promise<Student> {
  const list = ensureStudents();
  const s = list.find((x) => x.student_id === studentId);
  if (!s) return Promise.reject(new Error("学生不存在（离线）"));
  if (data.name !== undefined) s.name = data.name;
  if (data.grade !== undefined) s.grade = data.grade;
  saveStudents(list);
  return Promise.resolve(s);
}

export function sendChat(input: SendChatRequest): Promise<SendChatResponse> {
  const text = offlineTutor(input.message, getCoachLang());
  return Promise.resolve({
    session_id: `off_${Date.now()}`,
    reply: text,
    module_trace: buildTrace(input.message),
    student_update: buildStudentUpdate(input.student_id),
  });
}

export async function streamChat(
  input: SendChatRequest,
  handlers: StreamHandlers,
): Promise<void> {
  const lang = getCoachLang();
  const full = offlineTutor(input.message, lang);
  const chunks = chunkText(full);
  for (const c of chunks) {
    handlers.onDelta?.(c);
    await sleep(16);
  }
  const trace = buildTrace(input.message);
  handlers.onMeta?.({
    session_id: `off_${Date.now()}`,
    module_trace: trace,
    intent: "offline",
  });
  const upd = buildStudentUpdate(input.student_id);
  handlers.onAssessment?.(upd);

  const hist = getHistory(input.student_id);
  hist.push({ role: "user", content: input.message, created_at: new Date().toISOString() });
  hist.push({ role: "assistant", content: full, created_at: new Date().toISOString() });
  setHistory(input.student_id, hist);
  bumpPq(input.student_id, upd.pq);

  handlers.onDone?.({ session_id: `off_${Date.now()}` });
}

export function getDashboard(studentId: string): Promise<Dashboard> {
  const d = mockDashboard(studentId);
  const s = findStudent(studentId);
  return Promise.resolve({
    student_id: studentId,
    name: s?.name || "学员",
    grade: s?.grade,
    pq: d.pq,
    radar: d.radar,
    growth_curve: d.growth_curve,
    readiness: d.readiness,
    twin: d.twin,
    weak_concepts: d.weak_concepts,
    recommendations: d.recommendations,
    board_mastery: d.board_mastery,
  });
}

export function getTraining(studentId: string): Promise<TrainingPlan> {
  return Promise.resolve(mockTraining(studentId));
}

export function getMistakes(studentId: string): Promise<Mistake[]> {
  return Promise.resolve(getMistakesStore(studentId));
}

export function createMistake(studentId: string, data: MistakeCreate): Promise<Mistake> {
  const list = getMistakesStore(studentId);
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
  list.unshift(m);
  setMistakesStore(studentId, list);
  return Promise.resolve(m);
}

export function updateMistake(
  studentId: string,
  id: string,
  data: { status?: string; summary?: string; analysis?: string },
): Promise<Mistake> {
  const list = getMistakesStore(studentId);
  const m = list.find((x) => x.id === id);
  if (!m) return Promise.reject(new Error("错题不存在（离线）"));
  if (data.status !== undefined) m.status = data.status;
  if (data.summary !== undefined) m.summary = data.summary;
  if (data.analysis !== undefined) m.analysis = data.analysis;
  setMistakesStore(studentId, list);
  return Promise.resolve(m);
}

export function deleteMistake(studentId: string, id: string): Promise<{ ok: boolean }> {
  const list = getMistakesStore(studentId).filter((x) => x.id !== id);
  setMistakesStore(studentId, list);
  return Promise.resolve({ ok: true });
}

export async function uploadMistakeImage(
  studentId: string,
  mistakeId: string,
  file: File,
): Promise<{ image_path: string }> {
  const dataUrl = await fileToDataURL(file);
  const list = getMistakesStore(studentId);
  const m = list.find((x) => x.id === mistakeId);
  if (m) {
    m.image_path = dataUrl;
    setMistakesStore(studentId, list);
  }
  return { image_path: dataUrl };
}

export function getChatHistory(studentId: string): Promise<{ messages: HistoryMessage[] }> {
  return Promise.resolve({ messages: getHistory(studentId) });
}

export function testConnection(): Promise<TestConnectionResponse> {
  return Promise.resolve({
    ok: false,
    detail:
      "离线演示模式：未连接后端。如需真实 AI 辅导，请将后端部署到可访问地址，并设置 NEXT_PUBLIC_API_BASE 后重新部署。",
    mock_mode: true,
  });
}

export function getSettings(): Promise<SettingsResponse> {
  return Promise.resolve(getSettingsStore());
}

export function putSettings(data: Partial<SettingsResponse>): Promise<SettingsResponse> {
  const merged = { ...getSettingsStore(), ...data };
  lsSet(KEYS.settings, JSON.stringify(merged));
  if (data.coach_language) lsSet(KEYS.lang, data.coach_language);
  return Promise.resolve(merged);
}

// ================================================================ 内部辅助（供 api.ts 调用）
export function buildStudentUpdate(studentId: string): StudentUpdate {
  const d = mockDashboard(studentId);
  const rng = makeRng(hashStr(studentId) + 13);
  const pq = clamp(d.pq + 0.008 + rng() * 0.02);
  return {
    pq: Number(pq.toFixed(3)),
    mastery_delta: {},
    weak_concepts: d.weak_concepts,
    recommendations: d.recommendations,
  };
}
