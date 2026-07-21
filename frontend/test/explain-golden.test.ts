// test/explain-golden.test.ts
// Task B：把 v6.0 示例 1（斜抛六阶段）固化为 generateExplainOffline 的内容回归 fixture。
// 锁死结构契约：步数、phase 顺序、图像分析步的 trajectory 图 / projectile 动画、核心结论不变量。
// 注意：generateExplainOffline 自生成 text，不逐字节等于 golden；本测试只比对结构契约。
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { generateExplainOffline } from "@/lib/explain/offline";
import type { PomosExplainV1, ExplainPhase } from "@/lib/explain/types";

const GOLDEN_PATH = resolve(process.cwd(), "test/fixtures/explain-projectile-golden.json");
const golden = JSON.parse(readFileSync(GOLDEN_PATH, "utf8")) as PomosExplainV1;

const EXPECTED_PHASES: ExplainPhase[] = ["问题拆解", "概念辨析", "数理推导", "图像分析", "结论", "易错点"];

describe("斜抛六阶段 golden 契约（generateExplainOffline ↔ v6.0 示例1）", () => {
  it("主契约：斜抛讲解产出与 golden 结构一致", async () => {
    const out = await generateExplainOffline("斜抛运动为什么水平方向匀速", "student-x");

    // 顶层结构
    expect(out.schema_version).toBe("1.0");
    expect(out.mode).toBe("offline");
    expect(out.title).toContain("斜抛");

    // 步数与 phase 顺序（与 golden 一致）
    expect(out.steps.length).toBe(golden.steps.length); // 应为 6
    const phases = out.steps.map((s) => s.phase);
    expect(phases).toEqual(EXPECTED_PHASES);
    expect(phases).toEqual(golden.steps.map((s) => s.phase));

    // 图像分析步：trajectory 图 + projectile 动画，且 spec/params 含 v0/theta/g
    const img = out.steps.find((s) => s.phase === "图像分析");
    expect(img).toBeTruthy();
    expect(img!.diagram?.kind).toBe("trajectory");
    expect(img!.animation?.type).toBe("projectile");
    const spec = img!.diagram?.spec as Record<string, unknown> | undefined;
    const params = img!.animation?.params as Record<string, unknown> | undefined;
    expect(spec).toBeTruthy();
    expect(params).toBeTruthy();
    for (const k of ["v0", "theta", "g"]) {
      expect(spec).toHaveProperty(k);
      expect(params).toHaveProperty(k);
    }

    // 全部 6 步文本非空
    expect(out.steps.every((s) => s.text.length > 0)).toBe(true);

    // 核心不变量：至少一步同时含「水平」与「匀速」（锁死斜抛核心结论）
    const hasInvariant = out.steps.some(
      (s) => s.text.includes("水平") && s.text.includes("匀速"),
    );
    expect(hasInvariant).toBe(true);
  });

  it("golden 文件自身 schema 合法性：6 步且 phase 集合正确、图像步含 trajectory/projectile", () => {
    expect(golden.schema_version).toBe("1.0");
    expect(golden.steps.length).toBe(6);
    const set = new Set(golden.steps.map((s) => s.phase));
    for (const p of EXPECTED_PHASES) expect(set.has(p)).toBe(true);
    const gimg = golden.steps.find((s) => s.phase === "图像分析");
    expect(gimg?.diagram?.kind).toBe("trajectory");
    expect(gimg?.animation?.type).toBe("projectile");
  });
});
