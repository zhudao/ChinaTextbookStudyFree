import type { Lesson, Question } from "./types";
import { dateKey, isDateKey, parseDateKey } from "./week";

export const NUMBER_SENSE_VERSION = 1;
export const NUMBER_SKILLS = ["count", "compare", "apply"] as const;
export type NumberSkill = (typeof NUMBER_SKILLS)[number];
export type NumberVisual =
  | {
      kind: "count";
      count: number;
      emoji: string;
      label: string;
      layout: "line" | "scatter" | "frame";
    }
  | {
      kind: "compare";
      left: number;
      right: number;
      leftEmoji: string;
      rightEmoji: string;
      leftLabel: string;
      rightLabel: string;
    }
  | {
      kind: "share";
      learners: number;
      resources: number;
      learnerEmoji: string;
      resourceEmoji: string;
      learnerLabel: string;
      resourceLabel: string;
    };
export interface NumberTask {
  stage: "guided" | "independent" | "transfer";
  visual: NumberVisual;
  hints: [string, string];
}
export type NumberQuestion = Question & { numberTask: NumberTask };
export const NUMBER_LESSONS: Record<
  NumberSkill,
  { id: string; title: string; goal: string }
> = {
  count: {
    id: "g1up-u1-kp1",
    title: "数一数，认一认",
    goal: "一个不漏地数到10，把物体和数字对起来。",
  },
  compare: {
    id: "g1up-u1-kp2",
    title: "配一配，比多少",
    goal: "一个配一个，找出同样多和谁多谁少。",
  },
  apply: {
    id: "g1up-u1-kp3",
    title: "分一分，够不够",
    goal: "给每个朋友分一个，判断够不够。",
  },
};
export function numberSkillForLesson(id: string): NumberSkill | undefined {
  return NUMBER_SKILLS.find((skill) => NUMBER_LESSONS[skill].id === id);
}
function task(
  id: number,
  skill: NumberSkill,
  stage: NumberTask["stage"],
  question: string,
  options: string[],
  answer: string,
  explanation: string,
  visual: NumberVisual,
): NumberQuestion {
  const hints: [string, string] =
    visual.kind === "count"
      ? [
          "点过的做个记号，每个只数一次。",
          "从一个角开始，点一个数一个，最后数到几就是几个。",
        ]
      : visual.kind === "compare"
        ? [
            "试着让上面一个和下面一个配成一对。",
            "一个配一个，看看哪一组还剩下；没有剩下就是同样多。",
          ]
        : [
            "试着给每个朋友放一个。",
            "每人一个。还有朋友没分到就是不够，每人都有且没有剩下就是刚好。",
          ];
  return {
    id,
    type: "choice",
    score: 5,
    difficulty: stage === "transfer" ? 2 : 1,
    knowledge_point: NUMBER_LESSONS[skill].title,
    question,
    options,
    answer,
    explanation,
    numberTask: { stage, visual, hints },
  };
}
const count = (
  id: number,
  n: number,
  emoji: string,
  label: string,
  layout: "line" | "scatter" | "frame",
  stage: NumberTask["stage"],
) =>
  task(
    id,
    "count",
    stage,
    `一共有几${label === "苹果" ? "个" : label === "小鸟" ? "只" : "个"}${label}？`,
    [String(n - 1), String(n), String(n === 10 ? 8 : n + 1)].sort(
      (a, b) => ((Number(a) + id) % 3) - ((Number(b) + id) % 3),
    ),
    String(n),
    `每个只数一次，最后数到${n}，一共有${n}${label === "小鸟" ? "只" : "个"}${label}。`,
    { kind: "count", count: n, emoji, label, layout },
  );
