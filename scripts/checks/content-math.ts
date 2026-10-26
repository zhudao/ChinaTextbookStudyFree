import assert from "node:assert/strict";
import fs from "node:fs";
import { gradeAnswer } from "../../packages/core/src/grade";
import type { Question } from "../../packages/core/src/types";

const quiz = JSON.parse(fs.readFileSync("output/math/quizzes/义务教育教科书 · 数学五年级上册_unit4.json", "utf8"));
for (const id of [24, 26]) {
  const q: Question = quiz.unit_test.questions.find((question: Question) => question.id === id);
  const [total, ratio] = q.question.match(/\d+/g)!.map(Number);
  const valid = q.options.map(option => {
    const [a, b] = option.match(/\d+/g)!.map(Number);
    return a + b === total && a === ratio * b;
  });
  assert.equal(valid.filter(Boolean).length, 1, `#${id}: the stated total and ratio must admit exactly one option`);
  q.options.forEach((_, i) => assert.equal(gradeAnswer(q, String.fromCharCode(65 + i)), valid[i], `#${id}: grading must agree with the mathematical conditions`));
}
const placeQuiz = JSON.parse(fs.readFileSync('output/math/quizzes/义务教育教科书 · 数学四年级上册_unit1.json', 'utf8'));
const place: Question = placeQuiz.unit_test.questions.find((q: Question) => q.id === 15);
const [number, digit] = place.question.match(/\d+/g)!;
assert.equal(number.split(digit).length - 1, 1, 'The place-value question must identify a unique digit');
const units = ['个位', '十位', '百位', '千位', '万位', '十万位', '百万位', '千万位'];
const expectedPlace = units[number.length - number.indexOf(digit) - 1];
assert.equal(expectedPlace, '万位');
place.options.forEach((option, i) => assert.equal(gradeAnswer(place, String.fromCharCode(65 + i)), option === expectedPlace));
console.log("PASS: probability totals, ratios, digit positions and runtime grading agree, with one valid option each.");
