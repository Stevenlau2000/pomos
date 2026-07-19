// QA 独立验证：教材库结构 + 检索命中冒烟测试
// 由 software-qa-engineer (Edward) 编写，回归防护「新概念」拆分与学科扩展改写。
import { describe, it, expect } from "vitest";
import { TEXTBOOKS, type Textbook } from "../lib/textbooks";
import { searchTextbooks } from "../lib/textbookRetriever";

const byId = (id: string) => TEXTBOOKS.find((t) => t.id === id);

/** 返回某查询结果命中的教材 id 集合（去重、保序）。 */
function hitIds(query: string, topK = 6): string[] {
  return [...new Set(searchTextbooks(query, topK).map((h) => h.textbook.id))];
}

describe("教材库结构 (REQ-KB-02 / 拆分校验)", () => {
  it("TEXTBOOKS 总数为 14", () => {
    expect(TEXTBOOKS.length).toBe(14);
  });

  it("5 条新概念卷 subject 正确分别为 力学/热学/电磁学/光学/近代物理", () => {
    expect(byId("tb-xg-mech")?.subject).toBe("力学");
    expect(byId("tb-xg-thermo")?.subject).toBe("热学");
    expect(byId("tb-xg-em")?.subject).toBe("电磁学");
    expect(byId("tb-xg-optics")?.subject).toBe("光学");
    expect(byId("tb-xg-quantum")?.subject).toBe("近代物理");
  });

  it("3 部学科扩展 author/title 已换成真实参考书", () => {
    const math = byId("tb-math");
    expect(math?.author).toBe("同济大学数学系");
    expect(math?.title).toContain("高等数学");

    const vec = byId("tb-vector");
    expect(vec?.author).toBe("谢树艺");
    expect(vec?.title).toContain("矢量分析与场论");

    const ed = byId("tb-electro");
    expect(ed?.author).toBe("郭硕鸿");
    expect(ed?.title).toContain("电动力学");
  });

  it("全库作者字段无 'POMOS 教研组' 残留", () => {
    const residue = TEXTBOOKS.filter((t: Textbook) => t.author === "POMOS 教研组");
    expect(residue).toHaveLength(0);
  });

  it("无 tb-xingainian / TB_XINGAINIAN 残留 id", () => {
    expect(byId("tb-xingainian")).toBeUndefined();
    expect(TEXTBOOKS.some((t) => /xingainian/i.test(t.id))).toBe(false);
  });

  it("每条教材 source 字段无占位残留", () => {
    const bad: string[] = [];
    for (const tb of TEXTBOOKS) {
      for (const ch of tb.chapters) {
        for (const ex of ch.examples) {
          if (/POMOS\s*教研组/.test(ex.source)) bad.push(`${tb.id}/${ex.id}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
});

describe("检索冒烟 (核心)：拆分后各卷可正确命中", () => {
  it('"热学" 命中 tb-xg-thermo（新概念热学卷）', () => {
    const ids = hitIds("热学");
    expect(ids).toContain("tb-xg-thermo");
  });

  it('"电磁学" 命中 tb-xg-em（新概念电磁学卷）', () => {
    const ids = hitIds("电磁学");
    expect(ids).toContain("tb-xg-em");
  });

  it('"光学" 命中 tb-xg-optics（新概念光学卷）', () => {
    const ids = hitIds("光学");
    expect(ids).toContain("tb-xg-optics");
  });

  it('"量子" 命中 tb-xg-quantum（subject=近代物理）', () => {
    const ids = hitIds("量子");
    expect(ids).toContain("tb-xg-quantum");
  });

  it('"玻尔" 命中 tb-xg-quantum（原子模型/玻尔卷）', () => {
    const ids = hitIds("玻尔");
    expect(ids).toContain("tb-xg-quantum");
  });

  it('"原子模型" 命中 tb-xg-quantum', () => {
    const ids = hitIds("原子模型");
    expect(ids).toContain("tb-xg-quantum");
  });

  it('"相对论" 命中 tb-xg-mech（力学卷含相对论章节）', () => {
    const ids = hitIds("相对论");
    expect(ids).toContain("tb-xg-mech");
  });

  it('"矢量" 命中 tb-vector（谢树艺）', () => {
    const ids = hitIds("矢量");
    expect(ids).toContain("tb-vector");
  });

  it('"散度" 命中 tb-vector', () => {
    const ids = hitIds("散度");
    expect(ids).toContain("tb-vector");
  });

  it('"麦克斯韦" 命中 tb-electro（郭硕鸿）', () => {
    const ids = hitIds("麦克斯韦");
    expect(ids).toContain("tb-electro");
  });

  it('"电动力学" 命中 tb-electro', () => {
    const ids = hitIds("电动力学");
    expect(ids).toContain("tb-electro");
  });

  it('"泰勒" 命中 tb-math（同济）', () => {
    const ids = hitIds("泰勒");
    expect(ids).toContain("tb-math");
  });

  it('"高数" 命中 tb-math', () => {
    const ids = hitIds("高数");
    expect(ids).toContain("tb-math");
  });
});
