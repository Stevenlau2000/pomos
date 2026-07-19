// test/explain.test.ts
// 讲解增强纯函数单测：validateExplain / extractJsonObject / validateDiagramSpec /
// validateAnimationSpec / clampNum / generateExplainOffline / detectChatIntent。
// 编排层（lib/explain/*）为纯函数，可在 Node（fake-indexeddb/auto）直接加载。
import { describe, it, expect } from "vitest";
import {
  validateExplain,
  extractJsonObject,
  validateDiagramSpec,
  validateAnimationSpec,
  clampNum,
} from "@/lib/explain/validate";
import { generateExplainOffline } from "@/lib/explain/offline";
import { detectChatIntent } from "@/lib/explain";

describe("validateExplain", () => {
  it("拒绝非 1.0 的 schema_version（返回 null）", () => {
    expect(
      validateExplain({ schema_version: "2.0", steps: [{ id: "s1", phase: "概念辨析", text: "x" }] }),
    ).toBeNull();
  });

  it("空 steps 返回 null", () => {
    expect(validateExplain({ schema_version: "1.0", steps: [] })).toBeNull();
  });

  it("文本为空的 step 被过滤，其余保留并保留 id", () => {
    const r = validateExplain({
      schema_version: "1.0",
      steps: [
        { id: "s1", phase: "概念辨析", text: "" },
        { id: "s2", phase: "数理推导", text: "ok" },
      ],
    });
    expect(r).not.toBeNull();
    expect(r!.steps.length).toBe(1);
    expect(r!.steps[0].id).toBe("s2");
  });

  it("非法 diagram.kind / animation.type 被置 null 而非整体失败", () => {
    const r = validateExplain({
      schema_version: "1.0",
      steps: [
        {
          id: "s1",
          phase: "图像分析",
          text: "x",
          diagram: { kind: "bogus", spec: {} },
          animation: { type: "nope", params: {} },
        },
      ],
    });
    expect(r).not.toBeNull();
    expect(r!.steps[0].diagram).toBeNull();
    expect(r!.steps[0].animation).toBeNull();
  });

  it("phase 缺省按下标回退六阶段顺序（首步=问题拆解）", () => {
    const r = validateExplain({ schema_version: "1.0", steps: [{ text: "x" }] });
    expect(r).not.toBeNull();
    expect(r!.steps[0].phase).toBe("问题拆解");
  });

  it("完整合法结构通过并保留字段", () => {
    const r = validateExplain({
      schema_version: "1.0",
      title: "t",
      mode: "cloud",
      steps: [
        {
          id: "s1",
          phase: "问题拆解",
          heading: "h",
          text: "x",
          formulas: ["a=b"],
          diagram: { kind: "force", spec: {} },
          animation: { type: "wave", params: {} },
          misconception: "m",
          sourceRefs: ["r1"],
        },
      ],
      sources: ["s"],
    });
    expect(r).not.toBeNull();
    expect(r!.mode).toBe("cloud");
    expect(r!.steps[0].formulas).toEqual(["a=b"]);
    expect(r!.steps[0].diagram?.kind).toBe("force");
    expect(r!.steps[0].animation?.type).toBe("wave");
    expect(r!.sources).toEqual(["s"]);
  });
});

describe("extractJsonObject", () => {
  it("截取首个平衡 {...}", () => {
    expect(extractJsonObject('说明文字 {"a":1} 尾巴')).toBe('{"a":1}');
  });
  it("忽略字符串内的括号", () => {
    expect(extractJsonObject('前缀 {"x":"a}b"} 后')).toBe('{"x":"a}b"}');
  });
  it("无 { 返回 null", () => {
    expect(extractJsonObject("no json here")).toBeNull();
  });
});

describe("validateDiagramSpec / validateAnimationSpec", () => {
  it("非法 kind 返回 null", () => {
    expect(validateDiagramSpec({ kind: "x", spec: {} })).toBeNull();
  });
  it("合法 kind 通过并保留 caption", () => {
    const d = validateDiagramSpec({ kind: "force", spec: { bodies: [] }, caption: "c" });
    expect(d).not.toBeNull();
    expect(d!.caption).toBe("c");
  });
  it("动画参数收敛为 number|string，NaN 转 0", () => {
    const a = validateAnimationSpec({ type: "wave", params: { lambda: NaN, f: "1" } });
    expect(a).not.toBeNull();
    expect(a!.params.lambda).toBe(0);
    expect(a!.params.f).toBe("1");
  });
  it("未知 type 返回 null", () => {
    expect(validateAnimationSpec({ type: "x", params: {} })).toBeNull();
  });
});

describe("clampNum", () => {
  it("clamp 到范围，缺省回退 fallback", () => {
    expect(clampNum(5, 0, 3, 1)).toBe(3);
    expect(clampNum(-1, 0, 3, 1)).toBe(0);
    expect(clampNum(undefined, 0, 3, 2)).toBe(2);
    expect(clampNum(NaN, 0, 3, 2)).toBe(2);
  });
});

describe("generateExplainOffline", () => {
  it("抛体问题返回六阶段结构化讲解（含图/动画/教材引用/易错点）", async () => {
    const r = await generateExplainOffline("请讲解斜抛运动", "stu_test_offline");
    expect(r.schema_version).toBe("1.0");
    expect(r.mode).toBe("offline");
    expect(r.steps.length).toBe(6);
    const img = r.steps.find((s) => s.phase === "图像分析");
    expect(img?.diagram).not.toBeNull();
    expect(img?.animation).not.toBeNull();
    const mc = r.steps.find((s) => s.phase === "易错点");
    expect(mc?.misconception).toBeTruthy();
  });

  it("冷门问题兜底六阶段骨架且不抛异常", async () => {
    const r = await generateExplainOffline("请讲解一个很冷门的概念 xyz", "stu_test_cold");
    expect(r.steps.length).toBe(6);
    expect(r.steps.every((s) => s.text.length > 0)).toBe(true);
  });
});

describe("detectChatIntent", () => {
  it("生成讲义 → lecture", () => {
    expect(detectChatIntent("生成讲义：电磁感应")).toBe("lecture");
  });
  it("讲解这道题 + 参考答案要点 → explain_problem", () => {
    expect(detectChatIntent("讲解这道题：xxx\n【参考答案要点】\ny=...")).toBe("explain_problem");
  });
  it("出题类 → question", () => {
    expect(detectChatIntent("给我一道力学竞赛题")).toBe("question");
  });
  it("训练类 → training", () => {
    expect(detectChatIntent("请给我生成针对性训练计划")).toBe("training");
  });
  it("普通问题 → explain", () => {
    expect(detectChatIntent("什么是动量守恒？")).toBe("explain");
  });
});
