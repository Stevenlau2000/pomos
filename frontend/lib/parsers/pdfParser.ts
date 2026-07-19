// lib/parsers/pdfParser.ts
// PDF 解析：pdfjs-dist 动态 import（懒加载，避免进主包），提取全文文本。
// worker 置于 public/pdf.worker.min.mjs，运行时以 ${basePath}/pdf.worker.min.mjs 注入（兼容静态导出子路径）。
export async function parsePdf(file: File): Promise<string> {
  // 动态 import：打包器自动拆为独立 chunk，首屏不下载 pdfjs-dist
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const base = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");
  pdfjs.GlobalWorkerOptions.workerSrc = `${base}/pdf.worker.min.mjs`;

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((it) => ("str" in it ? (it as { str: string }).str : ""))
      .join(" ");
    pages.push(text);
  }
  return pages.join("\n\n");
}
