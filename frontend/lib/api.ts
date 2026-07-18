// lib/api.ts
// 类型化的 API 客户端：与 POMOS 后端契约对齐。
// 所有函数返回 Promise<T>，base URL 取 NEXT_PUBLIC_API_BASE 或默认 http://localhost:8000。
//
// 离线模式：当后端不可达（如 GitHub Pages 静态托管）时，调用自动路由到
// lib/offlineApi.ts —— 在浏览器内用物理教练启发式 + localStorage 提供完整演示。
// 由 detectApiMode() 在应用启动时探测 /api/health 决定 MODE。

import * as offline from "./offlineApi";
import type { GeneratedQuestion, GeneratedTraining, MistakeAnalysis } from "./offlineGen";
import type { Board, BugCategory } from "./physicsKB";

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

// ---------------------------------------------------------------- 离线模式路由
export type ApiMode = "online" | "offline";
let MODE: ApiMode = "online";

export function setApiMode(m: ApiMode): void {
  MODE = m;
}
export function getApiMode(): ApiMode {
  return MODE;
}

/** 探测后端健康状态，决定 online / offline 模式。失败（网络错误 / 非 2xx）即回退离线。 */
export async function detectApiMode(): Promise<ApiMode> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch(`${API_BASE}/api/health`, { signal: ctrl.signal });
    clearTimeout(timer);
    MODE = res.ok ? "online" : "offline";
  } catch {
    MODE = "offline";
  }
  return MODE;
}

function offlineMode(): boolean {
  return MODE === "offline";
}

// ---------- 类型定义（与后端契约一致） ----------

/** 健康检查返回 */
export interface HealthResponse {
  status: string;
  version: string;
  runtime: string;
  modules_loaded: number;
  llm_provider: string;
  llm_model: string;
  mock_mode: boolean;
}

/** 学生画像（Student Twin） */
export interface Student {
  student_id: string;
  name: string;
  created_at: string;
  /** 可选扩展字段 */
  grade?: string;
  pq?: number;
  [key: string]: unknown;
}

/** 创建学生请求体 */
export interface CreateStudentRequest {
  name: string;
  grade?: string;
}

/** 单个推理模块轨迹 */
export interface ModuleTrace {
  module: string;
  action: string;
  ts: string;
}

/** 学生能力更新 */
export interface StudentUpdate {
  pq: number;
  mastery_delta: Record<string, number>;
  weak_concepts?: string[];
  recommendations?: string[];
}

/** 发送对话请求体 */
export interface SendChatRequest {
  student_id: string;
  message: string;
  session_id?: string;
}

/** 发送对话返回 */
export interface SendChatResponse {
  session_id: string;
  reply: string;
  module_trace: ModuleTrace[];
  student_update: StudentUpdate | null;
}

/** PQ 雷达六维 */
export interface PqRadar {
  knowledge: number;
  modeling: number;
  scientific_thinking: number;
  transfer: number;
  competition: number;
  growth: number;
}

/** 学习曲线单点 */
export interface GrowthPoint {
  ts: string;
  pq: number;
}

/** 备赛就绪度 */
export interface Readiness {
  province_top: number;
  province_team: number;
  ipho: number;
}

/** 九维画像单维（后端返回 0~1 归一化） */
export interface NineDim {
  key: string;
  label: string;
  value: number;
  hint: string;
}

/** 仪表盘聚合（总览/孪生/诊断/图谱共用） */
export interface Dashboard {
  student_id: string;
  name: string;
  grade?: string;
  pq: number; // 0~1
  radar: PqRadar; // 0~1
  growth_curve: GrowthPoint[]; // pq 0~1
  readiness: Readiness; // 0~1
  twin: NineDim[];
  weak_concepts: string[];
  recommendations: string[];
  board_mastery: Record<string, number>; // 0~1
}

/** 训练计划：周计划 + 今日规划 */
export interface TrainingWeek {
  week: number;
  focus: string;
  items: string[];
  load: number;
}

export interface DailyPlan {
  time: string;
  task: string;
  type: string;
  priority: number;
}

export interface TrainingPlan {
  weekly: TrainingWeek[];
  today: DailyPlan[];
  rationale: string;
}

/** 错题本条目 */
export interface Mistake {
  id: string;
  topic: string;
  summary: string;
  bug_id?: string | null;
  status: string;
  recurrence: number;
  created_at: string;
  image_path?: string | null;
  analysis?: string | null;
}

export interface MistakeCreate {
  topic: string;
  summary: string;
  bug_id?: string;
  status?: string;
  analysis?: string;
}

// ---------- 底层 fetch 封装 ----------

/** 请求去重缓存：同 key 并行请求共享同一 Promise，避免重复发相同请求。 */
const _requestCache = new Map<string, Promise<unknown>>();

