import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { gradeAnswer } from "../grade";
import type { QuizFile } from "../types";
const read = (name: string) =>
  JSON.parse(
    readFileSync(
      new URL(`../../../../output/math/quizzes/${name}`, import.meta.url),
      "utf8",
    ),
  ) as QuizFile;
describe("independent verification of reported math errors", () => {
  it("counts exact-payment combinations without silently changing the available coins", () => {
    const source = read("义务教育教科书 · 数学二年级上册_unit8.json");
    const questions = [
      ...source.unit_test.questions,
      ...source.exam.questions,
    ].filter((q) => q.question.includes("2 角钱硬币 2 枚"));
    expect(questions.length).toBeGreaterThan(0);
    const ways = [0, 1]
      .flatMap((five) => [0, 1, 2].map((two) => five * 5 + two * 2))
      .filter((sum) => sum === 5).length;
    expect(ways).toBe(1);
    for (const q of questions) {
      expect(q.question).toContain("恰好");
      expect(q.answer).toBe(`${ways} 种`);
      expect(gradeAnswer(q, "A")).toBe(true);
      expect(gradeAnswer(q, "B")).toBe(false);
      expect(q.explanation).not.toMatch(
        /重新审视|答案更正|修正后题干|逻辑重校/,
      );
    }
  });
  it("keeps each decimal calculation step equivalent to the original calculation", () => {
    const source = read("义务教育教科书·数学四年级下册_unit4.json");
    const q = source.unit_test.questions.find((q) => q.id === 14)!;
    expect((4.8 * 100) / 1000).toBe(0.48);
    expect(q.answer).toBe("4.8");
    expect(q.explanation).not.toContain("480 \\div 100 =");
    expect(q.explanation).toContain("480 \\div 1000");
  });
});
