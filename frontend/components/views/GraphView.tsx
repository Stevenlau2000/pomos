// components/views/GraphView.tsx
// 知识图谱视图：力导向图 + 选中节点详情面板。
// 节点着色由后端 dashboard.board_mastery（真实 twin 推导）驱动。
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import KnowledgeGraph from "@/components/dashboard/KnowledgeGraph";
import type { KGNode } from "@/lib/pomosData";
import { getDashboard, type Dashboard } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface GraphViewProps {
  studentId: string;
  refreshKey?: number;
}

const GraphView: React.FC<GraphViewProps> = ({ studentId, refreshKey }) => {
  const { t } = useI18n();
  const [selected, setSelected] = React.useState<KGNode | null>(null);
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

  const masteryOf = (n: KGNode) =>
    dash && dash.board_mastery[n.board] != null
      ? Math.round(dash.board_mastery[n.board])
      : n.mastery;

  return (
    <div className="grid h-full grid-cols-1 gap-4 overflow-hidden p-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Card className="flex h-full flex-col">
          <CardHeader>
            <CardTitle className="text-sm">{t("views.graph.title")}</CardTitle>
            <p className="text-[11px] text-muted-foreground">
              点击节点查看掌握度 · 实线=先修 虚线=迁移 · 节点亮度=真实掌握度
            </p>
          </CardHeader>
          <CardContent className="flex-1">
            <KnowledgeGraph onSelect={setSelected} boardMastery={dash?.board_mastery} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">节点详情</CardTitle>
        </CardHeader>
        <CardContent>
          {selected ? (
            <div className="space-y-3">
              <div className="text-lg font-bold">{selected.name}</div>
              <Badge variant="secondary">{selected.board}</Badge>
              <div className="space-y-2 pt-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">掌握度</span>
                  <span className="font-semibold">{masteryOf(selected)}/100</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${masteryOf(selected)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">难度</span>
                  <span className="font-semibold">{"★".repeat(selected.difficulty)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">竞赛权重</span>
                  <span className="font-semibold">{"★".repeat(selected.importance)}</span>
                </div>
              </div>
              <button className="mt-2 w-full rounded-md bg-brand px-3 py-2 text-xs font-medium text-brand-foreground">
                生成针对性训练
              </button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              在左侧图谱中点击任意节点，查看其掌握度、难度与竞赛权重，并一键生成针对性训练。
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default GraphView;
