"""Explicit, isolated textbook sources. Never infer an edition from a curriculum."""
import copy
import hashlib
import json
import re
from pathlib import Path


def pdf_digest(path: Path) -> str:
    hasher = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def load_edition(path: Path, subject: str, defaults: dict) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError("Edition manifest must be an object")
    if data.get("subject") != subject:
        raise ValueError("Edition subject does not match --subject")
    edition = data.get("id", "")
    if not isinstance(edition, str) or not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", edition) or edition == "legacy":
        raise ValueError("Edition id must be a non-legacy lowercase slug")
    if data.get("school_system") not in ("6-3", "5-4"):
        raise ValueError("school_system must be 6-3 or 5-4")
    for key in ("label", "source", "pdf_dir"):
        if not isinstance(data.get(key), str) or not data[key].strip():
            raise ValueError(f"Missing edition {key}")
    books = data.get("textbooks")
    if (not isinstance(books, list) or not books
            or any(not isinstance(book, str) for book in books)
            or len({book.casefold() for book in books}) != len(books)):
        raise ValueError("textbooks must be a nonempty unique list")
    pdf_dir = (path.parent / data["pdf_dir"]).resolve()
    fingerprints = {}
    for name in books:
        if not isinstance(name, str) or Path(name).name != name or "/" in name or "\\" in name or not name.endswith(".pdf"):
            raise ValueError("Each textbook must be a PDF basename")
        pdf = (pdf_dir / name).resolve()
        if not pdf.is_relative_to(pdf_dir) or not pdf.is_file():
            raise ValueError(f"Missing local PDF: {name}")
        with pdf.open("rb") as stream:
            if stream.read(5) != b"%PDF-":
                raise ValueError(f"Invalid PDF: {name}")
        fingerprints[name] = pdf_digest(pdf)
    # Pin actual content, not only names or a cache copy that may be removed.
    data["pdf_sha256"] = fingerprints
    cfg = copy.deepcopy(defaults)
    cfg.update(textbooks=books, publisher_label=data["label"], edition=data,
               local_pdf_dir=str(pdf_dir))
    return cfg


def record_edition(directory: Path, edition: dict) -> None:
    metadata = directory / "edition.json"
    if metadata.exists() and json.loads(metadata.read_text(encoding="utf-8")) != edition:
        raise ValueError("Edition metadata or PDF changed: choose a new edition id")
    directory.mkdir(parents=True, exist_ok=True)
    if not metadata.exists():
        # Exclusive creation prevents silently replacing another import's metadata.
        with metadata.open("x", encoding="utf-8") as stream:
            json.dump(edition, stream, ensure_ascii=False, indent=2)
