// components/ui/progress.tsx
// 简约进度条：用于九维画像、诊断分层等。
import * as React from "react";
import { cn } from "@/lib/utils";

interface ProgressProps {
  value: number; // 0-100
  className?: string;
  /** 自定义颜色（hsl 字符串或 tailwind 类） */
  color?: string;
}

const Progress: React.FC<ProgressProps> = ({ value, className, color }) => {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${v}%`, backgroundColor: color ?? "hsl(var(--brand))" }}
      />
    </div>
  );
};

export default Progress;
