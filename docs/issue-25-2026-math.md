# #25：二年级上册数学 2026 秋版

基于最新 `origin/main` 278aa81 实现，与 #26 的多孩子档案分别提交。

## 内容与来源

以国家中小学智慧教育平台当前人教版教材的目录图片核对，资源记录更新时间为 2026-08-18。来源 URL 与已核对图片的 SHA256 见 `issue-25-textbook-source.json`。旧静态详情 JSON 仍指向 2022 版，不用于本次目录确认。Issue 中的百度分享因浏览器安全策略无法访问，未绕过限制；使用官方公开目录和预览图替代核验。

按顺序提供：分类与整理、1～6 的表内乘法、1～6 的表内除法、校园小导游、厘米和米、身体上的尺子、7～9 的表内乘除法、复习与关联。共 6 个教学单元、2 个实践主题、28 节小课和 168 道自编配套练习，每课 6 题并包含知识讲解。配套练习和讲解并非原书题目转录。

## 兼容行为

- 新版使用 `g2up-2026`，年级入口和首页优先进入新版；原 `g2up` 路由、题库和成绩保留，旧版页面提供新版入口。
- 课程、宝箱、错题和未完成会话的 ID 与旧版隔离，不把旧课完成情况当作新课成绩。
- 实践主题保留独立标签，第四至第六单元不因活动插入而重新编号。跳级按实际课程顺序选前置题库，包含前面的实践主题，排除后面的主题。
- `Outline.edition` 是前端构建用的稳定后缀，`editionLabel` 用于显示，`supersedes` 表示被替代教材。与 `scripts/quiz/editions.py` 的 PDF 导入来源清单是不同层次的数据。
- 新版源文件均独立新增，没有覆盖工作区原有的题库修订。

## 音频与复现

新内容的独立朗读文本共 615 条。使用已存在的音频缓存，其余在本机通过 macOS Tingting 生成 Opus 和 MP3，没有调用外部生成 API。Python 和 Web 共用 `math_speech` 规则，保持音频哈希一致。

```sh
python3 scripts/tts/local_say.py --pattern '*2026秋版*.json'
npm run build
```

以上语音命令需要 macOS 的 `say` 和 FFmpeg；其他系统可使用项目既有的语音生成流程。新增二进制音频位于被 Git 忽略的 `apps/web/public/audio/`，生产导出已包含这些文件；发布时应随资源或静态站点一同分发。

为验证当前主线，已恢复 v1.4.0 基础音频和校验通过的 v1.4.1 朗读补充包；全部安装只作用于独立工作区。

## 验证

- Web/Core 类型检查、231 个 Core 测试、web-experience、learning-quality、visual-controls 回归通过。
- `scripts/checks/learner-profiles.ts` 和 `scripts/checks/textbook-editions.ts` 通过；后者覆盖官方章节顺序、活动标签、168 道题实际评分、旧链接、课程/宝箱 ID 隔离及实践主题的跳级顺序。
- 58,178 条语料的 Python/Web 朗读身份一致；77,548 条源朗读零缺失。
- 完整 `npm run build` 退出码为 0；3,940 个静态生成条目完成。
- 3,937 个 HTML、5,161 处链接/图片引用检查，缺失 0；站点完整性错误 0。
- 79,488 处音频引用、67,631 个 MP3 检查通过；24 个实际解码样本（含本次新教材题干）通过。新增题干、选项、解析、知识卡音频全部存在，实际 HTTP Range 返回 206 / audio/mpeg。
- 浏览器在最新熊猫版生产页面检查多档案、年级入口、学习路径、教材版本及实践活动顺序；新知识讲解音频实际进入播放状态，首题判分正确，刷新后保持已判分状态和 10 XP。

本地证据：`deploy-output/issues-26-25-build.log`、`qa-site-integrity.json`、`issue-26-25-navigation.json`、`narration-coverage-final.json` 和 `web-audio-compat-report.json`。尚未部署到线上或关闭 GitHub issue。
