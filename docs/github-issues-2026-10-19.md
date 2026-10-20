# GitHub issues 修复与剩余验收

本轮在 `codex/github-issues` 实施，未部署生产。未完成的内容保持开放。

| Issue | 本轮结果 | 尚需完成 |
| --- | --- | --- |
| #23 分数、公式显示与朗读 | Web 支持四种 TeX 分隔符；修复损坏公式转义、分数与运算读法，39 条复杂写法使用共享明确读法；Python/Web 哈希一致；已补齐当前 76,987 条清单，4,490 条有效新音频通过 SHA256 核验，详见[补齐记录](pr24-narration-completion.md) | 教师听审及发布；未带分隔符的斜杠可能是日期或除法，不擅自全局转换；新遇到的复杂 LaTeX 仍需逐例核对 |
| #22 语文修订版 | 新增显式教材版本清单、本地 PDF 导入、来源记录和版本输出隔离 | 获取并核对修订版 PDF，生成题库/课文/音频，接入前端版本选择及隔离学习进度 |
| #14 最新数学教材 | 可通过同一版本清单导入新版数学教材 | 真实新版 PDF、逐册适配及审核；没有把旧版数据改标为新版 |
| #7 五四制 | 按用户本轮要求暂缓，不导入五四制教材 | 保持开放；清单保留学制字段供未来使用 |
| #3 旧 iPad 音频 | 已有 MP3 优先方案；本轮重新通过旧地址回退、播放中断和过期事件回归 | iPad 6 实机验收；本轮无此设备 |
| #12 Web UX | 已有修复保留，本轮 Core 231 测试及类型检查通过 | 教师/儿童/真实设备验收、题量覆盖、音频发布一致性；不能用自动测试替代 |

## 教材导入

### 已核对的现有来源

2026-10-19 从用户提供的 [TapXWorld/ChinaTextbook 小学目录](https://github.com/TapXWorld/ChinaTextbook/tree/master/%E5%B0%8F%E5%AD%A6) 下载并检查两册 PDF：

- 语文统编版五年级上册共 133 页，PDF 第 4 页目录仍为第 1 课《白鹭》、第 2 课《落花生》、第 3 课《桂花雨》，不是 #22 请求的修订版。SHA256：`a63e3a6636e0b4cd77a1e6434d85229ee40f13230fc841cd5f0f056853db7a3d`。
- 人教版数学一年级上册共 118 页，PDF 第 3 页版次为 2022 年 8 月第 2 版。出版年份不能代替“根据 2022 课标修订”的版本证明。SHA256：`a8e880217c456db68bb363cadba9e235263197d375243a5d0850d4f9131562d4`。

这两册仍不能作为本轮“已更新为最新教材”的证据。需补充经核对的修订版来源；不重新生成相同旧 PDF 并宣称完成更新。

将合法取得、已核对版本的 PDF 存入本地目录。清单相对路径以清单自身所在目录为基准，例如 `edition.json`：

```json
{
  "id": "chinese-2022-revised",
  "subject": "chinese",
  "label": "统编版·2022课标修订版",
  "school_system": "6-3",
  "source": "国家中小学智慧教育平台；请补充具体教材页面、版次和核对日期",
  "pdf_dir": "pdfs",
  "textbooks": ["语文五年级上册.pdf"]
}
```

```sh
python scripts/quiz/pipeline.py --subject chinese --edition-config edition.json --dry-run
python scripts/quiz/pipeline.py --subject chinese --edition-config edition.json
```

预览无需 API Key，也不迁移或写入数据。生成仍使用现有模型，需要 `OPENROUTER_API_KEY`。输出位于 `output/editions/chinese-2022-revised/chinese/`，版本来源记录位于上一级 `edition.json`。同一版本 ID 的元数据或 PDF 变化会报错，避免复用旧大纲和题库；改版时使用新 ID。旧命令及旧输出目录保持兼容。五四制使用 `school_system: "5-4"` 和独立 ID。

隔离输出目前用于审核，不会自动进入 Web 课程目录。正式接入需要课程版本 ID、课文/音频映射和学习进度隔离，不能直接覆盖 `output/chinese`。

## 公式音频更新

先运行 `python scripts/tts/collect_texts.py` 重新生成清单，再使用既有 TTS 流程合成缺失项。公式归一化后的文字参与 SHA1，旧音频不会被当作修正音频。Web 构建仅挂载实际存在的新音频；未生成时该段没有朗读地址。合成后运行既有 MP3 转码、完整性检查和人工听审，再发布。

本轮工作区不含音频资源，未调用付费 TTS，未声称已经修复线上声音。独立的 `1/2` 答案也会读作“2分之1”；正文中的未标记斜杠不自动猜测含义。

## 验证命令

```sh
npx tsx scripts/checks/math-speech.ts
python scripts/checks/textbook-editions.py
npx tsx scripts/checks/tts-legacy-audio.ts
npm run type-check
npm test
```

数学回归同时执行 Python 与 TypeScript，对照相同输入的期望朗读结果；包含分母/分子顺序、分隔符、平方/立方、百分比、普通文字和日期不变。新回归纳入 Web UX CI。

## PR #24 后续代码复查与本地验证

按用户要求不等待 CI，本次修复提交使用 `[skip ci]`。GitHub 列表仍显示旧任务排队，但取消接口返回“任务已完成”或“不在运行中”；没有把这种状态视为测试通过。

本轮修复：

- 显示与朗读共用分隔符扫描，保留转义美元符号和未闭合公式，移除旧 Safari 不支持的正则后行断言。
- 小数分数不再只匹配小数尾部，带分数明确读“又”；复杂、嵌套分数及连续斜杠保留原文，避免破坏数学分组。它们仍需后续补充可靠读法。
- TeX 命令边界采用 ASCII 字母规则，修复 Python 与 JavaScript 在紧接中文时可能生成不同音频地址的问题。
- 教材版本保存 PDF SHA256，即使缓存 PDF 被删除也不能沿用已变更源文件的旧大纲；复制前后核对指纹。元数据按 JSON 内容比较，避免仅格式变化时报错；拒绝大小写冲突文件名和无效版本 ID。
- 无匹配教材、空大纲、单元生成失败和教材导入失败都会向调用方报告错误，不再输出看似成功的结束状态。

本地测试结果：231 个 Core 测试、Web/Core 类型检查、Web 交互/学习质量/视觉控件及续学/复习/音频/缓存回归通过。数学测试对四科题库的 57,578 条去重字符串检查 Python 收集器与 Web 朗读归一化结果一致。`python scripts/checks/textbook-pipeline.py` 对真实 CLI dry-run、源文件变更、缓存损坏以及单元/教材失败路径做无网络集成测试（依赖既有 `openai`、`requests` 包）。

首次验证时，44 册数据导出成功、Next 生产编译成功，但缺少资源包导致 `/stories/[book]` 静态导出失败。后续已从发布附件恢复资源，完整性及重新构建的验收记录见 [PR #24 资源恢复与本地验证](pr24-resource-restoration.md)。线上验收仍需单独进行。
