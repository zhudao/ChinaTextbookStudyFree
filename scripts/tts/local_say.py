#!/usr/bin/env python3
"""Fill missing quiz narration using macOS speech, without an external API.

Example: python3 scripts/tts/local_say.py --pattern '*2026秋版*.json'
Existing content-addressed audio is preserved. Produces Opus plus Web MP3.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
from math_speech import math_speech

ROOT = Path(__file__).resolve().parents[2]


def texts(quiz):
    for section in ("unit_test", "exam"):
        for q in quiz.get(section, {}).get("questions", []):
            yield q["question"]
            yield from (re.sub(r"^[A-Da-d][.、]\s*", "", o) for o in q.get("options", []))
            yield q["explanation"]
    for point in quiz.get("knowledge_summary", []):
        for field in ("point", "core_concept", "key_formula", "tips"):
            yield point.get(field, "")
        yield from point.get("common_mistakes", [])



def render_text(text, voice="Tingting", audio_root=None):
    digest = hashlib.sha1(text.encode()).hexdigest()
    target = (audio_root or ROOT / "apps/web/public/audio") / digest[:2] / digest
    opus, mp3 = target.with_suffix(".opus"), target.with_suffix(".mp3")
    if opus.exists() and mp3.exists():
        return "cached"
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=target.parent) as temp:
        folder = Path(temp)
        if not opus.exists():
            spoken = text.translate(str.maketrans({"×": "乘", "÷": "除以", "=": "等于", "+": "加", "-": "减", "～": "到"})) if re.search(r"[\u4e00-\u9fff]", text) or not re.search(r"[A-Za-z]", text) else text
            (folder / "text.txt").write_text(spoken)
            subprocess.run(["say", "-v", voice, "-r", "175", "-f", str(folder / "text.txt"),
                            "-o", str(folder / "speech.aiff")], check=True, capture_output=True, timeout=60)
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(folder / "speech.aiff"),
                            "-ac", "1", "-ar", "24000", "-c:a", "libopus", "-b:a", "48k",
                            str(folder / "speech.opus")], check=True, capture_output=True, timeout=30)
            (folder / "speech.opus").replace(opus)
        if not mp3.exists():
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(opus), "-ac", "1", "-ar", "24000",
                            "-c:a", "libmp3lame", "-b:a", "64k", str(folder / "speech.mp3")],
                           check=True, capture_output=True, timeout=30)
            (folder / "speech.mp3").replace(mp3)
    return "generated"

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--pattern")
    source.add_argument("--manifest", type=Path)
    parser.add_argument("--voice", default="Tingting")
    parser.add_argument("--voice-en", default="Samantha")
    parser.add_argument("--workers", type=int, default=2)
    args = parser.parse_args()
    if not shutil.which("say") or not shutil.which("ffmpeg"):
        parser.error("Requires macOS say and FFmpeg (libopus/libmp3lame).")
    if args.manifest:
        items = json.loads(args.manifest.read_text())["items"]
        unique = {math_speech(item["text"]): item.get("language", "Chinese") for item in items}
    else:
        unique = {math_speech(text): ("English" if re.search(r"[A-Za-z]", text) and not re.search(r"[\u4e00-\u9fff]", text) else "Chinese")
                  for path in (ROOT / "output").glob(f"*/quizzes/{args.pattern}")
                  for text in texts(json.loads(path.read_text())) if text.strip()}
    if not unique:
        parser.error("No quiz text matched the pattern.")


    generated = cached = 0
    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
        for i, result in enumerate(pool.map(lambda text: render_text(text, args.voice_en if unique[text] == "English" else args.voice), sorted(unique)), 1):
            if result == "cached": cached += 1
            else: generated += 1
            if i % 50 == 0: print(f"{i}/{len(unique)} clips ready", flush=True)
    print(f"Ready: {len(unique)} clips ({generated} generated, {cached} cached).")


if __name__ == "__main__":
    main()
