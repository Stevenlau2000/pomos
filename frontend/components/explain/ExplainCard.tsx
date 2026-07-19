// components/explain/ExplainCard.tsx
// 富讲解卡片：标题 + 模式徽标（云端/离线/讲义）+ 六阶段步骤（渐进揭示）+ 教材引用区。
// 由 MessageBubble 懒加载（next/dynamic），仅 mentor 消息携带 explain 时渲染。
"use client";

import * as React from "react";
import type { PomosExplainV1 } from "@/lib/explain/types";
import { StepBlock } from "./StepBlock";
import { SourceRefs } from "./SourceRefs";
import { cn } from "@/lib/utils";

const MODE_BADGE: Record<string, { label: string; cls: string }> = {
  cloud: { label: "云端 AI", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  offline: { label: "离线讲解", cls: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  lecture: { label: "讲义适配", cls: "bg-sky-500/10 text-sky-600 border-sky-500/30" },
};

export const ExplainCard: React.FC<{ explain: PomosExplainV1 }> = ({ explain }) => {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    const t = setTimeout(() => setMounted(true), 20);
    return () => clearTimeout(t);
  }, []);

  const badge = MODE_BADGE[explain.mode] ?? MODE_BADGE.offline;

  return (
    <div
      className={cn(
        "rounded-lg border border-brand/20 bg-card p-4 transition-all duration-300",
        mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-card-foreground">{explain.title}</h3>
        <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px]", badge.cls)}>
          {badge.label}
          {explain.offline_fallback ? " · 降级" : ""}
        </span>
      </div>

      <div className="space-y-3">
        {explain.steps.map((s, i) => (
          <StepBlock key={s.id} step={s} index={i} reveal={mounted} />
        ))}
      </div>

      {explain.sources && explain.sources.length > 0 && (
        <div className="mt-3 border-t border-border pt-2">
          <SourceRefs refs={explain.sources} />
        </div>
      )}
    </div>
  );
};
