// components/views/TrainingView.tsx
// 竞赛训练：AOCS 周期规划 + ALOE 今日规划。
// 新增：竞赛导师生成题目、开启本周训练（完成回写能力并与总览/雷达联动）、今日规划自主编辑。
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Progress from "@/components/ui/progress";
import { TRAINING_PLAN, TODAY_PLAN, KG_BOARDS } from "@/lib/pomosData";
import {
  getTraining,
  getDashboard,
  applyMasteryDelta,
  masteryDeltaForBoard,
  generateCompetitionQuestion,
  type TrainingPlan,
  type Dashboard,
  type DailyPlan,
} from "@/lib/api";
import type { GeneratedQuestion } from "@/lib/offlineGen";
import type { Board } from "@/lib/physicsKB";
import { useI18n } from "@/lib/i18n";
import { ChevronDown, ChevronUp, Copy, Check, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";

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
  练习: { color: "#f59e0b", label: "训练", action: "练习" },
  反思: { color: "#6366f1", label: "复习", action: "反思" },
  输出: { color: "#0ea5e9", label: "输出", action: "输出" },
};
const getMeta = (type: string): TypeMeta =>
  TYPE_META[type] ?? { color: "#6366f1", label: type, action: "开始" };

const DAILY_KEY = (id: string) => `pomos_offline_dailyplan_${id}`;
const TRAIN_KEY = (id: string) => `pomos_offline_training_${id}`;

interface TrainingViewProps {
  studentId: string;
  refreshKey?: number;
  /** 训练完成后回写能力，通知父级刷新总览 / 雷达 */
  onProgress?: () => void;
  /** 把生成内容交给导师对话讲解 */
  onMentorPrompt?: (text: string) => void;
}