function _cacheKey(path: string, init?: RequestInit): string {
  const method = init?.method ?? "GET";
  const body = typeof init?.body === "string" ? init.body : JSON.stringify(init?.body ?? "");
  return `${method}:${path}:${body}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // 若调用方通过 X-No-Cache 头要求绕过缓存，直接发起网络请求
  const noCache = init?.headers &&
    typeof init.headers === "object" &&
    !Array.isArray(init.headers) &&
    "X-No-Cache" in (init.headers as Record<string, string>);

  if (!noCache) {
    const key = _cacheKey(path, init);
    const pending = _requestCache.get(key);
    if (pending) {
      return pending as Promise<T>;
    }
    const promise = _doFetch<T>(path, init);
    _requestCache.set(key, promise);
    // 无论成功失败，请求结束后清除缓存
    promise.finally(() => {
      _requestCache.delete(key);
    });
    return promise;
  }

  return _doFetch<T>(path, init);
}

async function _doFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    throw new Error(`请求失败 ${res.status}: ${path}`);
  }
  return (await res.json()) as T;
}

// ---------- 导出 API ----------

/** 健康检查 */
export function getHealth(): Promise<HealthResponse> {
  if (offlineMode()) return offline.getHealth();
  return request<HealthResponse>("/api/health");
}

/** 创建学生 */
export function createStudent(input: CreateStudentRequest): Promise<Student> {
  if (offlineMode()) return offline.createStudent(input);
  return request<Student>("/api/students", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** 列出所有学生（供学生切换器） */
export function getStudents(): Promise<Student[]> {
  if (offlineMode()) return offline.getStudents();
  return request<Student[]>("/api/students");
}

/** 删除学生（软删，级联清理其数据） */
export function deleteStudent(studentId: string): Promise<{ ok: boolean }> {
  if (offlineMode()) return offline.deleteStudent(studentId);
  return request<{ ok: boolean }>(`/api/students/${encodeURIComponent(studentId)}`, {
    method: "DELETE",
  });
}

/** 发送对话消息 */
export function sendChat(input: SendChatRequest): Promise<SendChatResponse> {
  if (offlineMode()) return offline.sendChat(input);
  return request<SendChatResponse>("/api/chat", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// ---------- SSE 流式对话 ----------
// 后端 /api/chat/stream 以 Server-Sent Events 逐字推送导师回复。

/** 流式事件类型（与后端 stream_orchestrator 事件对齐） */
export type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "meta"; session_id: string; module_trace: ModuleTrace[]; intent?: string }
  | { type: "assessment"; student_update: StudentUpdate }
  | { type: "done"; session_id: string }
  | { type: "error"; detail: string };

/** 流式事件回调 */
export interface StreamHandlers {
  onDelta?: (text: string) => void;
  onMeta?: (meta: { session_id: string; module_trace: ModuleTrace[]; intent?: string }) => void;
  onAssessment?: (u: StudentUpdate) => void;
  onDone?: (meta: { session_id: string }) => void;
  onError?: (detail: string) => void;
}

/** 发起流式对话，手动解析 SSE 流（EventSource 仅支持 GET，故用 fetch + ReadableStream）。
 *
 * @param signal - 可选的 AbortSignal，用于从外部中止流式连接（如切视图时）。
 *                 调用方可传入 AbortController.signal 统一管理多个连接的生命周期。
 */
export async function streamChat(
  input: SendChatRequest,
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  if (offlineMode()) return offline.streamChat(input, handlers, signal);

  const res = await fetch(`${API_BASE}/api/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal,
  });
  if (!res.ok || !res.body) {
    handlers.onError?.(`请求失败 ${res.status}`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const raw = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      let event = "message";
      const dataLines: string[] = [];
      for (const line of raw.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      }
      const data = dataLines.join("\n");
      if (!data) continue;
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(data) as Record<string, unknown>;
      } catch {
        continue;
      }
      if (event === "delta") handlers.onDelta?.(String(payload.text ?? ""));
      else if (event === "meta")
        handlers.onMeta?.(payload as unknown as {
          session_id: string;
          module_trace: ModuleTrace[];
          intent?: string;
        });
      else if (event === "assessment")
        handlers.onAssessment?.(payload.student_update as StudentUpdate);
      else if (event === "done") handlers.onDone?.(payload as { session_id: string });
      else if (event === "error") handlers.onError?.(String(payload.detail ?? "stream error"));
    }
  }
}

