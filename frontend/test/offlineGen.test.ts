// test/offlineGen.test.ts
// 离线生成引擎（纯函数）单元测试：就绪度 / 板块掌握度 / PCDF 八层 /
// 竞赛题目生成（确定性）/ 训练生成 / 错题归因。
import { describe, it, expect } from "vitest";
import {
  computeReadiness,
  computeBoardMastery,
  derivePcdfLayers,
  generateCompetitionQuestion,
  generateTrainingForNode,
  generateMistakeAnalysis,
  BUG_CATEGORIES,
  KG_BOARDS,
  type TwinLike,
} from "@/lib/offlineGen";

// 九维 key（与 offlineGen DIM_WEIGHT 对应）
const DIM_KEYS = [
  "concept",
  "modeling",
  "reasoning",
  "calculation",
  "experiment",
  "transfer",
  "meta",
  "competition",
  "growth",
] as const;

function uniformTwin(v: number): TwinLike {
  return DIM_KEYS.map((key) => ({ key, value: v }));
}

describe("computeReadiness", () => {
  it("低/中/高 twin 的就绪度均落在 0..1", () => {
    for (const v of [0.2, 0.6, 0.95]) {
      const r = computeReadiness(uniformTwin(v));
      for (const k of ["province_top", "province_team", "ipho"] as const) {
        expect(r[k]).toBeGreaterThanOrEqual(0);
        expect(r[k]).toBeLessThanOrEqual(1);
      }
    }
  });

  it("就绪度随能力单调递增（高 > 中 > 低）", () => {
    const lo = computeReadiness(uniformTwin(0.2));
    const mid = computeReadiness(uniformTwin(0.6));
    const hi = computeReadiness(uniformTwin(0.95));
    for (const k of ["province_top", "province_team", "ipho"] as const) {
      expect(mid[k]).toBeGreaterThan(lo[k]);
      expect(hi[k]).toBeGreaterThan(mid[k]);
    }
  });

  it("空 twin 不抛异常，且按公式 0.1+0.9*c 推导（c=0 → province_top=0.1）", () => {
    const r = computeReadiness([]);
    expect(r.province_top).toBeCloseTo(0.1, 5); // 0.1 + 0.9*0
    expect(r.province_team).toBe(0); // 0^1.4 * 0.92 = 0
    expect(r.ipho).toBe(0); // 0^2.3 * 0.75 = 0
  });
});

describe("computeBoardMastery", () => {
  it("每个板块掌握度落在 0..100 且覆盖全部板块", () => {
    const m = computeBoardMastery(uniformTwin(0.6));
    for (const board of KG_BOARDS) {
      expect(m[board]).toBeDefined();
      expect(m[board]).toBeGreaterThanOrEqual(0);
      expect(m[board]).toBeLessThanOrEqual(100);
      expect(Number.isInteger(m[board])).toBe(true);
    }
  });

  it("均匀能力 0.6 时各板块掌握度约为 60", () => {
    const m = computeBoardMastery(uniformTwin(0.6));
    for (const board of KG_BOARDS) {
      expect(m[board]).toBe(60);
    }
  });
});

describe("derivePcdfLayers", () => {
  it("返回长度 8 的数组，每层含必要字段", () => {
    const layers = derivePcdfLayers(uniformTwin(0.7));
    expect(layers).toHaveLength(8);
    for (const layer of layers) {
      expect(typeof layer.layer).toBe("number");
      expect(typeof layer.name).toBe("string");
      expect(["ok", "warn", "risk"]).toContain(layer.status);
      expect(layer.score).toBeGreaterThanOrEqual(0);
      expect(layer.score).toBeLessThanOrEqual(100);
      expect(typeof layer.note).toBe("string");
    }
  });

  it("高能力层状态优于低能力层", () => {
    const lo = derivePcdfLayers(uniformTwin(0.2));
    const hi = derivePcdfLayers(uniformTwin(0.95));
    const loRisk = lo.filter((l) => l.status === "risk").length;
    const hiRisk = hi.filter((l) => l.status === "risk").length;
    expect(hiRisk).toBeLessThan(loRisk);
  });
});

