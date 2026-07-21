"use client";

import React from "react";
import { MessageSquare, BookOpen, PenTool, ArrowRight } from "lucide-react";

interface QuickAction {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  glowColor: string;
}

const actions: QuickAction[] = [
  {
    id: "mentor",
    label: "问导师",
    description: "随时提问，AI 导师即时解答",
    icon: <MessageSquare className="w-6 h-6" />,
    color: "text-cyan-500",
    bgColor: "bg-cyan-500/10",
    borderColor: "border-cyan-500/20",
    glowColor: "hover:shadow-[0_0_30px_rgba(0,240,200,0.15)]",
  },
  {
    id: "lecture",
    label: "生成讲义",
    description: "定制知识点讲义与例题",
    icon: <BookOpen className="w-6 h-6" />,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
    glowColor: "hover:shadow-[0_0_30px_rgba(240,200,0,0.15)]",
  },
  {
    id: "training",
    label: "出题训练",
    description: "自适应难度，精准提升",
    icon: <PenTool className="w-6 h-6" />,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/20",
    glowColor: "hover:shadow-[0_0_30px_rgba(16,185,129,0.15)]",
  },
];

export default function QuickActions() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {actions.map((action, index) => (
        <button
          key={action.id}
          className={`group relative flex flex-col items-start gap-4 p-5 rounded-xl border ${action.borderColor} ${action.bgColor} bg-card transition-all duration-300 hover:-translate-y-1 ${action.glowColor} stagger-item`}
          style={{ "--i": index } as React.CSSProperties}
        >
          <div className={`w-12 h-12 rounded-xl ${action.bgColor} border ${action.borderColor} flex items-center justify-center transition-transform duration-300 group-hover:scale-110`}>
            <span className={action.color}>{action.icon}</span>
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-h3 font-display text-foreground">{action.label}</span>
              <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 -translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0" />
            </div>
            <p className="text-body-sm text-muted-foreground">{action.description}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
