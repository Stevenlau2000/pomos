// components/chat/ChatWindow.tsx
// 消息列表：滚动展示 user/mentor 气泡，自动滚到底部。
"use client";

import * as React from "react";
import MessageBubble, { type ChatMessage } from "./MessageBubble";
import { cn } from "@/lib/utils";

interface ChatWindowProps {
  messages: ChatMessage[];
  /** 是否正在等待导师回复 */
  loading?: boolean;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ messages, loading }) => {
  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  return (
    <div
      className={cn(
        "flex-1 space-y-4 overflow-y-auto p-4",
      )}
    >
      {messages.map((m, i) => (
        <MessageBubble key={i} message={m} />
      ))}
      {loading && (
        <div className="flex justify-start">
          <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
            导师思考中…
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
};

export default ChatWindow;