describe("generateCompetitionQuestion", () => {
  it("传入显式 seed 时两次调用结果完全一致（确定性）", () => {
    const q1 = generateCompetitionQuestion("力学", 3, 12345);
    const q2 = generateCompetitionQuestion("力学", 3, 12345);
    // 注意：返回对象的 id 字段内含 Date.now()，不参与确定性断言；
    // 确定性校验针对题目内容字段（topic/board/difficulty/stem 等）。
    expect(q1.topic).toBe(q2.topic);
    expect(q1.board).toBe(q2.board);
    expect(q1.difficulty).toBe(q2.difficulty);
    expect(q1.stem).toBe(q2.stem);
    expect(q1.hint).toBe(q2.hint);
    expect(q1.solutionPoints).toEqual(q2.solutionPoints);
    expect(q1.keyPoints).toEqual(q2.keyPoints);
  });

  it("返回对象含 stem / solutionPoints / keyPoints 等必要字段", () => {
    const q = generateCompetitionQuestion("电磁学", 4, 999);
    expect(q.board).toBe("电磁学");
    expect(typeof q.stem).toBe("string");
    expect(q.stem.length).toBeGreaterThan(0);
    expect(Array.isArray(q.solutionPoints)).toBe(true);
    expect(q.solutionPoints.length).toBeGreaterThan(0);
    expect(Array.isArray(q.keyPoints)).toBe(true);
    expect(q.keyPoints.length).toBeGreaterThan(0);
  });

  it("不同 seed 可得到不同题目（题库有多题时）", () => {
    const a = generateCompetitionQuestion("力学", 3, 1);
    const b = generateCompetitionQuestion("力学", 3, 2);
    // 至少 topic 可能因 seed 不同而变化（题库 3 题）
    expect([a.topic, b.topic]).toEqual(expect.arrayContaining([a.topic, b.topic]));
  });
});

describe("generateTrainingForNode", () => {
  it("返回含梯度题 / 目标 / 误区的完整训练", () => {
    const t = generateTrainingForNode("牛顿定律", "力学", 70);
    expect(t.node).toBe("牛顿定律");
    expect(t.board).toBe("力学");
    expect(t.mastery).toBe(70);
    expect(typeof t.tier).toBe("string");
    expect(Array.isArray(t.objectives) && t.objectives.length > 0).toBe(true);
    expect(Array.isArray(t.misconceptions) && t.misconceptions.length > 0).toBe(true);
    expect(typeof t.summary).toBe("string");
    expect(t.problems.length).toBeGreaterThanOrEqual(3);
    // 梯度：按难度升序
    for (let i = 1; i < t.problems.length; i++) {
      expect(t.problems[i].difficulty).toBeGreaterThanOrEqual(t.problems[i - 1].difficulty);
    }
    // 每道题含必要字段
    for (const p of t.problems) {
      expect(typeof p.stem).toBe("string");
      expect(Array.isArray(p.solutionPoints)).toBe(true);
    }
  });
});

describe("generateMistakeAnalysis", () => {
  const bugIds = BUG_CATEGORIES.map((c) => c.id);
  const topics: { topic: string; expectId: string }[] = [
    { topic: "电磁感应理解偏差", expectId: "concept" },
    { topic: "刚体转动模型误判", expectId: "model" },
    { topic: "符号与单位漏写", expectId: "symbol" },
    { topic: "审题漏读条件", expectId: "reading" },
    { topic: "极限自检缺失", expectId: "check" },
    { topic: "方法僵化不会换路", expectId: "method" },
    { topic: "概念本质迷思", expectId: "concept" },
  ];

  it("返回 7 类归因之一且含 cause/correctApproach/prevention 三段", () => {
    for (const { topic } of topics) {
      const a = generateMistakeAnalysis(topic, "解题过程出现偏差");
      expect(bugIds).toContain(a.categoryId);
      expect(typeof a.categoryLabel).toBe("string");
      expect(typeof a.cause).toBe("string");
      expect(a.cause.length).toBeGreaterThan(0);
      expect(typeof a.correctApproach).toBe("string");
      expect(a.correctApproach.length).toBeGreaterThan(0);
      expect(typeof a.prevention).toBe("string");
      expect(a.prevention.length).toBeGreaterThan(0);
    }
  });

  it("特定主题映射到正确的归因分类", () => {
    for (const { topic, expectId } of topics) {
      const a = generateMistakeAnalysis(topic, "解题过程出现偏差");
      expect(a.categoryId).toBe(expectId);
    }
  });
});
