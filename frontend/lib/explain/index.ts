// lib/explain/index.ts
// 编排层对外入口：意图识别 + 统一生成（云端优先 → 离线降级）+ 对话通道。
//
// 关键路由依据（架构 §0 澄清）：generateExplain 是否走云端，由
//   isConfigured()（密钥在 IndexedDB）+ navigator.onLine
// 决定，而「非」 MODE / isStaticHost()。
// 即 GitHub Pages 静态托管下，只要用户配了混元密钥且联网，
// 浏览器仍直接调云端讲解——「后端不可达」≠「云端 LLM 不可用」。
export type ChatIntent =
  | "explain"
  | "lecture"
  | "question"
  | "training"
  | "explain_problem";

export { EXPLAIN_MAX_TOKENS } from "./maps";
// 本地使用需单独 import（re-export 的 `from` 形式只生成导出别名，不引入模块内绑定）。
import { validateExplain } from "./validate";
export { validateExplain, validateAnimationSpec, validateDiagramSpec, extractJsonObject, clampNum } from "./validate";
export { EXPLAIN_PHASES } from "./types";
export type {
  PomosExplainV1,
  ExplainStep,
  DiagramSpec,
  AnimationSpec,
  ExplainPhase,
  DiagramKind,
  AnimationType,
  DiagramProps,
  AnimationProps,
} from "./types";

import { getLlmConfig } from "../llm";
import { callCloudExplain } from "./cloud";
import { generateExplainOffline } from "./offline";
import { generateLectureExplain } from "./lectureAdapter";
import type { PomosExplainV1 } from "./types";

const LECTURE_RE = /生成讲义[:：]\s*([^\n]+)/;
const EXPLAIN_PROBLEM_RE = /讲解这道题/;
const HAS_REFERENCE_RE = /参考答案要点/;
const TRAINING_RE = /训练计划|针对性训练|生成训练|训练方案|训练建议/;
const QUESTION_RE = /出题|生成题目|给我一道|来道题|练一道|一道题|考题|押一道/;

/** 意图识别（单一数据源，供 api.ts / offlineApi.ts 路由）。 */
export function detectChatIntent(message: string): ChatIntent {
  const text = message || "";
  if (LECTURE_RE.test(text)) return "lecture";
  if (EXPLAIN_PROBLEM_RE.test(text) && HAS_REFERENCE_RE.test(text)) return "explain_problem";
  if (TRAINING_RE.test(text)) return "training";
  if (QUESTION_RE.test(text)) return "question";
  return "explain"; // 普通问导师问题 → 结构化详细讲解
}

/** 统一生成：云端优先 → 离线降级，产出同构 PomosExplainV1。 */
export async function generateExplain(
  message: string,
  studentId: string,
  signal?: AbortSignal,
): Promise<PomosExplainV1> {
  const cfg = await getLlmConfig();
  const online = !!cfg && (typeof navigator === "undefined" || navigator.onLine !== false);
  if (online && cfg) {
    try {
      const cloud = await callCloudExplain(message, cfg, signal);
      const v = validateExplain(cloud);
      if (v) return { ...v, mode: "cloud", offline_fallback: false };
    } catch {
      /* 降级到离线 */
    }
  }
  const offline = await generateExplainOffline(message, studentId);
  return { ...offline, mode: "offline", offline_fallback: online };
}

/** 对话通道版：驱动 handlers.onExplain，并透传 onError。元信息 / 评估 / 历史由调用方（offlineApi）补齐。
 *  同时返回生成的结构化讲解（成功时），便于调用方直接消费、避免闭包捕获收窄问题。 */
export async function explainChat(
  input: { student_id: string; message: string },
  handlers: {
    onExplain?: (e: PomosExplainV1) => void;
    onError?: (d: string) => void;
    onMeta?: (m: unknown) => void;
    onAssessment?: (u: unknown) => void;
    onDone?: (m: unknown) => void;
  },
  signal?: AbortSignal,
): Promise<PomosExplainV1 | null> {
  const intent = detectChatIntent(input.message);
  try {
    let explain: PomosExplainV1;
    if (intent === "lecture") {
      const m = input.message.match(LECTURE_RE);
      const topic = m ? m[1].trim() : input.message;
      explain = await generateLectureExplain(topic, { studentId: input.student_id });
    } else {
      explain = await generateExplain(input.message, input.student_id, signal);
    }
    handlers.onExplain?.(explain);
    return explain;
  } catch (e) {
    handlers.onError?.(e instanceof Error ? e.message : String(e));
    return null;
  }
}
