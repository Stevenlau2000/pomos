// components/chat/MessageBubble.tsx
// 消息气泡：渲染 markdown + KaTeX（react-katex）+ ```mermaid``` 代码块（懒加载 Mermaid）。
// 另：mentor 消息若携带 explain（PomosExplainV1），优先渲染富卡片 ExplainCard（懒加载）。
"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BlockMath, InlineMath } from "react-katex";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { ModuleTrace, StudentUpdate } from "@/lib/api";
import type { PomosExplainV1 } from "@/lib/explain/types";
import "katex/dist/katex.min.css";

/** 单条聊天消息 */
export interface ChatMessage {
  role: "user" | "mentor";
  content: string;
  /** 导师消息附带的推理路径 */
  moduleTrace?: ModuleTrace[];
  /** 本轮对话的评估结果（PQ / 弱概念 / 建议） */
  assessment?: StudentUpdate;
  /** 结构化详细讲解（云端 / 离线 / 讲义 三源同源）；存在时优先渲染富卡片 */
  explain?: PomosExplainV1;
}

// ---------- Mermaid 渲染组件（懒加载 mermaid 库，避免顶部直引拖慢首屏） ----------
const MermaidView = dynamic(() => import("@/components/explain/MermaidView"), { ssr: false });

// ---------- 结构化讲解卡片（懒加载） ----------
const ExplainCard = dynamic(
  () => import("@/components/explain/ExplainCard").then((m) => m.ExplainCard),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-md border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
        讲解加载中…
      </div>
    ),
  },
);

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
  const hasExplain = !isUser && !!message.explain && message.explain.steps?.length > 0;
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
        {hasExplain ? (
          <ExplainCard explain={message.explain!} />
        ) : (
          splitSegments(message.content).map((seg, i) => {
            if (seg.type === "code") {
              if (seg.lang === "mermaid") {
                return <MermaidView key={i} code={seg.value} />;
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
          })
        )}

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
