# PR #24：资源恢复与本地验证

日期：2026-10-19。使用当前 PR 的代码和 `output/` 题库构建，不覆盖源码、不合并发布快照中的题库。按用户要求跳过 GitHub CI。

后续更新：本文保留资源恢复阶段的历史验收记录。下文的 4,495 条缺口和 RealRouter 超时已在后续补生成中解决；当前清单 76,987 条全部存在，新生成且仍被引用的 4,490 条源音频 SHA256 核验通过。最新构建与测试结果见 [朗读补齐记录](pr24-narration-completion.md)。

## 已恢复资源

来源：[v1.4.0-content](https://github.com/wuwangzhang1216/ChinaTextbookStudyFree/releases/tag/v1.4.0-content)。六个运行资源包合计 4,329,611,811 字节。下载包的大小与 SHA256 匹配 manifest；发布的 SHA256SUMS 与 manifest 的全部八个条目一致。安装后另逐文件比较源归档与磁盘内容的 SHA256：

| 包 | 已核验文件数 |
| --- | ---: |
| audio.tar.gz | 84,376 |
| audio-web-mp3.tar.gz | 55,297 |
| data.zip | 2,441 |
| data-source.zip | 40 |
| story-images.zip | 472 |
| textbook-pages.zip | 1,582 |
| 合计 | 144,208 |

全部匹配，0 错误。没有安装 `web-source.zip` 或 `web-app.zip`；它们是不同源码快照的交付物，不能替代当前 PR 的完整构建。`data.zip` 仅用于验证安装，构建会从当前 `output/` 和已恢复的课文/故事源数据重新导出。

原始归档保留在 `release-assets/v1.4.0-content/`，详细本地证据位于 `deploy-output/release-integrity.json`。这些大文件和生成物不进入 Git。

## 修复的构建问题

- 安装器现在也校验和安装发布包内的可选 `audio-web-mp3.tar.gz`，仍兼容没有此附件的旧版发布。
- npm 构建在 Windows 使用实际的 `python`，避开无效的 Microsoft Store `python3` 别名；其他平台仍用 `python3`，可通过 `PYTHON` 指定解释器。Docker 同步复制启动脚本。
- 音频临时文件改用可写句柄执行 fsync，修复 Windows 的 `Bad file descriptor`。15 个真实音频转换、缓存和失败保护场景通过。
- 媒体检查经由 Node 运行 tsx，不再直接执行 Unix shell 启动文件。
- 全站 HTML 链接扫描显式使用 UTF-8，并发读取 16 个页面，避免 Windows 上逐文件等待；嵌套路由、URL 编码路径及缺失图片的正反例通过。

## 可复现步骤

```sh
python scripts/install-release.py --tag v1.4.0-content --archives-dir release-assets/v1.4.0-content
python scripts/checks/release-assets.py --archives-dir release-assets/v1.4.0-content
python scripts/checks/release-installer.py
python scripts/checks/web-audio-compat.py --self-test
npm run build
python scripts/checks/site-integrity.py
python scripts/checks/web-audio-compat.py --decode-samples 24
python scripts/checks/site-navigation.py apps/web/out --report deploy-output/site-navigation.json
```

逐文件归档核验应在构建前运行：构建会重生成 JSON 和平台兼容音频，之后它们不必与发布包的旧输出逐字节相同。

浏览器检查需要 Python Playwright 和本机 Chrome，使用临时浏览器配置，不读取个人浏览器数据：

```sh
npx --yes http-server apps/web/out -a 127.0.0.1 -p 18824 -c-1 --no-dotfiles
python scripts/checks/local-web.py --origin http://127.0.0.1:18824
```

## 恢复阶段的新增朗读缺口（历史记录）

当前 TTS 清单有 77,003 条去重文本，其中 4,495 条没有对应源音频，主要是 PR 公式修正后产生的新地址：数学 4,477、语文 9、英语 8、科学 1。这不代表上述发布包缺文件。缺失字段不会注入旧的错误音频地址，也不将无声播放记作听读完成。

用户授权后，已为 RealRouter 创建独立 `.local/tts-venv`、安装其固定版本 aiortc 依赖、配置 Python 与原生 Codex 可执行文件并重启服务；原配置已备份。健康检查返回 200。还修复了语音桥先删除临时工作目录、后终止子进程导致的 Windows 文件占用错误，修改保留在 RealRouter 工作区，不混入本 PR。

后续实际语音测试已能建立会话并接收文本，但等待生成完成事件超时；不能据此启动 4,495 条批量生成。`appendSpeech` 与独立 `appendText` 诊断均未完成语音输出，保留严格的朗读文本匹配校验。API Key 只在内存读取，未写入本仓库或测试报告。新增朗读尚未生成或听审。该问题与已完整恢复的发布附件分开记录。

## 本地验收结果

- `npm run build` 成功退出：生产编译、类型检查、3,903 个静态页面生成及导出全部完成。
- 音频构建转换并校验 63,438 个文件，无失败；兼容性检查覆盖 75,103 个引用、63,438 个独立资源，24 个 FFmpeg 实际解码样本全部通过。
- 站点完整性检查：44 册、2,166 课、6,836 道基础课题、779 篇课文、284 篇故事，资源及预期路由错误为 0。
- 全站导航扫描：3,900 个 HTML 文件、5,151 处本地链接/图片引用、2,166 个独立目标，缺失为 0（Next 的 3,903 个静态生成条目还包括非 HTML 路由）。
- Chrome 实测两种窗口（390×844、1280×800），每种检查 10 条页面路径，年级选择、分数公式显示、故事配图、课文点击播放均通过；播放验证实际音频时间推进，HTTP Range 返回 206，无页面异常、HTTP 错误或横向溢出。
- Core 231 个测试及 web-experience、learning-quality、visual-controls 回归检查通过。数学朗读 Python/Web 的 57,578 条文本对照通过，音频构建 15 个真实编解码/缓存/失败保护场景通过，资源安装的新旧格式及损坏包预检通过。
- RealRouter 修复后 HTTP 语音复测用时 91.3 秒，仍返回 502，服务日志为 `TimeoutError`。服务健康接口正常，新音频补生成受此阻塞。

详细证据保存在 `deploy-output/full-build.log`、`qa-site-integrity.json`、`web-audio-compat-report.json`、`local-smoke/report.json` 和 `realrouter-speech-smoke.json`。浏览器截图在 `deploy-output/local-smoke/`。本地预览地址为 `http://127.0.0.1:18824`。

资源文件及技术检查通过不代表教材内容已人工审核。既有内容检查另报告 1,474 课无知识讲解、1,174 课仅一题、109 个含控制字符字段、58 个原始 LaTeX 字段；这些计数及示例保留在完整性报告中，未将它们记为已修复。新版教材和五四制的范围仍以先前记录为准。
