// components/chat/ChatInput.tsx
// 输入区：文本框 + 发送按钮，回车提交（Shift+Enter 换行）。
"use client";

import * as React from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSend, disabled }) => {
  const [value, setValue] = React.useState("");

  const submit = () => {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="flex items-center gap-2 border-t border-border bg-background p-4">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="向导师提问，例如：帮我推导单摆小角近似的周期…"
        disabled={disabled}
      />
      <Button onClick={submit} disabled={disabled || !value.trim()}>
        <Send className="h-4 w-4" />
        发送
      </Button>
    </div>
  );
};

export default ChatInput;
