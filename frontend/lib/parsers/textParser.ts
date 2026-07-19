// lib/parsers/textParser.ts
// TXT / MD 文本读取：直接读文本，MD 去标记保留正文。
// 体积极轻，可常驻；txt/md 走此解析器。
export async function parseText(file: File): Promise<string> {
  const raw = await file.text();
  return stripMarkdown(raw);
}

/** 去除常见 Markdown 标记，尽量保留可读正文。 */
function stripMarkdown(s: string): string {
  return s
    .replace(/^#{1,6}\s+/gm, "") // 标题
    .replace(/\*\*(.+?)\*\*/g, "$1") // 粗体
    .replace(/\*(.+?)\*/g, "$1") // 斜体
    .replace(/`(.+?)`/g, "$1") // 行内代码
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // 图片
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // 链接
    .replace(/^\s*>\s?/gm, ""); // 引用块标记
}
