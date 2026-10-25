#!/usr/bin/env python3
"""Validate reviewed 2026 content before adding isolated textbook resources.

The stage contains editorial candidates, not production data. This command
requires the complete catalog, checks official page fingerprints and never writes
legacy source paths. Reviewed passage sources and page images stay in the normal
ignored resource directories and ship in the resource package.
"""
from __future__ import annotations
import argparse
from collections import Counter
import copy
import hashlib
import json
from pathlib import Path
import re
import shutil
import urllib.request

ROOT = Path(__file__).resolve().parents[2]

def read(path):
    return json.loads(path.read_text(encoding="utf8"))

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    temporary.replace(path)

def question(row, number, points):
    q = copy.deepcopy(row)
    q.pop("source_ref", None)
    q.update(id=number, score=10)
    if q["knowledge_point"] not in points or not q["question"] or not q["explanation"]:
        raise ValueError("Question has missing or unexpected curriculum content")
    if q["type"] == "choice":
        if len(q["options"]) != 4 or len(set(q["options"])) != 4 or q["answer"] not in q["options"]:
            raise ValueError("Invalid choice")
        # Editorial drafts overuse the first answer. Keep wording/answers intact
        # while giving each question a reproducible, unbiased option ordering.
        q["options"].sort(key=lambda option: hashlib.sha256((q["question"] + "\0" + option).encode()).digest())
    elif q["type"] == "true_false":
        if q["options"] or q["answer"] not in ("对", "错"):
            raise ValueError("Invalid true/false")
    elif q["type"] == "calculation":
        if q["options"] or not re.fullmatch(r"-?\d+(?:[./]\d+)?", q["answer"]):
            raise ValueError("Invalid numeric input")
    else:
        raise ValueError("Unsupported revised question type")
    return q

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--stage", type=Path, default=ROOT/"deploy-output/five-textbooks")
    parser.add_argument("--page-cache", type=Path, required=True)
    args = parser.parse_args()
    catalog = read(ROOT/"content/editions/2026/catalog.json")
    evidence = read(ROOT/catalog["sourceReview"])
    pages = {(p["book"], p["physical_page"]): p for p in evidence["page_evidence"]}
    pending = []
    sources = []
    resources = []
    stats = Counter()
    for book in catalog["books"]:
        book_id = book["id"]
        if book_id != book["legacyId"] + "-2026" or "2026秋版" not in book["stem"]:
            raise ValueError("Refusing a legacy book or source path")
        subject = book["subject"]
        outline = {"textbook": book["sourceTitle"] + "（2026秋版）", "edition": "2026",
                   "editionLabel": book["editionLabel"], "supersedes": book["legacyId"], "units": []}
        for unit in book["units"]:
            stage = args.stage/"units"/f"{book_id}-u{unit['unit_number']}.json"
            candidate = read(stage)
            if candidate["bookId"] != book_id or candidate["unitNumber"] != unit["unit_number"] or not candidate["editorialReview"]["approved"]:
                raise ValueError(f"Unreviewed or mismatched unit: {stage}")
            content = candidate["unit"]
            if [k["point"] for k in content["knowledge_summary"]] != unit["points"]:
                raise ValueError(f"Knowledge list mismatch: {stage}")
            if Counter(q["knowledge_point"] for q in content["questions"]) != Counter({point: 6 for point in unit["points"]}) or len(content["exam"]) != 6:
                raise ValueError(f"Incomplete unit: {stage}")
            if len({q["question"] for q in content["questions"] + content["exam"]}) != len(content["questions"]) + 6:
                raise ValueError(f"Duplicate question: {stage}")
            for k in content["knowledge_summary"]:
                if not k["core_concept"] or not k["tips"] or not k["common_mistakes"]:
                    raise ValueError(f"Incomplete knowledge: {stage}")
            n = unit["unit_number"]
            questions = [question(q, n*10000+i, unit["points"]) for i, q in enumerate(content["questions"], 1)]
            exam = [question(q, n*10000+9000+i, unit["points"]) for i, q in enumerate(content["exam"], 1)]
            quiz = {"textbook": outline["textbook"], "unit": unit["title"], "unit_number": n,
                    "unit_test": {"title": unit["title"] + "·配套练习", "total_score": len(questions)*10, "time_minutes": max(10, len(questions)), "questions": questions},
                    "exam": {"title": unit["title"] + "·单元挑战", "total_score": 60, "time_minutes": 15, "questions": exam},
                    "knowledge_summary": content["knowledge_summary"]}
            pending.append((ROOT/"output"/subject/"quizzes"/f"{book['stem']}_unit{n}.json", quiz))
            outline["units"].append({"unit_number": n, "title": unit["title"], **({"label": unit["label"]} if unit.get("label") else {}),
                                    "knowledge_points": [{"name": p, "description": "结合新版教材学习"+p, "difficulty": 1,
                                                          "question_types": ["choice", "true_false"]} for p in unit["points"]]})
            sources.append({"bookId": book_id, "unit": n, "sourcePrintedPages": candidate["sourcePages"],
                            "candidate_sha256": digest(stage), "editorialReview": candidate["editorialReview"]})
            stats["regular_questions"] += len(questions)
            stats["exam_questions"] += len(exam)
            stats["lessons"] += len(unit["points"])
        passages = []
        mapping = []
        for i, expected in enumerate(book["readings"], 1):
            stage = args.stage/"readings"/f"{book_id}-p{i}.json"
            p = read(stage)
            if p.get("imageAudit", {}).get("status") != "verified":
                raise ValueError(f"Reading has not passed final image comparison: {stage}")
            if p["id"] != f"{book_id}-p{i}" or p["bookId"] != book_id or p["title"] != expected["title"] or p["curriculumRole"] != expected["role"] or not p["sentences"]:
                raise ValueError(f"Reading identity mismatch: {stage}")
            expected_pages = list(range(expected["start"]+book["pageOffset"], expected["end"]+book["pageOffset"]+1))
            if p["sourcePages"] != expected_pages:
                raise ValueError(f"Reading page mismatch: {stage}")
            for n in expected_pages:
                cached = args.page_cache/f"{book['key']}-{n}.jpg"
                if not cached.exists():
                    cached.parent.mkdir(parents=True, exist_ok=True)
                    with urllib.request.urlopen(pages[(book["key"], n)]["url"], timeout=30) as response:
                        cached.write_bytes(response.read())
                if digest(cached) != pages[(book["key"], n)]["sha256"]:
                    raise ValueError(f"Official page changed: {cached}")
                target = ROOT/"apps/web/public/textbook-pages"/book_id/f"p{n}.jpg"
                resources.append((cached, target))
            passages.append({k: p[k] for k in ("id", "unitNumber", "lessonNumber", "title", "kind", "author", "language", "sentences", "page_hint", "curriculumRole")})
            passages[-1]["lessonNumber"] = expected["lesson"]
            mapping.append({"passage_id": p["id"], "page_hint": expected["start"], "pdf_page": expected_pages[0], "pages": expected_pages})
            sources.append({"bookId": book_id, "readingId": p["id"], "sourcePages": p["source"],
                            "candidate_sha256": digest(stage), "editorialReview": p["editorialReview"], "imageAudit": p["imageAudit"]})
        if passages:
            outline["requiredPassageTitles"] = [p["title"] for p in passages]
            pending.append((ROOT/"data/passages"/subject/f"{book_id}.json", {"bookId": book_id, "subject": subject, "textbook": outline["textbook"], "grade": book["grade"], "passages": passages}))
            pending.append((ROOT/"apps/web/public/textbook-pages"/book_id/"pages.json", {"bookId": book_id, "offset": book["pageOffset"], "passages": mapping}))
        pending.append((ROOT/"output"/subject/"outlines"/f"{book['stem']}.json", outline))
        stats["readings"] += len(passages)
    # All candidates and source pages are validated before any production write.
    for cached, target in resources:
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(cached, target)
    for target, data in pending:
        write(target, data)
    source_manifest = {"schemaVersion": 1, "sourceReview": catalog["sourceReview"], "stats": dict(stats), "editorialSignoff": "model_screen_only_not_teacher_signoff", "sources": sources,
                       "resourceFiles": [{"path": str(p.relative_to(ROOT)), "sha256": digest(p)} for p, _ in pending if str(p.relative_to(ROOT)).startswith(("data/", "apps/web/public/"))]}
    write(ROOT/"content/editions/2026/resource-manifest.json", source_manifest)
    print(json.dumps(dict(stats), ensure_ascii=False))

if __name__ == "__main__":
    main()
