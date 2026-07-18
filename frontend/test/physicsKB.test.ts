// test/physicsKB.test.ts
// 物理知识库检索单元测试：findBoardByKeyword / inferBugCategory。
import { describe, it, expect } from "vitest";
import {
  findBoardByKeyword,
  inferBugCategory,
  BUG_CATEGORIES,
} from "@/lib/physicsKB";

describe("findBoardByKeyword", () => {
  it("已知关键词返回对应板块", () => {
    expect(findBoardByKeyword("力学")).toBe("力学");
    expect(findBoardByKeyword("法拉第电磁感应")).toBe("电磁学");
    expect(findBoardByKeyword("热力学第二定律")).toBe("热学");
    expect(findBoardByKeyword("双缝干涉与透镜")).toBe("光学");
    expect(findBoardByKeyword("相对论与洛伦兹变换")).toBe("近代物理");
  });

  it("不区分大小写（英文关键词）", () => {
    expect(findBoardByKeyword("NEWTON 动力学")).toBe("力学");
    expect(findBoardByKeyword("Quantum 势阱")).toBe("近代物理");
  });

  it("无关词 / 空串返回 null", () => {
    expect(findBoardByKeyword("音乐欣赏与绘画")).toBeNull();
    expect(findBoardByKeyword("")).toBeNull();
  });
});

describe("inferBugCategory", () => {
  it("已知主题映射到正确的归因分类", () => {
    expect(inferBugCategory("电磁感应理解偏差").id).toBe("concept");
    expect(inferBugCategory("刚体转动模型误判").id).toBe("model");
    expect(inferBugCategory("符号与单位漏写").id).toBe("symbol");
    expect(inferBugCategory("审题漏读条件").id).toBe("reading");
    expect(inferBugCategory("极限自检缺失").id).toBe("check");
    expect(inferBugCategory("方法僵化不会换路").id).toBe("method");
    expect(inferBugCategory("概念本质迷思").id).toBe("concept");
  });

  it("返回的归因分类是 7 类之一", () => {
    const ids = BUG_CATEGORIES.map((c) => c.id);
    for (const topic of ["动量守恒", "滑轮问题", "折射率", "光电效应", "卡诺循环"]) {
      const cat = inferBugCategory(topic);
      expect(ids).toContain(cat.id);
      expect(typeof cat.label).toBe("string");
      expect(typeof cat.desc).toBe("string");
      expect(typeof cat.fix).toBe("string");
    }
  });
});
