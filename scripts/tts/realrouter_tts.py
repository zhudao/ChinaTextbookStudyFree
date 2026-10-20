"""Fill missing narration through a local RealRouter API, with resumable receipts."""
import argparse
import hashlib
import io
import json
import os
import re
import subprocess
import tempfile
import time
import wave
from array import array
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[2]


def validate_wav(data):
    with wave.open(io.BytesIO(data)) as audio:
        if audio.getsampwidth() != 2 or audio.getnchannels() != 1 or audio.getframerate() != 24000:
            raise ValueError("Expected mono PCM16 24 kHz WAV")
        frames = audio.readframes(audio.getnframes())
        duration = audio.getnframes() / audio.getframerate()
    samples = array("h", frames)
    if duration < 0.1 or not samples or max(abs(value) for value in samples) < 100:
        raise ValueError("Empty or silent speech")
    return duration


def validate_item(item):
    digest = hashlib.sha1(item["text"].encode("utf-8")).hexdigest()
    if item["hash"] != digest or item["audio_rel"] != f"{digest[:2]}/{digest}.opus":
        raise ValueError("Manifest text hash/path mismatch")
    if len(item["text"]) > 1000:
        raise ValueError("Text exceeds RealRouter's input limit")


def synthesize(item, args, key):
    validate_item(item)
    if getattr(args, "stop_file", None) and args.stop_file.exists():
        return {"hash": item["hash"], "status": "deferred"}
    if item.get("subject") == "math" and re.search(r"\\[A-Za-z]+", item["text"]):
        return {"hash": item["hash"], "status": "failed", "errors": ["Unresolved math notation; repair narration before synthesis"]}
    target = args.audio_root / item["audio_rel"]
    if target.is_file() and target.stat().st_size:
        return {"hash": item["hash"], "status": "existing"}
    started = time.monotonic()
    errors = []
    for attempt in range(1, args.attempts + 1):
        voice = args.voices[(attempt - 1) % len(args.voices)]
        try:
            response = requests.post(args.base_url.rstrip("/") + "/audio/speech",
                headers={"Authorization": "Bearer " + key},
                json={"model": "codex-realtime", "voice": voice, "input": item["text"], "response_format": "wav"},
                timeout=(10, 115))
            if response.status_code != 200:
                raise ValueError(f"Speech HTTP {response.status_code}")
            source = response.content
            source_duration = validate_wav(source)
            target.parent.mkdir(parents=True, exist_ok=True)
            with tempfile.TemporaryDirectory(prefix="tts-", dir=target.parent) as directory:
                wav_path, opus_path = Path(directory) / "source.wav", Path(directory) / "speech.opus"
                wav_path.write_bytes(source)
                # Remove waiting silence only; preserve pauses inside the narration.
                subprocess.run(["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
                    "-i", str(wav_path), "-af", "silenceremove=start_periods=1:start_duration=0.02:start_threshold=-60dB:start_silence=0.15",
                    "-c:a", "libopus", "-b:a", "48k", str(opus_path)], check=True, capture_output=True, timeout=60)
                subprocess.run(["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-xerror",
                    "-i", str(opus_path), "-f", "null", "-"], check=True, capture_output=True, timeout=60)
                payload = opus_path.read_bytes()
                if not payload.startswith(b"OggS") or len(payload) < 100:
                    raise ValueError("Invalid Opus output")
                os.replace(opus_path, target)
            return {"hash": item["hash"], "status": "generated", "voice": voice, "attempt": attempt,
                    "source_wav_sha256": hashlib.sha256(source).hexdigest(), "source_duration": source_duration,
                    "opus_sha256": hashlib.sha256(payload).hexdigest(), "opus_bytes": len(payload),
                    "seconds": round(time.monotonic() - started, 2), "previous_errors": errors}
        except (requests.RequestException, ValueError, OSError, EOFError, wave.Error, subprocess.SubprocessError) as error:
            # Never log request headers, keys, or a proxy's potentially sensitive error body.
            errors.append(type(error).__name__ + ": " + str(error).replace(key, "[redacted]")[:300])
            if attempt < args.attempts:
                time.sleep(min(2 ** attempt, 8))
    return {"hash": item["hash"], "status": "failed", "errors": errors}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=ROOT / "scripts/tts/manifest.json")
    parser.add_argument("--audio-root", type=Path, default=ROOT / "apps/web/public/audio")
    parser.add_argument("--base-url", default="http://127.0.0.1:8787/v1")
    parser.add_argument("--key-file", required=True, type=Path)
    parser.add_argument("--workers", type=int, default=16)
    parser.add_argument("--attempts", type=int, default=3)
    parser.add_argument("--voices", nargs="+", default=["cove", "maple", "arbor"])
    parser.add_argument("--limit", type=int)
    parser.add_argument("--report-dir", type=Path, default=ROOT / "deploy-output/tts-repair")
    parser.add_argument("--stop-file", type=Path, help="Creating this file stops new requests after active workers finish")
    args = parser.parse_args()
    if not 1 <= args.workers <= 16 or args.attempts < 1:
        parser.error("Use 1–16 workers and at least one attempt")
    items = json.loads(args.manifest.read_text(encoding="utf-8"))["items"]
    for item in items:
        validate_item(item)
    pending = [item for item in items if not (args.audio_root / item["audio_rel"]).is_file()
               or not (args.audio_root / item["audio_rel"]).stat().st_size]
    if args.limit is not None:
        pending = pending[:args.limit]
    args.report_dir.mkdir(parents=True, exist_ok=True)
    key = args.key_file.read_text(encoding="utf-8").strip()
    if not key:
        raise ValueError("Empty API key file")
    run_id = time.strftime("%Y%m%d-%H%M%S")
    (args.report_dir / f"plan-{run_id}.json").write_text(json.dumps(pending, ensure_ascii=False, indent=2), encoding="utf-8")
    counts = {"generated": 0, "failed": 0, "existing": 0, "deferred": 0}
    print(f"Missing selected: {len(pending)}; workers: {args.workers}", flush=True)
    with (args.report_dir / f"receipts-{run_id}.jsonl").open("w", encoding="utf-8") as receipts:
        with ThreadPoolExecutor(max_workers=args.workers) as pool:
            futures = [pool.submit(synthesize, item, args, key) for item in pending]
            for completed, future in enumerate(as_completed(futures), 1):
                result = future.result()
                counts[result["status"]] += 1
                receipts.write(json.dumps(result, ensure_ascii=False) + "\n")
                receipts.flush()
                if completed % 16 == 0 or result["status"] == "failed" or completed == len(pending):
                    print(f"{completed}/{len(pending)} {counts}", flush=True)
    remaining = sum(not (args.audio_root / item["audio_rel"]).is_file() or not (args.audio_root / item["audio_rel"]).stat().st_size for item in items)
    summary = {"run": run_id, "workers": args.workers, "selected": len(pending), **counts, "remaining": remaining}
    (args.report_dir / f"summary-{run_id}.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary), flush=True)
    return bool(counts["failed"] or counts["deferred"])


if __name__ == "__main__":
    raise SystemExit(main())
