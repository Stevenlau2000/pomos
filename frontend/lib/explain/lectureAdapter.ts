// lib/explain/lectureAdapter.ts
// 讲义四模块 → 六阶段 PomosExplainV1 适配（同源 ExplainCard 渲染）。
import { generateLecture } from "../lecture";
import {
  EXPLAIN_PHASES,
  type ExplainPhase,
  type ExplainStep,
  type PomosExplainV1,
} from "./types";

/** 把四模块讲义结果包成六阶段 PomosExplainV1（mode:"lecture"）。 */
export function lectureToExplain(r: {
  topic: string;
  concept: string;
  derivation: string;
  image: string;
  logic: string;
  sources?: string[];
}): PomosExplainV1 {
  const sources = Array.isArray(r.sources) ? r.sources : [];
  const steps: ExplainStep[] = [
    mkStep("s1", "问题拆解", `本讲义围绕「${r.topic}」系统讲解，按「概念辨析 → 数理推导 → 图像分析 → 逻辑贯通」组织。`, sources),
    mkStep("s2", "概念辨析", r.concept || "（暂无内容）", sources),
    mkStep("s3", "数理推导", r.derivation || "（暂无内容）", sources),
    mkStep("s4", "图像分析", r.image || "（暂无内容）", sources),
    // 逻辑贯通 → 结论（前四阶段承接四模块；易错点补空，符合架构约定）
    mkStep("s5", "结论", r.logic || "（暂无内容）", sources),
    mkStep("s6", "易错点", "结合上述贯通，注意概念边界、符号约定与近似条件。", sources),
  ];
  return {
    schema_version: "1.0",
    title: r.topic,
    mode: "lecture",
    steps,
    sources: sources.length ? sources : undefined,
  };
}

function mkStep(
  id: string,
  phase: ExplainPhase,
  text: string,
  sources: string[],
): ExplainStep {
  return { id, phase, heading: phase, text, sourceRefs: sources.length ? sources : undefined };
}

/** 生成讲义并经适配器输出 PomosExplainV1（供 explainChat 的 lecture 意图复用）。 */
export async function generateLectureExplain(
  topic: string,
  ctx: { studentId?: string; knowledgePoint?: string; board?: string },
): Promise<PomosExplainV1> {
  const r = await generateLecture(topic, ctx);
  // 防止 EXPLAIN_PHASES 被 tree-shaking 误报未使用（类型层引用）
  void EXPLAIN_PHASES;
  return lectureToExplain(r);
}
