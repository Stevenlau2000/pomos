"use client";

import React from "react";
import { AlertTriangle, TrendingDown, Target, ArrowRight, Zap, BookOpen, PenTool } from "lucide-react";

interface WeakPoint {
  id: string;
  dimension: string;
  score: number;
  topic: string;
  severity: "high" | "medium" | "low";
  suggestion: string;
  actionType: "review" | "practice" | "lecture";
}

const weakPoints: WeakPoint[] = [
  {
    id: "1",
    dimension: "实验设计",
    score: 55,
    topic: "刚体转动惯量测量",
    severity: "high",
    suggestion: "建议复习扭摆法和三线摆实验原理，重点理解误差分析",
    actionType: "review",
  },
  {
    id: "2",
    dimension: "创造性思维",
    score: 48,
    topic: "多体问题构造解法",
    severity: "high",
    suggestion: "尝试用对称性分析构造守恒量，参考第 38 届 CPhO 决赛 T4",
    actionType: "practice",
  },
  {
    id: "3",
    dimension: "迁移能力",
    score: 60,
    topic: "电磁学与力学类比",
    severity: "medium",
    suggestion: "建立 RLC 电路与阻尼振动的类比图谱",
    actionType: "lecture",
  },
];

const severityConfig = {
  high: {
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    icon: <AlertTriangle className="w-4 h-4" />,
  },
  medium: {
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    icon: <TrendingDown className="w-4 h-4" />,
  },
  low: {
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/20",
    icon: <Target className="w-4 h-4" />,
  },
};

const actionConfig = {
  review: { icon: <BookOpen className="w-3.5 h-3.5" />, label: "复习" },
  practice: { icon: <PenTool className="w-3.5 h-3.5" />, label: "练习" },
  lecture: { icon: <Zap className="w-3.5 h-3.5" />, label: "讲义" },
};

export default function WeakPointAlerts() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <h3 className="text-h3 font-display text-foreground">薄弱点提示</h3>
        </div>
        <span className="text-caption text-muted-foreground">基于九维画像自动推荐</span>
      </div>

      <div className="space-y-3">
        {weakPoints.map((point, index) => {
          const sev = severityConfig[point.severity];
          const act = actionConfig[point.actionType];
          return (
            <div
              key={point.id}
              className={`group relative rounded-xl border ${sev.border} ${sev.bg} p-4 transition-all duration-300 hover:translate-x-1 cursor-pointer stagger-item`}
              style={{ "--i": index } as React.CSSProperties}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 ${sev.color}`}>{sev.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-foreground">
                      {point.topic}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-caption font-medium ${sev.bg} ${sev.color}`}>
                      {point.dimension} · {point.score}分
                    </span>
                  </div>
                  <p className="text-body-sm text-muted-foreground leading-relaxed mb-3">
                    {point.suggestion}
                  </p>
                  <div className="flex items-center gap-2">
                    <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-cyan-500/10 border border-cyan-500/20 text-sm font-medium text-cyan-500 hover:bg-cyan-500/20 transition-colors duration-150">
                      {act.icon}
                      {act.label}
                    </button>
                    <button className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors duration-150">
                      查看详情 <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Score bar */}
              <div className="mt-3">
                <div className="w-full h-1 bg-border/50 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-1000 ease-out"
                    style={{
                      width: `${point.score}%`,
                      background: point.severity === "high" ? "#f87171" : point.severity === "medium" ? "#fbbf24" : "#22d3ee",
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
