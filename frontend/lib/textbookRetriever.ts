// lib/textbookRetriever.ts
// 教材检索：按学科 / 知识点 / 例题关键词在预置教材库（TEXTBOOKS）中定位条目。
// 供 lecture 引用出处、offlineGen 按知识点定向出题。零外部依赖。
import { TEXTBOOKS, type Textbook, type TextbookChapter, type TextbookPoint, type TextbookExample } from "./textbooks";

export interface TextbookHit {
  textbook: Textbook;
  chapter: TextbookChapter;
  point?: TextbookPoint;
  example?: TextbookExample;
  score: number;
}

function normalize(s: string): string {
  return (s || "").toLowerCase().trim();
}

function tokenize(s: string): string[] {
  const t = normalize(s);
  if (!t) return [];
  // 中文按字符、英文按词，统一小写
  return t.split(/[^一-龥a-z0-9]+/i).filter((x) => x.length > 0);
}

/** 在单条目标文本上做关键词命中打分（命中 token 数 / 词频）。 */
function scoreText(queryTokens: string[], target: string): number {
  if (queryTokens.length === 0) return 0;
  let hit = 0;
  const t = normalize(target);
  for (const tk of queryTokens) {
    if (t.includes(tk)) hit++;
  }
  return hit;
}

/**
 * 检索教材库，返回按相关度降序的命中条目（含知识点与例题）。
 * @param query 学科 / 知识点 / 例题关键词
 * @param topK  最多返回条数（默认 6）
 */
export function searchTextbooks(query: string, topK = 6): TextbookHit[] {
  const qt = tokenize(query);
  if (qt.length === 0) return [];
  const hits: TextbookHit[] = [];

  for (const tb of TEXTBOOKS) {
    for (const ch of tb.chapters) {
      for (const p of ch.points) {
        let score = scoreText(qt, p.title) * 2 + scoreText(qt, p.summary) + scoreText(qt, p.keywords.join(" "));
        if (score > 0) hits.push({ textbook: tb, chapter: ch, point: p, score });
      }
      for (const ex of ch.examples) {
        let score = scoreText(qt, ex.topic) * 2 + scoreText(qt, ex.stem) + scoreText(qt, ex.source);
        if (score > 0) hits.push({ textbook: tb, chapter: ch, example: ex, score });
      }
      // 章节标题也作为弱信号
      const chScore = scoreText(qt, ch.title);
      if (chScore > 0) hits.push({ textbook: tb, chapter: ch, score: chScore * 0.5 });
    }
    // 学科名直接命中整本教材
    if (scoreText(qt, tb.subject) > 0 || scoreText(qt, tb.title) > 0) {
      hits.push({ textbook: tb, chapter: tb.chapters[0], score: 1 });
    }
  }

  const seen = new Set<string>();
  const unique = hits.filter((h) => {
    const k = `${h.textbook.id}|${h.chapter.id}|${h.point?.id ?? ""}|${h.example?.id ?? ""}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  unique.sort((a, b) => b.score - a.score);
  return unique.slice(0, topK);
}

/** 取某知识点（字符串）命中的第一个典型例题（用于定向出题 / 讲义示例）。 */
export function findExampleByPoint(knowledgePoint: string): TextbookExample | null {
  const hits = searchTextbooks(knowledgePoint, 20);
  for (const h of hits) {
    if (h.example) return h.example;
  }
  return null;
}
