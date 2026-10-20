# PR #24：新增朗读补齐与验证

日期：2026-10-19。初始缺口为 4,495 条，历史发布包本身已完整恢复。

## 已修复的生成路径

RealRouter 本地提交 `a9109b4` 修复 UTF-8 标准输入读取、语音触发与进程清理，并增加可配置的固定朗读指令输入。`d1e057b` 修复中文数字后“千克”等单位被误作数位的问题，并支持繁简体等价转录。指令仅送入模型的输入音轨，不混入生成文件；持续输入时钟使用极低幅度噪声。完成必须收到 assistant `turn.done` 且转录文本匹配。

转录校验允许中文/阿拉伯数字、“乘”/“乘以”及符号的等价写法，保留数值、小数点、数列边界和正负号；不同运算、数字、漏读和额外答案会被拒绝。首次 16 worker 的 HTTP 试跑全部返回有效 WAV。RealRouter 的配置和固定提示音保存在其 `.local/` 下，未复制密钥到本仓库，也未推送 RealRouter 的 main 分支。

教材公式读取同时修复了明确数学分隔符内的 JSON 转义损坏，例如制表符加 `imes`、换页符加 `rac`、损坏的除号/圆圈/方框。普通正文不进行这些替换。显示端还会转义百分号，防止 KaTeX 将后半个公式当作注释。Python 与 Web 对相同正文生成相同朗读哈希。

39 条不适合简单字符串替换的教材公式使用共享的 [明确读法](../packages/core/src/mathNarrationOverrides.json)。循环小数描述点的位置，保留不同选项之间的差异；复合分数明确描述分子、分母与分组；连写字母、比值、时间与乘法口诀使用明确口语。源码题库未被整批重写。

检查失败条目和过长解析时还确认了五道题的题面/答案矛盾，已针对性修正：圆片题拿走 12 个后是 3 倍；韦恩图左圈非重叠人数为 4；进位题明确要求结果十位为 4，最小填 2；并排正方体外露小面数为 8；两层各 50 个正方体的正面小格数为 100。删除了这些题中反复自我纠错的解析，其他题目未据此批量改写。

后续失败复查还修复了 360÷40 的除号、打字题验算、比较大小题的圆圈、连除判断题丢失的运算符；全清单检查发现的八个损坏除法选项和一条抽屉原理公式也已修正。最终朗读清单无控制字符。

## 可恢复的批处理

```powershell
python scripts/tts/collect_texts.py
python scripts/tts/realrouter_tts.py --key-file E:\realRouter\.local\api-key.txt --workers 16 --stop-file deploy-output/tts-repair/STOP
python scripts/checks/narration-coverage.py
npm run build
python scripts/checks/site-integrity.py
python scripts/checks/web-audio-compat.py --decode-samples 24
python scripts/checks/site-navigation.py apps/web/out --report deploy-output/site-navigation.json
python scripts/checks/local-web.py --origin http://127.0.0.1:18824 --narration-receipts deploy-output/tts-repair
```

程序只补缺失源音频。每条验证文本 SHA1 与路径、WAV 参数和非静音内容，再以临时文件转换为真实 Opus，实际解码成功后原子写入。只去掉开头等待静音，保留句内停顿。失败最多尝试三次，写入失败记录；重新执行时跳过已完成文件。创建指定 STOP 文件会让尚未开始的条目延期，当前请求正常结束。

`deploy-output/tts-repair/` 保存每轮清单、逐条生成记录和摘要，包括 WAV/Opus SHA256、音色、重试次数。覆盖率检查验证最终清单中的每个源文件，并对当前仍引用的新音频逐一核对生成记录。

公式修复会改变部分旧哈希并合并重复文本，因此最终以重新收集的清单零缺失为准，不为已废弃的错误读法制造音频。

最终全量检查通过：76,987 条全部存在、缺失 0、错误 0；4,490 条当前有效新音频逐一通过 SHA256 校验。另有 18 条在排查期间生成、后来被修正文本替代的音频，不计入有效新增资源。主批次及两轮补漏均配置 16 worker，最后一轮 15 条全部成功。

## 本地验收结果

已通过：RealRouter 离线校验、批处理失败保护与断点恢复、生成文件篡改检测、Core 231 个测试、Web/Core 类型检查、57,593 条语料的 Python/Web 一致性、KaTeX 修复样例渲染，以及 web-experience、learning-quality、visual-controls 回归检查。

- 完整 `npm run build` 成功退出，生产编译、类型检查、3,903 个静态生成条目和导出全部完成。一个阅读页首次超时，构建器自动重试后成功；没有跳过页面或提高超时掩盖问题。
- 音频构建与兼容性检查通过：78,816 处引用、67,068 个独立 MP3，24 个 FFmpeg 实际解码样本通过。
- 站点资源与路由完整性错误为 0：44 册、2,166 节基础课程、6,836 道基础课题、779 篇课文、284 篇故事。
- Chrome 的 390×844、1280×800 两种窗口各通过 13 条页面路径。验证课文点击朗读，以及三条本次新生成的数学题朗读，音频播放时间实际推进；新旧音频 Range 请求均为 206、类型为 audio/mpeg，无页面异常或 HTTP 错误。
- 全站扫描 3,900 个 HTML 页面、5,151 处链接/图片引用、2,166 个独立目标，缺失 0；结果记录于 `deploy-output/site-navigation.json`。

本地证据：`deploy-output/narration-coverage-final.json`、`full-build-tts.log`、`web-audio-compat-report.json`、`qa-site-integrity.json`、`local-smoke/report.json` 及截图。预览地址为 `http://127.0.0.1:18824`。

## 补充资源包

`release-assets/pr24-narration-repair/narration-additions.tar.gz` 包含 4,490 个有效新增 Opus 和 3,641 个被网页引用的 MP3，共 8,131 个文件、423,666,932 字节。归档内每个文件均重新读取并与清单 SHA256 比较，全部匹配。

归档 SHA256：`62b0a8e829b091d50fe9621481bdd5fcf02b2651acb1eda87ad56e7ee1db51a7`。

已发布为 [v1.4.1-narration-supplement](https://github.com/wuwangzhang1216/ChinaTextbookStudyFree/releases/tag/v1.4.1-narration-supplement) 预发布，固定配套源码为 `5a3408a90c87050aa54e1d12af4f446d880221d0`，不替换最新稳定完整包。附件包括归档、`manifest.json`、`SHA256SUMS`、`INSTALL.md` 和只读验证脚本 `verify-narration.py`。

这是基于 v1.4.0-content 的音频补充包：先恢复该版本资源，再将补充包解到仓库根目录，使用指定源码执行完整构建。它不是独立网站包。旧发布包的 144,208 文件核验结果仍保留在 `deploy-output/release-integrity.json`。

发布前另在独立目录依次安装两个基础音频归档和补充包：8,131 个补充文件 SHA256 全部匹配，目录索引核对 76,987 条源朗读全部存在且非空，24 个 Opus/MP3 实际解码样本通过，校验和不符与安装文件损坏两类反例均被拒绝。上传到草稿后重新下载五个附件，与本地逐一比较 SHA256，并再次验证归档内全部 8,131 个文件后才发布。证据位于 `deploy-output/narration-release-install-test.json` 和 `deploy-output/narration-release-remote-verification.json`。

全程不跑 GitHub CI。音频技术校验不代替逐条人工听审；新版教材与五四制范围仍遵循此前记录。
