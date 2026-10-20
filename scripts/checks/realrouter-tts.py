"""Offline HTTP/codec fixtures: only validated audio may reach a content hash path."""
import hashlib
import importlib.util
import io
import math
import struct
import subprocess
import sys
import tempfile
import unittest
import wave
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("realrouter_tts", ROOT / "scripts/tts/realrouter_tts.py")
tts = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tts)


def fixture_wav(silent=False):
    output = io.BytesIO()
    with wave.open(output, "wb") as audio:
        audio.setparams((1, 2, 24000, 0, "NONE", "not compressed"))
        audio.writeframes(struct.pack("<12000h", *(0 if silent else int(2000 * math.sin(i * 0.1)) for i in range(12000))))
    return output.getvalue()


class Tests(unittest.TestCase):
    def test_retry_validate_install_and_resume(self):
        text = "二分之一"
        digest = hashlib.sha1(text.encode()).hexdigest()
        item = {"hash": digest, "text": text, "audio_rel": f"{digest[:2]}/{digest}.opus"}
        with tempfile.TemporaryDirectory() as directory:
            args = SimpleNamespace(audio_root=Path(directory), attempts=2, voices=["cove"], base_url="http://fixture/v1")
            responses = [SimpleNamespace(status_code=429), SimpleNamespace(status_code=200, content=fixture_wav())]
            with patch.object(tts.requests, "post", side_effect=responses) as request, patch.object(tts.time, "sleep"):
                result = tts.synthesize(item, args, "fixture-key")
                self.assertEqual(result["status"], "generated")
                self.assertEqual(result["attempt"], 2)
                self.assertEqual(request.call_args.kwargs["json"]["input"], text)
            installed = (Path(directory) / item["audio_rel"]).read_bytes()
            self.assertTrue(installed.startswith(b"OggS"))
            with patch.object(tts.requests, "post", side_effect=AssertionError("Must not regenerate existing audio")):
                self.assertEqual(tts.synthesize(item, args, "fixture-key")["status"], "existing")
            self.assertEqual((Path(directory) / item["audio_rel"]).read_bytes(), installed)
            manifest = Path(directory) / "manifest.json"
            manifest.write_text(tts.json.dumps({"items": [item]}), encoding="utf-8")
            (Path(directory) / "receipts-test.jsonl").write_text(tts.json.dumps(result) + "\n", encoding="utf-8")
            command = [sys.executable, str(ROOT / "scripts/checks/narration-coverage.py"),
                       "--manifest", str(manifest), "--audio-root", directory, "--receipts", directory,
                       "--report", str(Path(directory) / "coverage.json")]
            check = subprocess.run(command, capture_output=True, text=True)
            self.assertEqual(check.returncode, 0, check.stdout + check.stderr)
            (Path(directory) / item["audio_rel"]).write_bytes(b"OggStampered")
            check = subprocess.run(command, capture_output=True, text=True)
            self.assertEqual(check.returncode, 1)
            self.assertIn("differs from receipt", check.stdout)

    def test_invalid_and_silent_responses_never_install(self):
        text = "test"
        digest = hashlib.sha1(text.encode()).hexdigest()
        item = {"hash": digest, "text": text, "audio_rel": f"{digest[:2]}/{digest}.opus"}
        with tempfile.TemporaryDirectory() as directory:
            args = SimpleNamespace(audio_root=Path(directory), attempts=1, voices=["cove"], base_url="http://fixture/v1")
            for data in [b"", b"not audio", fixture_wav(silent=True)]:
                with patch.object(tts.requests, "post", return_value=SimpleNamespace(status_code=200, content=data)):
                    self.assertEqual(tts.synthesize(item, args, "fixture-key")["status"], "failed")
                self.assertFalse((Path(directory) / item["audio_rel"]).exists())
            with self.assertRaises(ValueError):
                tts.validate_item({**item, "text": "changed text"})
            with self.assertRaises(ValueError):
                tts.validate_item({**item, "audio_rel": "../outside.opus"})

    def test_stop_and_unresolved_formula_do_not_call_the_api(self):
        with tempfile.TemporaryDirectory() as directory:
            args = SimpleNamespace(stop_file=Path(directory) / "STOP")
            text = r"\frac{a}{b}"
            digest = hashlib.sha1(text.encode()).hexdigest()
            item = {"hash": digest, "text": text, "audio_rel": f"{digest[:2]}/{digest}.opus", "subject": "math"}
            with patch.object(tts.requests, "post", side_effect=AssertionError("No API call allowed")):
                self.assertEqual(tts.synthesize(item, args, "fixture-key")["status"], "failed")
                args.stop_file.touch()
                self.assertEqual(tts.synthesize(item, args, "fixture-key")["status"], "deferred")


if __name__ == "__main__":
    unittest.main()
