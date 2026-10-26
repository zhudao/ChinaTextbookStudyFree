import { mathSegments } from "./mathSegments";
import narrationEntries from "./mathNarrationOverrides.json";

// Explicit descriptions preserve dotted-decimal answer choices and compound grouping.
const narrationOverrides = new Map(narrationEntries.map(entry => [entry.input, entry.spoken]));

/** Keep in sync with scripts/tts/math_speech.py; parity is checked in CI. */
export function mathSpeech(text: string): string {
  // A standalone answer/option is unambiguous; slashes inside prose may be dates.
  text = text.replace(/^\s*(\d+)\s*\/\s*(\d+)\s*$/, "$2分之$1");
  const formula = (value: string, raw: string): string => {
    value = value.replace(/\\(?:left|right)(?![A-Za-z])/g, "")
      .replace(/\\(?:mathrm|text)\s*\{([^{}]*)\}/g, "$1");
    // Preserve compound/nested fractions rather than change their grouping.
    value = value.replace(/(\d+)\s*(?=\\(?:dfrac|tfrac|frac)\s*\{)/g, "$1又")
      .replace(/\\(?:dfrac|tfrac|frac)\s*\{(\d+(?:\.\d+)?)\}\s*\{(\d+(?:\.\d+)?)\}/g, "$2分之$1");
    if (/\\(?:dfrac|tfrac|frac)(?![A-Za-z])/.test(value)) return raw;
    value = value.replace(/(^|[^\d./])(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)(?![\d./])/g, "$1$3分之$2");
    if (value.includes("/")) return raw;
    return value
      .replace(/\\(?:left|right)(?![A-Za-z])/g, "")
      .replace(/\\(?:mathrm|text)\s*\{([^{}]*)\}/g, "$1")
      .replace(/\^(?:\{2\}|2(?![0-9]))/g, "的平方")
      .replace(/\^(?:\{3\}|3(?![0-9]))/g, "的立方")
      .replace(/\\times(?![A-Za-z])|×/g, "乘以")
      .replace(/\\cdot(?![A-Za-z])/g, "乘以")
      .replace(/\\div(?![A-Za-z])|÷/g, "除以")
      .replace(/\\bigcirc(?![A-Za-z])/g, "圆圈")
      .replace(/\\(?:blacksquare|square)(?![A-Za-z])/g, "方框")
      .replace(/\\Box(?![A-Za-z])/g, "方框")
      .replace(/\\triangle(?![A-Za-z])/g, "三角形")
      .replace(/\\Delta(?![A-Za-z])/g, "三角形")
      .replace(/\^\s*(?:\{\\circ\}|\\circ)(?![A-Za-z])/g, "度")
      .replace(/\\angle(?![A-Za-z])/g, "角")
      .replace(/\\(?:Rightarrow|implies)(?![A-Za-z])/g, "所以")
      .replace(/\\dots(?![A-Za-z])/g, "省略号")
      .replace(/\\qquad(?![A-Za-z])/g, " ")
      .replace(/\\pm(?![A-Za-z])/g, "正负")
      .replace(/\\sqrt\s*\{(\d+(?:\.\d+)?)\}/g, "根号$1")
      .replace(/\\_|_{3,}/g, "空格")
      .replace(/\\rightarrow(?![A-Za-z])/g, "变为")
      .replace(/\\leftrightarrow(?![A-Za-z])/g, "双向箭头")
      .replace(/\\approx(?![A-Za-z])/g, "约等于")
      .replace(/\\(?:leq|le)(?![A-Za-z])|≤/g, "小于或等于")
      .replace(/\\(?:geq|ge)(?![A-Za-z])|≥/g, "大于或等于")
      .replace(/\\neq(?![A-Za-z])|≠/g, "不等于")
      .replace(/\\pi(?![A-Za-z])|π/g, "派")
      .replace(/(\d+(?:\.\d+)?)\s*\\?%/g, "百分之$1")
      .replace(/=/g, "等于").replace(/\+/g, "加").replace(/-/g, "减")
      .replace(/</g, "小于").replace(/>/g, "大于");
  };
  const spoken = mathSegments(text).map(part => part.type === "text" ? part.value : formula(part.value, part.raw))
    .join("").trim().replace(/\s+/g, " ");
  return narrationOverrides.get(spoken) ?? spoken;
}
