// lib/knowledgeBase.ts
// 个人知识库：文档导入（路由解析器）→ 轻量切分 → 按 student_id 存 IndexedDB → 关键词召回。
// 零外部依赖；解析器（pdf/docx）动态 import 懒加载（见 lib/parsers）。
import { idbGetByIndex, idbPut, idbDelete } from "./db/idb";
import { STORE } from "./db/schema";
import { parseText } from "./parsers/textParser";
import { parsePdf } from "./parsers/pdfParser";
import { parseDocx } from "./parsers/docxParser";

export type DocType = "pdf" | "txt" | "md" | "docx";

export interface Chunk {
  id: string;
  index: number;
  content: string;
  keywords: string[];
}

export interface KnowledgeDoc {
  doc_id: string;
  student_id: string;
  filename: string;
  type: DocType;
  size: number;
  imported_at: string;
  chunks: Chunk[];
}

function extType(name: string): DocType | null {
  const n = name.toLowerCase();
  if (n.endsWith(".pdf")) return "pdf";
  if (n.endsWith(".txt")) return "txt";
  if (n.endsWith(".md")) return "md";
  if (n.endsWith(".docx")) return "docx";
  return null;
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 关键词抽取：按词频取 Top-8（中文按字符、英文按词）。 */
function extractKeywords(s: string): string[] {
  const t = s.toLowerCase();
  const tokens = t.split(/[^一-龥a-z0-9]+/i).filter((w) => w.length >= 2);
  const freq = new Map<string, number>();
  for (const tk of tokens) freq.set(tk, (freq.get(tk) ?? 0) + 1);
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map((e) => e[0]);
}

/** 轻量切分：先按空行分段落，超长段再按句切，保证单块可读。 */
function chunkText(text: string): Chunk[] {
  const paras = text
    .split(/\n\s*\n+/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 0);
  const chunks: Chunk[] = [];
  let idx = 0;
  for (const p of paras) {
    if (p.length <= 600) {
      chunks.push(makeChunk(idx++, p));
      continue;
    }
    const parts = p.match(/[^。！？\n]{1,600}[。！？]?/g) ?? [p];
    for (const part of parts) {
      const c = part.trim();
      if (c) chunks.push(makeChunk(idx++, c));
    }
  }
  return chunks;
}

function makeChunk(index: number, content: string): Chunk {
  return { id: `c_${index}_${hashStr(content)}`, index, content, keywords: extractKeywords(content) };
}

/**
 * 导入文档：按扩展名路由到对应解析器（pdf/docx 动态 import 懒加载），
 * 解析 → 切分 → 存该生 IndexedDB，返回 KnowledgeDoc。
 */
export async function importDoc(studentId: string, file: File): Promise<KnowledgeDoc> {
  const type = extType(file.name);
  if (!type) throw new Error("不支持的文件格式（仅支持 txt / md / pdf / docx）");

  let text = "";
  if (type === "pdf") text = await parsePdf(file);
  else if (type === "docx") text = await parseDocx(file);
  else text = await parseText(file);

  const chunks = chunkText(text);
  const doc: KnowledgeDoc = {
    doc_id: `kb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    student_id: studentId,
    filename: file.name,
    type,
    size: file.size,
    imported_at: new Date().toISOString(),
    chunks,
  };
  await idbPut(STORE.knowledge_base, doc);
  return doc;
}

/** 列出某生已导入的文档（按导入时间倒序）。 */
export async function listDocs(studentId: string): Promise<KnowledgeDoc[]> {
  const docs = await idbGetByIndex<KnowledgeDoc>(STORE.knowledge_base, "student_id", studentId);
  return docs.sort((a, b) => (a.imported_at < b.imported_at ? 1 : -1));
}

/** 删除某生指定文档（校验归属，防越权）。 */
export async function deleteDoc(studentId: string, docId: string): Promise<void> {
  const docs = await idbGetByIndex<KnowledgeDoc>(STORE.knowledge_base, "student_id", studentId);
  if (docs.find((d) => d.doc_id === docId)) {
    await idbDelete(STORE.knowledge_base, docId);
  }
}

function tokenize(s: string): string[] {
  const t = (s || "").toLowerCase();
  if (!t) return [];
  return t.split(/[^一-龥a-z0-9]+/i).filter((w) => w.length > 0);
}

/**
 * 关键词召回：跨该生全文档 chunk 做命中打分，返回 Top-K。
 * 命中规则：query token 出现在正文（权重 2）+ 出现在 chunk 关键词（权重 1）。
 */
export async function retrieve(studentId: string, query: string, topK = 3): Promise<Chunk[]> {
  const docs = await listDocs(studentId);
  const all = docs.flatMap((d) => d.chunks);
  const qt = tokenize(query);
  if (qt.length === 0) return [];
  const scored = all
    .map((c) => {
      let score = 0;
      for (const tk of qt) {
        if (c.content.toLowerCase().includes(tk)) score += 2;
      }
      for (const kw of c.keywords) {
        for (const tk of qt) {
          if (kw.includes(tk)) score += 1;
        }
      }
      return { c, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map((x) => x.c);
}
