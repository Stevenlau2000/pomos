// lib/explain/cloud.ts
// 云端讲解：组装 prompt → 调 llm.chatCompletion(maxTokens = 2000) → 容错截取 JSON → 校验。
// 任何失败（未配置 / 离线 / 超时 / 非 2xx / 半截 JSON / 字段缺失）均抛错，
// 由 generateExplain 统一降级到离线同构结构。
import { getLlmConfig, chatCompletion, type LlmOpts } from "../llm";
import { validateExplain, extractJsonObject } from "./validate";
import { EXPLAIN_MAX_TOKENS } from "./maps";
import type { PomosExplainV1 } from "./types";

const SYSTEM_PROMPT = `你是 POMOS 物理竞赛导师。针对学生的提问，输出结构化详细讲解。
严格只输出一个 JSON 对象（不要任何额外说明文字），符合以下 TypeScript 类型：
{
  "schema_version": "1.0",
  "title": string,
  "mode": "cloud",
  "steps": Array<{
    "id": string,                 // 如 "s1" ~ "s6"
    "phase": "问题拆解" | "概念辨析" | "数理推导" | "图像分析" | "结论" | "易错点",
    "heading": string,
    "text": string,               // 展开式讲解，含 reasoning，禁用「显然 / 易得」
    "formulas"?: string[],        // KaTeX：$$...$$ / $...$
    "diagram"?: { "kind": "force" | "trajectory" | "vt" | "circuit" | "light" | "pv" | "wave" | "mermaid", "spec": object, "caption"?: string } | null,
    "animation"?: { "type": "projectile" | "uniform-motion" | "wave" | "charge-in-field" | "refraction", "params": object, "durationMs"?: number, "caption"?: string } | null,
    "misconception"?: string | null,
    "sourceRefs"?: string[]
  }>,
  "sources"?: string[],
  "offline_fallback"?: false
}
六阶段顺序固定为：问题拆解 → 概念辨析 → 数理推导 → 图像分析 → 结论 → 易错点（模块可空字符串但顺序固定）。
图表 / 动画仅在确有必要时给出；diagram.kind 与 animation.type 必须是上面白名单之一，否则给 null。`;

/**
 * 调云端 LLM 生成讲解。成功返回已校验的 PomosExplainV1（mode:"cloud"）；
 * 任意失败抛错（由调用方 catch 降级）。
 */
export async function callCloudExplain(
  message: string,
  cfg: LlmOpts,
  signal?: AbortSignal,
): Promise<PomosExplainV1> {
  const user = `学生问题：${message}\n\n请按上述契约输出完整 JSON。`;
  const text = await chatCompletion(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: user },
    ],
    { ...cfg, maxTokens: EXPLAIN_MAX_TOKENS, temperature: 0.3 },
  );
  if (signal?.aborted) throw new Error("已取消生成");
  const jsonStr = extractJsonObject(text);
  if (!jsonStr) throw new Error("云端未返回可解析 JSON");
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error("云端 JSON 解析失败");
  }
  const validated = validateExplain(parsed);
  if (!validated) throw new Error("云端返回结构不合法");
  // 强制标记为云端来源
  return { ...validated, mode: "cloud", offline_fallback: false };
}
