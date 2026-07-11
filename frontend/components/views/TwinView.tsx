// components/views/TwinView.tsx
// 数字孪生：九维学生画像卡片。从后端 dashboard.twin 拉取真实数据。
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Progress from "@/components/ui/progress";
import { NINE_DIMS } from "@/lib/pomosData";
import { getDashboard, type Dashboard } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

function colorFor(v: number): string {
  if (v >= 75) return "#10b981";
  if (v >= 60) return "#f59e0b";
  return "#ef4444";
}

interface TwinViewProps {
  studentId: string;
  refreshKey?: number;
}

interface DimView {
  label: string;
  value: number; // 0-100
  hint: string;
}

const TwinView: React.FC<TwinViewProps> = ({ studentId, refreshKey }) => {
  const { t } = useI18n();
  const [dash, setDash] = React.useState<Dashboard | null>(null);

  React.useEffect(() => {
    let alive = true;
    getDashboard(studentId)
      .then((d) => alive && setDash(d))
      .catch(() => alive && setDash(null));
    return () => {
      alive = false;
    };
  }, [studentId, refreshKey]);

  const dims: DimView[] = dash
    ? dash.twin.map((d) => ({
        label: d.label,
        value: Math.round(d.value * 100),
        hint: d.hint,
      }))
    : NINE_DIMS.map((d) => ({ label: d.label, value: d.value, hint: d.hint }));

  const sorted = [...dims].sort((a, b) => b.value - a.value);
  const strongest = sorted[0];
  const weakest = sorted[sorted.length - 1];

  return (
    <div className="h-full space-y-4 overflow-y-auto p-6">
      <div>
        <h2 className="text-sm font-semibold">{t("views.twin.title")}</h2>
        <p className="text-[11px] text-muted-foreground">
          {t("views.twin.sub")}
          {dash ? "" : " · 示例数据"} · 最强「{strongest.label}」· 最弱「{weakest.label}」
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {dims.map((d) => (
          <Card key={d.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm">{d.label}</CardTitle>
              <span className="text-lg font-bold" style={{ color: colorFor(d.value) }}>
                {d.value}
              </span>
            </CardHeader>
            <CardContent className="space-y-2">
              <Progress value={d.value} color={colorFor(d.value)} />
              <p className="text-[11px] leading-relaxed text-muted-foreground">{d.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">画像解读</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 text-xs">
          <Badge variant="success">优势：{strongest.label} {strongest.value}</Badge>
          <Badge variant="destructive">短板：{weakest.label} {weakest.value}</Badge>
          <Badge variant="secondary">建议优先：迁移能力 / 跨板块综合</Badge>
        </CardContent>
      </Card>
    </div>
  );
};

export default TwinView;
