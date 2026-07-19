// components/explain/ExplainRichText.tsx
// 讲解富文本：复用与 MessageBubble 一致的「$...$ / $$...$$ → KaTeX，其余 → react-markdown」解析。
// 独立成文件，供 ExplainCard / StepBlock 共用，避免与消息气泡耦合。
"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BlockMath, InlineMath } from "react-katex";
import "katex/dist/katex.min.css";

/** 将含公式的文本切成 math / text 片段。 */
function splitMath(
  text: string,
): Array<
  { type: "math-block"; value: string } | { type: "math-inline"; value: string } | { type: "text"; value: string }
> {
  const out: Array<
    { type: "math-block"; value: string } | { type: "math-inline"; value: string } | { type: "text"; value: string }
  > = [];
  const regex = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) out.push({ type: "text", value: text.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ type: "math-block", value: m[1].trim() });
    else if (m[2] !== undefined) out.push({ type: "math-inline", value: m[2].trim() });
    last = regex.lastIndex;
  }
  if (last < text.length) out.push({ type: "text", value: text.slice(last) });
  return out;
}

/** 把公式文本规范为可渲染形式：已带 $ 原样返回，否则用 $...$ 行内包裹。 */
export function toMath(f: string): string {
  const t = f.trim();
  return t.startsWith("$") ? t : `$${t}$`;
}

export const ExplainRichText: React.FC<{ text: string }> = ({ text }) => {
  const parts = splitMath(text);
  return (
    <>
      {parts.map((p, i) => {
        if (p.type === "math-block") return <BlockMath key={i} math={p.value} />;
        if (p.type === "math-inline") return <InlineMath key={i} math={p.value} />;
        return (
          <ReactMarkdown key={i} remarkPlugins={[remarkGfm]}>
            {p.value}
          </ReactMarkdown>
        );
      })}
    </>
  );
};
