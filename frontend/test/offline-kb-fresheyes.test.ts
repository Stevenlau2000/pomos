// test/offline-kb-fresheyes.test.ts
// 独立验证层（QA 严过关 / 不信任实现者结论）：
// 1) 对 6 个有代表性的新 topic 触发，断言：
//    - steps.length === 6
//    - 每一步 text 非空且「非」通用模板套话（offline.ts 的 genericPhase 特征串）
//    - 易错点这一步 misconception 非空且该节点专属（非 genericMisconception 的「…的常见误区：」套话）
//    - title 等于该 topic 自己配置的标题（证明命中无误、board 绑定正确）
// 2) 回归门：8 条旧 topic 的各代表 key 仍命中自身（未被新 keys 抢走）。
// 3) 降级健壮性：完全不匹配的生僻 query 返回 6 步、不抛异常、mode==="offline"。
import { describe, it, expect } from "vitest";
import { generateExplainOffline } from "@/lib/explain/offline";

// 通用模板（genericPhase）的特征串：命中任一即判定 generic 泄漏（属 bug）。
const GENERIC_MARKERS = [
  "针对「",
  "先明确已知量",
  "回顾该问题涉及的核心物理概念",
  "列出适用的定律与公式",
  "如适用，画出过程图像",
  "综合上述分析给出结论",
  "注意常见误区",
];
const GENERIC_MISCONCEPTION_MARKER = "的常见误区：";

const PHASE_ORDER = [
  "问题拆解",
  "概念辨析",
  "数理推导",
  "图像分析",
  "结论",
  "易错点",
] as const;

interface Hit {
  query: string;
  expectedTitle: string;
}

describe("fresh-eyed: 新 topic 内容真实、非 generic 泄漏", () => {
  const NEW: Hit[] = [
    { query: "能量守恒", expectedTitle: "能量守恒：用能量视角替代牛顿第二定律" },
    { query: "电磁感应", expectedTitle: "电磁感应：法拉第定律与楞次定律" },
    { query: "近代物理", expectedTitle: "近代物理：相对论、量子与原子核" },
    { query: "恒定电流", expectedTitle: "恒定电流：电路分析与等效定理" },
    { query: "刚体转动", expectedTitle: "刚体定轴转动：转动惯量与角动量守恒" },
    { query: "热力学", expectedTitle: "热力学：第一定律、第二定律与熵" },
  ];

  for (const h of NEW) {
    it(`「${h.query}」六阶段真实 + 专属 + 标题正确`, async () => {
      const r = await generateExplainOffline(`请讲解${h.query}`, "fresheyes_stu");
      expect(r.mode).toBe("offline");
      expect(r.steps.length).toBe(6);
      expect(r.title).toBe(h.expectedTitle); // 命中专属 topic，board 随之确定

      const phases = r.steps.map((s) => s.phase);
      expect(phases).toEqual([...PHASE_ORDER]);

      for (const s of r.steps) {
        // (a) text 非空
        expect(s.text.length).toBeGreaterThan(0);
        // (b) text 不是 generic 套话
        for (const m of GENERIC_MARKERS) {
          expect(s.text, `步骤「${s.phase}」疑似 generic 套话(${m})`).not.toContain(m);
        }
      }

      // (c) 易错点步骤：misconception 非空且专属（非 genericMisconception 套话）
      const mc = r.steps.find((s) => s.phase === "易错点");
      expect(mc).toBeTruthy();
      expect(mc!.misconception, "易错点 misconception 为空").toBeTruthy();
      expect(
        mc!.misconception,
        "易错点 misconception 为 generic 套话",
      ).not.toContain(GENERIC_MISCONCEPTION_MARKER);
    });
  }
});

describe("回归门：8 条旧 topic 命中未被新 keys 抢走", () => {
  const OLD: Hit[] = [
    { query: "斜抛", expectedTitle: "斜抛运动：水平方向为什么匀速？" },
    { query: "牛顿", expectedTitle: "牛顿第二定律与受力分析" },
    { query: "折射", expectedTitle: "折射定律（斯涅尔定律）" },
    { query: "电场", expectedTitle: "电荷在匀强电场中的偏转" },
    { query: "简谐", expectedTitle: "简谐振动的运动学特征" },
    { query: "卡诺", expectedTitle: "卡诺循环与效率上限" },
    { query: "波动", expectedTitle: "行波与干涉的基本关系" },
    { query: "动量", expectedTitle: "动量定理与动量守恒" },
  ];

  for (const h of OLD) {
    it(`「${h.query}」仍命中旧 topic「${h.expectedTitle}」`, async () => {
      const r = await generateExplainOffline(`请讲解${h.query}`, "regress_stu");
      expect(r.mode).toBe("offline");
      expect(r.steps.length).toBe(6);
      expect(r.title).toBe(h.expectedTitle);
      // 旧 topic 同样不应退化为 generic 套话
      for (const s of r.steps) {
        for (const m of GENERIC_MARKERS) {
          expect(s.text).not.toContain(m);
        }
      }
    });
  }
});

describe("降级健壮性：完全不匹配的生僻 query", () => {
  it("「如何做番茄炒蛋」返回 6 步、不抛异常、mode=offline", async () => {
    let r: Awaited<ReturnType<typeof generateExplainOffline>>;
    expect(async () => {
      r = await generateExplainOffline("如何做番茄炒蛋", "degrade_stu");
    }).not.toThrow();
    r = await generateExplainOffline("如何做番茄炒蛋", "degrade_stu");
    expect(r.mode).toBe("offline");
    expect(r.steps.length).toBe(6);
    // 降级路径应退化为 generic，但结构完整、可渲染
    expect(r.steps.every((s) => s.text.length > 0)).toBe(true);
  });
});
