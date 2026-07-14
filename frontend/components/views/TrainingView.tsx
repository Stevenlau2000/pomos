// components/views/TrainingView.tsx
// 竞赛训练：AOCS 周期规划 + ALOE 今日规划时间线（个性化，来自后端 /training）。
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Progress from "@/components/ui/progress";
import { TRAINING_PLAN, TODAY_PLAN } from "@/lib/pomosData";
import { getTraining, type TrainingPlan } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { ChevronDown, ChevronUp, Copy, Check } from "lucide-react";

// ALOE 今日规划支持两种 type 写法：
// 1) PlanType：复习/新学/训练/实验（pomosData 默认值）
// 2) 动作标签：练习/反思/输出（后端/离线 API 可能直接返回动作标签）
interface TypeMeta {
  color: string;
  label: string;
  action: string;
}

const TYPE_META: Record<string, TypeMeta> = {
  复习: { color: "#6366f1", label: "复习", action: "反思" },
  新学: { color: "#0ea5e9", label: "新学", action: "输出" },
  训练: { color: "#f59e0b", label: "训练", action: "练习" },
  实验: { color: "#10b981", label: "实验", action: "输出" },
  // 离线 API 可能直接返回动作标签作为 type
  练习: { color: "#f59e0b", label: "训练", action: "练习" },
  反思: { color: "#6366f1", label: "复习", action: "反思" },
  输出: { color: "#0ea5e9", label: "输出", action: "输出" },
};

const getMeta = (type: string): TypeMeta =>
  TYPE_META[type] ?? { color: "#6366f1", label: type, action: "开始" };

interface TrainingViewProps {
  studentId: string;
  refreshKey?: number;
}

