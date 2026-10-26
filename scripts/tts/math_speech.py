"""Speak explicitly delimited mathematics, preserving prose, dates and URLs."""
import re
import json
from pathlib import Path

_NARRATION_ENTRIES = json.loads((Path(__file__).resolve().parents[2] / "packages/core/src/mathNarrationOverrides.json").read_text(encoding="utf-8"))
_NARRATION_OVERRIDES = {entry["input"]: entry["spoken"] for entry in _NARRATION_ENTRIES}


def repair_formula(value):
    value = re.sub(r"\\+bdiv(?![A-Za-z])", lambda m: r"\div", value)
    value = re.sub(r"(\d+\.\d*)((?:\x08dot\{\d\})+)",
                   lambda m: m[1] + m[2].replace("\x08dot", r"\dot"), value)
    for pattern, replacement in [
        (r"\t(imes|riangle|ext)(?![A-Za-z])", lambda m: "\\t" + m[1]),
        (r"\frac(?![A-Za-z])", lambda m: r"\frac"),
        (r"\right(?![A-Za-z])", lambda m: r"\right"),
        (r"\rightarrow(?![A-Za-z])", lambda m: r"\rightarrow"),
        (r"\neq(?![A-Za-z])", lambda m: r"\neq"),
        (r"\x08div(?![A-Za-z])|\x00", lambda m: r"\div"),
        (r"\x07", lambda m: r"\times"),
        (r"\x08igcirc(?![A-Za-z])", lambda m: r"\bigcirc"),
        (r"\x08lacksquare(?![A-Za-z])", lambda m: r"\blacksquare"),
        (r"\x08dot(?![A-Za-z])", lambda m: r"\cdot"),
        (r"\x08", ""),
    ]:
        value = re.sub(pattern, replacement, value)
    return re.sub(r"(\\*)%", lambda m: m[0] if len(m[1]) % 2 else m[1] + r"\%", value)


def bare_math(text: str):
    if any(token in text for token in ("$", r"\(", r"\[")):
        return [("text", text, text)]
    text = re.sub(r"\x08div(?![A-Za-z])", lambda m: r"\div", text).replace("\x07", r"\times")
    simple_fractions = r"\\+(?:dfrac|tfrac|frac)\s*\{\d+(?:\.\d+)?\}\s*\{\d+(?:\.\d+)?\}"
    if re.search(r"\\+(?:dfrac|tfrac|frac)(?![A-Za-z])", re.sub(simple_fractions, "", text)):
        return [("text", text, text)]
    protected = [(m.start(), m.end()) for m in re.finditer(r"https?://\S+|[A-Za-z]:\\\S+", text)]
    pattern = (r"\\+(?:dfrac|tfrac|frac)\s*\{\d+(?:\.\d+)?\}\s*\{\d+(?:\.\d+)?\}"
               r"|\d+(?:\.\d+)?\^\s*(?:\{\\+circ\}|\\+circ)(?![A-Za-z])"
               r"|\\+(?:mathrm|text)\s*\{[^{}\\]*\}"
               r"|\\+(?:bdiv|div|times|cdot|rightarrow|leftrightarrow|pm)(?![A-Za-z])")
    parts, start = [], 0
    for match in re.finditer(pattern, text):
        if any(a <= match.start() < b for a, b in protected):
            continue
        if match.start() > start:
            value = text[start:match.start()]
            parts.append(("text", value, value))
        value = repair_formula(re.sub(r"\\+", lambda m: "\\", match[0]))
        parts.append(("inline", value, "$" + value + "$"))
        start = match.end()
    if start < len(text):
        parts.append(("text", text[start:], text[start:]))
    return parts


