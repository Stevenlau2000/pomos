"use client";

import React from "react";
import {
  LayoutDashboard,
  Network,
  MessageSquare,
  BookOpen,
  PenTool,
  BarChart3,
  NotebookPen,
  CalendarCheck,
  ChevronRight,
  ChevronDown,
} from "lucide-react";

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  children?: { id: string; label: string }[];
}

const navItems: NavItem[] = [
  { id: "dashboard", label: "仪表盘", icon: <LayoutDashboard className="w-5 h-5" />, active: true },
  {
    id: "knowledge",
    label: "知识图谱",
    icon: <Network className="w-5 h-5" />,
    children: [
      { id: "mechanics", label: "力学" },
      { id: "electromagnetism", label: "电磁学" },
      { id: "thermodynamics", label: "热学" },
      { id: "optics", label: "光学" },
      { id: "modern", label: "近代物理" },
    ],
  },
  { id: "mentor", label: "对话导师", icon: <MessageSquare className="w-5 h-5" /> },
  { id: "lecture", label: "讲义生成", icon: <BookOpen className="w-5 h-5" /> },
  { id: "training", label: "出题训练", icon: <PenTool className="w-5 h-5" /> },
  { id: "assessment", label: "能力评估", icon: <BarChart3 className="w-5 h-5" /> },
  { id: "mistakes", label: "错题本", icon: <NotebookPen className="w-5 h-5" /> },
  { id: "plan", label: "学习计划", icon: <CalendarCheck className="w-5 h-5" /> },
];

export default function Sidebar() {
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({ knowledge: true });
  const [activeId, setActiveId] = React.useState("dashboard");

  const toggleExpand = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <aside className="w-60 h-[calc(100vh-64px)] border-r border-border bg-sidebar flex flex-col sticky top-16 animate-slide-in-right">
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = activeId === item.id;
          const hasChildren = !!item.children;
          const isExpanded = expanded[item.id];

          return (
            <div key={item.id}>
              <button
                onClick={() => {
                  setActiveId(item.id);
                  if (hasChildren) toggleExpand(item.id);
                }}
                className={`w-full nav-item ${isActive ? "nav-item-active" : ""}`}
              >
                <span className={isActive ? "text-cyan-500" : "text-muted-foreground"}>
                  {item.icon}
                </span>
                <span className="flex-1 text-left">{item.label}</span>
                {hasChildren && (
                  <ChevronDown
                    className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  />
                )}
              </button>

              {hasChildren && isExpanded && (
                <div className="ml-4 mt-1 space-y-1 border-l border-border pl-3 animate-fade-in">
                  {item.children!.map((child) => (
                    <button
                      key={child.id}
                      onClick={() => setActiveId(child.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
                        activeId === child.id
                          ? "text-cyan-500 bg-cyan-500/5"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/30"
                      }`}
                    >
                      <ChevronRight className="w-3 h-3" />
                      {child.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Bottom Status */}
      <div className="p-4 border-t border-border">
        <div className="rounded-lg bg-secondary/30 p-3 space-y-2">
          <div className="flex items-center justify-between text-caption">
            <span className="text-muted-foreground">今日学习</span>
            <span className="text-cyan-500 font-medium">4.5h</span>
          </div>
          <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-400 to-cyan-500 rounded-full transition-all duration-1000 ease-out"
              style={{ width: "75%" }}
            />
          </div>
          <div className="flex items-center justify-between text-caption">
            <span className="text-muted-foreground">本周目标</span>
            <span className="text-foreground font-medium">30h</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