const TrainingView: React.FC<TrainingViewProps> = ({
  studentId,
  refreshKey,
  onProgress,
  onMentorPrompt,
}) => {
  const { t } = useI18n();
  const [plan, setPlan] = React.useState<TrainingPlan | null>(null);
  const [dash, setDash] = React.useState<Dashboard | null>(null);
  const [expandedWeek, setExpandedWeek] = React.useState<number | null>(null);
  const [expandedTask, setExpandedTask] = React.useState<number | null>(null);
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState("");
  const [msgType, setMsgType] = React.useState<"ok" | "err" | "">("");

  // 今日规划编辑
  const [daily, setDaily] = React.useState<DailyPlan[]>([]);
  const [editMode, setEditMode] = React.useState(false);

  // 本周训练
  const [trainActive, setTrainActive] = React.useState<number | null>(null);
  const [completed, setCompleted] = React.useState<Record<string, boolean>>({});

  // 竞赛导师生成题目
  const [genQ, setGenQ] = React.useState<GeneratedQuestion | null>(null);
  const [genBoard, setGenBoard] = React.useState<Board>("力学");
  const [genDiff, setGenDiff] = React.useState(3);
  const [genBusy, setGenBusy] = React.useState(false);

  const flash = React.useCallback((type: "ok" | "err", text: string) => {
    setMsgType(type);
    setMsg(text);
    if (typeof window !== "undefined") window.setTimeout(() => setMsg(""), 2800);
  }, []);

  React.useEffect(() => {
    let alive = true;
    getTraining(studentId)
      .then((p) => {
        if (!alive) return;
        setPlan(p);
        // 今日规划：优先使用用户持久化编辑，否则用个性化生成结果
        const persisted = (typeof window !== "undefined" && window.localStorage.getItem(DAILY_KEY(studentId))) || null;
        if (persisted) {
          try {
            setDaily(JSON.parse(persisted) as DailyPlan[]);
          } catch {
            setDaily(p.today);
          }
        } else {
          setDaily(p.today);
        }
      })
      .catch(() => alive && setPlan(null));
    getDashboard(studentId)
      .then((d) => alive && setDash(d))
      .catch(() => alive && setDash(null));
    // 训练状态（开启的周 + 完成项）
    const tp = (typeof window !== "undefined" && window.localStorage.getItem(TRAIN_KEY(studentId))) || null;
    if (tp) {
      try {
        const o = JSON.parse(tp) as { activeWeek: number | null; completed: Record<string, boolean> };
        setTrainActive(o.activeWeek);
        setCompleted(o.completed ?? {});
      } catch {
        /* ignore */
      }
    }
    return () => {
      alive = false;
    };
  }, [studentId, refreshKey]);

  const weekly = plan?.weekly ?? TRAINING_PLAN;
  const today = daily.length ? daily : plan?.today ?? TODAY_PLAN;
  const rationale = plan?.rationale;

  const persistDaily = (next: DailyPlan[]) => {
    setDaily(next);
    if (typeof window !== "undefined") window.localStorage.setItem(DAILY_KEY(studentId), JSON.stringify(next));
  };
  const persistTrain = (active: number | null, comp: Record<string, boolean>) => {
    if (typeof window !== "undefined")
      window.localStorage.setItem(TRAIN_KEY(studentId), JSON.stringify({ activeWeek: active, completed: comp }));
  };

  /** 根据周焦点推断回写板块（非板块焦点取最弱板块） */
  const boardOfFocus = (focus: string): Board => {
    if ((KG_BOARDS as readonly string[]).includes(focus)) return focus as Board;
    if (dash?.board_mastery) {
      const weak = [...KG_BOARDS].sort((a, b) => (dash.board_mastery[a] ?? 0) - (dash.board_mastery[b] ?? 0))[0];
      return weak as Board;
    }
    return "力学";
  };

  const handleComplete = async (week: number, focus: string, key: string) => {
    if (completed[key]) return;
    const board = boardOfFocus(focus);
    const delta = masteryDeltaForBoard(board);
    await applyMasteryDelta(studentId, delta);
    const next = { ...completed, [key]: true };
    setCompleted(next);
    persistTrain(trainActive, next);
    onProgress?.(); // 联动总览 / 雷达
    flash("ok", `已完成「${focus}」训练，已回写能力（${board} +）。可在「能力总览」查看变化。`);
  };

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
    [flash],
  );

  const weekPrompt = (w: (typeof weekly)[number]) =>
    `我是你的物理竞赛导师。请帮我制定「第 ${w.week} 周 · ${w.focus}」的详细训练计划，包含以下任务：${w.items.join("；")}。负荷 ${w.load}，请按 AOCS 自适应原则给出具体安排。`;
  const taskPrompt = (p: DailyPlan) =>
    `我是你的物理竞赛导师。请陪我完成今日 ALOE 任务：${p.time} · ${p.task}（类型：${p.type}，优先级：${p.priority}）。请以「${getMeta(p.type).action}」模式开始引导我。`;

  const handleGenerateQuestion = () => {
    setGenBusy(true);
    const q = generateCompetitionQuestion(genBoard, genDiff);
    setGenQ(q);
    setGenBusy(false);
  };

  // ---------------- 今日规划编辑操作
  const updateDaily = (idx: number, patch: Partial<DailyPlan>) => {
    persistDaily(daily.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  };
  const removeDaily = (idx: number) => persistDaily(daily.filter((_, i) => i !== idx));
  const moveDaily = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= daily.length) return;
    const next = [...daily];
    [next[idx], next[j]] = [next[j], next[idx]];
    persistDaily(next);
  };
  const addDaily = () =>
    persistDaily([...daily, { time: "21:00", task: "新任务", type: "练习", priority: 50 }]);

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

      {/* 竞赛导师生成题目 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">竞赛导师 · 生成题目</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={genBoard}
              onChange={(e) => setGenBoard(e.target.value as Board)}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-brand"
            >
              {KG_BOARDS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <select
              value={genDiff}
              onChange={(e) => setGenDiff(Number(e.target.value))}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-brand"
            >
              <option value={2}>难度 ★★ 基础</option>
              <option value={3}>难度 ★★★ 常规</option>
              <option value={4}>难度 ★★★★ 进阶</option>
              <option value={5}>难度 ★★★★★ 压轴</option>
            </select>
            <Button size="sm" onClick={handleGenerateQuestion} disabled={genBusy}>
              {genBusy ? "生成中…" : "生成题目"}
            </Button>
            {genQ && onMentorPrompt && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  onMentorPrompt(
                    `讲解这道题：${genQ.stem}\n【参考答案要点】\n${genQ.solutionPoints.join("\n")}`,
                  )
                }
              >
                交给导师讲解
              </Button>
            )}
          </div>
          {genQ && (
            <div className="space-y-2 rounded-md border border-brand/30 bg-brand/5 p-3 text-xs">
              <div className="font-semibold">
                {genQ.topic}（{genQ.board} · 难度 {"★".repeat(genQ.difficulty)}）
              </div>
              <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground">{genQ.stem}</p>
              <p className="text-brand">提示：{genQ.hint}</p>
              <div>
                <span className="font-medium text-foreground">标准解答要点</span>
                <ul className="mt-1 list-inside list-decimal space-y-1 text-muted-foreground">
                  {genQ.solutionPoints.map((s, i) => (
                    <li key={i} className="whitespace-pre-wrap text-[11px] leading-relaxed">{s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <span className="font-medium text-foreground">关键考点</span>
                <ul className="mt-1 list-inside list-disc space-y-1 text-muted-foreground">
                  {genQ.keyPoints.map((k, i) => (
                    <li key={i} className="text-[11px]">{k}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4 周训练周期 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">4 周训练周期（AOCS）</CardTitle>
          <Button
            size="sm"
            variant={trainActive != null ? "secondary" : "default"}
            onClick={() => {
              const next = trainActive != null ? null : weekly[0]?.week ?? 1;
              setTrainActive(next);
              persistTrain(next, completed);
              flash(next != null ? "ok" : "ok", next != null ? "已开启本周训练，完成任务即可回写能力" : "已结束本周训练");
            }}
          >
            {trainActive != null ? "结束本周训练" : "开启本周训练"}
          </Button>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {weekly.map((w) => {
            const open = expandedWeek === w.week;
            const active = trainActive === w.week;
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
                  {open ? <ChevronUp className="ml-1 h-3 w-3" /> : <ChevronDown className="ml-1 h-3 w-3" />}
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
                          <Check className="mr-1 h-3 w-3" /> 已复制
                        </>
                      ) : (
                        <>
                          <Copy className="mr-1 h-3 w-3" /> 复制提示词
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {active && (
                  <div className="mt-2 space-y-1 rounded-md border border-brand/30 bg-brand/5 p-2">
                    <div className="text-[11px] font-medium text-brand">本周训练打卡</div>
                    {w.items.map((it, i) => {
                      const key = `${w.week}-${i}`;
                      const done = !!completed[key];
                      return (
                        <label key={i} className="flex cursor-pointer items-center gap-2 text-[11px]">
                          <input
                            type="checkbox"
                            checked={done}
                            onChange={() => handleComplete(w.week, w.focus, key)}
                            className="accent-brand"
                          />
                          <span className={done ? "line-through text-muted-foreground" : ""}>{it}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* 今日规划（可编辑） */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">今日规划（ALOE Priority Score）</CardTitle>
          <div className="flex items-center gap-2">
            {editMode && (
              <Button size="sm" variant="outline" onClick={addDaily}>
                <Plus className="mr-1 h-3 w-3" /> 添加
              </Button>
            )}
            <Button size="sm" variant={editMode ? "default" : "outline"} onClick={() => setEditMode((v) => !v)}>
              {editMode ? "完成编辑" : "编辑今日规划"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {editMode ? (
            <div className="space-y-2">
              {daily.map((p, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2">
                  <input
                    value={p.time}
                    onChange={(e) => updateDaily(i, { time: e.target.value })}
                    className="w-16 rounded border border-border bg-background px-2 py-1 text-[11px] outline-none focus:border-brand"
                  />
                  <input
                    value={p.task}
                    onChange={(e) => updateDaily(i, { task: e.target.value })}
                    className="flex-1 rounded border border-border bg-background px-2 py-1 text-[11px] outline-none focus:border-brand"
                  />
                  <select
                    value={p.type}
                    onChange={(e) => updateDaily(i, { type: e.target.value })}
                    className="rounded border border-border bg-background px-2 py-1 text-[11px] outline-none focus:border-brand"
                  >
                    {["练习", "反思", "输出", "复习", "新学", "训练", "实验"].map((tp) => (
                      <option key={tp} value={tp}>{tp}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={p.priority}
                    onChange={(e) => updateDaily(i, { priority: Number(e.target.value) })}
                    className="w-14 rounded border border-border bg-background px-2 py-1 text-[11px] outline-none focus:border-brand"
                  />
                  <button onClick={() => moveDaily(i, -1)} className="text-muted-foreground hover:text-brand" title="上移">
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <button onClick={() => moveDaily(i, 1)} className="text-muted-foreground hover:text-brand" title="下移">
                    <ArrowDown className="h-3 w-3" />
                  </button>
                  <button onClick={() => removeDaily(i)} className="text-muted-foreground hover:text-destructive" title="删除">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
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
                        <Badge variant="outline" className="text-[10px]" style={{ color: m.color, borderColor: m.color }}>
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
                        <span className="text-[11px] text-muted-foreground">优先级 {p.priority}</span>
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
                              <Check className="mr-1 h-3 w-3" /> 已复制
                            </>
                          ) : (
                            <>
                              <Copy className="mr-1 h-3 w-3" /> 复制任务提示词
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
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
