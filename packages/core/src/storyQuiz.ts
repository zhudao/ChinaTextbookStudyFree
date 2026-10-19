import { gradeAnswer } from "./grade";
import { lessonContentKey } from "./content";
import type { Story, StoryQuestion, Question } from "./types";

export function storyQuestion(q: StoryQuestion): Question {
  return { ...q, score: 5, difficulty: 1, knowledge_point: "" };
}
export interface StoryQuizState {
  phase: "reading" | "quiz" | "result";
  index: number;
  answer: string;
  checked: boolean;
  correct: boolean | null;
  correctIds: number[];
  evidence: Record<number, number[]>;
}
export const newStoryQuiz = (): StoryQuizState => ({
  phase: "reading",
  index: 0,
  answer: "",
  checked: false,
  correct: null,
  correctIds: [],
  evidence: {},
});
export type StoryAction =
  | { type: "start" | "check" | "next" | "restart" }
  | { type: "answer"; value: string }
  | { type: "evidence"; sentence: number }
  | { type: "restore"; state: StoryQuizState };
export function advanceStoryQuiz(
  state: StoryQuizState,
  action: StoryAction,
  story: Story,
): StoryQuizState {
  if (action.type === "restore") return action.state;
  if (action.type === "restart") return newStoryQuiz();
  if (action.type === "start")
    return story.questions.length
      ? { ...newStoryQuiz(), phase: "quiz" }
      : state;
  if (state.phase !== "quiz") return state;
  const question = story.questions[state.index];
  if (!question) return state;
  if (action.type === "evidence") {
    if (
      state.checked ||
      !Number.isInteger(action.sentence) ||
      action.sentence < 1 ||
      action.sentence > story.sentences.length
    )
      return state;
    const selected = state.evidence[question.id] ?? [];
    return {
      ...state,
      evidence: {
        ...state.evidence,
        [question.id]: selected.includes(action.sentence)
          ? selected.filter((n) => n !== action.sentence)
          : [...selected, action.sentence],
      },
    };
  }
  if (action.type === "answer")
    return state.checked ? state : { ...state, answer: action.value };
  if (action.type === "check") {
    if (state.checked || !state.answer.trim()) return state;
    const correct = gradeAnswer(storyQuestion(question), state.answer);
    return {
      ...state,
      checked: true,
      correct,
      correctIds: correct
        ? [...new Set([...state.correctIds, question.id])]
        : state.correctIds,
    };
  }
  if (action.type === "next" && state.checked) {
    if (state.index + 1 === story.questions.length)
      return { ...state, phase: "result" };
    return {
      ...state,
      index: state.index + 1,
      answer: "",
      checked: false,
      correct: null,
    };
  }
  return state;
}

export function visibleStoryEvidence(
  story: Story,
  index: number,
  checked: boolean,
): number[] {
  if (!checked) return [];
  return [
    ...new Set(story.questions[index]?.evidence_sentence_indices ?? []),
  ].filter((n) => Number.isInteger(n) && n >= 1 && n <= story.sentences.length);
}
export function storySessionKey(story: Story): string {
  return lessonContentKey({
    knowledge: null,
    questions: story.questions
      .map(storyQuestion)
      .concat([
        { question: story.sentences.map((s) => s.text).join("\n") } as Question,
      ]),
  });
}
export function restoreStoryQuiz(raw: unknown, story: Story): StoryQuizState {
  const fresh = newStoryQuiz();
  if (!raw || typeof raw !== "object") return fresh;
  const saved = raw as { contentKey?: string; state?: StoryQuizState };
  const state = saved.state;
  if (
    saved.contentKey !== storySessionKey(story) ||
    !state ||
    !["reading", "quiz", "result"].includes(state.phase) ||
    !Number.isInteger(state.index) ||
    state.index < 0 ||
    state.index >= story.questions.length ||
    typeof state.answer !== "string" ||
    state.answer.length > 2000 ||
    !Array.isArray(state.correctIds) ||
    !state.evidence ||
    typeof state.evidence !== "object" ||
    typeof state.checked !== "boolean"
  )
    return fresh;
  const ids = new Set(
    story.questions
      .slice(0, state.index + (state.checked ? 1 : 0))
      .map((q) => q.id),
  );
  const evidence: Record<number, number[]> = {};
  for (const q of story.questions) {
    if (Array.isArray(state.evidence[q.id]))
      evidence[q.id] = [...new Set(state.evidence[q.id])].filter(
        (n) => Number.isInteger(n) && n >= 1 && n <= story.sentences.length,
      );
  }
  // The checked answer is re-derived; persisted UI feedback cannot contradict it.
  const correct = state.checked
    ? gradeAnswer(storyQuestion(story.questions[state.index]), state.answer)
    : null;
  if (
    state.phase === "result" &&
    (!state.checked || state.index !== story.questions.length - 1)
  )
    return fresh;
  return {
    ...state,
    correct,
    correctIds: [...new Set(state.correctIds)].filter(
      (id) =>
        ids.has(id) &&
        (id !== story.questions[state.index].id || correct === true),
    ),
    evidence,
  };
}
