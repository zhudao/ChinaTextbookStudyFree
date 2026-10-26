#!/usr/bin/env python3
"""
edge_tts_batch.py — 免费批量语音合成（微软 Edge 朗读，零 API Key，只需联网）。

与 api_tts.py（阿里云 DashScope，需付费 Key）**完全相同的 manifest / 输出路径 /
断点续传 / 并发语义**，可作为免费替代或补充：没有 DASHSCOPE_API_KEY 时，
用本脚本也能生成全站 TTS 音频。

用法:
    pip install edge-tts                 # 免费开源（MIT），无需任何 Key

    python scripts/tts/edge_tts_batch.py --dry-run          # 先看有多少条
    python scripts/tts/edge_tts_batch.py --limit 50         # 先试 50 条
    python scripts/tts/edge_tts_batch.py                    # 全量
    python scripts/tts/edge_tts_batch.py --language English # 只跑英文
    python scripts/tts/edge_tts_batch.py --requests-per-second 2 --report failures.json
    python scripts/tts/edge_tts_batch.py --manifest failures.json # 只重跑失败条目

依赖:
    pip install 'edge-tts>=7.0'

说明:
    - 输出路径 / 命名与 api_tts.py 一致（audio_root/<audio_rel>），两者产物可直接混用；
    - 断点续传：已存在的文件自动跳过；
    - 默认 4 并发、每秒最多启动 2 次合成（含重试，限速按进程计算）；
    - 失败后全局冷却，指数退避加随机抖动；仍有失败时退出码为 1；
    - --report report.json 保存统计和失败条目，可用作 --manifest 重跑；
    - 需要 edge-tts >= 7.x：旧版本不带 Sec-MS-GEC v2 令牌，会被微软服务返回 403；
    - edge-tts 为 MIT 开源项目（https://github.com/rany2/edge-tts）；
    - 该方案走微软公共服务，仅供学习交流，请遵守微软服务条款。
"""

from __future__ import annotations

import argparse
import asyncio
import json
import math
import random
import re
import sys
import time
from pathlib import Path

try:
    import edge_tts
except ImportError:
    sys.exit("❌ 未安装 edge-tts。请先执行: pip install 'edge-tts>=7.0'")

ROOT = Path(__file__).resolve().parents[2]
MANIFEST_PATH = Path(__file__).resolve().parent / "manifest.json"
AUDIO_ROOT = ROOT / "apps" / "web" / "public" / "audio"

# manifest speaker → 微软 Edge 音色（与 api_tts.py 的 SPEAKER_MAP 同键，换成免费音色）。
# 中文默认温暖女声（适合小学生）；英文用美式男女声。
SPEAKER_MAP = {
    # 中文条目
    "vivian": "zh-CN-XiaoxiaoNeural",  # 晓晓 - 温暖阳光，低中年级主力
    "serena": "zh-CN-XiaoyiNeural",  # 晓伊 - 温柔，高年级
    "uncle_fu": "zh-CN-XiaoxiaoNeural",  # 晓晓 - 科学讲解
    # 英文条目
    "sohee": "en-US-AnaNeural",  # 女声，低年级英语
    "ryan": "en-US-GuyNeural",  # 男声，中年级英语
    "dylan": "en-US-AriaNeural",  # 女声，高年级英语
}

DEFAULT_VOICE_ZH = "zh-CN-XiaoxiaoNeural"
DEFAULT_VOICE_EN = "en-US-AnaNeural"

# The service returns an empty stream for these isolated notation glyphs.
# Keep the original text hash/path and speak its sound or an explicit label.
PHONETIC_SPEECH = {
    ">": "大于", "<": "小于", "=": "等于", "……": "省略号",
    "＞": "大于", "＜": "小于", "＝": "等于",
    "+": "加号", "＋": "加号", "-": "减号", "－": "减号",
    "×": "乘号", "÷": "除号", "≤": "小于或等于", "≥": "大于或等于",
    "≠": "不等于", "±": "正负号", "π": "圆周率", "°": "度",
    "∠": "角", "□": "方框", "△": "三角形", "○": "圆圈",
    "ü": "迂", "ū": "乌", "ú": "无", "ǔ": "五", "ù": "物",
    "ˇ": "第三声，上声。", "ˋ": "第四声，去声。",
    "ˉ": "第一声，阴平。", "ˊ": "第二声，阳平。",
    "/ɪ/": "The short i sound, as in sit.",
    "/ɑː/": "The long ah sound, as in father.",
    "/ɔː/": "The aw sound, as in saw.",
    "/æ/": "The a sound, as in cat.",
    "/ð/": "The voiced th sound, as in this.",
    "/θ/": "The unvoiced th sound, as in thin.",
}


