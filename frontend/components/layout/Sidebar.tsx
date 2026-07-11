// components/layout/Sidebar.tsx
// 工作台左侧导航：每个入口映射一个 POMOS 功能模块。底部含设置入口。
"use client";

import * as React from "react";
import {
  Atom,
  MessageSquare,
  LayoutDashboard,
  Boxes,
  Network,
  Stethoscope,
  Swords,
  BookX,
  Workflow,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

export type ViewKey =
  | "chat"
  | "overview"
  | "twin"
  | "graph"
  | "diagnosis"
  | "training"
  | "mistakes"
  | "modules";

interface NavItem {
  key: ViewKey;
  label: string;
  desc: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { key: "chat", label: "nav.chat", desc: "nav.chatDesc", icon: MessageSquare },
  { key: "overview", label: "nav.overview", desc: "nav.overviewDesc", icon: LayoutDashboard },
  { key: "twin", label: "nav.twin", desc: "nav.twinDesc", icon: Boxes },
  { key: "graph", label: "nav.graph", desc: "nav.graphDesc", icon: Network },
  { key: "diagnosis", label: "nav.diagnosis", desc: "nav.diagnosisDesc", icon: Stethoscope },
  { key: "training", label: "nav.training", desc: "nav.trainingDesc", icon: Swords },
  { key: "mistakes", label: "nav.mistakes", desc: "nav.mistakesDesc", icon: BookX },
  { key: "modules", label: "nav.modules", desc: "nav.modulesDesc", icon: Workflow },
];

interface SidebarProps {
  active: ViewKey;
  onSelect: (key: ViewKey) => void;
  onOpenSettings: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ active, onSelect, onOpenSettings }) => {
  const { t } = useI18n();
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-5 py-4">
        <Atom className="h-6 w-6 text-brand" />
        <div className="leading-tight">
          <div className="text-sm font-bold">POMOS</div>
          <div className="text-[11px] text-muted-foreground">物理竞赛导师 OS</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = item.key === active;
          return (
            <button
              key={item.key}
              onClick={() => onSelect(item.key)}
              className={cn(
                "group flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors",
                isActive
                  ? "bg-brand text-brand-foreground"
                  : "text-foreground hover:bg-accent",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex flex-col">
                <span className="text-sm font-medium leading-tight">{t(item.label)}</span>
                <span
                  className={cn(
                    "text-[11px] leading-tight",
                    isActive ? "text-brand-foreground/80" : "text-muted-foreground",
                  )}
                >
                  {t(item.desc)}
                </span>
              </span>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-border">
        <button
          onClick={onOpenSettings}
          className="flex w-full items-center gap-3 px-5 py-3 text-left text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Settings className="h-4 w-4 shrink-0" />
          <span className="text-sm font-medium">{t("nav.settings")}</span>
        </button>
        <div className="px-5 pb-3 text-[11px] text-muted-foreground">
          v6.0 · WorkBuddy 驱动
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
