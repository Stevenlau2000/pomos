// components/views/MistakesView.tsx
// 错题本：从后端 /mistakes 拉取真实数据，支持新增 / 状态流转 / 删除 / 多模态，
// 并支持「AI 生成解析」（归因分类 + 原因分析 + 正确解法 + 防错策略）。
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MISTAKES } from "@/lib/pomosData";
import {
  getMistakes,
  getApiMode,
  createMistake,
  updateMistake,
  deleteMistake,
  uploadMistakeImage,
  generateMistakeAnalysis,
  API_BASE,
  type Mistake as ApiMistake,
} from "@/lib/api";
import { getMistakes as offlineGetMistakes } from "@/lib/offlineApi";
import { BUG_CATEGORIES } from "@/lib/physicsKB";
import type { MistakeAnalysis } from "@/lib/offlineGen";
import { useI18n } from "@/lib/i18n";

/** 轻量 toast：用于把加载/写入失败反馈给用户（替代静默 catch） */
function useFlash() {
  const [msg, setMsg] = React.useState("");
  const [msgType, setMsgType] = React.useState<"ok" | "err" | "">("");
  const flash = React.useCallback((type: "ok" | "err", text: string) => {
    setMsgType(type);
    setMsg(text);
    if (typeof window !== "undefined") {
      window.setTimeout(() => setMsg(""), 2800);
    }
  }, []);
  return { msg, msgType, flash };
}

function statusVariant(s: string) {
  if (s === "已掌握") return "success" as const;
  if (s === "巩固中") return "secondary" as const;
  return "destructive" as const;
}

const NEXT_STATUS: Record<string, string> = {
  未掌握: "巩固中",
  巩固中: "已掌握",
  已掌握: "未掌握",
};

function imgUrl(p?: string | null): string | null {
  if (!p) return null;
  if (p.startsWith("http") || p.startsWith("data:")) return p;
  return `${API_BASE}${p}`;
}

function formatAnalysis(a: MistakeAnalysis): string {
  return [
    `【归因类别】${a.categoryLabel}`,
    ``,
    `【原因分析】`,
    a.cause,
    ``,
    `【正确解法 / 思路】`,
    a.correctApproach,
    ``,
    `【防错策略】`,
    a.prevention,
  ].join("\n");
}

interface MistakesViewProps {
  studentId: string;
  refreshKey?: number;
}

