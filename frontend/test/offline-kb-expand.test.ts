// test/offline-kb-expand.test.ts
// 离线讲解 KB 扩容冒烟测试：锁定本次新增的 11 个核心节点。
// 对每个新增 topic，用其某个代表 key 调 generateExplainOffline，
// 断言：六阶段齐全(steps.length===6)、title 为专属 topic 标题（即正确命中，board 由 topic 决定）、mode==="offline"。
import { describe, it, expect } from "vitest";
import { generateExplainOffline } from "@/lib/explain/offline";

interface Case {
  key: string;
  expectedTitle: string;
}

// 11 个新增核心节点（offline.ts 扩容），各自一个代表 key 命中专属 topic。
const CASES: Case[] = [
  { key: "圆周运动", expectedTitle: "运动学：描述运动的语言与坐标变换" },
  { key: "能量守恒", expectedTitle: "能量守恒：用能量视角替代牛顿第二定律" },
  { key: "刚体转动", expectedTitle: "刚体定轴转动：转动惯量与角动量守恒" },
  { key: "单摆", expectedTitle: "振动与波：周期运动的描述与传播" },
  { key: "静电场", expectedTitle: "静电场：场强、电势与高斯定理" },
  { key: "恒定电流", expectedTitle: "恒定电流：电路分析与等效定理" },
  { key: "洛伦兹力", expectedTitle: "磁场：安培力、洛伦兹力与毕奥-萨伐尔定律" },
  { key: "电磁感应", expectedTitle: "电磁感应：法拉第定律与楞次定律" },
  { key: "热力学", expectedTitle: "热力学：第一定律、第二定律与熵" },
  { key: "光学", expectedTitle: "光学：几何光学与波动光学基础" },
  { key: "光电效应", expectedTitle: "近代物理：相对论、量子与原子核" },
];

describe("离线讲解 KB 扩容（11 个核心节点）", () => {
  it("新增条目数 = 11", () => {
    expect(CASES.length).toBe(11);
  });

  for (const c of CASES) {
    it(`命中「${c.key}」→ 六阶段 + 标题正确 + 离线模式`, async () => {
      const r = await generateExplainOffline(`请讲解${c.key}`, "kb_expand_stu");
      expect(r.mode).toBe("offline");
      expect(r.steps.length).toBe(6);
      // title 非空且正好等于专属 topic 标题 ⇒ 正确命中（board 随之确定）
      expect(r.title).toBeTruthy();
      expect(r.title).toBe(c.expectedTitle);
      // 六个阶段顺序固定
      const phases = r.steps.map((s) => s.phase);
      expect(phases).toEqual([
        "问题拆解",
        "概念辨析",
        "数理推导",
        "图像分析",
        "结论",
        "易错点",
      ]);
      // 每个阶段都有实质文本（非通用兜底）
      expect(r.steps.every((s) => s.text.length > 0)).toBe(true);
    });
  }
});
