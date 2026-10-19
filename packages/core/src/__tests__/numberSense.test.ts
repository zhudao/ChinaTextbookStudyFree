import { describe, expect, it } from "vitest";
import {
  NUMBER_SKILLS,
  numberSenseQuestions,
  numberReviewQuestions,
  recordNumberPractice,
  recordNumberReview,
  dueNumberSkills,
  numberSkillLabel,
  normalizeNumberProgress,
  nextStudyDay,
} from "../numberSense";
import { gradeAnswer } from "../grade";
const evidence = {
  independentCorrect: 3,
  independentTotal: 3,
  transferCorrect: 2,
  transferTotal: 2,
  hintsUsed: 0,
};
describe("number sense: actual visual quantities and learning evidence", () => {
  it("grades each of the 18 authored tasks against independent arithmetic", () => {
    for (const skill of NUMBER_SKILLS) {
      const questions = numberSenseQuestions(skill);
      expect(questions).toHaveLength(6);
      expect(
        questions.filter((q) => q.numberTask.stage === "transfer"),
      ).toHaveLength(2);
      for (const q of [
        ...questions,
        ...numberReviewQuestions(skill, "2026-10-18"),
        ...numberReviewQuestions(skill, "2026-10-19"),
      ]) {
        const v = q.numberTask.visual;
        const expected =
          v.kind === "count"
            ? String(v.count)
            : v.kind === "compare"
              ? v.left === v.right
                ? "同样多"
                : (v.left > v.right ? v.leftLabel : v.rightLabel) + "多"
              : v.resources < v.learners
                ? "不够"
                : v.resources === v.learners
                  ? "刚好够"
                  : "够，还有剩下";
        expect(q.answer).toBe(expected);
        expect(new Set(q.options).size).toBe(q.options.length);
        expect(q.options.filter((option) => option === expected)).toHaveLength(
          1,
        );
        q.options.forEach((_, i) =>
          expect(gradeAnswer(q, String.fromCharCode(65 + i))).toBe(
            q.options[i] === expected,
          ),
        );
        expect(gradeAnswer(q, "")).toBe(false);
        if (v.kind === "count") {
          expect(v.count).toBeLessThanOrEqual(10);
          expect(v.count).toBeGreaterThan(0);
        }
      }
    }
  });
  it("uses different quantities or contexts for the delayed check", () => {
    for (const skill of NUMBER_SKILLS) {
      const trained = numberSenseQuestions(skill).map((q) =>
        JSON.stringify(q.numberTask.visual),
      );
      for (const q of numberReviewQuestions(skill, "2026-10-18"))
        expect(trained).not.toContain(JSON.stringify(q.numberTask.visual));
    }
  });
  it("cannot call same-day repetition delayed retention; checks need both new questions correct", () => {
    let progress = recordNumberPractice({}, "count", evidence, "2026-10-17");
    expect(numberSkillLabel(progress.count)).toBe("能独立做");
    expect(dueNumberSkills(progress, "2026-10-17")).toEqual([]);
    expect(
      recordNumberReview(
        progress,
        [{ skill: "count", correct: 2, total: 2 }],
        "2026-10-17",
      ),
    ).toEqual(progress);
    expect(dueNumberSkills(progress, "2026-10-18")).toEqual(["count"]);
    progress = recordNumberReview(
      progress,
      [{ skill: "count", correct: 1, total: 2 }],
      "2026-10-18",
    );
    expect(progress.count?.verifiedOn).toBeUndefined();
    expect(progress.count?.nextReviewOn).toBe("2026-10-19");
    progress = recordNumberReview(
      progress,
      [{ skill: "count", correct: 2, total: 2 }],
      "2026-10-19",
    );
    expect(numberSkillLabel(progress.count)).toBe("隔天仍会");
    expect(progress.count?.nextReviewOn).toBe("2026-10-26");
    expect(
      recordNumberReview(
        progress,
        [{ skill: "count", correct: 2, total: 2 }],
        "2026-10-19",
      ),
    ).toEqual(progress);
  });
  it("does not promote supported or partially independent practice", () => {
    const progress = recordNumberPractice(
      {},
      "apply",
      { ...evidence, transferCorrect: 1, hintsUsed: 1 },
      "2026-10-17",
    );
    expect(numberSkillLabel(progress.apply)).not.toBe("能独立做");
    expect(numberSkillLabel(progress.apply)).not.toBe("隔天仍会");
  });
  it("uses calendar days across year and DST boundaries and validates backups", () => {
    expect(nextStudyDay("2026-12-31")).toBe("2027-01-01");
    expect(nextStudyDay("2026-11-01")).toBe("2026-11-02");
    const progress = recordNumberPractice(
      {},
      "compare",
      evidence,
      "2026-10-17",
    );
    expect(normalizeNumberProgress(progress)).toEqual(progress);
    expect(
      normalizeNumberProgress({
        compare: { ...progress.compare, practicedOn: "2026-02-30" },
      }),
    ).toEqual({});
    expect(
      normalizeNumberProgress({
        compare: {
          ...progress.compare,
          evidence: { ...evidence, independentCorrect: 999 },
        },
      }),
    ).toEqual({});
  });
});