const compare = (
  id: number,
  left: number,
  right: number,
  stage: NumberTask["stage"],
  variant = false,
) => {
  const leftLabel = variant ? "小鸟" : "兔子",
    rightLabel = variant ? "小窝" : "萝卜";
  return task(
    id,
    "compare",
    stage,
    `${leftLabel}和${rightLabel}，谁多一些？`,
    [leftLabel + "多", "同样多", rightLabel + "多"],
    left > right
      ? leftLabel + "多"
      : left < right
        ? rightLabel + "多"
        : "同样多",
    `一个配一个，${left === right ? "两组都没有剩下，所以同样多" : left > right ? leftLabel + "有剩下，所以" + leftLabel + "多" : rightLabel + "有剩下，所以" + rightLabel + "多"}。`,
    {
      kind: "compare",
      left,
      right,
      leftEmoji: variant ? "🐦" : "🐰",
      rightEmoji: variant ? "🪹" : "🥕",
      leftLabel,
      rightLabel,
    },
  );
};
const share = (
  id: number,
  learners: number,
  resources: number,
  stage: NumberTask["stage"],
  variant = false,
) => {
  const learnerLabel = variant ? "小熊" : "小猫",
    resourceLabel = variant ? "杯子" : "碗";
  return task(
    id,
    "apply",
    stage,
    `每只${learnerLabel}分一个${resourceLabel}，够不够？`,
    ["不够", "刚好够", "够，还有剩下"],
    resources < learners
      ? "不够"
      : resources === learners
        ? "刚好够"
        : "够，还有剩下",
    `${learners}只${learnerLabel}，每只分一个，需要${learners}个${resourceLabel}。有${resources}个，所以${resources < learners ? "不够" : resources === learners ? "刚好够" : "够，还有剩下"}。`,
    {
      kind: "share",
      learners,
      resources,
      learnerEmoji: variant ? "🐻" : "🐱",
      resourceEmoji: variant ? "🥤" : "🥣",
      learnerLabel,
      resourceLabel,
    },
  );
};
export function numberSenseQuestions(skill: NumberSkill): NumberQuestion[] {
  if (skill === "count")
    return [
      count(1001, 3, "🍎", "苹果", "line", "guided"),
      count(1002, 5, "🍎", "苹果", "scatter", "independent"),
      count(1003, 5, "🍎", "苹果", "line", "independent"),
      count(1004, 8, "🍎", "苹果", "frame", "independent"),
      count(1005, 6, "🐦", "小鸟", "scatter", "transfer"),
      count(1006, 10, "🐦", "小鸟", "frame", "transfer"),
    ];
  if (skill === "compare")
    return [
      compare(1101, 3, 3, "guided"),
      compare(1102, 4, 3, "independent"),
      compare(1103, 3, 5, "independent"),
      compare(1104, 5, 5, "independent"),
      compare(1105, 5, 4, "transfer", true),
      compare(1106, 4, 6, "transfer", true),
    ];
  return [
    share(1201, 3, 3, "guided"),
    share(1202, 4, 3, "independent"),
    share(1203, 3, 5, "independent"),
    share(1204, 5, 5, "independent"),
    share(1205, 4, 5, "transfer", true),
    share(1206, 5, 4, "transfer", true),
  ];
}
export function curateNumberSenseLesson(lesson: Lesson): Lesson {
  const skill = numberSkillForLesson(lesson.id);
  if (!skill) return lesson;
  const meta = NUMBER_LESSONS[skill];
  return {
    ...lesson,
    title: meta.title,
    questions: numberSenseQuestions(skill),
    knowledge: {
      point: meta.title,
      core_concept: meta.goal,
      key_formula:
        skill === "count"
          ? "点一个，数一个；最后数到几，就是几个。"
          : "一个配一个，看看有没有剩下。",
      tips: "可以自己试，也可以点“给我一点提示”。学会以后换一种情境再练。",
      common_mistakes: [
        skill === "count"
          ? "物体摆得疏或密，数量不会变。"
          : "先让每个都配上，再判断够不够。",
      ],
    },
  };
}

