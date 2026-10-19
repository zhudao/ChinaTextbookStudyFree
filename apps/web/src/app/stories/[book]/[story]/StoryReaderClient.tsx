"use client";

import { useCallback, useEffect, useRef, useState, useReducer } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause } from "lucide-react";
import { Modal } from '@/components/Modal';
import { StoryEvidencePanel } from '@/components/StoryEvidencePanel';
import { advanceStoryQuiz, newStoryQuiz, restoreStoryQuiz, storySessionKey, visibleStoryEvidence, storyQuestion } from '@cstf/core/storyQuiz';
import { readingId } from "@cstf/core/reading";
import { Volume, Check, XMark, Star, Lightning } from "@/components/icons";
import { MuteToggle, useSyncMute } from "@/components/MuteToggle";
import { InnerHeader } from "@/components/InnerHeader";
import { QuestionRenderer, type QuestionPhase } from "@/components/question/QuestionRenderer";
import { playTTSResult, stopTTS } from "@/lib/tts";
import { listenToPassage } from "@/lib/readingSession";
import { playSfx } from "@/lib/sfx";
import { gradeAnswer } from "@/lib/grade";
import { haptic } from "@/lib/haptic";
import { cn } from "@/lib/cn";
import { useProgressStore } from "@/store/progress";
import type { Story, StoryQuestion, Question } from "@/types";

const XP_STORY_READ = 5;
const XP_QUIZ_GOOD = 10;
const GOOD_THRESHOLD = 0.8;

type Phase = "reading" | "quiz" | "result";
type PlayMode = "idle" | "playing";


interface Props {
  story: Story;
  backHref: string;
}

