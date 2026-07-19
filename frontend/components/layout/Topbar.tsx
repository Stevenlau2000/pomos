// components/layout/Topbar.tsx
// 顶栏：学生切换 + PQ 徽标 + 模型接入状态（真实供应商 / Mock）+ 设置入口。
"use client";

import * as React from "react";
import { Gauge, Circle, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import StudentSwitcher from "@/components/layout/StudentSwitcher";

interface TopbarProps {
  studentId: string;
  studentName: string;
  grade?: string;
  pq: number;
  mock: boolean;
  provider?: string;
  model?: string;
  onOpenSettings: () => void;
  onSelectStudent: (id: string) => void;
  onCreateStudent: (name: string, grade: string) => void;
  onDeleteStudent: (id: string) => void;
  onOpenKb?: () => void;
}

const Topbar: React.FC<TopbarProps> = ({
  studentId,
  studentName,
  grade,
  pq,
  mock,
  provider,
  model,
  onOpenSettings,
  onSelectStudent,
  onCreateStudent,
  onDeleteStudent,
  onOpenKb,
}) => {
  return (
    <header className="flex items-center justify-between border-b border-border bg-background px-6 py-3">
      <StudentSwitcher
        currentId={studentId}
        currentName={studentName}
        onSelect={onSelectStudent}
        onCreate={onCreateStudent}
        onDelete={onDeleteStudent}
        onOpenKb={onOpenKb}
      />

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5">
          <Gauge className="h-4 w-4 text-brand" />
          <span className="text-xs text-muted-foreground">PQ</span>
          <span className="text-base font-bold text-brand">{pq}</span>
        </div>
        {mock ? (
          <Badge variant="secondary" className="gap-1">
            <Circle className="h-2 w-2 fill-warning text-warning" />
            Mock 模式
          </Badge>
        ) : (
          <Badge variant="success" className="gap-1">
            <Circle className="h-2 w-2 fill-success text-success" />
            {provider ? `${provider.toUpperCase()} · ${model}` : "LLM 已接入"}
          </Badge>
        )}
        <button
          onClick={onOpenSettings}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="设置"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
};

export default Topbar;