/** 更新学生画像（姓名 / 年级） */
export function updateStudent(
  studentId: string,
  data: { name?: string; grade?: string },
): Promise<Student> {
  if (offlineMode()) return offline.updateStudent(studentId, data);
  return request<Student>(`/api/students/${encodeURIComponent(studentId)}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/** 对话历史单条 */
export interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

/** 获取对话历史 */
export function getChatHistory(studentId: string): Promise<{ messages: HistoryMessage[] }> {
  if (offlineMode()) return offline.getChatHistory(studentId);
  return request<{ messages: HistoryMessage[] }>(
    `/api/chat/history?student_id=${encodeURIComponent(studentId)}`,
  );
}

/** 获取聚合仪表盘数据（总览/孪生/诊断/图谱共用） */
export function getDashboard(studentId: string): Promise<Dashboard> {
  if (offlineMode()) return offline.getDashboard(studentId);
  return request<Dashboard>(`/api/students/${encodeURIComponent(studentId)}/dashboard`);
}

/** 获取个性化训练计划 */
export function getTraining(studentId: string): Promise<TrainingPlan> {
  if (offlineMode()) return offline.getTraining(studentId);
  return request<TrainingPlan>(`/api/students/${encodeURIComponent(studentId)}/training`);
}

// ---------- 浏览器内生成引擎（离线 / 无后端时由前端真实生成） ----------
export function getBugCategories(): BugCategory[] {
  return offline.getBugCategories();
}
export function generateCompetitionQuestion(board: Board, difficulty: number): GeneratedQuestion {
  return offline.generateCompetitionQuestion(board, difficulty);
}
export function generateTrainingForNode(
  nodeName: string,
  board: Board,
  mastery: number,
): GeneratedTraining {
  return offline.generateTrainingForNode(nodeName, board, mastery);
}
export function generateMistakeAnalysis(
  topic: string,
  summary: string,
  categoryId?: string,
): MistakeAnalysis {
  return offline.generateMistakeAnalysis(topic, summary, categoryId);
}
export function applyMasteryDelta(
  studentId: string,
  delta: Record<string, number>,
): Promise<StudentUpdate> {
  // 后端暂未实现该端点；离线生成引擎直接回写九维孪生
  return Promise.resolve(offline.applyMasteryDelta(studentId, delta));
}
export function getTwin(studentId: string): Promise<NineDim[]> {
  return Promise.resolve(offline.getTwin(studentId));
}
export function masteryDeltaForBoard(board: Board): Record<string, number> {
  return offline.masteryDeltaForBoard(board);
}

/** 获取错题本 */
export function getMistakes(studentId: string): Promise<Mistake[]> {
  if (offlineMode()) return offline.getMistakes(studentId);
  return request<Mistake[]>(`/api/students/${encodeURIComponent(studentId)}/mistakes`);
}

/** 新增错题 */
export function createMistake(studentId: string, data: MistakeCreate): Promise<Mistake> {
  if (offlineMode()) return offline.createMistake(studentId, data);
  return request<Mistake>(`/api/students/${encodeURIComponent(studentId)}/mistakes`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/** 更新错题（状态/摘要/解析） */
export function updateMistake(
  studentId: string,
  id: string,
  data: { status?: string; summary?: string; analysis?: string; bug_id?: string },
): Promise<Mistake> {
  if (offlineMode()) return offline.updateMistake(studentId, id, data);
  return request<Mistake>(
    `/api/students/${encodeURIComponent(studentId)}/mistakes/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(data) },
  );
}

/** 上传错题题目原图，返回可访问的相对 URL（multipart，不经过 JSON 封装） */
export function uploadMistakeImage(
  studentId: string,
  mistakeId: string,
  file: File,
): Promise<{ image_path: string }> {
  if (offlineMode()) return offline.uploadMistakeImage(studentId, mistakeId, file);
  const form = new FormData();
  form.append("file", file);
  return new Promise((resolve, reject) => {
    fetch(
      `${API_BASE}/api/students/${encodeURIComponent(studentId)}/mistakes/${encodeURIComponent(mistakeId)}/image`,
      { method: "POST", body: form },
    )
      .then(async (res) => {
        if (!res.ok) {
          reject(new Error(`上传失败 ${res.status}`));
          return;
        }
        resolve((await res.json()) as { image_path: string });
      })
      .catch(reject);
  });
}

/** 删除错题 */
export function deleteMistake(studentId: string, id: string): Promise<{ ok: boolean }> {
  if (offlineMode()) return offline.deleteMistake(studentId, id);
  return request<{ ok: boolean }>(
    `/api/students/${encodeURIComponent(studentId)}/mistakes/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}

/** 测试当前 LLM 连接 */
export interface TestConnectionResponse {
  ok: boolean;
  detail: string;
  mock_mode: boolean;
}

export function testConnection(): Promise<TestConnectionResponse> {
  if (offlineMode()) return offline.testConnection();
  return request<TestConnectionResponse>("/api/settings/test", { method: "POST" });
}

// ---------- 运行时设置（前端设置面板） ----------

/** 后端配置快照（密钥已脱敏） */
export interface SettingsResponse {
  openai_api_key?: string;
  deepseek_api_key?: string;
  dashscope_api_key?: string;
  moonshot_api_key?: string;
  zhipu_api_key?: string;
  gemini_api_key?: string;
  anthropic_api_key?: string;
  llm_provider?: string;
  llm_base_url?: string;
  llm_api_key?: string;
  llm_model?: string;
  llm_temperature?: number;
  llm_max_tokens?: number;
  coach_language?: string;
  cors_origins?: string;
}

/** 读取当前后端配置（密钥脱敏） */
export function getSettings(): Promise<SettingsResponse> {
  if (offlineMode()) return offline.getSettings();
  return request<SettingsResponse>("/api/settings");
}

/** 保存配置（仅传入需更新的字段） */
export function putSettings(data: Partial<SettingsResponse>): Promise<SettingsResponse> {
  if (offlineMode()) return offline.putSettings(data);
  return request<SettingsResponse>("/api/settings", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}
