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
}

const ChatView: React.FC<ChatViewProps> = ({ messages, loading, onSend }) => {
  const { t } = useI18n();
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-6 py-3">
        <h2 className="text-sm font-semibold">{t("views.chat.title")}</h2>
        <p className="text-[11px] text-muted-foreground">
          {t("views.chat.sub")}
        </p>
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        <ChatWindow messages={messages} loading={loading} />
        <ChatInput onSend={onSend} disabled={loading} />
      </div>
    </div>
  );
};

export default ChatView;
