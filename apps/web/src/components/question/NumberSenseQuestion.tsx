"use client";
import { useEffect, useState } from "react";
import { Volume } from "@/components/icons";
import { useProgressStore } from "@/store/progress";
import { QuestionPrompt } from "./QuestionPrompt";
import { ChoiceQuestion } from "./ChoiceQuestion";
import type { QuestionRendererProps } from "./QuestionRenderer";
import type { NumberVisual } from "@cstf/core/numberSense";
import { stopTTS } from "@/lib/tts";

/** The manipulative is usable by tap and keyboard; dragging is never required. */
export function NumberSenseVisual({
  visual,
  marked,
  setMarked,
  showCount = false,
  locked = false,
}: {
  visual: NumberVisual;
  marked: number[];
  setMarked: (ids: number[]) => void;
  showCount?: boolean;
  locked?: boolean;
}) {
  const objectClass =
    "min-w-11 min-h-11 rounded-xl border-2 flex flex-col items-center justify-center text-3xl px-2 py-1 focus-visible:ring-2 focus-visible:ring-secondary";
  if (visual.kind === "count") {
    return (
      <div className="number-visual rounded-2xl bg-bg-soft p-2 sm:p-3 mb-4">
        <p className="text-sm text-ink-light mb-3">
          可以点物体做记号，每个只数一次。
        </p>
        <div
          role="group"
          aria-label={`${visual.label}图`}
          className={
            visual.layout === "frame"
              ? "grid grid-cols-5 gap-1"
              : "flex flex-wrap gap-2 items-center"
          }
        >
          {Array.from(
            { length: visual.layout === "frame" ? 10 : visual.count },
            (_, i) =>
              i >= visual.count ? (
                <span
                  key={i}
                  aria-hidden="true"
                  className="min-h-11 rounded-lg border border-dashed border-bg-softer"
                />
              ) : (
                <button
                  type="button"
                  key={i}
                  aria-label={`${visual.label}${i + 1}`}
                  aria-pressed={marked.includes(i)}
                  disabled={locked}
                  style={
                    visual.layout === "scatter"
                      ? { marginTop: [0, 14, 4, 20, 8][i % 5] }
                      : undefined
                  }
                  className={`${objectClass} ${marked.includes(i) ? "border-secondary bg-secondary/10" : "border-bg-softer bg-white"}`}
                  onClick={() =>
                    setMarked(
                      marked.includes(i)
                        ? marked.filter((n) => n !== i)
                        : [...marked, i],
                    )
                  }
                >
                  <span aria-hidden="true">{visual.emoji}</span>
                  {marked.includes(i) && (
                    <span className="text-xs font-extrabold text-secondary-dark">
                      {showCount ? marked.indexOf(i) + 1 : "·"}
                    </span>
                  )}
                </button>
              ),
          )}
        </div>
        {showCount && (
          <p
            role="status"
            className="mt-3 text-base font-extrabold text-secondary-dark"
          >
            点过 {marked.length} 个。
            {marked.length === visual.count
              ? "每个都数到了！"
              : "再看看有没有漏掉。"}
          </p>
        )}
      </div>
    );
  }
  if (visual.kind === "compare") {
    const paired = Math.min(marked.length, visual.left, visual.right);
    return (
      <div className="number-visual rounded-2xl bg-bg-soft p-2 sm:p-3 mb-4">
        <p className="text-sm text-ink-light mb-3">
          可以一个配一个，再看看哪一组有剩下。
        </p>
        {[
          [visual.left, visual.leftEmoji, visual.leftLabel],
          [visual.right, visual.rightEmoji, visual.rightLabel],
        ].map(([count, emoji, label], row) => (
          <div key={row} className="compare-row">
            <p className="text-sm font-bold text-ink mb-2">{label}</p>
            <div
              className="grid grid-cols-5 gap-1"
              role="group"
              aria-label={`${label}图`}
            >
              {Array.from({ length: Number(count) }, (_, i) => (
                <span
                  key={i}
                  className={`${objectClass} ${i < paired ? "border-secondary bg-secondary/10" : "border-bg-softer bg-white"}`}
                  aria-label={`${label}${i + 1}${i < paired ? "，已经配对" : ""}`}
                >
                  <span aria-hidden="true">{emoji}</span>
                  {i < paired && (
                    <span className="text-xs text-secondary-dark">配好</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        ))}
        <button
          type="button"
          disabled={locked || paired === Math.min(visual.left, visual.right)}
          onClick={() => setMarked([...marked, paired])}
          className="btn-chunky-secondary w-full min-h-11"
        >
          {paired === Math.min(visual.left, visual.right)
            ? "都配过了，看看剩下的"
            : "配一对"}
        </button>
      </div>
    );
  }
  const given = marked
    .filter((i) => i < visual.learners)
    .slice(0, visual.resources);
  return (
    <div className="number-visual rounded-2xl bg-bg-soft p-2 sm:p-3 mb-4">
      <p className="text-sm text-ink-light mb-3">
        点一个朋友，给它分一个。再点可以收回来。
      </p>
      <div
        className="flex flex-wrap gap-2 mb-3"
        role="group"
        aria-label={`${visual.learnerLabel}图`}
      >
        {Array.from({ length: visual.learners }, (_, i) => (
          <button
            type="button"
            key={i}
            disabled={
              locked || (!given.includes(i) && given.length >= visual.resources)
            }
            aria-pressed={given.includes(i)}
            aria-label={`${visual.learnerLabel}${i + 1}${given.includes(i) ? "，已经分到" : ""}`}
            className={`${objectClass} ${given.includes(i) ? "border-secondary bg-secondary/10" : "border-bg-softer bg-white"}`}
            onClick={() =>
              setMarked(
                given.includes(i)
                  ? given.filter((n) => n !== i)
                  : [...given, i],
              )
            }
          >
            <span aria-hidden="true">{visual.learnerEmoji}</span>
            <span aria-hidden="true" className="text-xl min-h-7">
              {given.includes(i) ? visual.resourceEmoji : "·"}
            </span>
          </button>
        ))}
      </div>
      <p className="text-sm text-ink mb-2">还在桌上的{visual.resourceLabel}</p>
      <div
        className="flex flex-wrap gap-2 min-h-11"
        aria-label={`桌上剩下的${visual.resourceLabel}`}
      >
        {Array.from({ length: visual.resources - given.length }, (_, i) => (
          <span
            aria-label={`${visual.resourceLabel}${i + 1}`}
            key={i}
            className="text-3xl"
          >
            {visual.resourceEmoji}
          </span>
        ))}
        {given.length === visual.resources && (
          <span className="text-sm text-ink-light">桌上的都分出去了。</span>
        )}
      </div>
    </div>
  );
}

export function NumberSenseQuestion(props: QuestionRendererProps) {
  const { question, locked = false, phase } = props;
  const task = question.numberTask!;
  const [localDraft, setLocalDraft] = useState<number[]>([]);
  const [localHint, setLocalHint] = useState(0);
  const [audioError, setAudioError] = useState(false);
  const muted = useProgressStore((s) => s.muted);
  const marked = props.visualDraft ?? localDraft;
  const hint = props.hintLevel ?? localHint;
  useEffect(() => {
    setLocalDraft([]);
    setLocalHint(0);
    setAudioError(false);
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, [question.id]);
  useEffect(() => {
    if (muted || locked || phase === "checked")
      window.speechSynthesis?.cancel();
  }, [muted, locked, phase]);
  function readText(text: string) {
    if (muted || locked) return;
    if (!("speechSynthesis" in window)) {
      setAudioError(true);
      return;
    }
    stopTTS();
    window.speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(text);
    speech.lang = "zh-CN";
    speech.rate = 0.85;
    speech.onerror = () => setAudioError(true);
    window.speechSynthesis.speak(speech);
  }
  return (
    <div
      onClickCapture={() => window.speechSynthesis?.cancel()}
      onKeyDownCapture={(event) => {
        if (/^[1-9]$/.test(event.key)) window.speechSynthesis?.cancel();
      }}
    >
      <p className="question-context text-secondary-dark">
        {task.stage === "guided"
          ? "跟着做"
          : task.stage === "transfer"
            ? "换个情境试一试"
            : "自己试一试"}
      </p>
      <QuestionPrompt text={question.question} audio={question.audio?.question} locked={locked} action={!question.audio?.question ? <button type="button" disabled={muted || locked} aria-label="朗读题目" onClick={() => readText(question.question)} className="ui-icon-button border-2 border-bg-softer text-secondary-dark"><Volume className="w-5 h-5"/></button> : undefined}/>
      {audioError && (
        <p role="status" className="text-sm text-ink-light mb-3">
          这台设备暂时不能朗读，可以先看图和题目。
        </p>
      )}
      <NumberSenseVisual
        visual={task.visual}
        marked={marked}
        setMarked={props.onVisualDraft ?? setLocalDraft}
        showCount={task.stage === "guided" || hint > 0}
        locked={locked || phase === "checked"}
      />
      <ChoiceQuestion {...props} hidePrompt />
      {phase === "checked" && !question.audio?.explanation && (
        <button
          type="button"
          disabled={muted || locked}
          className="min-h-11 mt-3 text-secondary-dark font-bold underline"
          onClick={() => readText(question.explanation)}
        >
          听听方法
        </button>
      )}
      {phase === "answering" && props.onHint && (
        <div className="mt-2">
          <button
            type="button"
            className="ui-text-button text-secondary-dark"
            disabled={locked || hint >= task.hints.length}
            onClick={() => {
              if (props.onHint) props.onHint();
              else setLocalHint((v) => v + 1);
            }}
          >
            {" "}
            {hint === 0
              ? "给我一点提示"
              : hint < task.hints.length
                ? "再给我一点提示"
                : "可以照着提示再试试"}
          </button>
          {hint > 0 && (
            <p
              role="status"
              className="rounded-xl bg-secondary/10 p-3 text-base text-ink mt-2"
            >
              {task.hints[Math.min(hint, task.hints.length) - 1]}
              <button
                type="button"
                disabled={muted || locked}
                className="min-h-11 block font-bold text-secondary-dark underline mt-1"
                onClick={() =>
                  readText(task.hints[Math.min(hint, task.hints.length) - 1])
                }
              >
                听提示
              </button>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
