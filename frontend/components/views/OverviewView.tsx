// components/views/OverviewView.tsx
// 能力总览：PQ 雷达 + 学习曲线 + 就绪度 + 关键指标卡。
// 现在从后端 /api/students/{id}/dashboard 拉取真实数据，失败回退静态示例。
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Target, Bug, BookOpen } from "lucide-react";
import PqRadar from "@/components/dashboard/PqRadar";
import LearningCurve from "@/components/dashboard/LearningCurve";
import ReadinessGauge from "@/components/dashboard/ReadinessGauge";
import Progress from "@/components/ui/progress";
import {
  SAMPLE_PQ,
  SAMPLE_RADAR,
  SAMPLE_GROWTH,
  SAMPLE_READINESS,
  PCDF_LAYERS,
  MISTAKES,
  type PcdfLayer,
} from "@/lib/pomosData";
import { getMistakes, type Mistake } from "@/lib/api";
import { derivePcdfLayers } from "@/lib/offlineGen";
import { useDashboard } from "@/lib/useDashboard";
import { useI18n } from "@/lib/i18n";

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-brand/10 text-brand">
          {icon}
        </div>
        <div className="leading-tight">
          <div className="text-[11px] text-muted-foreground">{label}</div>
          <div className="text-xl font-bold">{value}</div>
          <div className="text-[11px] text-muted-foreground">{sub}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function fmtTs(ts: number | string): string {
  const n = typeof ts === "number" ? ts : Number(ts);
  if (!n || Number.isNaN(n)) return "";
  const d = new Date(n * 1000);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

interface OverviewViewProps {
  studentId: string;
  refreshKey?: number;
}

const OverviewView: React.FC<OverviewViewProps> = ({ studentId, refreshKey }) => {
  const { t } = useI18n();
  // 仪表盘数据统一由 useDashboard hook 拉取（取代原先重复的 getDashboard + useState + useEffect 样板）
  const { dash } = useDashboard(studentId, refreshKey);
  const [mistakes, setMistakes] = React.useState<Mistake[] | null>(null);

  React.useEffect(() => {
    let alive = true;
    getMistakes(studentId)
      .then((m) => alive && setMistakes(m))
      .catch(() => alive && setMistakes(null));
    return () => {
      alive = false;
    };
  }, [studentId]);

  const pq = dash ? Math.round(dash.pq * 100) : SAMPLE_PQ;
  const radar = dash
    ? {
        knowledge: Math.round(dash.radar.knowledge * 100),
        modeling: Math.round(dash.radar.modeling * 100),
        scientific_thinking: Math.round(dash.radar.scientific_thinking * 100),
        transfer: Math.round(dash.radar.transfer * 100),
        competition: Math.round(dash.radar.competition * 100),
        growth: Math.round(dash.radar.growth * 100),
      }
    : SAMPLE_RADAR;
  const growth = dash
    ? dash.growth_curve.map((p) => ({ ts: fmtTs(p.ts), pq: Math.round(p.pq * 100) }))
    : SAMPLE_GROWTH;
  const readiness = dash ? dash.readiness : SAMPLE_READINESS;
  // 诊断分层：有真实孪生时由九维推导，否则回退示例数据
  const pcdf: PcdfLayer[] = dash ? derivePcdfLayers(dash.twin) : [];

  const lowest = [...PCDF_LAYERS].sort((a, b) => a.score - b.score)[0];
  // 最弱维度优先取实时数字孪生（动态数据），无数据时回退到静态 PCDF 参考层
  const weakestDim = dash?.twin
    ? [...dash.twin].sort((a, b) => a.value - b.value)[0]
    : null;
  const realMistakes = mistakes ?? MISTAKES;
  const unmastered = realMistakes.filter((m) => m.status !== "已掌握").length;
  const avgDim = dash
    ? Math.round(dash.twin.reduce((s, d) => s + d.value, 0) / dash.twin.length * 100)
    : 70;

  return (
    <div className="h-full space-y-4 overflow-y-auto p-6">
      <div>
        <h2 className="text-sm font-semibold">{t("views.overview.title")}</h2>
        <p className="text-[11px] text-muted-foreground">{t("views.overview.sub")}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="物理商 PQ"
          value={`${pq}`}
          sub={dash ? "实时评估" : "示例值"}
        />
        <StatCard
          icon={<Target className="h-5 w-5" />}
          label="九维均值"
          value={`${avgDim}`}
          sub={dash ? "来自数字孪生" : "示例值"}
        />
        <StatCard
          icon={<Bug className="h-5 w-5" />}
          label="待巩固错题"
          value={`${unmastered}`}
          sub={dash ? "来自错题本" : "含 1 项未掌握"}
        />
        <StatCard
          icon={<BookOpen className="h-5 w-5" />}
          label="最弱维度"
          value={weakestDim ? weakestDim.label : `L${lowest.layer}`}
          sub={weakestDim ? `数字孪生 · ${Math.round(weakestDim.value * 100)}` : lowest.name}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>PQ 能力雷达</CardTitle>
          </CardHeader>
          <CardContent>
            <PqRadar data={radar} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>学习曲线</CardTitle>
          </CardHeader>
          <CardContent>
            <LearningCurve data={growth} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>备赛就绪度</CardTitle>
          </CardHeader>
          <CardContent>
            <ReadinessGauge data={readiness} />
            <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
              <div className="flex justify-between">
                <span>省一概率</span>
                <span className="font-medium text-foreground">
                  {Math.round(readiness.province_top * 100)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span>省队概率</span>
                <span className="font-medium text-foreground">
                  {Math.round(readiness.province_team * 100)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span>IPhO 概率</span>
                <span className="font-medium text-foreground">
                  {Math.round(readiness.ipho * 100)}%
                </span>
              </div>
              <p className="pt-1 text-[10px] leading-relaxed">
                就绪度由九维数字孪生加权推导（省一 / 省队 / IPhO 三档概率），与能力画像实时挂钩。
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>诊断分层健康度（来自数字孪生）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(pcdf.length ? pcdf : PCDF_LAYERS).map((l) => {
            const color =
              l.status === "ok"
                ? "#10b981"
                : l.status === "warn"
                  ? "#f59e0b"
                  : "#ef4444";
            return (
              <div key={l.layer} className="space-y-1">
                <div className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-xs text-muted-foreground">
                    L{l.layer} {l.name}
                  </span>
                  <Progress value={l.score} color={color} />
                  <span className="w-10 shrink-0 text-right text-xs font-medium">{l.score}</span>
                </div>
                <p className="pl-24 text-[10px] leading-relaxed text-muted-foreground">{l.note}</p>
              </div>
            );
          })}
          {!dash && (
            <p className="pt-1 text-[10px] text-muted-foreground">当前为示例数据；接入画像后显示真实分层。</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OverviewView;
