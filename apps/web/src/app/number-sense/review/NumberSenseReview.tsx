"use client";
import { learnerSessionStorage } from "@/lib/learnerProfiles";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { dateKey } from "@cstf/core/week";
import { dueNumberSkills, NUMBER_LESSONS } from "@cstf/core/numberSense";
import { gradeAnswer } from "@cstf/core/grade";
import { useProgressStore } from "@/store/progress";
import { QuestionRenderer } from "@/components/question/QuestionRenderer";
import { Mascot } from "@/components/Mascot";
import { useSyncMute, MuteToggle } from "@/components/MuteToggle";
import {
  newNumberCheck,
  advanceNumberCheck,
  checkQuestions,
  numberCheckResults,
  restoreNumberCheck,
  type NumberCheckState,
} from "@/lib/numberCheck";
const KEY = "csf-number-check-v1";
export default function NumberSenseReview() {
  useSyncMute();
  const [session, setSession] = useState<NumberCheckState | null>(null);
  const [ready, setReady] = useState(false);
  const questionScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (questionScrollRef.current) questionScrollRef.current.scrollTop = 0;
  }, [session?.index, ready]);
  const [limited, setLimited] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  useEffect(() => {
    const store = useProgressStore.getState(),
      today = dateKey();
    const due = dueNumberSkills(store.numberSenseProgress, today);
    let restored: NumberCheckState | null = null;
    try {
      const raw = JSON.parse(
        learnerSessionStorage.getItem(KEY) ?? "null",
      ) as NumberCheckState | null;
      // A receipt may be restored after completion removed the skills from due.
      if (raw && raw.day === today) {
        restored = restoreNumberCheck(
          raw,
          today,
          raw.complete ? raw.skills : due,
        );
      }
    } catch {
      /* usable without session storage */
    }
    if (restored) setSession(restored);
    else if (due.length) {
      if (store.dailyTimeLimitReached()) setLimited(true);
      else setSession(newNumberCheck(today, due));
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready || !session) return;
    try {
      learnerSessionStorage.setItem(KEY, JSON.stringify(session));
    } catch {
      /* memory-only fallback */
    }
    if (session.complete) {
      const applied = useProgressStore
        .getState()
        .recordNumberSenseReview(numberCheckResults(session));
      setSaved(true);
      setSaveMessage(
        applied
          ? "今天的检验已保存。"
          : "这次结果已保留；如果今天已经检验过，同一轮不会再次领取奖励。",
      );
    }
  }, [session, ready]);
  // Same foreground-time contract as a lesson, without counting hidden-tab time.
  useEffect(() => {
    if (!ready || !session || session.complete) return;
    let last = Date.now();
    const flush = () => {
      const now = Date.now();
      if (document.visibilityState === "visible")
        useProgressStore
          .getState()
          .addLearningTimeMs(Math.min(now - last, 30_000));
      last = now;
    };
    const timer = window.setInterval(flush, 15_000);
    document.addEventListener("visibilitychange", flush);
    return () => {
      flush();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", flush);
    };
  }, [ready, !!session, session?.complete]);
  const update = (action: Parameters<typeof advanceNumberCheck>[1]) =>
    setSession((s) => (s ? advanceNumberCheck(s, action) : s));
  if (!ready)
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Mascot mood="think" size={90} />
      </main>
    );
  if (!session || limited)
    return (
      <main className="min-h-screen px-5 flex flex-col justify-center items-center text-center gap-4">
        <Mascot mood="happy" size={100} />
        <h1 className="text-2xl font-extrabold text-ink">
          {limited ? "今天先休息一下" : "下次再用新题试试"}
        </h1>
        <p className="text-ink-light max-w-md">
          {limited
            ? "今天的学习时间到了，明天再来。"
            : "练习后的下一天才做隔天检验。同一天重练不会标成“隔天仍会”。"}
        </p>
        <Link className="btn-chunky-primary px-5" href="/number-sense/">
          回到示范单元
        </Link>
      </main>
    );
  const questions = checkQuestions(session),
    current = questions[session.index];
  const response = session.responses.find((r) => r.questionId === current.id);
  const correct =
    !!response && !response.helped && gradeAnswer(current, response.answer);
  if (session.complete)
    return (
      <main className="min-h-screen px-5 py-8 max-w-lg mx-auto text-center">
        <Mascot mood="cheer" size={100} />
        <h1 className="text-2xl font-extrabold text-ink mt-4">隔天检验完成</h1>
        {numberCheckResults(session).map((r) => (
          <div
            key={r.skill}
            className="mt-4 rounded-2xl border-2 border-bg-softer bg-white p-4 text-ink"
          >
            <h2 className="font-extrabold">{NUMBER_LESSONS[r.skill].title}</h2>
            <p>
              {r.correct}/{r.total} 道新题独立答对
            </p>
            <p className="text-sm text-ink-light">
              {r.correct === r.total
                ? "隔天仍会，一周后再巩固。"
                : "还需要巩固，明天再试。可以先回去练一练。"}
            </p>
          </div>
        ))}
        <p role="status" className="mt-4 text-sm text-ink-light">
          {saved ? saveMessage : "正在保存…"}
        </p>
        <Link className="btn-chunky-primary w-full mt-5" href="/number-sense/">
          看看学习记录
        </Link>
      </main>
    );
  return (
    <main className="lesson-screen flex flex-col max-w-2xl mx-auto text-ink">
      <div className="lesson-toolbar flex items-center justify-between gap-3 px-3 py-2">
        <Link
          className="min-h-11 inline-flex items-center font-bold text-secondary-dark"
          href="/number-sense/"
        >
          保存并返回
        </Link>
        <span>
          {session.index + 1}/{questions.length}
        </span>
        <MuteToggle />
      </div>
      <div ref={questionScrollRef} className="lesson-content px-3 sm:px-4">
      <h1 className="text-lg font-extrabold">隔天用新题试一试</h1>
      <p className="text-sm text-ink-light mb-5 mt-2">
        可以点物体做记号。需要帮助也没关系，我们会把它记成“还需要巩固”。
      </p>
      <div className="rounded-2xl bg-white border-2 border-bg-softer p-2 sm:p-4">
        <QuestionRenderer
          key={current.id}
          question={current}
          answer={session.answer}
          phase={session.checked ? "checked" : "answering"}
          isCorrect={session.checked ? correct : null}
          onChange={(value) => update({ type: "answer", value })}
        />
      </div>
      </div>
      {session.checked ? (
        <div className="lesson-actions max-h-[45dvh] overflow-y-auto px-3 pt-3 pb-4 bg-white border-t-2 border-bg-softer">
          <p role="status" className="rounded-xl bg-secondary/10 p-4">
            {correct ? "这道新题答对了。" : "一起看看方法："}{" "}
            {current.explanation}
          </p>
          <button
            className="btn-chunky-primary w-full mt-4"
            onClick={() => update({ type: "next" })}
          >
            {session.index + 1 === questions.length ? "完成检验" : "下一题"}
          </button>
        </div>
      ) : (
        <div className="lesson-actions px-3 pt-3 pb-3 bg-white border-t-2 border-bg-softer">
          <button
            className={
              session.answer
                ? "btn-chunky-primary w-full"
                : "btn-chunky-disabled w-full"
            }
            disabled={!session.answer}
            onClick={() => update({ type: "check" })}
          >
            检查
          </button>
          <button
            className="ui-text-button text-secondary-dark mt-1 w-full"
            onClick={() => update({ type: "help" })}
          >
            需要帮助，先看看方法
          </button>
        </div>
      )}
    </main>
  );
}
