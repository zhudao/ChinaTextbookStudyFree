import assert from 'node:assert/strict';

async function main() {
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  }, configurable: true });
  const { useProgressStore } = await import('../../apps/web/src/store/progress');
  const store = useProgressStore.getState();
  const outcome = store.recordLessonComplete('single-question', '微练习', 1, 10, { questionCount: 1 });
  assert.equal(outcome.stars, 1, 'one guessed answer must not grant three-star evidence');
  assert.equal(outcome.isFirstPerfect, false);
  assert.equal(outcome.gemsGained, 3);
  assert.equal(useProgressStore.getState().perfectedLessons['single-question'], undefined);
  assert.equal(store.questProgress('reviewMistakes'), 1, 'a learner without mistakes can consolidate a lesson');
  const normal = store.recordLessonComplete('multi-question', '练习', 1, 60, { questionCount: 6 });
  assert.equal(normal.stars, 3, 'full exercises retain their existing reward contract');
  assert.equal(normal.isFirstPerfect, true);
  const quest = store.todayQuests().find(q => q.kind === 'reviewMistakes');
  if (quest && store.questProgress(quest.kind) >= quest.target) {
    assert.equal(store.claimQuest(quest.id, 999999), true);
    assert.equal(store.claimQuest(quest.id, 999999), false, 'quest adaptation must preserve the claim ledger');
  }
  useProgressStore.setState({ hearts: 0, nextHeartAt: Date.now() + 300000, lastReviewHeartDate: null });
  assert.equal(store.awardReviewHeart(3, 3), 1, 'a complete three-question review must not promise an impossible five-question reward');
  assert.equal(useProgressStore.getState().hearts, 1);
  assert.equal(store.awardReviewHeart(3, 3), 0, 'the smaller review pool must preserve the daily claim limit');
  const {buildBackup}=await import('../../packages/core/src/backup');
  store.importBackup(buildBackup({platform:'web',data:{mistakesBank:[{lessonId:'g1up-u1-kp1',questionId:11,box:2,nextReviewDate:'2999-01-01'}]}}));
  assert.equal(useProgressStore.getState().mistakesBank.length,1,'snapshot-free legacy mistakes must not be silently discarded');
  assert.equal(useProgressStore.getState().mistakesBank[0].question.id,11);
  assert.equal(useProgressStore.getState().mistakesBank[0].nextReviewDate,'2999-01-01');
  console.log('micro-practice evidence and attainable quest regressions passed');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
