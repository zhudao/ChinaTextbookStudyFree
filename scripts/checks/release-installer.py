"""Small offline fixtures for legacy/new releases and all-or-nothing preflight."""
import hashlib
import io
import json
import subprocess
import sys
import tarfile
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
with tempfile.TemporaryDirectory() as directory:
    root = Path(directory)
    cache = root / "archives"
    cache.mkdir()
    payloads = {
        "audio.tar.gz": ("audio/aa/test.opus", b"original audio"),
        "audio-web-mp3.tar.gz": ("audio/aa/test.mp3", b"mp3 fixture"),
        "data.zip": ("index.json", b"{}"),
        "data-source.zip": ("stories/test.json", b"{}"),
        "story-images.zip": ("test.jpg", b"image fixture"),
        "textbook-pages.zip": ("test.jpg", b"page fixture"),
    }
    assets = []
    for name, (entry, content) in payloads.items():
        archive_path = cache / name
        if name.endswith(".zip"):
            with zipfile.ZipFile(archive_path, "w") as archive:
                archive.writestr(entry, content)
        else:
            with tarfile.open(archive_path, "w:gz") as archive:
                info = tarfile.TarInfo(entry)
                info.size = len(content)
                archive.addfile(info, io.BytesIO(content))
        raw = archive_path.read_bytes()
        assets.append(dict(name=name, bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest(),
                           files=1, uncompressed_bytes=len(content)))
    manifest = dict(schema_version=1, tag="fixture", assets=assets)
    (cache / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    target = root / "installed"
    command = [sys.executable, str(ROOT / "scripts/install-release.py"), "--tag", "fixture",
               "--archives-dir", str(cache), "--root", str(target)]
    def run(args, code=0):
        result = subprocess.run(args, capture_output=True, text=True, encoding="utf-8")
        assert result.returncode == code, result.stdout + result.stderr
    run(command)
    mp3 = target / "apps/web/public/audio/aa/test.mp3"
    assert mp3.read_bytes() == b"mp3 fixture"
    run([sys.executable, str(ROOT / "scripts/checks/release-assets.py"), "--archives-dir", str(cache),
         "--root", str(target), "--report", str(root / "report.json")])
    mp3.write_bytes(b"existing local output")
    (cache / "audio-web-mp3.tar.gz").write_bytes(b"corrupt package")
    run(command, 1)
    assert mp3.read_bytes() == b"existing local output", "Failed preflight must not install partial packages"
    manifest["assets"] = [entry for entry in assets if entry["name"] != "audio-web-mp3.tar.gz"]
    (cache / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    run(command)
    assert mp3.read_bytes() == b"existing local output", "Legacy releases must not remove optional existing media"
    legacy = target / "apps/web/public/data/books/legacy/lesson.json"
    legacy.parent.mkdir(parents=True)
    legacy.write_text(json.dumps({"id": "legacy-u1-l1", "answer": "3", "audio": "/old.opus"}))
    canonical = json.dumps({"id": "legacy-u1-l1", "answer": "3"}, ensure_ascii=False, sort_keys=True)
    manifest["requires_content"] = {"json_without_audio_sha256": {
        "data/books/legacy/lesson.json": hashlib.sha256(canonical.encode()).hexdigest()}}
    (cache / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    empty = root / "empty-overlay-target"
    run(command[:-1] + [str(empty)], 1)
    assert not empty.exists(), "A missing overlay base must fail before any writes"
    legacy.write_text(json.dumps({"id": "legacy-u1-l1", "answer": "4"}))
    run(command, 1)
    assert mp3.read_bytes() == b"existing local output", "A changed overlay base must fail before any writes"
    legacy.write_text(json.dumps({"id": "legacy-u1-l1", "answer": "3", "audio": "/new.mp3", "generatedAt": "today"}))
    run(command)
    assert json.loads(legacy.read_text())["audio"] == "/new.mp3", "Audio versions must not change legacy content identity"
print("PASS: complete/legacy resource install, byte-level audit and corrupt-package preflight")
print("PASS: overlay rejects absent/changed base before writes and accepts audio-only changes")
