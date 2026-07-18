// components/views/ChatView.tsx
// 对话辅导视图：复用既有 ChatWindow / ChatInput / MessageBubble。
"use client";

import * as React from "react";
import ChatWindow from "@/components/chat/ChatWindow";
import ChatInput from "@/components/chat/ChatInput";
import type { ChatMessage } from "@/components/chat/MessageBubble";
import { useI18n } from "@/lib/i18n";

interface ChatViewProps {
  messages: ChatMessage[];
  loading: boolean;
  onSend: (text: string) => void;
  /** 可选：视图卸载时中止正在进行的 SSE 流式连接。 */
  onAbort?: () => void;
  /** 导师模式：通用 / 竞赛 */
  mentorMode?: "general" | "competition";
  onMentorModeChange?: (m: "general" | "competition") => void;
}

const ChatView: React.FC<ChatViewProps> = ({
  messages,
  loading,
  onSend,
  onAbort,
  mentorMode = "general",
  onMentorModeChange,
}) => {
  const { t } = useI18n();
  // 卸载时中止 SSE 流式连接，避免切视图后后台仍消耗带宽
  React.useEffect(() => {
    return () => {
      onAbort?.();
    };
  }, [onAbort]);
  // 末条为导师错误气泡时，提供「重试」入口：重发最后一条用户消息
  const last = messages[messages.length - 1];
  const isError = !!last && last.role === "mentor" && last.content.startsWith("⚠️");
  const lastUserMsg = [...messages]
    .reverse()
    .find((m) => m.role === "user")?.content;
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-6 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">{t("views.chat.title")}</h2>
          {onMentorModeChange && (
            <div className="flex rounded-md border border-border p-0.5 text-[11px]">
              <button
                onClick={() => onMentorModeChange("general")}
                className={
                  "rounded px-2 py-1 " +
                  (mentorMode === "general"
                    ? "bg-brand text-brand-foreground"
                    : "text-muted-foreground hover:text-brand")
                }
              >
                通用导师
              </button>
              <button
                onClick={() => onMentorModeChange("competition")}
                className={
                  "rounded px-2 py-1 " +
                  (mentorMode === "competition"
                    ? "bg-brand text-brand-foreground"
                    : "text-muted-foreground hover:text-brand")
                }
              >
                竞赛导师
              </button>
            </div>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          {mentorMode === "competition"
            ? "竞赛导师模式：可让我「生成题目 / 生成针对性训练」，直接产出竞赛题与解析"
            : t("views.chat.sub")}
        </p>
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        <ChatWindow messages={messages} loading={loading} />
        {isError && lastUserMsg && (
          <div className="flex items-center justify-between gap-3 border-t border-destructive/30 bg-destructive/5 px-4 py-2 text-xs">
            <span className="text-destructive">⚠️ 发送失败，可重试</span>
            <button
              onClick={() => onSend(lastUserMsg)}
              disabled={loading}
              className="rounded-md bg-brand px-3 py-1 text-[11px] font-medium text-brand-foreground disabled:opacity-60"
            >
              重试
            </button>
          </div>
        )}
        <ChatInput onSend={onSend} disabled={loading} loading={loading} />
      </div>
    </div>
  );
};

export default ChatView;
