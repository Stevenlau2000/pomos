// lib/explain/validate.ts
// 容错校验：把任意输入收敛为合法的 PomosExplainV1，或返回 null（由调用方降级）。
// 全程纯函数，无副作用，可在 Node 单测。
import {
  EXPLAIN_PHASES,
  type ExplainPhase,
  type DiagramKind,
  type AnimationType,
  type DiagramSpec,
  type AnimationSpec,
  type ExplainStep,
  type PomosExplainV1,
} from "./types";

const PHASE_SET = new Set<string>(EXPLAIN_PHASES as readonly string[]);
const DIAGRAM_KINDS: DiagramKind[] = [
  "force",
  "trajectory",
  "vt",
  "circuit",
  "light",
  "pv",
  "wave",
  "mermaid",
];
const ANIMATION_TYPES: AnimationType[] = [
  "projectile",
  "uniform-motion",
  "wave",
  "charge-in-field",
  "refraction",
];

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function asStr(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}
function asStrArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
}
/** 把任意东西收敛成有限数字（clamp 到 [lo, hi]），用于动画参数白名单 + 范围。 */
export function clampNum(v: unknown, lo: number, hi: number, fallback: number): number {
  const n = typeof v === "number" && Number.isFinite(v) ? v : fallback;
  return Math.max(lo, Math.min(hi, n));
}

/** 校验图表 spec；非法 kind 返回 null（ExplainCard 据此跳过渲染）。 */
export function validateDiagramSpec(raw: unknown): DiagramSpec | null {
  if (!isObj(raw)) return null;
  const kind = raw.kind as DiagramKind;
  if (!DIAGRAM_KINDS.includes(kind)) return null;
  const spec = isObj(raw.spec) ? raw.spec : {};
  return {
    kind,
    spec,
    caption: typeof raw.caption === "string" ? raw.caption : undefined,
  };
}

/** 校验动画 spec；未知 type / 缺失关键参数时返回 null（播放器保底首帧）。 */
export function validateAnimationSpec(raw: unknown): AnimationSpec | null {
  if (!isObj(raw)) return null;
  const type = raw.type as AnimationType;
  if (!ANIMATION_TYPES.includes(type)) return null;
  const paramsRaw = isObj(raw.params) ? raw.params : {};
  // 把 params 收敛成 number | string，并对数值做默认 clamp（避免 NaN / 无限）
  const params: Record<string, number | string> = {};
  for (const [k, v] of Object.entries(paramsRaw)) {
    if (typeof v === "number") params[k] = Number.isFinite(v) ? v : 0;
    else if (typeof v === "string") params[k] = v;
  }
  return {
    type,
    params,
    durationMs: typeof raw.durationMs === "number" ? clampNum(raw.durationMs, 200, 60000, 2000) : undefined,
    caption: typeof raw.caption === "string" ? raw.caption : undefined,
  };
}

function resolvePhase(raw: unknown, index: number): ExplainPhase {
  if (typeof raw === "string" && PHASE_SET.has(raw)) return raw as ExplainPhase;
  // 容错：用下标映射到六阶段顺序
  return EXPLAIN_PHASES[index % EXPLAIN_PHASES.length];
}

function validateStep(raw: unknown, index: number): ExplainStep | null {
  if (!isObj(raw)) return null;
  const id = asStr(raw.id, `s${index + 1}`);
  const phase = resolvePhase(raw.phase, index);
  const heading = asStr(raw.heading, `第 ${index + 1} 步`);
  const text = asStr(raw.text);
  if (!text) return null; // 文本为空视为无效 step
  const diagram = raw.diagram == null ? null : validateDiagramSpec(raw.diagram);
  const animation = raw.animation == null ? null : validateAnimationSpec(raw.animation);
  const mcRaw = raw.misconception;
  const misconception = mcRaw == null ? null : asStr(mcRaw, "") || null;
  const sourceRefs = Array.isArray(raw.sourceRefs) ? asStrArr(raw.sourceRefs) : undefined;
  return {
    id,
    phase,
    heading,
    text,
    formulas: Array.isArray(raw.formulas) ? asStrArr(raw.formulas) : undefined,
    diagram,
    animation,
    misconception,
    sourceRefs,
  };
}

/**
 * 对外主校验：把任意 JSON 收敛为 PomosExplainV1。
 * 返回 null 表示整体不可用（调用方应降级到离线同构结构）。
 */
export function validateExplain(raw: unknown): PomosExplainV1 | null {
  if (!isObj(raw)) return null;
  if (asStr(raw.schema_version) !== "1.0") return null;
  const title = asStr(raw.title, "物理讲解");
  const modeRaw = raw.mode;
  const mode: "cloud" | "offline" | "lecture" =
    modeRaw === "cloud" || modeRaw === "offline" || modeRaw === "lecture"
      ? (modeRaw as "cloud" | "offline" | "lecture")
      : "offline";
  if (!Array.isArray(raw.steps)) return null;
  const steps: ExplainStep[] = [];
  for (let i = 0; i < raw.steps.length; i++) {
    const s = validateStep(raw.steps[i], i);
    if (s) steps.push(s);
  }
  if (steps.length === 0) return null;
  const sources = Array.isArray(raw.sources) ? asStrArr(raw.sources) : undefined;
  const offlineFallback = typeof raw.offline_fallback === "boolean" ? raw.offline_fallback : undefined;
  return {
    schema_version: "1.0",
    title,
    mode,
    steps,
    sources,
    offline_fallback: offlineFallback,
  };
}

/**
 * 从可能夹带说明文本的字符串里截取首个平衡 {...} JSON。
 * 兼顾混元可能返回的前导说明文字；解析失败返回 null。
 */
export function extractJsonObject(text: string): string | null {
  if (typeof text !== "string") return null;
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (ch === "\\") {
      esc = true;
      continue;
    }
    if (ch === '"') {
      inStr = !inStr;
      continue;
    }
    if (inStr) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}