def spoken_text(text: str) -> str:
    """Describe isolated notation while retaining its original content hash."""
    if re.fullmatch(r"●+(?:\s+●+)*", text):
        # Say each dot so children can count; do not announce the answer count.
        return "；".join("，".join("圆点" for _ in group) for group in text.split())
    return PHONETIC_SPEECH.get(text, text)


class RequestLimiter:
    """Space synthesis attempts across workers, including retries and cooldowns."""

    def __init__(self, requests_per_second: float):
        self.interval = 1 / requests_per_second
        self.next_start = 0.0
        self.cooldown_until = 0.0
        self.requests = 0
        self.retries = 0
        self.lock = asyncio.Lock()

    async def wait(self) -> None:
        async with self.lock:
            while True:
                delay = max(self.next_start, self.cooldown_until) - time.monotonic()
                if delay <= 0:
                    break
                await asyncio.sleep(delay)
                # Another in-flight request may extend the cooldown while we sleep.
            self.next_start = time.monotonic() + self.interval
            self.requests += 1

    def defer(self, delay: float) -> None:
        # Called only on this event loop; never shorten another worker's cooldown.
        self.cooldown_until = max(self.cooldown_until, time.monotonic() + delay)


def pick_voice(item: dict, voice_zh: str, voice_en: str) -> str:
    speaker = item.get("speaker")
    if speaker in SPEAKER_MAP:
        return SPEAKER_MAP[speaker]
    if item.get("language") == "English":
        return voice_en
    return voice_zh


async def synth_one(
    item: dict,
    audio_root: Path,
    rate: str,
    volume: str,
    pitch: str,
    voice_zh: str,
    voice_en: str,
    max_retries: int = 5,
    *,
    limiter: RequestLimiter | None = None,
    backoff_base: float = 2.0,
    backoff_max: float = 60.0,
) -> tuple[bool, str]:
    """合成一条；返回 (成功与否, 错误信息)。已存在则跳过。"""
    out_path = audio_root / item["audio_rel"]
    if out_path.exists():
        return True, "skip"

    voice = pick_voice(item, voice_zh, voice_en)
    text = item.get("text", "")
    if not text:
        return False, "empty text"

    last_err = ""
    for attempt in range(max_retries):
        if limiter is not None:
            await limiter.wait()
            if attempt:
                limiter.retries += 1
        try:
            communicate = edge_tts.Communicate(
                text=spoken_text(text), voice=voice, rate=rate, volume=volume, pitch=pitch
            )
            audio = bytearray()
            async for chunk in communicate.stream():
                if chunk.get("type") == "audio":
                    audio.extend(chunk["data"])
            if not audio:
                last_err = "empty audio stream"
            else:
                out_path.parent.mkdir(parents=True, exist_ok=True)
                out_path.write_bytes(audio)
                return True, ""
        except Exception as e:  # noqa: BLE001 - 批量任务里任何错误都重试
            last_err = f"{type(e).__name__}: {e}"
        # Cool down the whole batch so queued first attempts cannot flood the
        # service while a failed worker backs off. Do not sleep after exhaustion.
        base = min(backoff_max, backoff_base * 2 ** min(attempt, 30))
        delay = min(backoff_max, base + random.uniform(0, base * 0.25))
        if limiter is not None:
            limiter.defer(delay)
        if attempt + 1 < max_retries:
            print(
                f"  ↻ {str(item.get('hash', '?'))[:8]} 重试 {attempt + 1}/{max_retries - 1}，"
                f"冷却 {delay:.1f}s: {last_err}",
                flush=True,
            )
            if limiter is None:
                await asyncio.sleep(delay)
    return False, last_err


