#!/usr/bin/env python3
"""Package the verified five-book overlay for the existing resource installer."""
import argparse
from datetime import datetime, timezone
import importlib.util
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("packager", ROOT/"scripts/package-release.py")
packager = importlib.util.module_from_spec(spec)
spec.loader.exec_module(packager)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--site", type=Path, default=ROOT/"apps/web/out")
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--baseline", type=Path, required=True)
    parser.add_argument("--tag", default="v1.5.0-five-textbooks")
    args = parser.parse_args()
    if not re.fullmatch(r"[a-zA-Z0-9._-]+", args.tag):
        parser.error("Invalid tag")
    books = json.loads((ROOT/"content/editions/2026/catalog.json").read_text())["books"]
    ids = {b["id"] for b in books}
    legacy = {b["legacyId"] for b in books}
    baseline = json.loads(args.baseline.read_text())
    required = {"data/books/"+name: sha for name, sha in baseline.items()}
    if not legacy.issubset({name.split("/", 1)[0] for name in baseline}):
        raise ValueError("Missing verified legacy-content baseline")
    entries = []
    urls = set()
    for book_id in sorted(ids):
        folder = args.site/"data/books"/book_id
        if not folder.is_dir():
            raise ValueError(f"Missing built textbook: {book_id}")
        for file in packager.files(folder):
            entries.append((file, file.relative_to(args.site/"data").as_posix()))
            if file.suffix == ".json":
                urls.update(re.findall(r'"(/audio/[^"?]+)', file.read_text()))
    manifest = {"schema_version":2, "tag":args.tag, "created_at":datetime.now(timezone.utc).isoformat(),
                "source_commit":subprocess.check_output(["git","rev-parse","HEAD"],cwd=ROOT,text=True).strip(),
                "source_dirty":bool(subprocess.check_output(["git","status","--porcelain"],cwd=ROOT,text=True).strip()),
                "overlay":True, "installation_modes":["source"], "books":sorted(ids), "content":packager.content_statistics(args.site),
                "requires_content":{"description":"Existing v1.4.3-compatible legacy textbooks; original grades and content are retained.",
                                    "json_without_audio_sha256":required}, "assets":[]}
    args.out.mkdir(parents=True, exist_ok=False)
    with (args.out/"files.jsonl").open("w") as inventory:
        def pack(name, files, kind, destinations, stored=False):
            files=sorted(set(files),key=lambda x:x[1])
            if not files:
                raise ValueError(f"Empty package: {name}")
            size=packager.write_zip(args.out/name, files, inventory, stored)
            manifest["assets"].append({"name":name,"kind":kind,"destinations":destinations,
                "bytes":(args.out/name).stat().st_size,"sha256":packager.digest(args.out/name),"files":len(files),"uncompressed_bytes":size})
        for extension, kind in [(".mp3","audio-web"),(".opus","audio-original")]:
            audio=[]
            for url in sorted(urls):
                file=ROOT/"apps/web/public"/url.lstrip("/")
                if extension == ".opus":
                    # Web fixes can use hash.edge-version.mp3 aliases; original
                    # immutable inputs retain the canonical hash.opus name.
                    stem = file.name.split(".", 1)[0]
                    if not re.fullmatch(r"[a-f0-9]{40}", stem):
                        raise ValueError(f"Invalid audio hash: {url}")
                    file = file.with_name(stem + extension)
                if not file.is_file():
                    raise ValueError(f"Missing source audio: {file}")
                audio.append((file,"audio/"+file.relative_to(ROOT/"apps/web/public/audio").as_posix()))
            pack(kind+".zip",audio,kind,{"source":"apps/web/public"},True)
        entries.append((args.site/"data/index.json","index.json"))
        pack("data.zip",entries,"data",{"source":"apps/web/public/data"})
        source=[];pages=[];curriculum=[]
        for b in books:
            if b["readings"]:
                p=ROOT/"data/passages"/b["subject"]/f"{b['id']}.json"
                source.append((p,p.relative_to(ROOT/"data").as_posix()))
                pages.extend((p,p.relative_to(ROOT/"apps/web/public/textbook-pages").as_posix()) for p in packager.files(ROOT/"apps/web/public/textbook-pages"/b["id"]))
            for kind in ("outlines","quizzes"):
                curriculum.extend((p,p.relative_to(ROOT).as_posix()) for p in (ROOT/"output"/b["subject"]/kind).glob(b["stem"]+"*.json"))
        curriculum.extend((p,p.relative_to(ROOT).as_posix()) for p in (ROOT/"content/editions/2026").glob("*.json"))
        pack("data-source.zip",source,"source-data",{"source":"data"})
        pack("textbook-pages.zip",pages,"textbook-pages",{"source":"apps/web/public/textbook-pages"},True)
        pack("curriculum-source.zip",curriculum,"curriculum-source",{"source":"."})
    inventory=args.out/"files.jsonl"
    manifest["file_inventory"]={"name":inventory.name,"bytes":inventory.stat().st_size,"sha256":packager.digest(inventory)}
    (args.out/"manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n")
    (args.out/"SHA256SUMS").write_text("".join(f"{packager.digest(p)}  {p.name}\n" for p in sorted(args.out.iterdir()) if p.is_file()))
    print(json.dumps({"tag":args.tag,"books":len(ids),"assets":len(manifest["assets"]),"bytes":sum(x["bytes"] for x in manifest["assets"])}))

if __name__=="__main__":
    main()
