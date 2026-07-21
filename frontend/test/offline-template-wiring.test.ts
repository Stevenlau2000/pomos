// test/offline-template-wiring.test.ts
// Task C：模板接线审计。验证 7 个已接线 topic 在「图像分析」步注入图/动画，
// 4 个未接线 topic 图像分析步 diagram/animation 均为 null（无回归），
// 且 maps 目录补全（mermaid 模板存在）。
import { describe, it, expect } from "vitest";
import { generateExplainOffline } from "@/lib/explain/offline";
import { lookupTemplate } from "@/lib/explain/maps";
import type { ExplainStep } from "@/lib/explain/types";

interface WiredCase {
  key: string;
  /** 触发词，默认 `请讲解${key}`；当 key 并非 topic 的真实命中词时显式指定，避免误命中其它 topic */
  trigger?: string;
  /** 该接线预期产生的 diagram.kind（仅动画的 topic 不在此断言） */
  expectDiagramKind?: string;
  /** 该接线预期产生的 animation.type（仅含图无动画的 topic 不在此断言） */
  expectAnimType?: string;
}

// 7 个已接线 topic（template 命中现有 maps 模板）
// 注意：trigger 必须用 topic 自身真实拥有的 key，否则会命中别的 topic 导致接线断言失真。
const WIRED: WiredCase[] = [
  { key: "运动学", expectDiagramKind: "vt" }, // 匀加速 → vt 图
  { key: "振动与波", trigger: "请讲解机械波", expectDiagramKind: "wave" }, // 波动 → wave 图（「振动与波」非裸 key，用「机械波」唯一命中）
  { key: "恒定电流", expectDiagramKind: "circuit" }, // 电路 → circuit 图
  { key: "磁场", trigger: "请讲解洛伦兹力", expectAnimType: "charge-in-field" }, // 磁场 → 仅动画 charge-in-field（axis: magnetic）；「磁场」非裸 key，用「洛伦兹力」唯一命中
  { key: "电磁感应" }, // 磁场 → 仅动画
  { key: "热力学", expectDiagramKind: "pv" }, // pv → pv 图
  { key: "光学", expectDiagramKind: "wave" }, // 波动 → wave 图
];

// 4 个保持 template 空的 topic（无贴切现成模板）
const UNWIRED = ["能量守恒", "刚体转动", "静电场", "近代物理"];

function findImageStep(steps: ExplainStep[]): ExplainStep {
  const s = steps.find((x) => x.phase === "图像分析");
  if (!s) throw new Error("缺少图像分析步");
  return s;
}

describe("Task C 模板接线审计", () => {
  for (const w of WIRED) {
    it(`接线 topic「${w.key}」：图像分析步含图或动画`, async () => {
      const trigger = w.trigger ?? `请讲解${w.key}`;
      const out = await generateExplainOffline(trigger, "wiring-stu");
      expect(out.mode).toBe("offline");
      const img = findImageStep(out.steps);
      const hasDiagram = img.diagram != null;
      const hasAnim = img.animation != null;
      expect(hasDiagram || hasAnim).toBe(true);
      if (w.expectDiagramKind) {
        expect(img.diagram?.kind).toBe(w.expectDiagramKind);
      }
      if (w.expectAnimType) {
        expect(img.animation?.type).toBe(w.expectAnimType);
      }
    });
  }

  for (const u of UNWIRED) {
    it(`未接线 topic「${u}」：图像分析步无图/动画（无回归）`, async () => {
      const out = await generateExplainOffline(`请讲解${u}`, "wiring-stu-2");
      const img = findImageStep(out.steps);
      expect(img.diagram).toBeNull();
      expect(img.animation).toBeNull();
    });
  }

  it("maps 目录补全：lookupTemplate('mermaid') 返回非 undefined", () => {
    expect(lookupTemplate("mermaid")).toBeDefined();
  });
});