export interface NumberPracticeEvidence {
  independentCorrect: number;
  independentTotal: number;
  transferCorrect: number;
  transferTotal: number;
  hintsUsed: number;
}
export interface NumberSkillProgress {
  version: number;
  practicedOn: string;
  nextReviewOn: string;
  evidence: NumberPracticeEvidence;
  reviewedOn?: string;
  reviewCorrect?: number;
  reviewTotal?: number;
  verifiedOn?: string;
}
export type NumberProgress = Partial<Record<NumberSkill, NumberSkillProgress>>;
export const nextStudyDay = (day: string, n = 1) => {
  const parsed = parseDateKey(day);
  if (!parsed) throw new Error("Invalid study day");
  return dateKey(
    new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate() + n),
  );
};
export function recordNumberPractice(
  previous: NumberProgress,
  skill: NumberSkill,
  evidence: NumberPracticeEvidence,
  day: string,
): NumberProgress {
  return {
    ...previous,
    [skill]: {
      version: NUMBER_SENSE_VERSION,
      practicedOn: day,
      nextReviewOn: nextStudyDay(day),
      evidence,
    },
  };
}
export function dueNumberSkills(
  progress: NumberProgress,
  day: string,
): NumberSkill[] {
  return NUMBER_SKILLS.filter((skill) => {
    const entry = progress[skill];
    return (
      entry?.version === NUMBER_SENSE_VERSION &&
      day > entry.practicedOn &&
      day >= entry.nextReviewOn
    );
  });
}
export function recordNumberReview(
  previous: NumberProgress,
  results: { skill: NumberSkill; correct: number; total: number }[],
  day: string,
): NumberProgress {
  const next = { ...previous };
  const due = dueNumberSkills(previous, day);
  for (const result of results) {
    const entry = previous[result.skill];
    if (
      !entry ||
      !due.includes(result.skill) ||
      result.total !== 2 ||
      result.correct < 0 ||
      result.correct > result.total
    )
      continue;
    const passed = result.correct === result.total;
    next[result.skill] = {
      ...entry,
      reviewedOn: day,
      reviewCorrect: result.correct,
      reviewTotal: result.total,
      verifiedOn: passed ? day : undefined,
      nextReviewOn: nextStudyDay(day, passed ? 7 : 1),
    };
  }
  return next;
}
/** New arrangements and quantities, not training-question replays. No hints in verification. */
export function numberReviewQuestions(
  skill: NumberSkill,
  day: string,
): NumberQuestion[] {
  const alternate = Number(day.replaceAll("-", "")) % 2 === 1;
  if (skill === "count")
    return [
      count(2001, alternate ? 7 : 9, "⭐", "星星", "scatter", "transfer"),
      count(2002, alternate ? 4 : 7, "⚽", "足球", "frame", "transfer"),
    ];
  if (skill === "compare")
    return [
      compare(2101, alternate ? 6 : 2, alternate ? 5 : 4, "transfer", true),
      compare(2102, alternate ? 4 : 6, alternate ? 4 : 6, "transfer", true),
    ];
  return [
    share(2201, alternate ? 6 : 2, alternate ? 5 : 3, "transfer", true),
    share(2202, alternate ? 2 : 6, alternate ? 3 : 5, "transfer", true),
  ];
}
export function numberSkillLabel(
  entry: NumberSkillProgress | undefined,
): string {
  if (!entry || entry.version !== NUMBER_SENSE_VERSION) return "还没开始";
  if (entry.verifiedOn && entry.verifiedOn > entry.practicedOn)
    return "隔天仍会";
  if (
    entry.reviewedOn &&
    entry.reviewedOn > entry.practicedOn &&
    (entry.reviewCorrect ?? 0) < (entry.reviewTotal ?? 0)
  )
    return "隔天检验还需巩固";
  const e = entry.evidence;
  return e.independentTotal >= 2 &&
    e.independentCorrect === e.independentTotal &&
    e.transferTotal >= 2 &&
    e.transferCorrect === e.transferTotal
    ? "能独立做"
    : "已经练习，继续巩固";
}
/** Defensive local-storage/backup reader; only the three known skills and valid dates. */
export function normalizeNumberProgress(raw: unknown): NumberProgress {
  if (!raw || typeof raw !== "object") return {};
  const result: NumberProgress = {};
  for (const skill of NUMBER_SKILLS) {
    const e = (raw as NumberProgress)[skill];
    if (
      !e ||
      e.version !== NUMBER_SENSE_VERSION ||
      !isDateKey(e.practicedOn) ||
      !isDateKey(e.nextReviewOn) ||
      !e.evidence
    )
      continue;
    const counters = [
      "independentCorrect",
      "independentTotal",
      "transferCorrect",
      "transferTotal",
      "hintsUsed",
    ] as const;
    if (
      !counters.every(
        (k) =>
          Number.isInteger(e.evidence[k]) &&
          e.evidence[k] >= 0 &&
          e.evidence[k] <= 100,
      )
    )
      continue;
    if (
      e.evidence.independentCorrect > e.evidence.independentTotal ||
      e.evidence.transferCorrect > e.evidence.transferTotal
    )
      continue;
    const verified =
      e.verifiedOn &&
      isDateKey(e.verifiedOn) &&
      e.verifiedOn > e.practicedOn &&
      e.reviewCorrect === 2 &&
      e.reviewTotal === 2;
    result[skill] = {
      version: NUMBER_SENSE_VERSION,
      practicedOn: e.practicedOn,
      nextReviewOn: e.nextReviewOn,
      evidence: { ...e.evidence },
      ...(e.reviewedOn && isDateKey(e.reviewedOn)
        ? {
            reviewedOn: e.reviewedOn,
            reviewCorrect: e.reviewCorrect,
            reviewTotal: e.reviewTotal,
          }
        : {}),
      ...(verified ? { verifiedOn: e.verifiedOn } : {}),
    };
  }
  return result;
}
