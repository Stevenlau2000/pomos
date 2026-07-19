// lib/parsers/docxParser.ts
// DOCX 解析：mammoth 动态 import（懒加载），提取纯文本。
// 注：mammoth 仅提取文本，MathType/OLE 公式与图片会丢失（本期文本优先，架构 §8 #7）。
export async function parseDocx(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}
