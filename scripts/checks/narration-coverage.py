"""Check every current narration hash and verify receipts for newly generated audio."""
import argparse
import collections
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT / 'scripts/tts'))
from pinyin_speech import pinyin_speech, identity, audio_rel, CONTEXT


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=ROOT / "scripts/tts/manifest.json")
    parser.add_argument("--audio-root", type=Path, default=ROOT / "apps/web/public/audio")
    parser.add_argument("--receipts", type=Path, default=ROOT / "deploy-output/tts-repair")
    parser.add_argument("--report", type=Path, default=ROOT / "deploy-output/narration-coverage-final.json")
    args = parser.parse_args()
    items = json.loads(args.manifest.read_text(encoding="utf-8"))["items"]
    errors, missing = [], []
    active = {item["hash"]: item for item in items}
    if len(active) != len(items):
        errors.append("Duplicate manifest hashes")
    for item in items:
        digest = hashlib.sha1(item["text"].encode("utf-8")).hexdigest()
        expected_rel = f"{digest[:2]}/{digest}.opus"
        if item.get('pronunciation_context') == CONTEXT:
            spoken = pinyin_speech(item['text'])
            if spoken is None or item.get('spoken_text') != spoken or item.get('language') != 'Chinese':
                errors.append(f"Pinyin speech plan mismatch: {item['hash']}")
                continue
            digest = hashlib.sha1(identity(item['text'],spoken).encode()).hexdigest()
            expected_rel = audio_rel(item['text'],spoken)
        if digest != item["hash"] or item["audio_rel"] != expected_rel:
            errors.append(f"Hash/path mismatch: {item['hash']}")
            continue
        if re.search(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", item["text"]):
            errors.append(f"Control character in narration: {digest}")
        path = args.audio_root / item["audio_rel"]
        if not path.is_file() or not path.stat().st_size:
            missing.append(item)
            continue
        with path.open("rb") as audio:
            header = audio.read(4)
        if not (header == b"OggS" or header.startswith(b"ID3") or (len(header) >= 2 and header[0] == 255 and header[1] & 224 == 224)):
            errors.append(f"Unrecognized source audio: {digest}")
    generated = {}
    for file in sorted(args.receipts.glob("receipts-*.jsonl")):
        for line in file.read_text(encoding="utf-8").splitlines():
            record = json.loads(line)
            if record["status"] == "generated":
                generated[record["hash"]] = record
    verified = 0
    for digest, receipt in generated.items():
        if digest not in active:
            continue
        path = args.audio_root / active[digest]["audio_rel"]
        if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != receipt["opus_sha256"]:
            errors.append(f"Generated audio differs from receipt: {digest}")
        else:
            verified += 1
    report = {"status": "failed" if errors or missing else "passed", "total": len(items),
              "present": len(items) - len(missing), "missing": len(missing),
              "missing_by_subject": dict(collections.Counter(item["subject"] for item in missing)),
              "missing_items": [{"hash": item["hash"], "text": item["text"], "field": item["field"]} for item in missing],
              "generated_active_verified": verified, "generated_obsolete": len(set(generated) - set(active)), "errors": errors}
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: value for key, value in report.items() if key != "missing_items"}, ensure_ascii=False))
    return report["status"] != "passed"


if __name__ == "__main__":
    raise SystemExit(main())
