// components/views/DiagnosisView.tsx
// 认知诊断：PCDF 八层 + 认知 Bug 清单 + 本轮检测到的真实误区（可加入错题本）。
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Progress from "@/components/ui/progress";
import { PCDF_LAYERS, COGNITIVE_BUGS, type DiagStatus } from "@/lib/pomosData";
import { getDashboard, createMistake, type Dashboard } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

function statusMeta(s: DiagStatus): { color: string; label: string } {
  if (s === "ok") return { color: "#10b981", label: "健康" };
  if (s === "warn") return { color: "#f59e0b", label: "预警" };
  return { color: "#ef4444", label: "风险" };
}

interface DiagnosisViewProps {
  studentId: string;
  refreshKey?: number;
  onMistakeAdded?: () => void;
}

const DiagnosisView: React.FC<DiagnosisViewProps> = ({
  studentId,
  refreshKey,
  onMistakeAdded,
}) => {
  const { t } = useI18n();
  const [dash, setDash] = React.useState<Dashboard | null>(null);
  const [added, setAdded] = React.useState<Record<string, boolean>>({});
  const [busy, setBusy] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    getDashboard(studentId)
      .then((d) => alive && setDash(d))
      .catch(() => alive && setDash(null));
    return () => {
      alive = false;
    };
  }, [studentId, refreshKey]);

  const weak = dash?.weak_concepts ?? [];

  const addMistake = async (note: string) => {
    if (added[note] || busy) return;
    setBusy(note);
    try {
      await createMistake(studentId, {
        topic: "误区复盘",
        summary: note,
        bug_id: "detected",
      });
      setAdded((p) => ({ ...p, [note]: true }));
      onMistakeAdded?.();
    } catch {
      /* 忽略：后端不可达 */
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="h-full space-y-4 overflow-y-auto p-6">
      <div>
        <h2 className="text-sm font-semibold">{t("views.diagnosis.title")}</h2>
        <p className="text-[11px] text-muted-foreground">{t("views.diagnosis.sub")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">本轮检测到的误区</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {weak.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              暂无检测到明显误区。多在对话中提问，导师会实时诊断你的物理迷思概念。
            </p>
          ) : (
            weak.map((note, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs"
              >
                <span className="text-foreground">⚠ {note}</span>
                <button
                  disabled={!!added[note] || busy === note}
                  onClick={() => addMistake(note)}
                  className="shrink-0 rounded-md bg-brand px-3 py-1 text-[11px] font-medium text-brand-foreground disabled:opacity-60"
                >
                  {added[note] ? "已加入 ✓" : "加入错题本"}
                </button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">分层健康度</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {PCDF_LAYERS.map((l) => {
            const m = statusMeta(l.status);
            return (
              <div key={l.layer} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">
                    L{l.layer} · {l.name}
                  </span>
                  <Badge
                    variant={
                      l.status === "ok"
                        ? "success"
                        : l.status === "warn"
                          ? "secondary"
                          : "destructive"
                    }
                  >
                    {m.label} {l.score}
                  </Badge>
                </div>
                <Progress value={l.score} color={m.color} />
                <p className="text-[11px] text-muted-foreground">{l.note}</p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">认知 Bug 清单（Cognitive Bugs）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {COGNITIVE_BUGS.map((b) => (
            <details key={b.id} className="rounded-md border border-border p-3 text-xs">
              <summary className="flex cursor-pointer items-center justify-between">
                <span className="font-medium">
                  {b.title}
                  <span className="ml-2 text-muted-foreground">L{b.layer}</span>
                </span>
                <Badge variant={b.severity >= 4 ? "destructive" : "secondary"}>
                  严重度 {b.severity} · 复发 {b.recurrence}
                </Badge>
              </summary>
              <div className="mt-2 space-y-1 leading-relaxed text-muted-foreground">
                <div>
                  <span className="font-medium text-foreground">根因：</span>
                  {b.rootCause}
                </div>
                <div>
                  <span className="font-medium text-foreground">修复：</span>
                  {b.fix}
                </div>
              </div>
            </details>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default DiagnosisView;
