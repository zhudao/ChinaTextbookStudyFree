import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

async function main() {
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
    configurable: true,
  });
  const { useProgressStore } = await import(
    "../../apps/web/src/store/progress"
  );
  const { WeeklyReportView } = await import(
    "../../apps/web/src/components/WeeklyReportCard"
  );
  const { weeklyStudyReport } = await import("../../packages/core/src/week");
  const render = () =>
    renderToStaticMarkup(
      <WeeklyReportView
        data={weeklyStudyReport(useProgressStore.getState())}
      />,
    );
  const initial = useProgressStore.getState();
  initial.recordLessonComplete("science-micro", "微练习", 0, 0, {
    questionCount: 1,
  });
  assert.equal(useProgressStore.getState().xp, 0);
  assert.match(render(), /1\/7/, "a completed zero-XP lesson is a study day");
  assert.doesNotMatch(
    render(),
    /本周还没有学习记录/,
    "do not deny a completed learning activity",
  );
  const { dateKey } = await import("../../packages/core/src/week");
  assert.match(
    render(),
    /0 XP.*已学习/,
    "the zero-XP activity must also be visible in the chart description",
  );
  const completedBackup = useProgressStore.getState().exportBackup();
  useProgressStore.getState().importBackup(completedBackup);
  assert.match(render(), /完成课时/);
  assert.equal(
    weeklyStudyReport(useProgressStore.getState()).totalLessons,
    1,
    "weekly course totals survive export/import",
  );
  useProgressStore.setState({
    xpHistory: {},
    lessonHistory: {},
    studyDays: {},
    lastActiveDate: "",
    completedReadings: {},
  });
  useProgressStore.getState().awardReviewXP(0, 1);
  assert.match(
    render(),
    /1\/7/,
    "unsuccessful but real review is still learning",
  );
  const today = dateKey();
  const backup = useProgressStore.getState().exportBackup();
  useProgressStore.getState().importBackup(backup);
  assert.equal(
    useProgressStore.getState().studyDays[today],
    true,
    "zero-XP activity survives export/import",
  );
  useProgressStore.setState({
    xpHistory: {},
    lessonHistory: {},
    studyDays: {},
    lastActiveDate: "",
    completedReadings: {},
  });
  useProgressStore.getState().completeReading("reading:story:sample", 0);
  assert.match(
    render(),
    /1\/7/,
    "reading is learning even when there is no XP",
  );
  const xp = useProgressStore.getState().xp;
  useProgressStore.getState().completeReading("reading:story:sample", 100);
  assert.equal(
    useProgressStore.getState().xp,
    xp,
    "recording activity must not bypass reward idempotency",
  );
  console.log(
    "PASS: actual zero-XP lesson/review/reading → weekly render and backup; reward idempotency.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
