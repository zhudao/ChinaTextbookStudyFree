"""Exercise the real CLI and failure paths without contacting a model API.

Requires the normal pipeline dependencies (openai and requests).
"""
import contextlib
import io
import json
import sys
import tempfile
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "quiz"))
import pipeline as pipeline
from editions import load_edition, record_edition


def expect_error(callback, error_type):
    try:
        callback()
    except error_type:
        return
    raise AssertionError(f"Expected {error_type.__name__}")


with tempfile.TemporaryDirectory() as directory, contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
    root = Path(directory)
    source = root / "book.pdf"
    source.write_bytes(b"%PDF-1.7\n")
    manifest = root / "manifest.json"
    manifest.write_text(json.dumps(dict(id="test-edition", subject="chinese", school_system="6-3",
        label="Test", source="Local fixture", pdf_dir=".", textbooks=["book.pdf"])), encoding="utf-8")
    argv = ["pipeline.py", "--subject", "chinese", "--edition-config", str(manifest)]
    output = root / "output"
    with patch.object(pipeline, "OUTPUT_DIR", output), patch.dict(pipeline.SUBJECTS, clear=False), \
            patch.object(pipeline, "OPENROUTER_API_KEY", ""), patch.object(sys, "argv", argv + ["--dry-run"]), \
            patch.object(pipeline, "process_textbook") as process:
        pipeline.main()
        process.assert_not_called()
        assert not output.exists(), "Dry runs must not create or migrate output"

    cfg = load_edition(manifest, "chinese", pipeline.SUBJECTS["chinese"])
    with patch.object(pipeline, "OUTPUT_DIR", root / "copy-test"):
        dirs = pipeline.build_dirs("chinese")
        pipeline.setup_dirs(dirs)
        copied = pipeline.download_pdf("book.pdf", cfg, dirs)
        assert copied.read_bytes() == source.read_bytes()
        copied.write_bytes(b"%PDF-1.7\ncorrupt cache")
        expect_error(lambda: pipeline.download_pdf("book.pdf", cfg, dirs), ValueError)
        copied.unlink()
        source.write_bytes(b"%PDF-1.7\nchanged after validation")
        expect_error(lambda: pipeline.download_pdf("book.pdf", cfg, dirs), ValueError)
        assert not copied.exists()
        source.write_bytes(b"%PDF-1.7\n")
    destination = output / "editions" / "test-edition"
    record_edition(destination, cfg["edition"])
    source.write_bytes(b"%PDF-1.7\nchanged")
    with patch.object(pipeline, "OUTPUT_DIR", output), patch.dict(pipeline.SUBJECTS, clear=False), \
            patch.object(pipeline, "OPENROUTER_API_KEY", "test-only"), patch.object(sys, "argv", argv), \
            patch.object(pipeline, "process_textbook") as process:
        try:
            pipeline.main()
        except SystemExit as error:
            assert error.code == 2
        else:
            raise AssertionError("Changed source must fail before generation")
        process.assert_not_called()

    with patch.object(pipeline, "process_textbook", side_effect=ValueError("bad PDF")):
        expect_error(lambda: pipeline.run_subject("chinese", None, 10), RuntimeError)

    with patch.object(pipeline, "OUTPUT_DIR", root / "unit-failure"):
        dirs = pipeline.build_dirs("chinese")
        pipeline.setup_dirs(dirs)
        outline = dirs["outline"] / "book.json"
        outline.write_text(json.dumps({"units": [{"unit_number": 1, "title": "Unit"}]}), encoding="utf-8")
        with patch.object(pipeline, "download_pdf", return_value=source), \
                patch.object(pipeline, "generate_quiz_for_unit", side_effect=RuntimeError("model failed")):
            expect_error(lambda: pipeline.process_textbook("book.pdf", "chinese"), RuntimeError)
        outline.write_text('{"units": []}', encoding="utf-8")
        with patch.object(pipeline, "download_pdf", return_value=source):
            expect_error(lambda: pipeline.process_textbook("book.pdf", "chinese"), ValueError)

print("PASS: real CLI dry run, source-change rejection and book/unit error propagation")