const MistakesView: React.FC<MistakesViewProps> = ({ studentId, refreshKey }) => {
  const { t } = useI18n();
  const [list, setList] = React.useState<ApiMistake[] | null>(null);
  const [topic, setTopic] = React.useState("");
  const [summary, setSummary] = React.useState("");
  const [analysis, setAnalysis] = React.useState("");
  const [bugCat, setBugCat] = React.useState(BUG_CATEGORIES[0].id);
  const [file, setFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);
  const { msg, msgType, flash } = useFlash();

  const load = React.useCallback(() => {
    getMistakes(studentId)
      .then(setList)
      .catch(async () => {
        if (getApiMode() === "offline") {
          try {
            const local = await offlineGetMistakes(studentId);
            setList(local);
            return;
          } catch {
            /* 落到静态示例 */
          }
        }
        setList(null);
        flash("err", "错题加载失败，显示示例数据");
      });
  }, [studentId, flash]);

  React.useEffect(() => {
    load();
  }, [load, refreshKey]);

  const addMistake = async () => {
    if (!topic.trim() || busy) return;
    setBusy(true);
    try {
      const created = await createMistake(studentId, {
        topic: topic.trim(),
        summary: summary.trim() || "（未填写摘要）",
        analysis: analysis.trim() || undefined,
        bug_id: bugCat,
      });
      if (file) {
        try {
          await uploadMistakeImage(studentId, created.id, file);
        } catch {
          /* 图片上传失败时仍保留文字错题 */
        }
      }
      setTopic("");
      setSummary("");
      setAnalysis("");
      setFile(null);
      load();
    } catch (e) {
      flash("err", "操作失败：" + ((e as Error)?.message || String(e)));
    } finally {
      setBusy(false);
    }
  };

  const cycle = async (m: ApiMistake) => {
    try {
      await updateMistake(studentId, m.id, { status: NEXT_STATUS[m.status] ?? "未掌握" });
      load();
    } catch (e) {
      flash("err", "操作失败：" + ((e as Error)?.message || String(e)));
    }
  };

  const remove = async (m: ApiMistake) => {
    try {
      await deleteMistake(studentId, m.id);
      load();
    } catch (e) {
      flash("err", "操作失败：" + ((e as Error)?.message || String(e)));
    }
  };

  const saveAnalysis = async (m: ApiMistake, text: string) => {
    try {
      await updateMistake(studentId, m.id, { analysis: text });
      load();
    } catch (e) {
      flash("err", "操作失败：" + ((e as Error)?.message || String(e)));
    }
  };

  const saveBug = async (m: ApiMistake, bugId: string) => {
    try {
      await updateMistake(studentId, m.id, { bug_id: bugId });
      load();
    } catch (e) {
      flash("err", "操作失败：" + ((e as Error)?.message || String(e)));
    }
  };

  const onUploadImage = async (m: ApiMistake, f: File) => {
    try {
      await uploadMistakeImage(studentId, m.id, f);
      load();
    } catch (e) {
      flash("err", "操作失败：" + ((e as Error)?.message || String(e)));
    }
  };

  const items: ApiMistake[] =
    list ??
    MISTAKES.map((m) => ({
      id: m.id,
      topic: m.topic,
      summary: m.summary,
      bug_id: m.bugId,
      status: m.status,
      recurrence: m.recurrence,
      created_at: m.date,
    }));

  return (
    <div className="h-full space-y-4 overflow-y-auto p-6">
      <div>
        <h2 className="text-sm font-semibold">{t("views.mistakes.title")}</h2>
        <p className="text-[11px] text-muted-foreground">{t("views.mistakes.sub")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">新增错题（支持题目原图 + 解析）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="主题，如：电磁感应·导体棒切割"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs outline-none focus:border-brand"
          />
          <input
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="错误摘要（可选）"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs outline-none focus:border-brand"
          />
          <select
            value={bugCat}
            onChange={(e) => setBugCat(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs outline-none focus:border-brand"
          >
            {BUG_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                归因分类：{c.label}
              </option>
            ))}
          </select>
          <textarea
            value={analysis}
            onChange={(e) => setAnalysis(e.target.value)}
            placeholder="题目解析 / 正确思路（可选，可点「AI 生成解析」自动生成）"
            rows={3}
            className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-xs outline-none focus:border-brand"
          />
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-[11px] text-muted-foreground file:mr-2 file:rounded-md file:border-0 file:bg-brand/10 file:px-2 file:py-1 file:text-brand"
            />
            {file && <span className="shrink-0 text-[11px] text-success">已选 {file.name}</span>}
          </div>
          <button
            onClick={addMistake}
            disabled={!topic.trim() || busy}
            className="w-full rounded-md bg-brand px-3 py-2 text-xs font-medium text-brand-foreground disabled:opacity-60"
          >
            加入错题本
          </button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {items.map((m) => (
          <MistakeCard
            key={m.id}
            m={m}
            onCycle={() => cycle(m)}
            onRemove={() => remove(m)}
            onSaveAnalysis={(text) => saveAnalysis(m, text)}
            onSaveBug={(id) => saveBug(m, id)}
            onUploadImage={(f) => onUploadImage(m, f)}
          />
        ))}
        {items.length === 0 && (
          <p className="text-xs text-muted-foreground">错题本为空。在诊断视图检测到的误区可一键加入。</p>
        )}
      </div>

      {msg && (
        <div
          className={
            "sticky bottom-0 border-t bg-background/95 px-6 py-2 text-xs backdrop-blur " +
            (msgType === "ok" ? "text-success" : "text-destructive")
          }
        >
          {msg}
        </div>
      )}
    </div>
  );
};

function MistakeCard({
  m,
  onCycle,
  onRemove,
  onSaveAnalysis,
  onSaveBug,
  onUploadImage,
}: {
  m: ApiMistake;
  onCycle: () => void;
  onRemove: () => void;
  onSaveAnalysis: (text: string) => void;
  onSaveBug: (bugId: string) => void;
  onUploadImage: (f: File) => void;
}) {
  const [editAnalysis, setEditAnalysis] = React.useState(m.analysis ?? "");
  const [showAnalysis, setShowAnalysis] = React.useState(false);
  const [busyAI, setBusyAI] = React.useState(false);
  const url = imgUrl(m.image_path);
  const cat = BUG_CATEGORIES.find((c) => c.id === m.bug_id);

  const handleAIAnalysis = () => {
    setBusyAI(true);
    const a = generateMistakeAnalysis(m.topic, m.summary ?? "", m.bug_id ?? undefined);
    setEditAnalysis(formatAnalysis(a));
    setShowAnalysis(true);
    setBusyAI(false);
  };

  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">{m.topic}</div>
            <div className="mt-1 text-xs text-muted-foreground">{m.summary}</div>
          </div>
          <Badge variant={statusVariant(m.status)}>{m.status}</Badge>
        </div>

        {url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={m.topic}
            className="max-h-48 w-full rounded-md border border-border object-contain"
          />
        )}

        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <Badge variant="outline">归因 {cat?.label ?? "未分类"}</Badge>
          <span className="text-muted-foreground">复发 {m.recurrence} 次</span>
          <label className="cursor-pointer rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground hover:border-brand hover:text-brand">
            上传图片
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUploadImage(f);
              }}
            />
          </label>
          <button
            onClick={handleAIAnalysis}
            disabled={busyAI}
            className="rounded-md border border-brand px-2 py-1 text-[11px] font-medium text-brand hover:bg-brand/10 disabled:opacity-60"
          >
            AI 生成解析
          </button>
          <button
            onClick={() => setShowAnalysis((v) => !v)}
            className="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground hover:border-brand hover:text-brand"
          >
            {showAnalysis ? "收起解析" : "编辑解析"}
          </button>
          <button
            onClick={onCycle}
            className="ml-auto rounded-md bg-brand px-3 py-1 text-[11px] font-medium text-brand-foreground"
          >
            {m.status === "已掌握" ? "重置" : "标记进阶"}
          </button>
          <button
            onClick={onRemove}
            className="rounded-md border border-border px-3 py-1 text-[11px] font-medium text-muted-foreground hover:border-destructive hover:text-destructive"
          >
            删除
          </button>
        </div>

        {showAnalysis && (
          <div className="space-y-2 border-t border-border pt-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">归因分类</span>
              <select
                value={m.bug_id ?? ""}
                onChange={(e) => onSaveBug(e.target.value)}
                className="rounded-md border border-border bg-background px-2 py-1 text-[11px] outline-none focus:border-brand"
              >
                <option value="">未分类</option>
                {BUG_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              value={editAnalysis}
              onChange={(e) => setEditAnalysis(e.target.value)}
              placeholder="填写正确思路 / 解析…（可先用「AI 生成解析」生成草稿）"
              rows={6}
              className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-xs outline-none focus:border-brand"
            />
            <button
              onClick={() => onSaveAnalysis(editAnalysis)}
              className="w-full rounded-md bg-brand/90 px-3 py-1.5 text-[11px] font-medium text-brand-foreground"
            >
              保存解析
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default MistakesView;
