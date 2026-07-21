"use client";

import React from "react";
import { MessageSquare, Clock, ArrowRight, Sparkles, BookOpen, Lightbulb } from "lucide-react";

interface Conversation {
  id: string;
  title: string;
  type: "question" | "lecture" | "insight";
  preview: string;
  time: string;
  unread?: boolean;
}

const conversations: Conversation[] = [
  {
    id: "1",
    title: "刚体转动的角动量守恒",
    type: "question",
    preview: "导师分析了陀螺进动的物理机制，建议从欧拉方程入手...",
    time: "10 分钟前",
    unread: true,
  },
  {
    id: "2",
    title: "电磁感应中的涡旋电场",
    type: "lecture",
    preview: "已生成讲义：含麦克斯韦方程推导、3道例题和自测题...",
    time: "1 小时前",
  },
  {
    id: "3",
    title: "对称性在竞赛解题中的应用",
    type: "insight",
    preview: "发现你在第 38 届 CPhO 复赛第 3 题中遗漏了镜像对称...",
    time: "3 小时前",
  },
  {
    id: "4",
    title: "多普勒效应的相对论修正",
    type: "question",
    preview: "讨论了光的多普勒效应与经典情形的区别，推导出频率变换公式...",
    time: "昨天",
  },
];

const typeConfig = {
  question: { icon: <MessageSquare className="w-3.5 h-3.5" />, label: "问答", color: "text-cyan-500", bg: "bg-cyan-500/10" },
  lecture: { icon: <BookOpen className="w-3.5 h-3.5" />, label: "讲义", color: "text-amber-500", bg: "bg-amber-500/10" },
  insight: { icon: <Lightbulb className="w-3.5 h-3.5" />, label: "洞察", color: "text-emerald-500", bg: "bg-emerald-500/10" },
};

export default function RecentConversations() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-cyan-500" />
          </div>
          <h3 className="text-h3 font-display text-foreground">最近对话</h3>
        </div>
        <button className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150 flex items-center gap-1">
          查看全部 <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-2">
        {conversations.map((conv, index) => {
          const type = typeConfig[conv.type];
          return (
            <div
              key={conv.id}
              className={`group relative rounded-xl border border-border bg-card p-4 transition-all duration-200 hover:border-cyan-500/20 hover:translate-x-1 cursor-pointer stagger-item ${
                conv.unread ? "ring-1 ring-cyan-500/10" : ""
              }`}
              style={{ "--i": index } as React.CSSProperties}
            >
              {conv.unread && (
                <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
              )}
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 w-7 h-7 rounded-md ${type.bg} flex items-center justify-center flex-shrink-0`}>
                  <span className={type.color}>{type.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-foreground truncate">
                      {conv.title}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-caption font-medium ${type.bg} ${type.color}`}>
                      {type.label}
                    </span>
                  </div>
                  <p className="text-body-sm text-muted-foreground leading-relaxed line-clamp-2">
                    {conv.preview}
                  </p>
                  <div className="flex items-center gap-1 mt-2 text-caption text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {conv.time}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
