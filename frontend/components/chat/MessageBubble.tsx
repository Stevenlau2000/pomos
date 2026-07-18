// components/chat/MessageBubble.tsx
// 消息气泡：渲染 markdown + KaTeX（react-katex）+ ```mermaid``` 代码块（mermaid 渲染）。
"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BlockMath, InlineMath } from "react-katex";
import mermaid from "mermaid";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { ModuleTrace, StudentUpdate } from "@/lib/api";
import "katex/dist/katex.min.css";

/** 单条聊天消息 */
export interface ChatMessage {
  role: "user" | "mentor";
  content: string;
  /** 导师消息附带的推理路径 */
  moduleTrace?: ModuleTrace[];
  /** 本轮对话的评估结果（PQ / 弱概念 / 建议） */
  assessment?: StudentUpdate;
}

// ---------- Mermaid 渲染组件 ----------

interface MermaidProps {
  code: string;
}

const Mermaid: React.FC<MermaidProps> = ({ code }) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    mermaid.initialize({ startOnLoad: false, theme: "default", securityLevel: "strict" });
    let cancelled = false;
    const id = `mermaid-${Math.random().toString(36).slice(2)}`;
    mermaid
      .render(id, code)
      .then(({ svg }) => {
        if (!cancelled && ref.current) ref.current.innerHTML = svg;
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (error) {
    return (
      <pre className="rounded-md bg-muted p-3 text-xs text-destructive">
        {error}
      </pre>
    );
  }
  return <div ref={ref} className="my-2 flex justify-center" />;
};

// ---------- 数学公式片段解析 ----------

/** 将含 $...$ / $$...$$ 的文本切成：math(块/行内) 与普通文本片段 */
function splitMath(text: string): Array<
  { type: "math-block"; value: string } | { type: "math-inline"; value: string } | { type: "text"; value: string }
> {
  const out: Array<
    { type: "math-block"; value: string } | { type: "math-inline"; value: string } | { type: "text"; value: string }
  > = [];
  const regex = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) {
      out.push({ type: "text", value: text.slice(last, m.index) });
    }
    if (m[1] !== undefined) {
      out.push({ type: "math-block", value: m[1].trim() });
    } else if (m[2] !== undefined) {
      out.push({ type: "math-inline", value: m[2].trim() });
    }
    last = regex.lastIndex;
  }
  if (last < text.length) out.push({ type: "text", value: text.slice(last) });
  return out;
}

/** 渲染含数学公式的普通文本（非代码块部分） */
const RichText: React.FC<{ text: string }> = ({ text }) => {
  const parts = splitMath(text);
  return (
    <>
      {parts.map((p, i) => {
        if (p.type === "math-block")
          return <BlockMath key={i} math={p.value} />;
        if (p.type === "math-inline")
          return <InlineMath key={i} math={p.value} />;
        return (
          <ReactMarkdown key={i} remarkPlugins={[remarkGfm]}>
            {p.value}
          </ReactMarkdown>
        );
      })}
    </>
  );
};

// ---------- 顶层分块：先按围栏代码块拆分 ----------

type Segment =
  | { type: "code"; lang: string; value: string }
  | { type: "text"; value: string };

function splitSegments(content: string): Segment[] {
  const segments: Segment[] = [];
  const regex = /```(\w*)\n?([\s\S]*?)```/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(content)) !== null) {
    if (m.index > last) {
      segments.push({ type: "text", value: content.slice(last, m.index) });
    }
    segments.push({
      type: "code",
      lang: (m[1] ?? "").toLowerCase(),
      value: m[2].replace(/\n$/, ""),
    });
    last = regex.lastIndex;
  }
  if (last < content.length)
    segments.push({ type: "text", value: content.slice(last) });
  return segments;
}

// ---------- 气泡主体 ----------

interface MessageBubbleProps {
  message: ChatMessage;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === "user";
  return (
    <div
      className={cn(
        "flex w-full",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground"
            : "border border-border bg-card text-card-foreground",
        )}
      >
        {splitSegments(message.content).map((seg, i) => {
          if (seg.type === "code") {
            if (seg.lang === "mermaid") {
              return <Mermaid key={i} code={seg.value} />;
            }
            return (
              <pre
                key={i}
                className="my-2 overflow-x-auto rounded-md bg-muted p-3 text-xs"
              >
                <code>{seg.value}</code>
              </pre>
            );
          }
          return (
            <div key={i} className="prose prose-sm max-w-none">
              <RichText text={seg.value} />
            </div>
          );
        })}

        {!isUser && message.moduleTrace && message.moduleTrace.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1 border-t border-border pt-2">
            <span className="mr-1 text-xs text-muted-foreground">
              推理路径：
            </span>
            {message.moduleTrace.map((t, i) => (
              <Badge key={i} variant="secondary" className="text-[10px]">
                {t.module} · {t.action}
              </Badge>
            ))}
          </div>
        )}

        {!isUser && message.assessment && (
          <div className="mt-3 space-y-2 rounded-md border border-brand/30 bg-brand/5 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-brand">
                本次评估 · HPCAS
              </span>
              <span className="text-[11px] font-semibold text-brand">
                PQ {message.assessment.pq.toFixed(3)}
              </span>
            </div>
            {message.assessment.weak_concepts &&
              message.assessment.weak_concepts.length > 0 && (
                <div className="text-[11px] text-destructive">
                  <span className="font-medium">⚠ 需注意：</span>
                  {message.assessment.weak_concepts[0]}
                </div>
              )}
            {message.assessment.recommendations &&
              message.assessment.recommendations.length > 0 && (
                <ul className="list-disc space-y-0.5 pl-4 text-[11px] text-muted-foreground">
                  {message.assessment.recommendations.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;
