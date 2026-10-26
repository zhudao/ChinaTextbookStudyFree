import argparse
import asyncio
import contextlib
import importlib.util
import io
import json
import tempfile
import subprocess
import sys
import time
import unittest
from pathlib import Path
from unittest.mock import patch, AsyncMock

SOURCE = Path(__file__).with_name("edge_tts_batch.py")
spec = importlib.util.spec_from_file_location("batch", SOURCE)
batch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(batch)


def item(index=0, **overrides):
    result = dict(
        hash=f"{index:040x}",
        audio_rel=f"00/{index:040x}.opus",
        text=f"测试{index}",
        language="Chinese",
        speaker="vivian",
        subject="math",
        field="question",
    )
    result.update(overrides)
    return result


class BatchTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.calls = []

    async def asyncTearDown(self):
        self.temp.cleanup()

    def stream_class(self, fail=False, empty=False):
        calls = self.calls

        class FakeCommunicate:
            def __init__(self, **kwargs):
                calls.append(kwargs)

            async def stream(self):
                yield {"type": "WordBoundary"}
                if fail:
                    raise RuntimeError("service unavailable")
                if not empty:
                    yield {"type": "audio", "data": b"first"}
                    yield {"type": "audio", "data": b"second"}

        return FakeCommunicate

    async def synth(self, entry=None, **kwargs):
        return await batch.synth_one(
            entry or item(),
            self.root,
            "-5%",
            "+0%",
            "+0Hz",
            batch.DEFAULT_VOICE_ZH,
            batch.DEFAULT_VOICE_EN,
            **kwargs,
        )

    async def run_items(self, entries, **overrides):
        manifest = self.root / "manifest.json"
        manifest.write_text(json.dumps({"items": entries}))
        values = dict(
            manifest=str(manifest),
            audio_root=str(self.root / "audio"),
            language="all",
            subject="",
            field="",
            shard="0/1",
            limit=0,
            workers=2,
            rate="-5%",
            volume="+0%",
            pitch="+0Hz",
            voice_zh=batch.DEFAULT_VOICE_ZH,
            voice_en=batch.DEFAULT_VOICE_EN,
            dry_run=False,
            requests_per_second=1000.0,
            max_retries=3,
            backoff_base=0.01,
            backoff_max=0.05,
            report=None,
        )
        values.update(overrides)
        stream = io.StringIO()
        with contextlib.redirect_stdout(stream):
            await batch.run(argparse.Namespace(**values))
        return stream.getvalue()

    async def test_audio_chunks_written_and_parameters_forwarded(self):
        with patch.object(batch.edge_tts, "Communicate", self.stream_class()):
            self.assertEqual(await self.synth(), (True, ""))
        self.assertEqual((self.root / item()["audio_rel"]).read_bytes(), b"firstsecond")
        self.assertEqual(self.calls[0]["rate"], "-5%")
        self.assertEqual(self.calls[0]["voice"], "zh-CN-XiaoxiaoNeural")

    async def test_isolated_phonetic_keeps_original_cache_identity(self):
        entry = item(text="ǔ")
        with patch.object(batch.edge_tts, "Communicate", self.stream_class()):
            self.assertEqual(await self.synth(entry), (True, ""))
        self.assertEqual(self.calls[0]["text"], "五")
        self.assertTrue((self.root / entry["audio_rel"]).is_file())
        self.assertEqual(entry["text"], "ǔ")

    async def test_existing_file_is_skipped(self):
        path = self.root / item()["audio_rel"]
        path.parent.mkdir()
        path.write_bytes(b"existing")
        with patch.object(batch.edge_tts, "Communicate", self.stream_class()):
            self.assertEqual(await self.synth(), (True, "skip"))
        self.assertEqual(self.calls, [])
        self.assertEqual(path.read_bytes(), b"existing")

    async def test_isolated_notation_is_spoken_without_changing_cache_identity(self):
        for index, (text, spoken) in enumerate([(">", "大于"), ("<", "小于"), ("=", "等于"), ("……", "省略号")], 1):
            entry = item(index, text=text)
            with patch.object(batch.edge_tts, "Communicate", self.stream_class()):
                self.assertEqual(await self.synth(entry), (True, ""))
            self.assertEqual(self.calls[-1]["text"], spoken)
            self.assertEqual(entry["text"], text)
            self.assertTrue((self.root / entry["audio_rel"]).is_file())

    async def test_empty_text_is_rejected(self):
        self.assertEqual(await self.synth(item(text="")), (False, "empty text"))

    async def test_comparison_symbols_and_countable_dots_keep_identity(self):
        for index, (text, spoken) in enumerate([
            ("＜", "小于"), ("＞", "大于"), ("＝", "等于"),
            ("●", "圆点"), ("●●● ●●", "圆点，圆点，圆点；圆点，圆点"),
        ], 10):
            entry = item(index, text=text)
            with patch.object(batch.edge_tts, "Communicate", self.stream_class()):
                self.assertEqual(await self.synth(entry), (True, ""))
            self.assertEqual(self.calls[-1]["text"], spoken)
            self.assertEqual(entry["text"], text)
            self.assertTrue((self.root / entry["audio_rel"]).is_file())
        self.assertEqual(batch.spoken_text("有●●个符号"), "有●●个符号")

    async def test_service_failure_retries_without_output(self):
        with (
            patch.object(batch.edge_tts, "Communicate", self.stream_class(fail=True)),
            patch.object(batch.asyncio, "sleep", new_callable=AsyncMock),
        ):
            ok, err = await self.synth(max_retries=3)
        self.assertFalse(ok)
        self.assertIn("service unavailable", err)
        self.assertEqual(len(self.calls), 3)
        self.assertFalse((self.root / item()["audio_rel"]).exists())

    async def test_empty_stream_retries_without_output(self):
        with (
            patch.object(batch.edge_tts, "Communicate", self.stream_class(empty=True)),
            patch.object(batch.asyncio, "sleep", new_callable=AsyncMock),
        ):
            ok, err = await self.synth(max_retries=2)
        self.assertFalse(ok)
        self.assertEqual(err, "empty audio stream")
        self.assertEqual(len(self.calls), 2)
        self.assertFalse((self.root / item()["audio_rel"]).exists())

    async def test_dry_run_writes_nothing(self):
        with patch.object(batch.edge_tts, "Communicate", self.stream_class()):
            output = await self.run_items([item()], dry_run=True)
        self.assertIn("待生成: 1", output)
        self.assertEqual(self.calls, [])
        self.assertFalse((self.root / "audio").exists())

    async def test_language_subject_field_filters(self):
        entries = [
            item(),
            item(1, language="English"),
            item(2, subject="science"),
            item(3, field="explanation"),
        ]
        with patch.object(batch.edge_tts, "Communicate", self.stream_class()):
            await self.run_items(
                entries, language="Chinese", subject="math", field="question"
            )
        self.assertEqual([c["text"] for c in self.calls], ["测试0"])

    async def test_shard_limit_and_skip_order(self):
        entries = [item(i) for i in range(8)]
        existing = self.root / "audio" / entries[1]["audio_rel"]
        existing.parent.mkdir(parents=True)
        existing.write_bytes(b"existing")
        with patch.object(batch.edge_tts, "Communicate", self.stream_class()):
            await self.run_items(entries, shard="1/2", limit=2)
        self.assertEqual([c["text"] for c in self.calls], ["测试3", "测试5"])

    async def test_worker_concurrency_limit(self):
        active = 0
        maximum = 0

        async def fake_synth(*args, **kwargs):
            nonlocal active, maximum
            active += 1
            maximum = max(active, maximum)
            await asyncio.sleep(0.005)
            active -= 1
            return True, ""

        with patch.object(batch, "synth_one", fake_synth):
            output = await self.run_items([item(i) for i in range(8)], workers=2)
        self.assertEqual(maximum, 2)
        self.assertIn("成功 8 失败 0", output)

    async def test_unknown_speaker_uses_language_fallback(self):
        self.assertEqual(
            batch.pick_voice(item(speaker="unknown", language="English"), "zh", "en"),
            "en",
        )
        self.assertEqual(batch.pick_voice(item(speaker="unknown"), "zh", "en"), "zh")

    async def test_science_and_low_grade_english_use_validated_voices(self):
        self.assertEqual(
            batch.pick_voice(item(speaker="uncle_fu"), "zh", "en"),
            "zh-CN-XiaoxiaoNeural",
        )
        self.assertEqual(
            batch.pick_voice(item(speaker="sohee", language="English"), "zh", "en"),
            "en-US-AnaNeural",
        )
        self.assertEqual(batch.DEFAULT_VOICE_EN, "en-US-AnaNeural")

    async def test_default_concurrency_is_four(self):
        self.assertEqual(batch.build_parser().parse_args([]).workers, 4)

    async def test_cli_failure_returns_nonzero(self):
        manifest = self.root / "invalid.json"
        manifest.write_text(json.dumps({"items": [item(text="")]}))
        result = await asyncio.to_thread(
            subprocess.run,
            [
                sys.executable,
                str(SOURCE),
                "--manifest",
                str(manifest),
                "--audio-root",
                str(self.root / "audio"),
            ],
            capture_output=True,
            text=True,
            timeout=10,
        )
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn("失败 1", result.stdout)

    async def test_request_starts_are_spaced_across_workers(self):
        starts = []

        class TimedCommunicate:
            def __init__(self, **kwargs):
                starts.append(time.monotonic())

            async def stream(self):
                yield {"type": "audio", "data": b"audio"}

        with patch.object(batch.edge_tts, "Communicate", TimedCommunicate):
            await self.run_items(
                [item(i) for i in range(5)], workers=4, requests_per_second=50
            )
        self.assertEqual(len(starts), 5)
        self.assertTrue(all(b - a >= 0.019 for a, b in zip(starts, starts[1:])), starts)

    async def test_shared_cooldown_delays_queued_request(self):
        limiter = batch.RequestLimiter(50)
        await limiter.wait()
        waiter = asyncio.create_task(limiter.wait())
        await asyncio.sleep(0.001)
        limiter.defer(0.03)
        started = time.monotonic()
        await waiter
        self.assertGreaterEqual(time.monotonic() - started, 0.029)

    async def test_retries_use_limiter_and_skip_final_sleep(self):
        limiter = unittest.mock.Mock()
        limiter.wait = AsyncMock()
        limiter.retries = 0
        with (
            patch.object(batch.edge_tts, "Communicate", self.stream_class(fail=True)),
            patch.object(batch.asyncio, "sleep", new_callable=AsyncMock) as sleep,
        ):
            ok, err = await batch.synth_one(
                item(),
                self.root,
                "-5%",
                "+0%",
                "+0Hz",
                "zh",
                "en",
                max_retries=3,
                limiter=limiter,
                backoff_base=2,
                backoff_max=5,
            )
        self.assertFalse(ok)
        self.assertEqual(limiter.wait.await_count, 3)
        self.assertEqual(limiter.defer.call_count, 3)
        delays = [call.args[0] for call in limiter.defer.call_args_list]
        self.assertTrue(2 <= delays[0] <= 2.5, delays)
        self.assertTrue(4 <= delays[1] <= 5, delays)
        self.assertEqual(delays[2], 5)
        sleep.assert_not_awaited()

    async def test_failure_report_preserves_items_for_rerun(self):
        report = self.root / "report.json"
        with patch.object(batch.edge_tts, "Communicate", self.stream_class()):
            await self.run_items([item(), item(1, text="")], report=str(report))
        result = json.loads(report.read_text())
        self.assertEqual(result["summary"]["succeeded"], 1)
        self.assertEqual(result["summary"]["failed"], 1)
        self.assertEqual(result["items"], [item(1, text="")])

    async def test_invalid_limits_are_rejected(self):
        for args in (
            ["--workers", "0"],
            ["--requests-per-second", "0"],
            ["--requests-per-second", "nan"],
            ["--max-retries", "0"],
            ["--backoff-base", "-1"],
            ["--backoff-max", "inf"],
        ):
            with (
                self.subTest(args=args),
                contextlib.redirect_stderr(io.StringIO()),
                self.assertRaises(SystemExit),
            ):
                batch.build_parser().parse_args(args)

    async def test_failed_attempt_pauses_new_work_then_recovers(self):
        starts = []
        attempts = {}

        class RecoveringCommunicate:
            def __init__(self, **kwargs):
                self.text = kwargs["text"]
                starts.append(time.monotonic())
                attempts[self.text] = attempts.get(self.text, 0) + 1
                self.fail = self.text == "测试0" and attempts[self.text] == 1

            async def stream(self):
                if self.fail:
                    raise RuntimeError("429 Too Many Requests")
                yield {"type": "audio", "data": b"audio"}

        report = self.root / "recovery.json"
        with patch.object(batch.edge_tts, "Communicate", RecoveringCommunicate):
            await self.run_items(
                [item(i) for i in range(3)],
                workers=2,
                requests_per_second=1000,
                backoff_base=0.03,
                backoff_max=0.03,
                report=str(report),
            )
        result = json.loads(report.read_text())
        self.assertEqual(result["summary"]["succeeded"], 3)
        self.assertEqual(result["summary"]["requests"], 4)
        self.assertEqual(result["summary"]["retries"], 1)
        self.assertEqual(len(list((self.root / "audio").rglob("*.opus"))), 3)
        self.assertGreaterEqual(starts[1] - starts[0], 0.029)

    async def test_resume_reports_no_new_requests(self):
        report = self.root / "resume.json"
        with patch.object(batch.edge_tts, "Communicate", self.stream_class()):
            await self.run_items([item()], report=str(report))
            await self.run_items([item()], report=str(report))
        result = json.loads(report.read_text())
        self.assertEqual(len(self.calls), 1)
        self.assertEqual(result["summary"]["skipped"], 1)
        self.assertEqual(result["summary"]["requests"], 0)
        self.assertEqual(result["summary"]["failed"], 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
