/** Verify revised lessons through the data builder and actual runtime grader. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { gradeAnswer } from "../packages/core/src/grade";
import { numberSkillForLesson, curateNumberSenseLesson } from "../packages/core/src/numberSense";
import type { Lesson } from "../packages/core/src/types";
import { narrationVerifier } from "./checks/narration-reference";

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(
    Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => [k, canonical(v)]),
  );
  return value;
}
function fingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}
function clean(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "audio"));
}
const contentOnly = process.argv.includes('--content-only');
const verifyAudio = contentOnly ? () => {} : narrationVerifier();

const folder = path.resolve("docs/lesson-reviews");
assert(fs.existsSync(folder), "No applied lesson reviews");
const rechecks = JSON.parse(fs.readFileSync('docs/ux12-2026-10-25/content-rechecks.json', 'utf8')) as {
  lesson_id: string; historical_review_fingerprint: string; current_fingerprint: string;
  review_kind: string; teacher_review: string;
}[];
let lessons = 0, questions = 0, curatedLessons = 0, recheckedLessons = 0;
for (const file of fs.readdirSync(folder).filter(f => f.endsWith(".json"))) {
  const ledger = JSON.parse(fs.readFileSync(path.join(folder, file), "utf8"));
  if (!ledger.model_review) continue; // Standalone teacher submissions have no model draft.
  const book = ledger.lesson_id.split("-u")[0];
  const lesson: Lesson = JSON.parse(fs.readFileSync(path.resolve("apps/web/public/data/books", book, "lessons", `${ledger.lesson_id}.json`), "utf8"));
  if (numberSkillForLesson(lesson.id)) {
    const reference = curateNumberSenseLesson(lesson);
    assert.deepEqual(lesson.questions.map(q => clean(q as unknown as Record<string, unknown>)), reference.questions);
    assert.deepEqual(clean(lesson.knowledge as unknown as Record<string, unknown>), reference.knowledge);
    curatedLessons++;
    continue; // Intentional new authored curriculum, not the historical model-reviewed text.
  }
  assert(lesson.knowledge, `${lesson.id}: no knowledge`);
  assert(lesson.questions.length >= 6, `${lesson.id}: insufficient practice`);
  assert.equal(lesson.questions.length, ledger.after_question_count);
  const actual = { knowledge: clean(lesson.knowledge as unknown as Record<string, unknown>),
    questions: lesson.questions.map(q => clean(q as unknown as Record<string, unknown>)) };
  const currentFingerprint = fingerprint(actual);
  if (currentFingerprint !== ledger.after_fingerprint) {
    const recheck = rechecks.find(r => r.lesson_id === lesson.id);
    assert(recheck, `${lesson.id}: built content differs without an explicit recheck`);
    assert.equal(recheck.historical_review_fingerprint, ledger.after_fingerprint);
    assert.equal(recheck.review_kind, 'deterministic_math_and_source_recheck_not_teacher_signoff');
    assert.equal(recheck.teacher_review, 'pending');
    assert.equal(currentFingerprint, recheck.current_fingerprint, `${lesson.id}: built content differs from its precise recheck`);
    recheckedLessons++;
  }
  assert.equal(ledger.model_review.approved, true);
  assert.deepEqual(ledger.model_review.issues, []);
  const ks = lesson.knowledge;
  for (const field of ["point", "core_concept", "key_formula", "tips"] as const) verifyAudio(ks[field], ks.audio?.[field], book);
  ks.common_mistakes.forEach((text, i) => verifyAudio(text, ks.audio?.common_mistakes?.[i], book));
  for (const q of lesson.questions) {
    assert.equal(q.knowledge_point, lesson.title);
    assert(!gradeAnswer(q, ""), `${lesson.id} #${q.id}: empty answer`);
    if (q.type === "choice") {
      const idx = q.options.indexOf(q.answer);
      assert(idx >= 0, `${lesson.id} #${q.id}: answer not in options`);
      for (let i = 0; i < 4; i++) assert.equal(gradeAnswer(q, String.fromCharCode(65 + i)), i === idx, `${lesson.id} #${q.id}: option ${i}`);
    } else {
      assert(gradeAnswer(q, q.answer), `${lesson.id} #${q.id}: correct answer rejected`);
      const wrong = q.type === "true_false" ? (q.answer === "对" ? "错" : "对") : q.type === "fill_blank_text" ? "错误答案" : gradeAnswer(q, "99999") ? "99998" : "99999";
      assert(!gradeAnswer(q, wrong), `${lesson.id} #${q.id}: wrong answer accepted`);
    }
    verifyAudio(q.question, q.audio?.question, book);
    verifyAudio(q.explanation, q.audio?.explanation, book);
    q.options.forEach((text, i) => verifyAudio(text.replace(/^[A-Da-d][.、]\s*/, ""), q.audio?.options?.[i], book));
    questions++;
  }
  lessons++;
}
assert(lessons > 0, "No model-reviewed lesson revisions");
console.log(`PASS: ${lessons} revised lessons, ${questions} questions; precise content fingerprints and correct/wrong/empty grading; audio ${contentOnly ? 'NOT CHECKED (content-only mode)' : 'normalized/versioned MP3 integrity passed'}; ${recheckedLessons} explicit content recheck (not teacher signoff); ${curatedLessons} historical lessons replaced by the independently tested visual pilot.`);