def math_segments(text: str):
    def escaped(index):
        count = 0
        while index > 0 and text[index - 1] == "\\":
            count += 1
            index -= 1
        return count % 2 == 1
    parts = []
    plain_start = i = 0
    while i < len(text):
        opener = next((token for token in ("$$", "$", r"\(", r"\[")
                       if text.startswith(token, i)), None) if not escaped(i) else None
        if opener is None:
            i += 1
            continue
        closer = {r"\(": r"\)", r"\[": r"\]"}.get(opener, opener)
        end = i + len(opener)
        while end < len(text):
            if text.startswith(closer, end) and not escaped(end):
                break
            end += 1
        if end == len(text):
            break
        if i > plain_start:
            parts.append(("text", text[plain_start:i], text[plain_start:i]))
        value = repair_formula(text[i + len(opener):end])
        parts.append(("block" if opener in ("$$", r"\[") else "inline",
                      value, opener + value + closer))
        i = plain_start = end + len(closer)
    if plain_start < len(text):
        parts.append(("text", text[plain_start:], text[plain_start:]))
    return [segment for kind, value, raw in parts
            for segment in (bare_math(value) if kind == "text" else [(kind, value, raw)])]


def math_speech(text: str) -> str:
    text = re.sub(r"^\s*(\d+)\s*/\s*(\d+)\s*$", r"\2分之\1", text)
    def formula(value, raw):
        value = re.sub(r"\\(?:left|right)(?![A-Za-z])", "", value)
        value = re.sub(r"\\(?:mathrm|text)\s*\{([^{}]*)\}", r"\1", value)
        value = re.sub(r"(\d+)\s*(?=\\(?:dfrac|tfrac|frac)\s*\{)", r"\1又", value)
        value = re.sub(r"\\(?:dfrac|tfrac|frac)\s*\{(\d+(?:\.\d+)?)\}\s*\{(\d+(?:\.\d+)?)\}", r"\2分之\1", value)
        if re.search(r"\\(?:dfrac|tfrac|frac)(?![A-Za-z])", value):
            return raw
        value = re.sub(r"(^|[^\d./])(\d+(?:\.\d+)?)\s*/\s*(\d+(?:\.\d+)?)(?![\d./])", r"\1\3分之\2", value)
        if "/" in value:
            return raw
        for pattern, replacement in [
            (r"\\(?:left|right)\b", ""),
            (r"\\(?:mathrm|text)\s*\{([^{}]*)\}", r"\1"),
            (r"\^(?:\{2\}|2(?![0-9]))", "的平方"), (r"\^(?:\{3\}|3(?![0-9]))", "的立方"),
            (r"\\times\b|×", "乘以"), (r"\\div\b|÷", "除以"),
            (r"\\cdot\b", "乘以"), (r"\\(?:bigcirc)\b", "圆圈"),
            (r"\\(?:blacksquare|square)\b", "方框"), (r"\\triangle\b", "三角形"),
            (r"\\Box\b", "方框"), (r"\\Delta\b", "三角形"),
            (r"\^\s*(?:\{\\circ\}|\\circ)(?![A-Za-z])", "度"),
            (r"\\angle\b", "角"), (r"\\(?:Rightarrow|implies)\b", "所以"),
            (r"\\dots\b", "省略号"), (r"\\qquad\b", " "), (r"\\pm\b", "正负"),
            (r"\\sqrt\s*\{(\d+(?:\.\d+)?)\}", r"根号\1"), (r"\\_|_{3,}", "空格"),
            (r"\\rightarrow\b", "变为"), (r"\\leftrightarrow\b", "双向箭头"), (r"\\approx\b", "约等于"),
            (r"\\(?:leq|le)\b|≤", "小于或等于"),
            (r"\\(?:geq|ge)\b|≥", "大于或等于"),
            (r"\\neq\b|≠", "不等于"), (r"\\pi\b|π", "派"),
            (r"(\d+(?:\.\d+)?)\s*\\?%", r"百分之\1"),
            ("=", "等于"), (r"\+", "加"), ("-", "减"),
            ("<", "小于"), (">", "大于"),
        ]:
            value = re.sub(pattern.replace(r"\b", r"(?![A-Za-z])"), replacement, value)
        return value
    text = "".join(value if kind == "text" else formula(value, raw)
                   for kind, value, raw in math_segments(text))
    spoken = re.sub(r"\s+", " ", text.strip())
    return _NARRATION_OVERRIDES.get(spoken, spoken)
