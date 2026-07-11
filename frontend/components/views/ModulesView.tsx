// components/views/ModulesView.tsx
// 模块地图：16 个 POMOS 模块按五层组织，可搜索、点击查看模块职责与实现状态。
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LAYER_META, MODULES, MODULE_STATUS, type PomosLayer, type PomosModule } from "@/lib/pomosData";
import { useI18n } from "@/lib/i18n";

const ORDER: PomosLayer[] = [
  "Persona",
  "Cognitive",
  "Knowledge",
  "Teaching",
  "Runtime",
];

const ModulesView: React.FC = () => {
  const { t } = useI18n();
  const [selected, setSelected] = React.useState<PomosModule | null>(null);
  const [query, setQuery] = React.useState("");

  const q = query.trim().toLowerCase();
  const match = (m: PomosModule) =>
    !q || m.name.toLowerCase().includes(q) || m.desc.toLowerCase().includes(q);

  const liveCount = MODULES.filter((m) => MODULE_STATUS[m.id]?.status === "live").length;

  return (
    <div className="h-full space-y-4 overflow-y-auto p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">{t("views.modules.title")}</h2>
          <p className="text-[11px] text-muted-foreground">{t("views.modules.sub")}</p>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索模块…"
          className="w-44 rounded-md border border-border bg-background px-3 py-1.5 text-xs outline-none transition-colors focus:border-brand"
        />
      </div>

      <div className="text-[11px] text-muted-foreground">
        已实装 <span className="font-semibold text-success">{liveCount}</span> / {MODULES.length} 个模块
      </div>

      {/* 选中模块详情面板 */}
      {selected && (
        <Card className="border-brand/40 bg-brand/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">
              <span
                className="mr-2 rounded px-1.5 py-0.5 text-[10px] font-bold text-white"
                style={{ backgroundColor: LAYER_META[selected.layer].color }}
              >
                {selected.code}
              </span>
              {selected.name}
            </CardTitle>
            <button
              onClick={() => setSelected(null)}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              关闭
            </button>
          </CardHeader>
          <CardContent className="space-y-1 text-xs">
            <div>
              <span className="text-muted-foreground">所属层级：</span>
              {LAYER_META[selected.layer].label}
            </div>
            <div>
              <span className="text-muted-foreground">核心职责：</span>
              {selected.desc}
            </div>
            {(() => {
              const info = MODULE_STATUS[selected.id];
              if (!info) return null;
              return (
                <>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">实现状态：</span>
                    {info.status === "live" ? (
                      <span className="font-semibold text-success">✓ 已实装</span>
                    ) : (
                      <span className="font-semibold text-muted-foreground">◌ 架构占位</span>
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground">位置：</span>
                    <code className="rounded bg-background/70 px-1">{info.file}</code>
                  </div>
                  <div>
                    <span className="text-muted-foreground">说明：</span>
                    {info.note}
                  </div>
                </>
              );
            })()}
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {ORDER.map((layer) => {
          const meta = LAYER_META[layer];
          const mods = MODULES.filter((m) => m.layer === layer && match(m));
          if (q && mods.length === 0) return null;
          return (
            <Card key={layer} className="overflow-hidden">
              <CardHeader
                className="flex flex-row items-center gap-3 space-y-0"
                style={{ backgroundColor: `${meta.color}10` }}
              >
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: meta.color }}
                />
                <CardTitle className="text-sm" style={{ color: meta.color }}>
                  {meta.label}
                </CardTitle>
                <span className="text-[11px] text-muted-foreground">
                  · {meta.blurb}
                </span>
                <span className="ml-auto rounded-full bg-background/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                  {mods.length} 模块
                </span>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
                {mods.map((m) => {
                  const info = MODULE_STATUS[m.id];
                  const live = info?.status === "live";
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelected(m)}
                      className={`rounded-md border border-border p-3 text-left transition-colors hover:border-brand ${
                        selected?.id === m.id ? "border-brand bg-brand/5" : ""
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="rounded px-1.5 py-0.5 text-[10px] font-bold text-white"
                          style={{ backgroundColor: meta.color }}
                        >
                          {m.code}
                        </span>
                        <span className="text-xs font-semibold">{m.name}</span>
                        <span
                          className={`ml-auto rounded-full px-1.5 py-0.5 text-[9px] ${
                            live
                              ? "bg-success/15 text-success"
                              : "bg-muted text-muted-foreground"
                          }`}
                          title={live ? "已实装" : "架构占位"}
                        >
                          {live ? "✓" : "◌"}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">{m.desc}</p>
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default ModulesView;
