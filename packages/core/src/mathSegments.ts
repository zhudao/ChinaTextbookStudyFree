export type MathSegment = { type: "text" | "inline" | "block"; value: string; raw: string };

/** Recover known JSON-escaped TeX tokens, only inside explicit math delimiters. */
function repairFormula(value: string): string {
  return value
    .replace(/\t(imes|riangle|ext)(?![A-Za-z])/g, (_, tail: string) => `\\t${tail}`)
    .replace(/\f(rac)(?![A-Za-z])/g, "\\frac")
    .replace(/\r(ight)(?![A-Za-z])/g, "\\right")
    .replace(/\r(ightarrow)(?![A-Za-z])/g, "\\rightarrow")
    .replace(/\n(eq)(?![A-Za-z])/g, "\\neq")
    .replace(/\x08div(?![A-Za-z])|\x00/g, "\\div")
    .replace(/\x07/g, "\\times")
    .replace(/\x08igcirc(?![A-Za-z])/g, "\\bigcirc")
    .replace(/\x08lacksquare(?![A-Za-z])/g, "\\blacksquare")
    .replace(/\x08dot(?![A-Za-z])/g, "\\cdot")
    .replace(/\x08/g, "")
    // In textbook formulas a percent sign is a value, not a TeX line comment.
    .replace(/(\\*)%/g, (all, slashes: string) => slashes.length % 2 ? all : `${slashes}\\%`);
}

/** Scan delimiters without lookbehind (also runs on older Safari). */
export function mathSegments(text: string): MathSegment[] {
  const parts: MathSegment[] = [];
  const escaped = (index: number) => {
    let count = 0;
    while (index > 0 && text[--index] === "\\") count++;
    return count % 2 === 1;
  };
  let plainStart = 0;
  let i = 0;
  while (i < text.length) {
    const open = !escaped(i) ? ["$$", "$", "\\(", "\\["].find(token => text.startsWith(token, i)) : undefined;
    if (!open) { i++; continue; }
    const close = open === "\\(" ? "\\)" : open === "\\[" ? "\\]" : open;
    let end = i + open.length;
    while (end < text.length) {
      if (text.startsWith(close, end) && !escaped(end)) break;
      end++;
    }
    // Keep an unclosed opener literal, including its inner dollar characters.
    if (end === text.length) break;
    if (i > plainStart) parts.push({ type: "text", value: text.slice(plainStart, i), raw: text.slice(plainStart, i) });
    const value = repairFormula(text.slice(i + open.length, end));
    parts.push({ type: open === "$$" || open === "\\[" ? "block" : "inline",
      value, raw: open + value + close });
    i = end + close.length;
    plainStart = i;
  }
  if (plainStart < text.length) parts.push({ type: "text", value: text.slice(plainStart), raw: text.slice(plainStart) });
  return parts;
}
