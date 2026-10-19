import {
  NUMBER_SKILLS,
  numberReviewQuestions,
  type NumberSkill,
  type NumberQuestion,
} from "@cstf/core/numberSense";
import { gradeAnswer } from "@cstf/core/grade";
export interface NumberCheckState {
  day: string;
  skills: NumberSkill[];
  index: number;
  answer: string;
  checked: boolean;
  complete: boolean;
  responses: { questionId: number; answer: string; helped: boolean }[];
}
export function newNumberCheck(
  day: string,
  skills: NumberSkill[],
): NumberCheckState {
  return {
    day,
    skills,
    index: 0,
    answer: "",
    checked: false,
    complete: false,
    responses: [],
  };
}
export const checkQuestions = (state: NumberCheckState): NumberQuestion[] =>
  state.skills.flatMap((skill) => numberReviewQuestions(skill, state.day));
export function advanceNumberCheck(
  state: NumberCheckState,
  action:
    | { type: "answer"; value: string }
    | { type: "check" | "help" | "next" },
): NumberCheckState {
  if (state.complete) return state;
  const questions = checkQuestions(state),
    current = questions[state.index];
  if (!current) return state;
  if (action.type === "answer")
    return state.checked ? state : { ...state, answer: action.value };
  if (action.type === "check" || action.type === "help") {
    if (state.checked || (action.type === "check" && !state.answer))
      return state;
    return {
      ...state,
      checked: true,
      responses: [
        ...state.responses,
        {
          questionId: current.id,
          answer: state.answer,
          helped: action.type === "help",
        },
      ],
    };
  }
  if (state.checked)
    return state.index + 1 === questions.length
      ? { ...state, complete: true }
      : { ...state, index: state.index + 1, answer: "", checked: false };
  return state;
}
export function numberCheckResults(state: NumberCheckState) {
  return state.skills.map((skill) => ({
    skill,
    total: 2,
    correct: numberReviewQuestions(skill, state.day).filter((q) => {
      const response = state.responses.find((r) => r.questionId === q.id);
      return response && !response.helped && gradeAnswer(q, response.answer);
    }).length,
  }));
}
export function restoreNumberCheck(
  raw: unknown,
  day: string,
  skills: NumberSkill[],
): NumberCheckState | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as NumberCheckState;
  if (
    !Array.isArray(s.skills) ||
    s.skills.length < 1 ||
    s.skills.length > 3 ||
    new Set(s.skills).size !== s.skills.length ||
    !s.skills.every((skill) => NUMBER_SKILLS.includes(skill))
  )
    return null;
  if (
    s.day !== day ||
    JSON.stringify(s.skills) !== JSON.stringify(skills) ||
    !Number.isInteger(s.index) ||
    typeof s.answer !== "string" ||
    s.answer.length > 20 ||
    typeof s.checked !== "boolean" ||
    typeof s.complete !== "boolean" ||
    !Array.isArray(s.responses)
  )
    return null;
  const questions = checkQuestions(newNumberCheck(day, skills));
  if (
    s.index < 0 ||
    s.index >= questions.length ||
    s.responses.length !== s.index + (s.checked ? 1 : 0) ||
    (s.complete && (!s.checked || s.index !== questions.length - 1))
  )
    return null;
  if (
    !s.responses.every(
      (r, i) =>
        r &&
        r.questionId === questions[i].id &&
        typeof r.answer === "string" &&
        r.answer.length <= 20 &&
        typeof r.helped === "boolean",
    )
  )
    return null;
  return s;
}
