# Edge TTS 批量合成验证（2026-10-20）

修复 PR #17 的无效音色和失败退出码，并验证保守限速下的中文批量生成。

## 行为与参数

- `uncle_fu` 改用 `zh-CN-XiaoxiaoNeural`；`sohee` 和英文兜底改用 `en-US-AnaNeural`。
- 默认 `--workers 4`、`--requests-per-second 2`。首次合成和重试共用一个限速器；每次启动至少间隔 0.5 秒，空闲后不会积攒突发额度。
- 失败后整个进程共享冷却期限。退避从 2 秒指数增长，加最多 25% 随机抖动，最终封顶 60 秒；每条最多尝试 5 次。耗尽次数后不额外等待，但其他待处理任务仍遵守冷却。
- 最终存在失败条目时退出码为 1；全部成功或全部跳过时为 0。
- `--report` 写入请求数、重试数、成功数、失败原因和失败 manifest；可直接用 `--manifest` 重跑该报告。
- 限速按进程计算。多个分片进程各自拥有额度；`edge-tts` 内部的协议重试和长文本拆段不由这个调度器单独计数。

```bash
pip install 'edge-tts>=7.0'
python scripts/tts/collect_texts.py
python scripts/tts/edge_tts_batch.py \
  --language Chinese --limit 120 \
  --workers 4 --requests-per-second 2 \
  --audio-root /tmp/edge-tts-smoke/audio \
  --report /tmp/edge-tts-smoke/failures.json

# 保留相同 audio-root，避免重新生成已成功条目
python scripts/tts/edge_tts_batch.py \
  --manifest /tmp/edge-tts-smoke/failures.json \
  --audio-root /tmp/edge-tts-smoke/audio
```

## 实际网络测试

环境：macOS、Python 3.14、edge-tts 7.3.1。使用真实 manifest 中 `language=Chinese` 的条目，将 `vivian`、`serena`、`uncle_fu` 三组各按 `(文本长度, hash)` 排序，均匀取 40 条，共 120 条。以全新的独立音频目录执行真实 `run()`，没有复用已有音频；仅在客户端边界记录开始时间、延迟、错误与同时进行的请求数。

| 指标 | 结果 |
| --- | --- |
| 中文文本数 | 120（每种 speaker 40 条） |
| 来源学科 | 语文 44、科学 43、数学 28、英语科目中的中文 5 |
| 文本长度 | 1–331 字符 |
| 并发上限 / 每秒启动上限 | 4 / 2 |
| 成功 / 失败 | 120 / 0 |
| 合成尝试 / 重试 | 120 / 0 |
| 批量合成耗时 | 62.720 秒 |
| 实际最高同时进行请求数 | 4 |
| 最小启动间隔 | 0.5000 秒 |
| 成功请求耗时中位数 / P95 | 0.778 秒 / 1.970 秒 |
| FFmpeg 完整解码 | 120 / 120 通过 |
| 原 manifest 续跑 | 跳过 120 条，新增请求 0，退出码 0 |

全部配置音色均在实时音色列表中；修正后的低年级英文 Ana 另有一次真实合成通过。

本次没有遇到服务端限流，退避路径由故障注入测试覆盖。这是一次约一分钟的批量测试，不能据此确定服务的长期额度或持续负载上限。

## 回归测试

```bash
python -m unittest discover -s scripts/tts -p test_edge_tts_batch.py -v
```

20 项测试全部通过，包含：CLI 失败退出码、有效音色映射、默认并发、跨 worker 启动间隔、等待期间冷却延长、模拟 429 后新任务等待与重试恢复、重试次数与退避上限、失败报告与续跑，以及原有过滤、分片、限量、并发、空音频和已有文件跳过行为。Ruff 检查通过。
