"use client";

/**
 * MathText — 把含 $...$ 的字符串拆开，行内 LaTeX 用 KaTeX 渲染。
 *
 * 支持美元符号及 TeX 圆括号/方括号分隔的行内和块级公式。
 * 未配对的分隔符保留为普通文本。
 */

import dynamic from "next/dynamic";
import { Fragment } from "react";
import { splitMath } from "@/lib/math-segments";

// react-katex + katex 的体积较大 (~100KB+)，改为按需加载，
// 让 LessonRunner 初次渲染时不阻塞在 KaTeX chunk 上。
// 首屏先显示原始 LaTeX 字符串（等公式 chunk 到位后自动替换为渲染结果）。
const InlineMath = dynamic(
  () => import("react-katex").then(m => ({ default: m.InlineMath })),
  {
    ssr: false,
    loading: () => <span className="opacity-60">…</span>,
  },
);
const BlockMath = dynamic(
  () => import("react-katex").then(m => ({ default: m.BlockMath })),
  {
    ssr: false,
    loading: () => <span className="block my-2 opacity-60">…</span>,
  },
);

interface MathTextProps {
  text: string;
  block?: boolean;
}

export function MathText({ text, block = false }: MathTextProps) {
  const parts = splitMath(text);

  return (
    <span>
      {parts.map((p, idx) => {
        if (p.type === "text") return <Fragment key={idx}>{p.value}</Fragment>;
        if (p.type === "block")
          return (
            <span key={idx} className="block my-2 max-w-full overflow-x-auto">
              <BlockMath math={p.value} />
            </span>
          );
        return <span key={idx} className="inline-block max-w-full overflow-x-auto overflow-y-hidden align-middle py-1"><InlineMath math={p.value} /></span>;
      })}
    </span>
  );
}
