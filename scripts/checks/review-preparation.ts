import assert from "node:assert/strict";
import { prepareReview } from "../../apps/web/src/lib/prepareReview";
import type { SrsMistakeEntry } from "../../packages/core/src/srs";
const question = {
  id: 1,
  type: "true_false" as const,
  question: "题目",
  answer: "对",
  options: [],
  explanation: "说明",
  score: 1,
  difficulty: 1,
  knowledge_point: "练习",
};
const due: SrsMistakeEntry = {
  lessonId: "g1up-u1-kp1",
  question,
  box: 1,
  addedAt: "2020-01-01",
  nextReviewDate: "2020-01-01",
};
async function main() {
  const bank = [
    ...Array.from({ length: 5 }, (_, i) => ({
      ...due,
      question: { ...question, id: i + 1 },
    })),
    { ...due, lessonId: "g1up-u1-kp2", nextReviewDate: "2999-01-01" },
  ];
  const load = async (url: string) =>
    new Response(
      JSON.stringify({
        id: url.includes("kp2") ? "g1up-u1-kp2" : "g1up-u1-kp1",
        title: "当前练习",
        questions: url.includes("kp2") ? [question] : [],
      }),
    );
  const result = await prepareReview(bank, true, undefined, load);
  assert.equal(
    result.items.length,
    1,
    "retired due questions must not conceal available future practice",
  );
  assert.equal(result.items[0].scheduled, false);
  const fallback = await prepareReview([], true, "g1up-u1-kp2", load);
  assert.equal(
    fallback.items.length,
    1,
    "zero-heart course must offer fresh source practice even with an empty bank",
  );
  assert.equal(
    fallback.items[0].scheduled,
    false,
    "course fallback does not advance or create SRS entries",
  );
  console.log("PASS: deleted-question refill and empty-bank source practice.");
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