async def run(args: argparse.Namespace) -> int:
    manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    items = manifest["items"]

    # 与 api_tts.py 相同的过滤 / 分片语义
    if args.language and args.language != "all":
        items = [it for it in items if it.get("language") == args.language]
    if args.subject:
        items = [it for it in items if it.get("subject") == args.subject]
    if args.field:
        items = [it for it in items if it.get("field") == args.field]

    n, m = (int(x) for x in args.shard.split("/"))
    items = [it for i, it in enumerate(items) if i % m == n]

    audio_root = Path(args.audio_root)
    pending = [it for it in items if not (audio_root / it["audio_rel"]).exists()]
    skipped = len(items) - len(pending)
    if args.limit:
        pending = pending[: args.limit]

    print(
        f"📊 总量: {len(manifest['items'])}  本次范围: {len(items)}  "
        f"已跳过: {skipped}  待生成: {len(pending)}"
    )
    print(
        f"🎤 引擎: EdgeTTS(免费)   workers: {args.workers}   "
        f"requests/s: {args.requests_per_second:g}   rate: {args.rate}   "
        f"中文音色: {args.voice_zh}   英文音色: {args.voice_en}"
    )
    if args.dry_run:
        return 0

    total = len(pending)
    done = 0
    fail = 0
    t0 = time.monotonic()
    failures = []
    limiter = RequestLimiter(args.requests_per_second)
    stats_lock = asyncio.Lock()
    sem = asyncio.Semaphore(args.workers)

    async def worker(item: dict) -> tuple[dict, bool, str]:
        async with sem:
            ok, err = await synth_one(
                item,
                audio_root,
                args.rate,
                args.volume,
                args.pitch,
                args.voice_zh,
                args.voice_en,
                max_retries=args.max_retries,
                limiter=limiter,
                backoff_base=args.backoff_base,
                backoff_max=args.backoff_max,
            )
            return item, ok, err

    tasks = [asyncio.create_task(worker(it)) for it in pending]
    for coro in asyncio.as_completed(tasks):
        item, ok, err = await coro
        async with stats_lock:
            done += 1
            if not ok:
                fail += 1
                failures.append({"item": item, "error": err})
                print(f"  ⚠️  {str(item.get('hash', '?'))[:8]} 失败: {err}", flush=True)
            if done % 50 == 0 or done == total:
                elapsed = time.monotonic() - t0
                rate_n = done / elapsed if elapsed else 0
                eta = (total - done) / rate_n if rate_n else 0
                print(
                    f"  [{done:>5}/{total}] {rate_n:5.1f} it/s   "
                    f"ETA {eta / 60:6.1f} min   fail={fail}",
                    flush=True,
                )

    elapsed = time.monotonic() - t0
    print(
        f"\n{'⚠️' if fail else '🎉'} 完成。成功 {total - fail} 失败 {fail}，"
        f"请求 {limiter.requests} 重试 {limiter.retries}，用时 {elapsed / 60:.1f} min"
    )
    if args.report:
        report = {
            "summary": {
                "total": total,
                "skipped": skipped,
                "succeeded": total - fail,
                "failed": fail,
                "requests": limiter.requests,
                "retries": limiter.retries,
                "elapsed_seconds": round(elapsed, 3),
                "workers": args.workers,
                "requests_per_second": args.requests_per_second,
            },
            "failures": failures,
            "items": [failure["item"] for failure in failures],
        }
        report_path = Path(args.report)
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(
            json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
    return 1 if fail else 0


def positive_int(value: str) -> int:
    number = int(value)
    if number <= 0:
        raise argparse.ArgumentTypeError("必须大于 0")
    return number


def positive_float(value: str) -> float:
    number = float(value)
    if not math.isfinite(number) or number <= 0:
        raise argparse.ArgumentTypeError("必须是大于 0 的有限数值")
    return number


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="免费批量 TTS（微软 Edge 朗读，零 API Key）"
    )
    p.add_argument("--manifest", default=str(MANIFEST_PATH))
    p.add_argument("--audio-root", default=str(AUDIO_ROOT))
    p.add_argument("--workers", type=positive_int, default=4, help="并发数（默认 4）")
    p.add_argument(
        "--requests-per-second",
        type=positive_float,
        default=2.0,
        help="每进程每秒启动的合成任务上限，含重试（默认 2）",
    )
    p.add_argument(
        "--max-retries",
        type=positive_int,
        default=5,
        help="每条最多尝试次数，含首次请求（默认 5）",
    )
    p.add_argument(
        "--backoff-base",
        type=positive_float,
        default=2.0,
        help="失败退避初始秒数，指数增长并加随机抖动（默认 2）",
    )
    p.add_argument(
        "--backoff-max",
        type=positive_float,
        default=60.0,
        help="失败退避上限秒数（默认 60）",
    )
    p.add_argument("--report", help="写入统计和失败 manifest 的 JSON 文件")
    p.add_argument("--limit", type=int, default=0, help="只生成前 N 条（调试用）")
    p.add_argument("--shard", default="0/1", help="分片，如 0/4 表示只跑 1/4")
    p.add_argument("--subject", default="")
    p.add_argument("--field", default="")
    p.add_argument(
        "--language",
        default="all",
        help="只跑指定语言（默认 all，传 Chinese/English 过滤）",
    )
    p.add_argument("--rate", default="-5%", help="语速（默认 -5%%，略慢适合小学生）")
    p.add_argument("--volume", default="+0%")
    p.add_argument("--pitch", default="+0Hz")
    p.add_argument("--voice-zh", default=DEFAULT_VOICE_ZH, help="中文兜底音色")
    p.add_argument("--voice-en", default=DEFAULT_VOICE_EN, help="英文兜底音色")
    p.add_argument("--dry-run", action="store_true")
    return p


def main() -> None:
    args = build_parser().parse_args()
    sys.exit(asyncio.run(run(args)))


if __name__ == "__main__":
    main()
