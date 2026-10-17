import type { Question } from "@/types";
import type { SrsMistakeEntry } from "@cstf/core/srs";
import { reviewQueue } from "./reviewQueue";
import {
  loadReviewLessons,
  reconcileMistakes,
  type LessonMap,
  type FetchLesson,
} from "./reviewContent";
export interface ReviewItem {
  key: string;
  lessonId: string;
  lessonTitle: string;
  question: Question;
  scheduled: boolean;
}
export async function prepareReview(
  bank: SrsMistakeEntry[],
  forHearts: boolean,
  fallbackLessonId?: string,
  fetcher?: FetchLesson,
) {
  const lessons: LessonMap = new Map();
  let current = bank;
  for (;;) {
    const candidates = reviewQueue(current, forHearts);
    const missing = candidates.filter(
      (item) => !lessons.has(item.entry.lessonId),
    );
    if (!missing.length) break;
    const loaded = await loadReviewLessons(
      missing.map((item) => item.entry),
      fetcher,
    );
    for (const [id, lesson] of loaded) lessons.set(id, lesson);
    current = reconcileMistakes(bank, lessons);
  }
  const items: ReviewItem[] = reviewQueue(current, forHearts).map(
    ({ entry, scheduled }) => ({
      key: `${entry.lessonId}:${entry.question.id}`,
      lessonId: entry.lessonId,
      lessonTitle: entry.lessonTitle ?? entry.lessonId,
      question: entry.question,
      scheduled,
    }),
  );
  if (!items.length && forHearts && fallbackLessonId) {
    if (!lessons.has(fallbackLessonId)) {
      const loaded = await loadReviewLessons(
        [{ lessonId: fallbackLessonId }],
        fetcher,
      );
      for (const [id, lesson] of loaded) lessons.set(id, lesson);
    }
    const lesson = lessons.get(fallbackLessonId);
    for (const question of lesson?.questions.slice(0, 5) ?? [])
      items.push({
        key: `${fallbackLessonId}:${question.id}`,
        lessonId: fallbackLessonId,
        lessonTitle: lesson!.title,
        question,
        scheduled: false,
      });
  }
  return { items, lessons, retiredCount: bank.length - current.length };
}
