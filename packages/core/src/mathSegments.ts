export type MathSegment = { type: "text" | "inline" | "block"; value: string; raw: string };

/** Recover known JSON-escaped TeX tokens inside recognized formulas. */
function repairFormula(value: string): string {
  return value
    .replace(/\\+bdiv(?![A-Za-z])/g, "\\div")
    .replace(/\t(imes|riangle|ext)(?![A-Za-z])/g, (_, tail: string) => `\\t${tail}`)
    .replace(/\f(rac)(?![A-Za-z])/g, "\\frac")
    .replace(/\r(ight)(?![A-Za-z])/g, "\\right")
    .replace(/\r(ightarrow)(?![A-Za-z])/g, "\\rightarrow")
    .replace(/\n(eq)(?![A-Za-z])/g, "\\neq")
    .replace(/\x08div(?![A-Za-z])|\x00/g, "\\div")
    .replace(/\x07/g, "\\times")
    .replace(/\x08igcirc(?![A-Za-z])/g, "\\bigcirc")
    .replace(/\x08lacksquare(?![A-Za-z])/g, "\\blacksquare")
    .replace(/(\d+\.\d*)((?:\x08dot\{\d\})+)/g,
      (_, prefix: string, dots: string) => prefix + dots.replace(/\x08dot/g, "\\dot"))
    .replace(/\x08dot(?![A-Za-z])/g, "\\cdot")
    .replace(/\x08/g, "")
    // In textbook formulas a percent sign is a value, not a TeX line comment.
    .replace(/(\\*)%/g, (all, slashes: string) => slashes.length % 2 ? all : `${slashes}\\%`);
}

/** Recognize only self-contained TeX tokens found in legacy textbook fields. */
function bareMath(text: string): MathSegment[] {
  // Keep incomplete delimiters literal, as with the explicit-math scanner.
  if (text.includes("$") || text.includes("\\(") || text.includes("\\["))
    return [{ type: "text", value: text, raw: text }];
  text = text.replace(/\x08div(?![A-Za-z])/g, "\\div").replace(/\x07/g, "\\times");
  const simpleFractions = /\\+(?:dfrac|tfrac|frac)\s*\{\d+(?:\.\d+)?\}\s*\{\d+(?:\.\d+)?\}/g;
  // Never render only an inner fraction and silently change compound grouping.
  if (/\\+(?:dfrac|tfrac|frac)(?![A-Za-z])/.test(text.replace(simpleFractions, "")))
    return [{ type: "text", value: text, raw: text }];
  const protectedRanges: [number, number][] = [];
  const protectedPattern = /https?:\/\/\S+|[A-Za-z]:\\\S+/g;
  let protectedMatch: RegExpExecArray | null;
  while ((protectedMatch = protectedPattern.exec(text)) !== null)
    protectedRanges.push([protectedMatch.index, protectedMatch.index + protectedMatch[0].length]);
  const pattern = /\\+(?:dfrac|tfrac|frac)\s*\{\d+(?:\.\d+)?\}\s*\{\d+(?:\.\d+)?\}|\d+(?:\.\d+)?\^\s*(?:\{\\+circ\}|\\+circ)(?![A-Za-z])|\\+(?:mathrm|text)\s*\{[^{}\\]*\}|\\+(?:bdiv|div|times|cdot|rightarrow|leftrightarrow|pm)(?![A-Za-z])/g;
  const result: MathSegment[] = [];
  let start = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const index = match.index;
    if (protectedRanges.some(([a, b]) => index >= a && index < b)) continue;
    if (index > start) result.push({ type: "text", value: text.slice(start, index), raw: text.slice(start, index) });
    const value = repairFormula(match[0].replace(/\\+/g, "\\"));
    result.push({ type: "inline", value, raw: "$" + value + "$" });
    start = index + match[0].length;
  }
  if (start < text.length) result.push({ type: "text", value: text.slice(start), raw: text.slice(start) });
  return result;
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
  const result: MathSegment[] = [];
  for (const part of parts) result.push(...(part.type === "text" ? bareMath(part.value) : [part]));
  return result;
}
