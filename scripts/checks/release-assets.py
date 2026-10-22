"""Verify downloaded packages and byte-for-byte installed resources before build.

Run before build-data regenerates data/ or web_audio regenerates MP3 siblings.
"""
import argparse
import hashlib
import importlib.util
import json
import tarfile
import zipfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("installer", ROOT / "scripts/install-release.py")
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)


def stream_hash(stream):
    result = hashlib.sha256()
    for chunk in iter(lambda: stream.read(1024 * 1024), b""):
        result.update(chunk)
    return result.hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archives-dir", required=True, type=Path)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--report", type=Path, default=ROOT / "deploy-output/release-integrity.json")
    parser.add_argument("--mode", choices=["source", "static"], default="source")
    parser.add_argument("--with-source", action="store_true")
    args = parser.parse_args()
    manifest = json.loads((args.archives_dir / "manifest.json").read_text(encoding="utf-8"))
    assets = {item["name"]: item for item in manifest["assets"]}
    destinations = {asset['name']: destination for asset, destination in
                    installer.install_plan(manifest, args.mode, args.with_source)}
    report = {"tag": manifest["tag"], "status": "passed", "packages": [], "errors": []}
    for name, relative in destinations.items():
        source = args.archives_dir / name
        expected = assets[name]
        summary = {"name": name, "bytes": source.stat().st_size, "sha256": installer.sha256(source),
                   "files": 0, "uncompressed_bytes": 0, "installed_matches": 0}
        if summary["bytes"] != expected["bytes"] or summary["sha256"] != expected["sha256"]:
            report["errors"].append(f"Archive size/hash mismatch: {name}")
            report["packages"].append(summary)
            continue
        print(f"Verified archive: {name}", flush=True)
        pool = ThreadPoolExecutor(max_workers=16)
        pending = []
        def compare(entry_name, size, expected_hash):
            target = installer.target_path(args.root / relative, entry_name)
            return entry_name, target.is_file() and target.stat().st_size == size and installer.sha256(target) == expected_hash
        def drain():
            for future in pending:
                entry_name, matches = future.result()
                if matches:
                    summary["installed_matches"] += 1
                else:
                    report["errors"].append(f"Installed resource mismatch: {entry_name}")
            pending.clear()
        def check(entry_name, size, stream):
            summary["files"] += 1
            summary["uncompressed_bytes"] += size
            with stream:
                expected_hash = stream_hash(stream)
            pending.append(pool.submit(compare, entry_name, size, expected_hash))
            if len(pending) == 256:
                drain()
            if summary["files"] % 10000 == 0:
                print(f"  {name}: {summary['files']} files checked", flush=True)
        if source.suffix == ".zip":
            with zipfile.ZipFile(source) as archive:
                for entry in archive.infolist():
                    if not entry.is_dir():
                        check(entry.filename, entry.file_size, archive.open(entry))
        else:
            # Sequential mode avoids gzip back-seeks while inspecting each file.
            with tarfile.open(source, "r|gz") as archive:
                for entry in archive:
                    if not entry.isfile():
                        raise ValueError(f"Unexpected non-file in {name}: {entry.name}")
                    check(entry.name, entry.size, archive.extractfile(entry))
        drain()
        pool.shutdown(wait=True)
        for field in ("files", "uncompressed_bytes"):
            if summary[field] != expected[field]:
                report["errors"].append(f"{name}: {field} differs from manifest")
        report["packages"].append(summary)
        print(f"Checked installation: {name}, {summary['installed_matches']}/{summary['files']} files", flush=True)
    if report["errors"]:
        report["status"] = "failed"
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{report['status']}: {len(report['errors'])} errors; {args.report}")
    return 0 if report["status"] == "passed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
