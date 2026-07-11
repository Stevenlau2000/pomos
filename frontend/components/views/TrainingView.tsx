// components/views/TrainingView.tsx
// 竞赛训练：AOCS 周期规划 + ALOE 今日规划时间线（个性化，来自后端 /training）。
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Progress from "@/components/ui/progress";
import { TRAINING_PLAN, TODAY_PLAN, type PlanType } from "@/lib/pomosData";
import { getTraining, type TrainingPlan } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

const TYPE_META: Record<string, { color: string; label: string }> = {
  复习: { color: "#6366f1", label: "复习" },
  新学: { color: "#0ea5e9", label: "新学" },
  训练: { color: "#f59e0b", label: "训练" },
  实验: { color: "#10b981", label: "实验" },
};

interface TrainingViewProps {
  studentId: string;
  refreshKey?: number;
}

const TrainingView: React.FC<TrainingViewProps> = ({ studentId, refreshKey }) => {
  const { t } = useI18n();
  const [plan, setPlan] = React.useState<TrainingPlan | null>(null);

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
          {weekly.map((w) => (
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
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">今日规划（ALOE Priority Score）</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative space-y-4 border-l border-border pl-6">
            {today.map((p, i) => {
              const m = TYPE_META[p.type] ?? { color: "#6366f1", label: p.type };
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
                      <span className="text-[11px] text-muted-foreground">
                        优先级 {p.priority}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TrainingView;
