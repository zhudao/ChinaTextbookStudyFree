"use client";

/**
 * GuideClient — 单元知识手册 slide carousel
 *
 * 对标 Duolingo "这是什么?" 知识介绍页：
 *   - 一屏一个知识点，大图 + 标题 + TTS 朗读 + 通俗描述
 *   - 顶部 X 关闭 + 进度圆点 + 计数
 *   - 底部"下一步 →" 推进；最后一张显示"完成"
 */

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen } from "@/components/LearningIcon";
import { Close, Target } from "@/components/icons";
import { TTSButton } from "@/components/TTSButton";
import { MathText } from "@/components/MathText";
import { cn } from "@/lib/cn";
import { playSfx } from "@/lib/sfx";
import { haptic } from "@/lib/haptic";
import type { Book } from "@/types";
import type { KnowledgeSummary, Unit } from "@cstf/core";

interface GuideClientProps {
  book: Book;
  unit: Unit;
  summaries: KnowledgeSummary[];
}

export function GuideClient({ book, unit, summaries }: GuideClientProps) {
  const router = useRouter();
  const slideTitleRef = useRef<HTMLHeadingElement>(null);
  const [idx, setIdx] = useState(0);
  const total = summaries.length;
  const current = summaries[idx];
  const isLast = idx === total - 1;

  function close() {
    playSfx("tap");
    haptic("light");
    router.push(`/book/${book.id}/`);
  }

  function next() {
    playSfx("tap");
    haptic("light");
    if (isLast) {
      close();
      return;
    }
    setIdx(i => Math.min(total - 1, i + 1));
  }

  // 空态：该单元的 lesson 没有 knowledge 数据
  if (!current) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-white px-6 text-center">
        <h1 className="text-base font-extrabold text-ink mb-2">本单元暂无知识手册</h1>
        <div className="text-sm text-ink-light mb-6">
          {book.textbookName} · {unit.label ?? `第 ${unit.unit_number} 单元`} · {unit.title}
        </div>
        <button
          type="button"
          onClick={close}
          className="btn-chunky-primary"
        >
          返回
        </button>
      </main>
    );
  }

  return (
    <main className="guide-screen min-h-screen flex flex-col bg-white overflow-x-hidden">
      {/* 顶部：X + 进度圆点 + 计数 */}
      <header className="sticky top-0 z-20 bg-white flex items-center gap-3 px-4 py-3 border-b border-bg-softer">
        <button
          type="button"
          aria-label="关闭"
          onClick={close}
          className="shrink-0 w-11 h-11 rounded-full inline-flex items-center justify-center text-ink-light hover:bg-bg-soft transition-colors"
        >
          <Close className="w-5 h-5" />
        </button>
        <div className="min-w-0 flex-1 flex items-center justify-center gap-1.5" role="progressbar" aria-label="知识手册进度" aria-valuemin={0} aria-valuemax={total} aria-valuenow={idx + 1}>
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "min-w-0 flex-1 max-w-8 h-1.5 rounded-full transition-all",
                i === idx ? "w-8 bg-secondary" : i < idx ? "w-6 bg-secondary/60" : "w-6 bg-bg-softer",
              )}
            />
          ))}
        </div>
        <div className="shrink-0 text-xs font-extrabold text-ink-light w-10 text-right tabular-nums">
          {idx + 1}/{total}
        </div>
      </header>

      {/* 主体 slide */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            onAnimationComplete={() => {
              slideTitleRef.current?.focus({ preventScroll: true });
              window.scrollTo({ top: 0, behavior: "instant" });
            }}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.22 }}
            className="flex-1 flex flex-col items-stretch px-5 pt-6 pb-8 w-full max-w-[640px] mx-auto"
          >
            {/* 单元上下文 */}
            <div className="text-sm font-bold text-ink-light">
              {unit.label ?? `第 ${unit.unit_number} 单元`} · {unit.title}
            </div>
            <h1 ref={slideTitleRef} tabIndex={-1} className="focus:outline-none text-[28px] font-bold text-ink mt-2 leading-snug max-w-lg">
              <MathText text={current.point} />
            </h1>

            <div className="flex items-center gap-2 mt-6 text-secondary-dark text-sm font-bold"><BookOpen className="w-7 h-7" />知识讲解</div>

            {/* 标题 + TTS */}
            <div className="mt-5 flex items-center gap-3">
              <div className="text-xl font-bold text-ink">核心概念</div>
              {current.audio?.core_concept && (
                <TTSButton src={current.audio.core_concept} autoPlay preload size="md" />
              )}
            </div>

            {/* 描述（核心概念） */}
            <div className="mt-3 text-[17px] text-ink leading-relaxed max-w-lg">
              <MathText text={current.core_concept} />
            </div>

            {/* 公式卡（content-10）：key_formula 大字居中 + TTS */}
            {current.key_formula && (
              <div className="mt-6 rounded-2xl bg-bg-soft border-2 border-bg-softer p-4 max-w-lg w-full">
                <div className="flex items-center gap-1.5 mb-2">
                  <Target className="w-3.5 h-3.5 text-primary" />
                  <span className="text-sm font-bold text-ink">
                    记住这个
                  </span>
                  {current.audio?.key_formula && (
                    <TTSButton
                      src={current.audio.key_formula}
                      size="sm"
                      className="ml-auto"
                      label="朗读公式"
                    />
                  )}
                </div>
                <div className="text-lg text-ink font-bold leading-relaxed">
                  <MathText text={current.key_formula} />
                </div>
              </div>
            )}

            {/* 小贴士 */}
            {current.tips && (
              <div className="mt-6 border-t-2 border-bg-softer pt-5 max-w-lg w-full">
                <div className="flex items-start gap-2">
                  {current.audio?.tips && (
                    <TTSButton src={current.audio.tips} size="sm" className="mt-0.5" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-ink mb-1">
                      小贴士
                    </div>
                    <div className="text-base text-ink leading-relaxed">
                      <MathText text={current.tips} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 易错点 */}
            {current.common_mistakes && current.common_mistakes.length > 0 && (
              <div className="mt-5 border-t-2 border-bg-softer pt-5 max-w-lg w-full">
                <div className="text-sm font-bold text-danger mb-2">
                  容易搞错
                </div>
                <ul className="space-y-1.5">
                  {current.common_mistakes.map((m, i) => (
                    <li key={i} className="flex items-start gap-2 text-base text-ink leading-relaxed">
                      {current.audio?.common_mistakes?.[i] && (
                        <TTSButton
                          src={current.audio.common_mistakes[i]}
                          size="sm"
                          className="mt-0.5"
                        />
                      )}
                      <span className="flex-1">
                        <MathText text={m} />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* 底部 CTA */}
      <div className="guide-actions sticky bottom-0 z-20 p-4 border-t-2 border-bg-softer bg-white" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
        <div className="max-w-lg mx-auto flex gap-3">
          {idx > 0 && (
            <button
              type="button"
              onClick={() => {
                playSfx("tap");
                haptic("light");
                setIdx(i => Math.max(0, i - 1));
              }}
              className="btn-chunky-ghost shrink-0"
            >
              上一步
            </button>
          )}
          <button
            type="button"
            onClick={next}
            className="btn-chunky-primary flex-1"
          >
            {isLast ? "完成 ✓" : "下一步 →"}
          </button>
        </div>
      </div>
    </main>
  );
}
