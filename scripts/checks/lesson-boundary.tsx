import assert from "node:assert/strict";
import LessonPageClient from "../../apps/web/src/app/lesson/[book]/[lesson]/LessonPageClient";
import type { Lesson } from "../../packages/core/src/types";
const lesson = {
  id: "g1up-u1-kp1",
  knowledge: null,
  questions: [
    { id: 1, type: "calculation", question: "计算", answer: "18", options: [] },
  ],
} as Lesson;
const props = { lesson, chestSlot: null };
const before = LessonPageClient(props);
const changed = LessonPageClient({
  ...props,
  lesson: { ...lesson, questions: [{ ...lesson.questions[0], answer: "20" }] },
});
assert.notEqual(
  before.key,
  changed.key,
  "same-ID content updates must remount the actual runner, not stamp stale local feedback with a new content key",
);
assert.equal(
  before.key,
  LessonPageClient({
    ...props,
    lesson: {
      ...lesson,
      questions: [{ ...lesson.questions[0], audio: { question: "/new.mp3" } }],
    },
  }).key,
  "audio repackaging preserves a runner",
);
console.log(
  "PASS: real lesson caller remounts on content edits and preserves media-only updates.",
);
