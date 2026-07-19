// components/knowledge/KnowledgeBaseDrawer.tsx
// 个人知识库抽屉：导入 .txt/.md/.pdf/.docx（按 student_id 隔离）→ 列表 / 删除 → 关键词召回预览。
// 解析（pdf/docx）动态 import 懒加载；零外部依赖的关键词召回见 lib/knowledgeBase.ts。
"use client";

import * as React from "react";
import { X, Upload, Trash2, FileText, Search, Loader2, Database } from "lucide-react";
import {
  listDocs,
  importDoc,
  deleteDoc,
  retrieve,
  type KnowledgeDoc,
  type Chunk,
} from "@/lib/knowledgeBase";

interface KnowledgeBaseDrawerProps {
  open: boolean;
  studentId: string;
  onClose: () => void;
}

const ACCEPT = ".txt,.md,.pdf,.docx";
const TYPE_LABEL: Record<string, string> = {
  pdf: "PDF",
  txt: "TXT",
  md: "MD",
  docx: "DOCX",
};

function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
function fmtTime(s: string): string {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const KnowledgeBaseDrawer: React.FC<KnowledgeBaseDrawerProps> = ({
  open,
  studentId,
  onClose,
}) => {
  const [docs, setDocs] = React.useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [msg, setMsg] = React.useState("");
  const [msgType, setMsgType] = React.useState<"ok" | "err" | "">("");

  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<Chunk[]>([]);
  const [searching, setSearching] = React.useState(false);

  const fileRef = React.useRef<HTMLInputElement>(null);

  const flash = (type: "ok" | "err", text: string) => {
    setMsgType(type);
    setMsg(text);
    if (typeof window !== "undefined") {
      window.setTimeout(() => setMsg(""), 2800);
    }
  };

  const load = React.useCallback(() => {
    if (!open || !studentId) return;
    setLoading(true);
    listDocs(studentId)
      .then(setDocs)
      .catch(() => setDocs([]))
      .finally(() => setLoading(false));
  }, [open, studentId]);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleImport = async (file: File) => {
    if (!studentId) return;
    setImporting(true);
    try {
      const doc = await importDoc(studentId, file);
      setDocs((prev) => [doc, ...prev]);
      flash("ok", `已导入「${doc.filename}」（${doc.chunks.length} 个片段）`);
    } catch (e) {
      flash("err", String(e));
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDelete = async (docId: string, filename: string) => {
    if (typeof window !== "undefined" && !window.confirm(`确认删除「${filename}」？`)) return;
    if (!studentId) return;
    try {
      await deleteDoc(studentId, docId);
      setDocs((prev) => prev.filter((d) => d.doc_id !== docId));
      setHits((prev) => prev); // 召回结果可能失效，清空
      flash("ok", `已删除「${filename}」`);
    } catch {
      flash("err", "删除失败");
    }
  };

  const handleSearch = async () => {
    const q = query.trim();
    if (!q || !studentId) return;
    setSearching(true);
    try {
      const r = await retrieve(studentId, q, 5);
      setHits(r);
    } catch {
      setHits([]);
    } finally {
      setSearching(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative z-10 flex h-full w-full max-w-md flex-col bg-background shadow-xl">
        {/* header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-brand" />
            <div className="leading-tight">
              <div className="text-sm font-semibold">个人知识库</div>
              <div className="text-[11px] text-muted-foreground">按学生隔离 · 本地 IndexedDB</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="关闭"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {/* 导入 */}
          <div className="space-y-2">
            <div className="text-sm font-medium">导入文档</div>
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImport(f);
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={importing}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-brand hover:text-brand disabled:opacity-60"
            >
              {importing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              选择 .txt / .md / .pdf / .docx
            </button>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              文档内容经轻量切分后存入本地知识库，可用于「生成讲义」时注入个人参考资料。
            </p>
          </div>

          {/* 文档列表 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">已导入（{docs.length}）</div>
              <button onClick={load} className="text-[11px] text-muted-foreground hover:text-brand">
                刷新
              </button>
            </div>
            {loading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> 加载中…
              </div>
            ) : docs.length === 0 ? (
              <div className="rounded-md border border-dashed border-border px-3 py-4 text-center text-[11px] text-muted-foreground">
                暂无文档
              </div>
            ) : (
              <div className="space-y-2">
                {docs.map((d) => (
                  <div
                    key={d.doc_id}
                    className="flex items-center gap-3 rounded-md border border-border px-3 py-2"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-brand" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium">{d.filename}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {TYPE_LABEL[d.type] ?? d.type} · {fmtSize(d.size)} · {d.chunks.length} 片段 · {fmtTime(d.imported_at)}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(d.doc_id, d.filename)}
                      className="rounded p-1 text-muted-foreground transition-colors hover:text-destructive"
                      aria-label="删除文档"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 关键词召回 */}
          <div className="space-y-2">
            <div className="text-sm font-medium">关键词召回</div>
            <div className="flex gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearch();
                }}
                placeholder="输入知识点，如：电磁感应"
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand"
              />
              <button
                onClick={handleSearch}
                disabled={searching || !query.trim()}
                className="flex items-center gap-1 rounded-md bg-brand px-3 py-2 text-xs font-medium text-brand-foreground disabled:opacity-60"
              >
                {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                召回
              </button>
            </div>
            {hits.length > 0 && (
              <div className="space-y-2">
                {hits.map((c) => (
                  <div key={c.id} className="rounded-md border border-border bg-accent/40 px-3 py-2 text-[11px] leading-relaxed">
                    {c.content.length > 240 ? `${c.content.slice(0, 240)}…` : c.content}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* footer 提示 */}
        {msg && (
          <div
            className={
              "border-t px-5 py-2.5 text-xs " +
              (msgType === "ok" ? "text-success" : "text-destructive")
            }
          >
            {msg}
          </div>
        )}
      </div>
    </div>
  );
};

export default KnowledgeBaseDrawer;
