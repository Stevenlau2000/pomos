// test/offline-kb-template-wire.test.ts
// Task（本次）：验证本次补接的 2 个节点的 template 真的能渲染出图/动画。
//   - 光学：几何光学与波动光学基础  → template "波动"  → 图像分析步应含 wave 图 + wave 动画
//   - 热力学：第一定律、第二定律与熵 → template "pv"    → 图像分析步应含 pv 图（diagram.kind === "pv"）
// 触发消息确保唯一路由到目标 topic（避免命中其它同名 key 的 topic）。
import { describe, it, expect } from "vitest";
import { generateExplainOffline } from "@/lib/explain/offline";
import type { ExplainStep } from "@/lib/explain/types";

function imageStep(steps: ExplainStep[]): ExplainStep {
  const s = steps.find((x) => x.phase === "图像分析");
  if (!s) throw new Error("缺少图像分析步");
  return s;
}

describe("本次补接的 2 个节点：template 渲染验证", () => {
  it("光学 → 图像分析步带 wave 图与 wave 动画", async () => {
    const out = await generateExplainOffline("请讲解光学", "wire-stu-optics");
    // 路由正确性自检：应命中光学：几何光学与波动光学基础
    expect(out.title).toContain("光学");
    expect(out.title).toContain("几何光学");
    const img = imageStep(out.steps);
    expect(img.diagram).not.toBeNull();
    expect(img.diagram?.kind).toBe("wave");
    expect(img.animation).not.toBeNull();
    expect(img.animation?.type).toBe("wave");
  });

  it("热力学 → 图像分析步带 pv 图（diagram.kind === 'pv'）", async () => {
    const out = await generateExplainOffline(
      "请讲解热力学第一定律",
      "wire-stu-thermo",
    );
    // 路由正确性自检：应命中热力学：第一定律、第二定律与熵（而非卡诺）
    expect(out.title).toContain("热力学");
    expect(out.title).toContain("第一定律");
    const img = imageStep(out.steps);
    expect(img.diagram).not.toBeNull();
    expect(img.diagram?.kind).toBe("pv");
  });
});
