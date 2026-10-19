"use client";

/**
 * 词语排序题：把打乱的词语按正确顺序点击拼成句子。
 *
 * answer 是逗号连接的正确顺序词语；
 * options 是打乱顺序的同一组词语。
 *
 * 交互：
 *   - 上方"已选区"按点击顺序展示
 *   - 下方"待选区"展示尚未点选的词语
 *   - 点击已选区的词可以撤回
 *   - 每次选择/撤回都写入受控 answer，刷新后按 answer 恢复
 */

import { wordOrderIndices } from "@/lib/questionDraft";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/cn";
import { QuestionPrompt } from "./QuestionPrompt";
import { MathText } from "@/components/MathText";
import { TTSButton } from "@/components/TTSButton";
import { playSfx } from "@/lib/sfx";
import { haptic } from "@/lib/haptic";
import { playTTS } from "@/lib/tts";
import { useAutoNarrate } from "@/lib/useAutoNarrate";
import type { QuestionRendererProps } from "./QuestionRenderer";

export function WordOrderQuestion({
  question,
  answer,
  phase,
  isCorrect,
  onChange,
  locked = false,
}: QuestionRendererProps) {
  const disabled = phase === "checked";
  const options = question.options ?? [];
  const cancelNarrate = useAutoNarrate([question.audio?.question], question.id);

  // 已选索引列表（指向 options 中的 index）
  const picked = wordOrderIndices(options, answer);

  /** 播放第 i 个选项的 TTS */
  function playOptionAudio(i: number) {
    const src = question.audio?.options?.[i];
    if (src) playTTS(src);
  }

  function pick(i: number) {
    if (locked || disabled) return; // 遮罩打开时停摆（webrunner-5）
    if (picked.includes(i)) return;
    cancelNarrate();
    playSfx("tap");
    haptic("light");
    playOptionAudio(i);
    onChange([...picked, i].map(index => options[index]).join(","));
  }

  function unpick(i: number) {
    if (locked || disabled) return;
    playSfx("tap");
    haptic("light");
    playOptionAudio(i);
    onChange(picked.filter(index => index !== i).map(index => options[index]).join(","));
  }

  const remaining = options.map((_, i) => i).filter(i => !picked.includes(i));

  // checked 阶段下，把正确序列拆出来供对照展示
  const correctSeq = phase === "checked" ? question.answer.split(",").map(s => s.trim()) : [];

  return (
    <div className="w-full">
      <QuestionPrompt text={question.question} audio={question.audio?.question} locked={locked} />

      {/* 已选区 */}
      <div
        className={cn(
          "min-h-[64px] rounded-2xl border-2 border-dashed p-3 flex flex-wrap gap-2 mb-4 transition-colors",
          disabled
            ? isCorrect
              ? "border-primary bg-primary/15"
              : "border-danger bg-danger/10"
            : "border-bg-softer bg-bg-soft",
        )}
      >
        <AnimatePresence>
          {picked.length === 0 && !disabled && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-ink-softer text-base self-center"
            >
              点击下方词语按顺序排列
            </motion.span>
          )}
          {picked.map(i => (
            <motion.button
              key={`pick-${i}`}
              type="button"
              layout
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", damping: 18, stiffness: 260 }}
              onClick={() => unpick(i)}
              disabled={disabled}
              className="min-h-11 min-w-11 px-4 inline-flex items-center rounded-xl bg-secondary text-white font-extrabold text-base"
              style={{ boxShadow: "0 3px 0 0 #1899d6" }}
            >
              {options[i]}
            </motion.button>
          ))}
        </AnimatePresence>
      </div>

      {/* 待选区 */}
      <div className="flex flex-wrap gap-2">
        {remaining.map(i => (
          <motion.button
            key={`opt-${i}`}
            type="button"
            layout
            onClick={() => pick(i)}
            disabled={disabled}
            className="min-h-11 min-w-11 px-4 inline-flex items-center rounded-xl bg-white border-2 border-bg-softer text-ink font-extrabold text-base hover:border-secondary transition-colors"
            style={{ boxShadow: "0 3px 0 0 var(--shadow-card-color)" }}
          >
            {options[i]}
          </motion.button>
        ))}
        {remaining.length === 0 && disabled === false && (
          <span className="text-xs text-ink-softer self-center">已全部选完，请检查</span>
        )}
      </div>

      {/* 错误时显示正确答案 */}
      {phase === "checked" && !isCorrect && (
        <motion.div
          initial={{ y: 6, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mt-4 text-center text-sm text-ink-light"
        >
          正确顺序：
          <span className="font-extrabold text-primary-dark">{correctSeq.join(" → ")}</span>
        </motion.div>
      )}
    </div>
  );
}
