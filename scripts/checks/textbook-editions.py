import json
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "quiz"))
from editions import load_edition, record_edition
from subjects import CHINESE

with tempfile.TemporaryDirectory() as directory:
    root = Path(directory)
    (root / "book.pdf").write_bytes(b"%PDF-1.7\n")
    manifest = root / "edition.json"
    data = dict(id="revised-2022", subject="chinese", school_system="6-3",
                label="Revised", source="official local download", pdf_dir=".", textbooks=["book.pdf"])
    def load():
        manifest.write_text(json.dumps(data), encoding="utf-8")
        return load_edition(manifest, "chinese", CHINESE)
    result = load()
    assert result["edition"]["id"] == "revised-2022"
    assert "edition" not in CHINESE
    output = root / "output"
    record_edition(output, result["edition"])
    # Formatting/key order do not indicate a new edition.
    metadata = output / "edition.json"
    metadata.write_text(json.dumps(result["edition"], sort_keys=True), encoding="utf-8")
    record_edition(output, load()["edition"])
    original_metadata = metadata.read_bytes()
    (root / "book.pdf").write_bytes(b"%PDF-1.7\nchanged contents")
    try:
        record_edition(output, load()["edition"])
    except ValueError:
        pass
    else:
        raise AssertionError("Changed source must not reuse cached outlines")
    assert metadata.read_bytes() == original_metadata
    (root / "book.pdf").write_bytes(b"%PDF-1.7\n")
    data["school_system"] = "5-4"
    assert load()["edition"]["school_system"] == "5-4"
    for field, invalid in [("id", "../escape"), ("id", None), ("subject", "math"),
                           ("textbooks", ["../book.pdf"]), ("textbooks", ["missing.pdf"]),
                           ("textbooks", ["book.pdf", "BOOK.pdf"]),
                           ("school_system", "unknown")]:
        old = data[field]
        data[field] = invalid
        try:
            load()
        except ValueError:
            pass
        else:
            raise AssertionError(field)
        data[field] = old
print("PASS: edition isolation, school systems, local sources and invalid manifests")