const TrainingView: React.FC<TrainingViewProps> = ({ studentId, refreshKey }) => {
  const { t } = useI18n();
  const [plan, setPlan] = React.useState<TrainingPlan | null>(null);
  const [expandedWeek, setExpandedWeek] = React.useState<number | null>(null);
  const [expandedTask, setExpandedTask] = React.useState<number | null>(null);
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState("");
  const [msgType, setMsgType] = React.useState<"ok" | "err" | "">("");
  const flash = React.useCallback((type: "ok" | "err", text: string) => {
    setMsgType(type);
    setMsg(text);
    if (typeof window !== "undefined") {
      window.setTimeout(() => setMsg(""), 2800);
    }
  }, []);

  React.useEffect(() => {
    let alive = true;
    getTraining(studentId)
      .then((p) => alive && setPlan(p))
      .catch(() => alive && setPlan(null));
    return () => {
      alive = false;
    };
  }, [studentId, refreshKey]);

  const weekly = plan?.weekly ?? TRAINING_PLAN;
  const today = plan?.today ?? TODAY_PLAN;
  const rationale = plan?.rationale;

  /** 当 navigator.clipboard 不可用时，用 execCommand('copy') 兜底 */
  const copyByExecCommand = (text: string): boolean => {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.top = "-9999px";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  };

  const handleCopy = React.useCallback(
    async (text: string, key: string) => {
      let ok = false;
      try {
        await navigator.clipboard.writeText(text);
        ok = true;
      } catch {
        ok = copyByExecCommand(text);
      }
      if (ok) {
        setCopiedKey(key);
        window.setTimeout(() => setCopiedKey(null), 1500);
      } else {
        flash("err", "复制失败，请手动复制");
      }
    },
    [flash]
  );

  const weekPrompt = (w: (typeof weekly)[number]) =>
    `我是你的物理竞赛导师。请帮我制定「第 ${w.week} 周 · ${w.focus}」的详细训练计划，包含以下任务：${w.items.join("；")}。负荷 ${w.load}，请按 AOCS 自适应原则给出具体安排。`;

  const taskPrompt = (p: (typeof today)[number]) =>
    `我是你的物理竞赛导师。请陪我完成今日 ALOE 任务：${p.time} · ${p.task}（类型：${p.type}，优先级：${p.priority}）。请以「${getMeta(p.type).action}」模式开始引导我。`;

  return (
    <div className="h-full space-y-4 overflow-y-auto p-6">
      <div>
        <h2 className="text-sm font-semibold">{t("views.training.title")}</h2>
        <p className="text-[11px] text-muted-foreground">
          {t("views.training.sub")}
          {plan ? " · 已按你的画像个性化" : " · 示例计划"}
        </p>
      </div>

      {rationale && (
        <div className="rounded-md border border-brand/30 bg-brand/5 p-3 text-xs text-foreground">
          {rationale}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">4 周训练周期（AOCS）</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {weekly.map((w) => {
            const open = expandedWeek === w.week;
            return (
              <div key={w.week} className="rounded-md border border-border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">第 {w.week} 周</span>
                  <Badge variant="secondary">负荷 {w.load}</Badge>
                </div>
                <div className="mt-1 text-xs font-medium text-brand">{w.focus}</div>
                <ul className="mt-2 list-inside list-disc space-y-1 text-[11px] text-muted-foreground">
                  {w.items.map((it, i) => (
                    <li key={i}>{it}</li>
                  ))}
                </ul>
                <Progress value={w.load} className="mt-2" />
                <Button
                  variant="default"
                  size="sm"
                  className="mt-2 h-7 w-full text-[11px]"
                  onClick={() => setExpandedWeek(open ? null : w.week)}
                >
                  {open ? "收起" : "查看训练"}
                  {open ? (
                    <ChevronUp className="ml-1 h-3 w-3" />
                  ) : (
                    <ChevronDown className="ml-1 h-3 w-3" />
                  )}
                </Button>

                {open && (
                  <div className="mt-2 space-y-2 rounded-md border border-border bg-muted/30 p-2">
                    <p className="text-[11px] text-muted-foreground">
                      点击「复制提示词」即可粘贴到 AI 对话中开始本周针对性训练。
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 w-full text-[11px]"
                      onClick={() => handleCopy(weekPrompt(w), `week-${w.week}`)}
                    >
                      {copiedKey === `week-${w.week}` ? (
                        <>
                          <Check className="mr-1 h-3 w-3" />
                          已复制
                        </>
                      ) : (
                        <>
                          <Copy className="mr-1 h-3 w-3" />
                          复制提示词
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">今日规划（ALOE Priority Score）</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative space-y-4 border-l border-border pl-6">
            {today.map((p, i) => {
              const m = getMeta(p.type);
              const open = expandedTask === i;
              return (
                <div key={i} className="relative">
                  <span
                    className="absolute -left-[1.65rem] top-1 h-3 w-3 rounded-full border-2 border-background"
                    style={{ backgroundColor: m.color }}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">
                      {p.time} · {p.task}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="text-[10px]"
                        style={{ color: m.color, borderColor: m.color }}
                      >
                        {m.label}
                      </Badge>
                      <Button
                        variant="default"
                        size="sm"
                        className="h-7 text-[10px]"
                        style={{ backgroundColor: m.color, borderColor: m.color }}
                        onClick={() => setExpandedTask(open ? null : i)}
                      >
                        {m.action}
                      </Button>
                      <span className="text-[11px] text-muted-foreground">
                        优先级 {p.priority}
                      </span>
                    </div>
                  </div>

                  {open && (
                    <div className="mt-2 space-y-2 rounded-md border border-border bg-muted/30 p-2">
                      <p className="text-[11px] text-muted-foreground">
                        类型：{m.label} · 动作：{m.action} · 优先级 {p.priority}
                        <br />
                        点击「复制提示词」后可在 AI 对话中开始本次{m.action}。
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 w-full text-[11px]"
                        onClick={() => handleCopy(taskPrompt(p), `task-${i}`)}
                      >
                        {copiedKey === `task-${i}` ? (
                          <>
                            <Check className="mr-1 h-3 w-3" />
                            已复制
                          </>
                        ) : (
                          <>
                            <Copy className="mr-1 h-3 w-3" />
                            复制任务提示词
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

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

export default TrainingView;
