/** Exercise every published question through the same grader used by the app. */
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { gradeAnswer } from "../../packages/core/src/grade";
import type { Question } from "../../packages/core/src/types";

const publicDir = path.resolve(process.argv[2] ?? "apps/web/public");
const failures: { location: string; error: string }[] = [];
let checked = 0;
function check(question: Question, location: string): void {
  checked++;
  try {
    assert(Array.isArray(question.options) && question.options.every(
      option => typeof option === "string" && option.trim().length > 0),
      "options must contain usable text, or be empty for text input");
    assert(!gradeAnswer(question, ""), "empty answer accepted");
    if (question.type === "choice") {
      const accepted = question.options.map((_, index) =>
        gradeAnswer(question, String.fromCharCode(65 + index)));
      assert.equal(accepted.filter(Boolean).length, 1, "choice must accept exactly one visible button");
    } else if (question.type === "true_false") {
      assert.notEqual(gradeAnswer(question, "对"), gradeAnswer(question, "错"),
        "true/false must accept exactly one visible button");
    } else {
      assert(gradeAnswer(question, question.answer), "standard answer rejected");
    }
  } catch (error) {
    failures.push({ location, error: String(error) });
  }
}
for (const book of fs.readdirSync(path.join(publicDir, "data/books"))) {
  const folder = path.join(publicDir, "data/books", book);
  for (const file of fs.readdirSync(path.join(folder, "lessons"))) {
    if (!file.endsWith(".json")) continue;
    const lesson = JSON.parse(fs.readFileSync(path.join(folder, "lessons", file), "utf8"));
    for (const question of lesson.questions) check(question, `${lesson.id} #${question.id}`);
  }
  const stories = path.join(folder, "stories.json");
  if (fs.existsSync(stories)) {
    for (const story of JSON.parse(fs.readFileSync(stories, "utf8")).stories) {
      for (const question of story.questions) check(question, `${story.id} #${question.id}`);
    }
  }
}
console.log(JSON.stringify({ status: failures.length ? "failed" : "passed", checked, failures }, null, 2));
if (!checked || failures.length) process.exitCode = 1;
