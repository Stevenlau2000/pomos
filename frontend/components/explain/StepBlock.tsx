// components/explain/StepBlock.tsx
// 单个讲解步骤：阶段徽标 + 标题 + 富文本 + 公式 + 图 + 动画 + 易错点高亮 + 教材引用。
// 渐进揭示：按 index * 150ms 错峰淡入（reveal 由 ExplainCard 控制）。
"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import type { ExplainStep } from "@/lib/explain/types";
import { ExplainRichText, toMath } from "./ExplainRichText";
import { SourceRefs } from "./SourceRefs";
import { cn } from "@/lib/utils";

const DiagramRenderer = dynamic(
  () => import("./DiagramRenderer").then((m) => m.DiagramRenderer),
  { ssr: false },
);
const AnimationPlayer = dynamic(
  () => import("./AnimationPlayer").then((m) => m.AnimationPlayer),
  { ssr: false },
);

export const StepBlock: React.FC<{
  step: ExplainStep;
  index: number;
  reveal: boolean;
}> = ({ step, index, reveal }) => {
  const [shown, setShown] = React.useState(false);
  React.useEffect(() => {
    if (!reveal) return;
    // 150ms 错峰揭示，避免一次性堆叠
    const t = setTimeout(() => setShown(true), Math.min(index, 5) * 150);
    return () => clearTimeout(t);
  }, [reveal, index]);

  return (
    <div
      className={cn(
        "rounded-md border border-border bg-background/40 p-3 transition-all duration-300",
        shown ? "opacity-100" : "opacity-0",
      )}
    >
      <div className="mb-1.5 flex items-center gap-2">
        <span className="rounded bg-brand/10 px-2 py-0.5 text-[10px] font-medium text-brand">
          {step.phase}
        </span>
        {step.heading && step.heading !== step.phase && (
          <span className="text-[12px] font-medium text-card-foreground">{step.heading}</span>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground">#{index + 1}</span>
      </div>

      <div className="text-[13px] leading-relaxed text-card-foreground/90">
        <ExplainRichText text={step.text} />
      </div>

      {step.formulas && step.formulas.length > 0 && (
        <div className="mt-1.5 space-y-1">
          {step.formulas.map((f, i) => (
            <div key={i} className="text-[13px]">
              <ExplainRichText text={toMath(f)} />
            </div>
          ))}
        </div>
      )}

      {step.diagram && <DiagramRenderer spec={step.diagram} />}
      {step.animation && <AnimationPlayer spec={step.animation} />}

      {step.misconception && (
        <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-[12px] text-destructive">
          ⚠ 易错点：{step.misconception}
        </div>
      )}

      {step.sourceRefs && step.sourceRefs.length > 0 && <SourceRefs refs={step.sourceRefs} />}
    </div>
  );
};
