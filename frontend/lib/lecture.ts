// lib/lecture.ts
// 讲义四模块生成：编排云端 LLM（深度）或本地启发式（降级），返回 LectureResult。
// 固定四模块标题常量 LECTURE_SECTIONS（架构 §7），全链路以此生成与渲染二级标题。
import {
  generateLectureOffline,
  type LectureResult,
} from "./offlineGen";
import { searchTextbooks } from "./textbookRetriever";
import { retrieve } from "./knowledgeBase";
import { getLlmConfig, chatCompletion } from "./llm";

/** 四模块固定标题（禁止散落硬编码）。 */
export const LECTURE_SECTIONS = [
  "概念辨析",
  "数理推导",
  "图像分析",
  "逻辑贯通",
] as const;

export interface LectureContext {
  studentId?: string;
  knowledgePoint?: string;
  board?: string;
}

export type { LectureResult } from "./offlineGen";

function mergeSources(a: string[], b: string[]): string[] {
  return Array.from(new Set([...a, ...b]));
}

/** 把 LLM 返回的 markdown 拆成四模块字段；若缺失则用离线版兜底。 */
function parseLecture(text: string, fallback: LectureResult): LectureResult {
  const map: Record<string, keyof LectureResult> = {
    概念: "concept",
    推导: "derivation",
    图像: "image",
    贯通: "logic",
  };
  const result: LectureResult = { ...fallback, concept: "", derivation: "", image: "", logic: "" };
  const re = /##\s*(.+?)\s*\n([\s\S]*?)(?=\n##\s|$)/g;
  let m: RegExpExecArray | null;
  let any = false;
  while ((m = re.exec(text)) !== null) {
    const head = m[1];
    const body = m[2].trim();
    for (const key of Object.keys(map)) {
      if (head.includes(key) && body) {
        (result[map[key]] as string) = body;
        any = true;
      }
    }
  }
  if (!any) {
    // LLM 未按要求分节，整体作为「概念辨析」，其余沿用离线
    return {
      ...fallback,
      concept: text.trim() || fallback.concept,
    };
  }
  return { ...result, markdown: "", sources: fallback.sources };
}

/**
 * 生成四模块讲义。联网走云端 LLM（注入教材 + 个人知识库上下文），
 * 任意失败（未配置 / 离线 / 超时 / 错误）降级本地启发式。
 */
export async function generateLecture(
  topic: string,
  ctx: LectureContext = {},
): Promise<LectureResult> {
  const point = ctx.knowledgePoint?.trim() || topic.trim();

  // 参考上下文：教材库 + 个人知识库
  const tbSources = searchTextbooks(point, 5).map(
    (h) => h.example?.source ?? `${h.textbook.title}·${h.chapter.title}`,
  );
  let kbChunks: string[] = [];
  if (ctx.studentId) {
    try {
      const ch = await retrieve(ctx.studentId, point, 4);
      kbChunks = ch.map((c) => c.content);
    } catch {
      kbChunks = [];
    }
  }

  const offline = generateLectureOffline(topic, ctx);
  const offlineFull = { ...offline, sources: mergeSources(offline.sources, tbSources) };

  const cfg = await getLlmConfig();
  if (!cfg) return offlineFull;

  const sys =
    "你是 POMOS 物理竞赛导师，擅长为高中生撰写深入浅出、可解释的四模块讲义。" +
    "严格按以下四个二级标题输出，每节内容非空、使用中文与 LaTeX 公式：$$...$$。\n" +
    "## 概念辨析\n## 数理推导\n## 图像分析\n## 逻辑贯通";
  const user =
    `请围绕「${point}」撰写讲义（${LECTURE_SECTIONS.join(" / ")}）。\n` +
    (ctx.board ? `所属学科/板块：${ctx.board}。\n` : "") +
    `参考教材出处：${tbSources.join("；") || "无"}\n` +
    (kbChunks.length ? `学生个人知识库片段：\n${kbChunks.slice(0, 3).join("\n---\n")}` : "");
  try {
    const text = await chatCompletion(
      [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      cfg,
    );
    if (!text || !text.trim()) return offlineFull;
    const parsed = parseLecture(text, offline);
    return { ...parsed, sources: mergeSources(parsed.sources, tbSources) };
  } catch {
    return offlineFull;
  }
}

/** 把 LectureResult 组装为四模块 Markdown（供对话/讲义统一渲染）。 */
export function toMarkdown(r: LectureResult): string {
  const pairs: [string, string][] = [
    [LECTURE_SECTIONS[0], r.concept],
    [LECTURE_SECTIONS[1], r.derivation],
    [LECTURE_SECTIONS[2], r.image],
    [LECTURE_SECTIONS[3], r.logic],
  ];
  const parts = pairs
    .filter(([, v]) => v && v.trim())
    .map(([h, v]) => `## ${h}\n\n${v.trim()}`);
  let md = parts.join("\n\n");
  if (r.sources && r.sources.length) {
    md += `\n\n---\n\n**参考出处**：${r.sources.join("；")}`;
  }
  return md;
}
