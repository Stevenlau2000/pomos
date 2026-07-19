// components/explain/MermaidView.tsx
// 懒加载 Mermaid 渲染器：仅在组件挂载时动态 import("mermaid")，
// 避免顶部直引拖慢首屏（架构 §6 要求 mermaid 改为 next/dynamic 懒加载）。
"use client";

import * as React from "react";

const MermaidView: React.FC<{ code: string; className?: string }> = ({
  code,
  className,
}) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "default",
          securityLevel: "strict",
        });
        const id = `mmd-${Math.random().toString(36).slice(2)}`;
        const { svg } = await mermaid.render(id, code);
        if (!cancelled && ref.current) ref.current.innerHTML = svg;
      } catch (e: unknown) {
        if (!cancelled) setError(String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (error) {
    return (
      <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs text-destructive">
        {error}
      </pre>
    );
  }
  return (
    <div
      ref={ref}
      className={className ?? "my-2 flex justify-center"}
    />
  );
};

export default MermaidView;
