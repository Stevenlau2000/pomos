// components/views/GraphView.tsx
// 知识图谱视图：力导向图 + 选中节点详情面板。
// 节点着色由后端 dashboard.board_mastery（九维孪生真实推导）驱动；
// 点击节点可「直接让导师生成」针对性训练，并在本页内联渲染。
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import KnowledgeGraph from "@/components/dashboard/KnowledgeGraph";
import type { KGNode } from "@/lib/pomosData";
import { getDashboard, generateTrainingForNode, type Dashboard } from "@/lib/api";
import { masteryTier, type GeneratedTraining } from "@/lib/offlineGen";
import type { Board } from "@/lib/physicsKB";
import { useI18n } from "@/lib/i18n";

interface GraphViewProps {
  studentId: string;
  refreshKey?: number;
  /** 把节点交给导师（对话视图）生成训练讲解 */
  onGenerateTraining?: (node: KGNode) => void;
}

const GraphView: React.FC<GraphViewProps> = ({
  studentId,
  refreshKey,
  onGenerateTraining,
}) => {
  const { t } = useI18n();
  const [selected, setSelected] = React.useState<KGNode | null>(null);
  const [dash, setDash] = React.useState<Dashboard | null>(null);
  const [generated, setGenerated] = React.useState<GeneratedTraining | null>(null);
  const [busy, setBusy] = React.useState(false);

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

  const handleGenerate = (n: KGNode) => {
    setBusy(true);
    // 直接调用生成引擎，立即在本页渲染梯度训练（不再空跳转）
    const m = masteryOf(n);
    const res = generateTrainingForNode(n.name, n.board as Board, m);
    setGenerated(res);
    setBusy(false);
  };

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

      <Card className="flex flex-col overflow-hidden">
        <CardHeader>
          <CardTitle className="text-sm">节点详情</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 space-y-3 overflow-y-auto">
          {selected ? (
            <>
              <div className="text-lg font-bold">{selected.name}</div>
              <Badge variant="secondary">{selected.board}</Badge>
              <div className="space-y-2 pt-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">掌握度</span>
                  <span className="font-semibold">{masteryOf(selected)}/100</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${masteryOf(selected)}%`,
                      backgroundColor: masteryTier(masteryOf(selected)).color,
                    }}
                  />
                </div>
                <Badge
                  variant="outline"
                  style={{
                    color: masteryTier(masteryOf(selected)).color,
                    borderColor: masteryTier(masteryOf(selected)).color,
                  }}
                >
                  层级：{masteryTier(masteryOf(selected)).label}
                </Badge>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  {masteryTier(masteryOf(selected)).desc}
                </p>
                <div className="rounded-md border border-border bg-muted/30 p-2 text-[11px] leading-relaxed text-muted-foreground">
                  <span className="font-medium text-foreground">掌握度如何量化：</span>
                  由你的九维数字孪生按板块加权推导（如力学 = 建模·推理·计算·概念 加权），
                  映射到 0–100 分，再分为 入门→基础→熟练→进阶→精通 五档。
                </div>
              </div>

              <button
                onClick={() => handleGenerate(selected)}
                disabled={busy}
                className="mt-2 w-full rounded-md bg-brand px-3 py-2 text-xs font-medium text-brand-foreground transition-colors hover:bg-brand/90 disabled:opacity-60"
              >
                生成针对性训练
              </button>
              <button
                onClick={() => onGenerateTraining?.(selected)}
                className="w-full rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-brand hover:text-brand"
              >
                交给导师讲解
              </button>

              {generated && generated.node === selected.name && (
                <div className="mt-1 space-y-2 rounded-md border border-brand/30 bg-brand/5 p-3 text-xs">
                  <p className="font-semibold text-foreground">{generated.summary}</p>
                  <div>
                    <span className="font-medium text-foreground">🎯 训练目标</span>
                    <ul className="mt-1 list-inside list-disc space-y-1 text-muted-foreground">
                      {generated.objectives.map((o, i) => (
                        <li key={i}>{o}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span className="font-medium text-foreground">📚 梯度题</span>
                    <div className="mt-1 space-y-2">
                      {generated.problems.map((p, i) => (
                        <div key={p.id} className="rounded-md border border-border p-2">
                          <div className="font-medium">
                            第 {i + 1} 题 · {p.topic}{" "}
                            <span className="text-amber-500">{"★".repeat(p.difficulty)}</span>
                          </div>
                          <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground">
                            {p.stem}
                          </p>
                          <p className="mt-1 text-[11px] text-brand">提示：{p.hint}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="font-medium text-foreground">⚠️ 常见误区</span>
                    <ul className="mt-1 list-inside list-disc space-y-1 text-muted-foreground">
                      {generated.misconceptions.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </>
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
