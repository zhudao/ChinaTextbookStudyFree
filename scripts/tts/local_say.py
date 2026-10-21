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


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pattern", required=True)
    parser.add_argument("--voice", default="Tingting")
    parser.add_argument("--workers", type=int, default=2)
    args = parser.parse_args()
    if not shutil.which("say") or not shutil.which("ffmpeg"):
        parser.error("Requires macOS say and FFmpeg (libopus/libmp3lame).")
    unique = {math_speech(text)
              for path in (ROOT / "output").glob(f"*/quizzes/{args.pattern}")
              for text in texts(json.loads(path.read_text())) if text.strip()}
    if not unique:
        parser.error("No quiz text matched the pattern.")

    def render(text):
        digest = hashlib.sha1(text.encode()).hexdigest()
        target = ROOT / "apps/web/public/audio" / digest[:2] / digest
        opus, mp3 = target.with_suffix(".opus"), target.with_suffix(".mp3")
        if opus.exists() and mp3.exists():
            return "cached"
        target.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=target.parent) as temp:
            folder = Path(temp)
            if not opus.exists():
                spoken = text.translate(str.maketrans({"×": "乘", "÷": "除以", "=": "等于", "+": "加", "-": "减", "～": "到"}))
                (folder / "text.txt").write_text(spoken)
                subprocess.run(["say", "-v", args.voice, "-r", "175", "-f", str(folder / "text.txt"),
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

    generated = cached = 0
    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
        for i, result in enumerate(pool.map(render, sorted(unique)), 1):
            if result == "cached": cached += 1
            else: generated += 1
            if i % 50 == 0: print(f"{i}/{len(unique)} clips ready", flush=True)
    print(f"Ready: {len(unique)} clips ({generated} generated, {cached} cached).")


if __name__ == "__main__":
    main()
