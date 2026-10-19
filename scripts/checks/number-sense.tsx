import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  NUMBER_SKILLS,
  NUMBER_LESSONS,
  numberSenseQuestions,
  recordNumberPractice,
  nextStudyDay,
} from "../../packages/core/src/numberSense";
import { dateKey } from "../../packages/core/src/week";
import {
  newNumberCheck,
  advanceNumberCheck,
  checkQuestions,
  numberCheckResults,
  restoreNumberCheck,
} from "../../apps/web/src/lib/numberCheck";
import fs from "node:fs";
async function main() {
  Object.defineProperty(globalThis, "localStorage", {
    value: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    configurable: true,
  });
  const { useProgressStore } = await import(
    "../../apps/web/src/store/progress"
  );
  const { NumberSenseVisual } = await import(
    "../../apps/web/src/components/question/NumberSenseQuestion"
  );
  for (const skill of NUMBER_SKILLS) {
    const path = `apps/web/public/data/books/g1up/lessons/${NUMBER_LESSONS[skill].id}.json`;
    const built = JSON.parse(fs.readFileSync(path, "utf8"));
    assert.equal(built.title, NUMBER_LESSONS[skill].title);
    assert.deepEqual(
      built.questions.map(({ audio, ...q }: any) => q),
      numberSenseQuestions(skill),
      "the canonical route must export the curated content",
    );
    for (const q of numberSenseQuestions(skill)) {
      const markup = renderToStaticMarkup(
        <NumberSenseVisual
          visual={q.numberTask.visual}
          marked={[]}
          setMarked={() => {}}
        />,
      );
      assert(!markup.includes("NaN"));
      assert(markup.includes('role="group"'));
      assert(markup.includes("图"));
    }
  }
  const today = dateKey(),
    yesterday = nextStudyDay(today, -1);
  const evidence = {
    independentCorrect: 3,
    independentTotal: 3,
    transferCorrect: 2,
    transferTotal: 2,
    hintsUsed: 0,
  };
  let progress = {};
  for (const skill of NUMBER_SKILLS)
    progress = recordNumberPractice(progress, skill, evidence, yesterday);
  useProgressStore.setState({ numberSenseProgress: progress });
  let state = newNumberCheck(today, [...NUMBER_SKILLS]);
  const questions = checkQuestions(state);
  for (const question of questions) {
    state = advanceNumberCheck(state, {
      type: "answer",
      value: String.fromCharCode(
        65 + question.options.indexOf(question.answer),
      ),
    });
    const snapshot = restoreNumberCheck(
      JSON.parse(JSON.stringify(state)),
      today,
      [...NUMBER_SKILLS],
    );
    assert.deepEqual(snapshot, state, "draft survives refresh");
    state = advanceNumberCheck(state, { type: "check" });
    state = advanceNumberCheck(state, { type: "check" });
    state = advanceNumberCheck(state, { type: "next" });
    state = advanceNumberCheck(state, { type: "next" });
  }
  assert(state.complete);
  assert.equal(state.responses.length, 6);
  assert(numberCheckResults(state).every((r) => r.correct === 2));
  const store = useProgressStore.getState();
  assert(store.recordNumberSenseReview(numberCheckResults(state)));
  const earned = useProgressStore.getState().xp;
  assert(
    !store.recordNumberSenseReview(numberCheckResults(state)),
    "a receipt cannot settle twice",
  );
  assert.equal(useProgressStore.getState().xp, earned);
  const backup = store.exportBackup();
  store.importBackup(backup);
  assert.deepEqual(
    useProgressStore.getState().numberSenseProgress,
    backup.data.numberSenseProgress,
  );
  let supported = newNumberCheck(today, ["count"]);
  supported = advanceNumberCheck(supported, { type: "help" });
  supported = advanceNumberCheck(supported, { type: "next" });
  const second = checkQuestions(supported)[1];
  supported = advanceNumberCheck(supported, {
    type: "answer",
    value: String.fromCharCode(65 + second.options.indexOf(second.answer)),
  });
  supported = advanceNumberCheck(supported, { type: "check" });
  supported = advanceNumberCheck(supported, { type: "next" });
  assert.equal(
    numberCheckResults(supported)[0].correct,
    1,
    "helped answers are not independent evidence",
  );
  assert.equal(
    restoreNumberCheck({ ...state, skills: ["unknown"] }, today, [
      "unknown",
    ] as any),
    null,
  );
  console.log(
    "PASS: canonical pilot export, visual render, delayed verification/resume/help, idempotent reward, backup round trip.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
