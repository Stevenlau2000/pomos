// components/layout/StudentSwitcher.tsx
// 学生切换器：下拉菜单列出所有学生，支持切换 / 新建 / 删除。
"use client";

import * as React from "react";
import { User, ChevronDown, Plus, Trash2, Check, BookOpen } from "lucide-react";
import { getStudents, deleteStudent, type Student } from "@/lib/api";

interface StudentSwitcherProps {
  currentId: string;
  currentName: string;
  onSelect: (id: string) => void;
  onCreate: (name: string, grade: string) => void;
  onDelete: (id: string) => void;
  onOpenKb?: () => void;
}

export default function StudentSwitcher({
  currentId,
  currentName,
  onSelect,
  onCreate,
  onDelete,
  onOpenKb,
}: StudentSwitcherProps) {
  const [open, setOpen] = React.useState(false);
  const [students, setStudents] = React.useState<Student[]>([]);
  const [creating, setCreating] = React.useState(false);
  const [name, setName] = React.useState("");
  const [grade, setGrade] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  const load = React.useCallback(() => {
    getStudents()
      .then(setStudents)
      .catch(() => setStudents([]));
  }, []);

  React.useEffect(() => {
    if (open) load();
  }, [open, load]);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const displayName =
    students.find((s) => s.student_id === currentId)?.name || currentName;

  const handleCreate = () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      onCreate(name.trim(), grade.trim());
      setName("");
      setGrade("");
      setCreating(false);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = (id: string) => {
    if (typeof window !== "undefined" && !window.confirm("确认删除该学生及其全部数据？")) return;
    onDelete(id);
    setOpen(false);
  };

  return (
    <div className="relative flex items-center gap-1.5" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-accent"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/10 text-brand">
          <User className="h-5 w-5" />
        </div>
        <div className="leading-tight text-left">
          <div className="text-sm font-semibold">{displayName}</div>
          <div className="text-[11px] text-muted-foreground">切换学生 ▾</div>
        </div>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>
      {onOpenKb && (
        <button
          onClick={onOpenKb}
          aria-label="个人知识库"
          title="个人知识库"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-brand hover:text-brand"
        >
          <BookOpen className="h-4 w-4" />
        </button>
      )}

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-64 rounded-md border border-border bg-card shadow-xl">
          <div className="max-h-64 overflow-y-auto p-1.5">
            {students.length === 0 && (
              <div className="px-3 py-2 text-[11px] text-muted-foreground">暂无学生，请新建</div>
            )}
            {students.map((s) => {
              const active = s.student_id === currentId;
              return (
                <div
                  key={s.student_id}
                  className={
                    "group flex items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors " +
                    (active ? "bg-brand/10 text-brand" : "hover:bg-accent")
                  }
                >
                  <button
                    className="flex flex-1 items-center gap-2 text-left"
                    onClick={() => {
                      onSelect(s.student_id);
                      setOpen(false);
                    }}
                  >
                    {active ? (
                      <Check className="h-4 w-4 shrink-0" />
                    ) : (
                      <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="flex flex-col">
                      <span className="font-medium leading-tight">{s.name}</span>
                      {s.grade && (
                        <span className="text-[11px] leading-tight text-muted-foreground">
                          {s.grade}
                        </span>
                      )}
                    </span>
                  </button>
                  <button
                    onClick={() => handleDelete(s.student_id)}
                    className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                    aria-label="删除学生"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="border-t border-border p-2">
            {creating ? (
              <div className="space-y-2">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="姓名"
                  className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-brand"
                />
                <input
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  placeholder="年级（可选）"
                  className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-brand"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleCreate}
                    disabled={!name.trim() || busy}
                    className="flex-1 rounded-md bg-brand px-2 py-1.5 text-xs font-medium text-brand-foreground disabled:opacity-60"
                  >
                    创建
                  </button>
                  <button
                    onClick={() => setCreating(false)}
                    className="flex-1 rounded-md border border-border px-2 py-1.5 text-xs font-medium hover:bg-accent"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-brand hover:text-brand"
              >
                <Plus className="h-3.5 w-3.5" />
                新建学生
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
