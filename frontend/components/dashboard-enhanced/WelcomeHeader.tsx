"use client";

import React from "react";
import { Calendar, TrendingUp, Flame } from "lucide-react";

interface StudyProgress {
  todayHours: number;
  targetHours: number;
  streakDays: number;
  completedTopics: number;
  totalTopics: number;
}

const progress: StudyProgress = {
  todayHours: 4.5,
  targetHours: 6,
  streakDays: 12,
  completedTopics: 42,
  totalTopics: 156,
};

export default function WelcomeHeader() {
  const today = new Date();
  const dateStr = today.toLocaleDateString("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  const hourPercent = Math.min((progress.todayHours / progress.targetHours) * 100, 100);
  const topicPercent = (progress.completedTopics / progress.totalTopics) * 100;

  return (
    <div className="animate-fade-up">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-caption text-muted-foreground mb-2">
            <Calendar className="w-3.5 h-3.5" />
            {dateStr}
          </div>
          <h1 className="text-hero font-display text-foreground">
            欢迎回来，<span className="text-gradient-cyan">张明远</span>
          </h1>
          <p className="text-body text-muted-foreground mt-1">
            距离第 41 届全国中学生物理竞赛复赛还有 <span className="text-amber-500 font-semibold">28 天</span>
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <Flame className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-semibold text-amber-500">
              {progress.streakDays} 天连续学习
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
            <TrendingUp className="w-4 h-4 text-cyan-500" />
            <span className="text-sm font-semibold text-cyan-500">
              今日 +12 能力点
            </span>
          </div>
        </div>
      </div>

      {/* Progress overview cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card-surface">
          <div className="text-caption text-muted-foreground mb-2">今日学习时长</div>
          <div className="flex items-baseline gap-1">
            <span className="text-data font-mono text-foreground">{progress.todayHours}</span>
            <span className="text-body-sm text-muted-foreground">/ {progress.targetHours}h</span>
          </div>
          <div className="mt-3 w-full h-2 bg-border rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-cyan-500 transition-all duration-1000 ease-out"
              style={{ width: `${hourPercent}%` }}
            />
          </div>
        </div>

        <div className="card-surface">
          <div className="text-caption text-muted-foreground mb-2">知识点覆盖</div>
          <div className="flex items-baseline gap-1">
            <span className="text-data font-mono text-foreground">{progress.completedTopics}</span>
            <span className="text-body-sm text-muted-foreground">/ {progress.totalTopics}</span>
          </div>
          <div className="mt-3 w-full h-2 bg-border rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-1000 ease-out"
              style={{ width: `${topicPercent}%` }}
            />
          </div>
        </div>

        <div className="card-surface">
          <div className="text-caption text-muted-foreground mb-2">平均正确率</div>
          <div className="flex items-baseline gap-1">
            <span className="text-data font-mono text-foreground">78</span>
            <span className="text-body-sm text-muted-foreground">%</span>
          </div>
          <div className="mt-3 flex items-center gap-1">
            <span className="text-caption text-emerald-500 font-medium">↑ 5%</span>
            <span className="text-caption text-muted-foreground">较上周</span>
          </div>
        </div>

        <div className="card-surface">
          <div className="text-caption text-muted-foreground mb-2">待复习错题</div>
          <div className="flex items-baseline gap-1">
            <span className="text-data font-mono text-foreground">23</span>
            <span className="text-body-sm text-muted-foreground">道</span>
          </div>
          <div className="mt-3 flex items-center gap-1">
            <span className="text-caption text-cyan-500 font-medium">3 道</span>
            <span className="text-caption text-muted-foreground">今日新增</span>
          </div>
        </div>
      </div>
    </div>
  );
}