export default function StoryReaderClient({ story, backHref }: Props) {
  useSyncMute();
  const router = useRouter();
  const [quiz, dispatch] = useReducer((state: ReturnType<typeof newStoryQuiz>, action: Parameters<typeof advanceStoryQuiz>[1]) => advanceStoryQuiz(state, action, story), undefined, newStoryQuiz);
  const phase = quiz.phase;
  const [sessionReady, setSessionReady] = useState(false);
  const [passageOpen, setPassageOpen] = useState(false);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`csf-story:${story.id}`);
      if (raw) dispatch({ type: 'restore', state: restoreStoryQuiz(JSON.parse(raw), story) });
    } catch { /* Reading is usable with storage disabled. */ }
    setSessionReady(true);
  }, [story]);
  useEffect(() => {
    if (!sessionReady) return;
    try { sessionStorage.setItem(`csf-story:${story.id}`, JSON.stringify({ contentKey: storySessionKey(story), state: quiz })); } catch { /* Keep the current session in memory. */ }
  }, [quiz, sessionReady, story]);
  const [mode, setMode] = useState<PlayMode>("idle");
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const abortRef = useRef(false);
  const playbackGenerationRef = useRef(0);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  const qIdx = quiz.index;
  const answer = quiz.answer;
  const qPhase: QuestionPhase = quiz.checked ? 'checked' : 'answering';
  const isCorrect = quiz.correct;
  const correctCount = quiz.correctIds.length;
  const setAnswer = (value: string) => dispatch({ type: 'answer', value });

  const completeReading = useProgressStore(s => s.completeReading);

  // 离开页面时停止
  useEffect(() => {
    return () => { abortRef.current = true; playbackGenerationRef.current++; stopTTS(); };
  }, []);

  const hasAudio = story.sentences.some(s => s.audio);

  const playSingle = useCallback(async (idx: number) => {
    const s = story.sentences[idx];
    if (!s?.audio) return;
    const generation = ++playbackGenerationRef.current;
    stopTTS();
    setPlaybackError(null);
    setMode("playing");
    setCurrentIndex(idx);
    const result = await playTTSResult(s.audio);
    if (generation !== playbackGenerationRef.current) return;
    if (result !== "ended") setPlaybackError("声音未能完整播放，请确认声音已开启并重试。");
    setCurrentIndex(null);
    setMode("idle");
  }, [story]);

  const playAll = useCallback(async () => {
    if (mode === "playing") {
      abortRef.current = true;
      playbackGenerationRef.current++;
      stopTTS();
      setMode("idle");
      setCurrentIndex(null);
      return;
    }
    const generation = ++playbackGenerationRef.current;
    abortRef.current = false;
    setPlaybackError(null);
    setMode("playing");
    const result = await listenToPassage(story.sentences, {
      play: playTTSResult, cancelled: () => abortRef.current || generation !== playbackGenerationRef.current,
      onSentence: setCurrentIndex, wait: () => Promise.resolve(),
    });
    if (generation !== playbackGenerationRef.current) return;
    if (result === "audio-unavailable") setPlaybackError("声音未能完整播放，请确认声音已开启并重试。");
    setCurrentIndex(null);
    setMode("idle");
  }, [mode, story]);

  const startQuiz = () => {
    abortRef.current = true;
    playbackGenerationRef.current++;
    stopTTS();
    setCurrentIndex(null);
    setMode("idle");
    dispatch({ type: 'start' });
  };

  const currentQ = story.questions[qIdx];
  const currentQuestion = currentQ ? storyQuestion(currentQ) : null;
  const referenceEvidence = visibleStoryEvidence(story, qIdx, quiz.checked);
  const selectedEvidence = quiz.evidence[currentQ?.id] ?? [];
  function stopPlayback() {
    abortRef.current = true; playbackGenerationRef.current++; stopTTS(); setMode('idle'); setCurrentIndex(null);
  }
  const checkAnswer = () => {
    if (!currentQ || quiz.checked || !answer.trim() || passageOpen) return;
    const correct = gradeAnswer(storyQuestion(currentQ), answer);
    dispatch({ type: 'check' });
    playSfx(correct ? 'correct' : 'wrong'); haptic(correct ? 'success' : 'error');
  };
  const nextQuestion = () => { stopPlayback(); dispatch({ type: 'next' }); };
  useEffect(() => {
    if (quiz.phase !== 'result' || !sessionReady) return;
    const accuracy = story.questions.length ? quiz.correctIds.length / story.questions.length : 0;
    completeReading(readingId('story', story.id), accuracy >= GOOD_THRESHOLD ? XP_STORY_READ + XP_QUIZ_GOOD : XP_STORY_READ);
  }, [quiz.phase, quiz.correctIds.length, story.id, story.questions.length, sessionReady, completeReading]);
  const evidencePanel = <StoryEvidencePanel story={story} selected={selectedEvidence} reference={referenceEvidence}
    checked={quiz.checked} playing={currentIndex} onSelect={sentence => dispatch({ type: 'evidence', sentence })} onPlay={playSingle} />;

  const accuracy = story.questions.length > 0 ? correctCount / story.questions.length : 0;
  const stars = accuracy >= 0.95 ? 3 : accuracy >= 0.75 ? 2 : 1;

  return (
    <main className="reading-screen min-h-screen bg-bg" style={{ paddingBottom: "calc(6rem + env(safe-area-inset-bottom))" }}>
      <InnerHeader
        backHref={backHref}
        title={story.title}
        subtitle={`第${story.unitNumber}单元 · ${story.unitTitle}`}
        right={<div className="flex items-center gap-2"><MuteToggle />{phase === "quiz" ? (
          <span className="text-xs font-bold text-primary tabular-nums">
            {qIdx + 1}/{story.questions.length}
          </span>
        ) : null}</div>}
        bottom={phase === "quiz" ? (
          <div className="h-1 bg-bg-softer">
            <motion.div
              className="h-full bg-primary"
              animate={{ width: `${((qIdx + (qPhase === "checked" ? 1 : 0)) / story.questions.length) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        ) : undefined}
      />

      <AnimatePresence mode="wait">
        {/* ===================== READING PHASE ===================== */}
        {phase === "reading" && (
          <motion.div
            key="reading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* 桌面双栏：配图(左) + 正文(右)；移动端顺序堆叠 */}
            <div
              className={cn(
                "max-w-md lg:max-w-6xl mx-auto",
                story.image && "lg:grid lg:grid-cols-[3fr_2fr] lg:gap-6 lg:items-start",
              )}
            >
              {/* 配图 */}
              {story.image && (
                <div className="px-4 pt-4 lg:pt-5">
                  <div className="relative rounded-2xl overflow-hidden bg-white border border-bg-softer shadow-sm">
                    <img
                      src={story.image}
                      alt={story.title}
                      className="w-full h-auto block"
                    />
                  </div>
                </div>
              )}

              {/* 正文 */}
              <div className="px-4 pt-5 lg:pt-5">
                <div className="rounded-2xl bg-white border border-bg-softer p-4 shadow-sm">
                  {story.sentences.map((s, i) => {
                    const active = currentIndex === i;
                    return (
                      <div
                        key={i}
                        className={cn(
                          "flex items-start gap-2 rounded-lg px-2 py-2 my-0.5 transition-colors",
                          active && "bg-primary/10 ring-1 ring-primary/40",
                        )}
                      >
                        <button
                          type="button"
                          aria-label={`朗读第 ${i + 1} 句`}
                          onClick={() => playSingle(i)}
                          disabled={!s.audio || mode !== "idle"}
                          className={cn(
                            "shrink-0 w-11 h-11 inline-flex items-center justify-center rounded-full",
                            "bg-bg-soft text-secondary hover:bg-secondary/10 transition-colors",
                            (!s.audio || mode !== "idle") && "opacity-40 cursor-not-allowed",
                          )}
                        >
                          <Volume className="w-4 h-4" />
                        </button>
                        <span
                          className={cn(
                            "text-lg leading-[2] text-ink",
                            active && "font-bold text-primary",
                          )}
                        >
                          {s.text}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ===================== QUIZ PHASE ===================== */}
        {phase === "quiz" && currentQuestion && (
          <motion.div
            key={`q-${qIdx}`}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25 }}
            className="max-w-md lg:max-w-6xl mx-auto px-4 py-5 lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start"
          >
            <aside className="hidden lg:block lg:sticky lg:top-24 max-h-[75dvh] overflow-y-auto ui-card rounded-2xl bg-white border-2 border-bg-softer p-5">{evidencePanel}</aside>
            <div className="min-w-0">
            <button type="button" className="btn-chunky-ghost mb-4" onClick={() => { stopPlayback(); setPassageOpen(true); }}>查看原文 / 找证据</button>
            {selectedEvidence.length > 0 && <p className="mb-3 text-sm text-ink-light" role="status">我找到了第 {selectedEvidence.join('、')} 句。</p>}
            <div className="ui-card bg-white border-2 border-bg-softer p-4 sm:p-5 mb-4">
              <QuestionRenderer
                question={currentQuestion}
                answer={answer}
                phase={qPhase}
                isCorrect={isCorrect}
                onChange={setAnswer}
                locked={passageOpen}
              />
            </div>

            {qPhase === "checked" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "rounded-2xl p-4 mb-4",
                  isCorrect ? "bg-primary/10 border border-primary/30" : "bg-danger/10 border border-danger/30",
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  {isCorrect ? (
                    <>
                      <Check className="w-5 h-5 text-primary-dark" />
                      <span className="font-extrabold text-primary-dark">答对了!</span>
                    </>
                  ) : (
                    <>
                      <XMark className="w-5 h-5 text-danger" />
                      <span className="font-extrabold text-danger">
                        正确答案: {currentQ.answer}
                      </span>
                    </>
                  )}
                </div>
                <p className="text-sm text-ink-light">{currentQ.explanation}</p>
                {referenceEvidence.length > 0 && <button type="button" className="min-h-11 mt-2 text-secondary-dark font-bold underline" onClick={() => { stopPlayback(); setPassageOpen(true); }}>看看第 {referenceEvidence.join('、')} 句的依据</button>}
              </motion.div>
            )}

            {qPhase === "answering" ? (
              <button
                onClick={checkAnswer}
                disabled={!answer.trim()}
                className={cn(
                  "w-full",
                  answer.trim()
                    ? "btn-chunky-primary"
                    : "btn-chunky-disabled",
                )}
              >
                检查答案
              </button>
            ) : (
              <button
                onClick={nextQuestion}
                className="btn-chunky-primary w-full"
              >
                {qIdx + 1 < story.questions.length ? "下一题" : "查看结果"}
              </button>
            )}
            </div>
          </motion.div>
        )}

        {/* ===================== RESULT PHASE ===================== */}
        {phase === "result" && (
          <motion.div
            key="result"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md lg:max-w-2xl mx-auto px-4 py-5 text-center"
          >
            <div className="bg-white rounded-2xl border border-bg-softer p-8 mb-6 shadow-sm">
              <div className="flex justify-center gap-2 mb-4">
                {[1, 2, 3].map(n => (
                  <Star
                    key={n}
                    className={cn(
                      "w-10 h-10",
                      n <= stars ? "fill-current text-gold" : "text-bg-softer",
                    )}
                  />
                ))}
              </div>
              <h2 className="text-2xl font-extrabold text-ink mb-2">
                {stars === 3 ? "太棒了!" : stars === 2 ? "不错!" : "继续努力!"}
              </h2>
              <p className="text-ink-light mb-4">「{story.title}」阅读理解</p>
              <div className="flex justify-center gap-6 text-sm">
                <div>
                  <div className="text-2xl font-extrabold text-primary tabular-nums">
                    {correctCount}/{story.questions.length}
                  </div>
                  <div className="text-ink-softer">答对</div>
                </div>
                <div>
                  <div className="text-2xl font-extrabold text-gold tabular-nums">
                    {Math.round(accuracy * 100)}%
                  </div>
                  <div className="text-ink-softer">正确率</div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => router.push(backHref)}
                className="btn-chunky-primary w-full"
              >
                返回故事列表
              </button>
              <button
                onClick={() => {
                  dispatch({ type: 'restart' });
                }}
                className="btn-chunky-ghost w-full"
              >
                再读一遍
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Modal open={passageOpen} size="reading" ariaLabel="查看原文与证据" onClose={() => { stopPlayback(); setPassageOpen(false); }}>
        <div className="sticky top-0 z-10 bg-white pb-4">
          <button type="button" className="btn-chunky-secondary w-full" onClick={() => { stopPlayback(); setPassageOpen(false); }}>回到题目</button>
        </div>
        {evidencePanel}
        {playbackError && <p role="alert" className="text-danger mt-3">{playbackError}</p>}
      </Modal>
      {/* 底部操作栏 — 仅阅读阶段 */}
      {phase === "reading" && (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-bg-softer shadow-[0_-4px_12px_rgba(0,0,0,0.04)]" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div className="max-w-md lg:max-w-6xl mx-auto px-4 py-3 flex gap-3">
            <motion.button
              type="button"
              onClick={playAll}
              disabled={!hasAudio}
              className={cn(
                "flex-1 gap-2",
                mode === "playing" ? "btn-chunky-danger" : "btn-chunky-primary",
                !hasAudio && "btn-chunky-disabled",
              )}
            >
              {mode === "playing" ? (
                <>
                  <Pause className="w-5 h-5" />
                  停止
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  听全文
                </>
              )}
            </motion.button>

            <motion.button
              type="button"
              onClick={startQuiz}
              className="flex-1 gap-2 btn-chunky-secondary"
            >
              <Lightning className="w-5 h-5" />
              开始答题
            </motion.button>
          </div>
          {playbackError && <p role="alert" className="max-w-md lg:max-w-6xl mx-auto px-4 pb-3 text-sm text-danger">{playbackError}</p>}
        </div>
      )}
    </main>
  );
}
