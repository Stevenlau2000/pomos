// components/explain/SourceRefs.tsx
// 教材引用标签：可点击 / 悬停 tooltip 展示出处（纯展示，不跳转外部）。
"use client";

import * as React from "react";

export const SourceRefs: React.FC<{ refs: string[] }> = ({ refs }) => {
  if (!refs || refs.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      <span className="self-center text-[10px] text-muted-foreground">
        教材引用：
      </span>
      {refs.map((r, i) => (
        <span
          key={i}
          title={r}
          className="cursor-default rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:border-brand hover:text-brand"
        >
          📚 {r}
        </span>
      ))}
    </div>
  );
};
