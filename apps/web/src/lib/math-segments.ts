import { mathSegments } from "../../../../packages/core/src/mathSegments";

export function splitMath(text: string) {
  return mathSegments(text).map(({ type, value }) => ({ type, value }));
}
