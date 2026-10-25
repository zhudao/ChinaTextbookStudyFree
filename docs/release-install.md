# v1.5.0 五册修订教材与完整材料包：安装与升级

本版更新二上语文、三上数学/语文/英语/科学五册，使用独立 2026 版 ID，保留全部旧版及原有成绩。包含全部现有及新版音频、MP3、题库、页面、故事配图、课本原页和匹配源码。新增五册共 150 课时、1,110 道题、118 篇/组朗读；新增音频使用 Tingting/Samantha，既有音频保留。无需先安装任何旧版本，也不需要 AI API Key。音频分为多个独立 ZIP，每个不超过 1.4 GB（十进制）；所有分包都需要安装，不需要拼接文件。

## 最快使用：安装现成网站

只需 Python 3.9+，无需 Node.js 或 FFmpeg。在 [Release](https://github.com/wuwangzhang1216/ChinaTextbookStudyFree/releases/tag/v1.5.0-five-textbooks) 下载 `install-release.py`，执行：

```sh
python3 install-release.py --tag v1.5.0-five-textbooks --mode static --root ChinaStudyFree-site
python3 -m http.server 8080 --directory ChinaStudyFree-site
```

打开 http://localhost:8080/。Windows 将 `python3` 换成 `py -3`。这是 HTTP 本地预览；正式托管时使用支持 MP3 和 HTTP Range 的静态服务器（例如 Nginx 或对象存储/CDN），跟读录音需要 HTTPS 或 localhost。

安装器会下载、验证完整附件的 SHA-256，再在临时目录解压并逐文件核验后安装。资源较大，请为下载、安装前的暂存、现有站点和备份预留充足空间，建议至少 40 GB。安装期间保持现有服务停止，安装完成后再启动。

## 已有旧版：原目录升级

先备份自定义文件或数据，并从新版 Release 下载新版安装器。不要用旧安装器安装新版分包。

```sh
python3 install-release.py --tag v1.5.0-five-textbooks --mode static --root /path/to/existing-site
```

此命令覆盖已有页面、配套数据、音频和缓存文件，包括旧 GPT 音频的同名兼容文件；不会因音频目录已存在而跳过更新。未包含在材料包中的自定义文件会保留，旧版遗留文件也不会自动删除。浏览器学习记录保存在原来的浏览器存储中；继续使用相同域名、协议和端口可以保留该存储。

如果是源码部署，先备份本地代码修改；希望安装本版匹配源码与所有资源时执行：

```sh
python3 install-release.py --tag v1.5.0-five-textbooks --with-source --root /path/to/ChinaTextbookStudyFree
cd /path/to/ChinaTextbookStudyFree
npm ci
npm run build
```

`--with-source` 会更新材料包中的源码文件。只更新已检出配套版本的资源时，省略这个参数。重新部署 `apps/web/out/`，刷新原站点 CDN 缓存，并重新打开页面，使新服务工作线程和音频版本地址生效。

## 全新源码安装

需要 Node.js 20+、Python 3.9+、带 libmp3lame 的 FFmpeg（均加入 PATH）：

```sh
python3 install-release.py --tag v1.5.0-five-textbooks --with-source --root ChinaTextbookStudyFree
cd ChinaTextbookStudyFree
npm ci
npm run build
python3 -m http.server 8080 --directory apps/web/out
```

`web-source.zip` 同时提供匹配源码，可单独解压到新目录；ZIP 内直接是仓库文件，没有额外顶层目录。源码构建复用包内音频和已校验的转换缓存，不调用在线 TTS。构建会再次检查音频；缓存不匹配时重新转换，而不是信任旧音频。生成数据会应用已验证的版本化音频地址，避免浏览器复用旧 GPT 语音。

## 离线安装与完整校验

在 Release 页面下载全部附件至同一目录。安装器按模式选择所需包；`manifest.json` 和 `files.jsonl` 必不可少。

```sh
python3 install-release.py --tag v1.5.0-five-textbooks --mode static --root ChinaStudyFree-site --archives-dir /path/to/downloads
python3 install-release.py --tag v1.5.0-five-textbooks --mode static --root ChinaStudyFree-site --archives-dir /path/to/downloads --verify-only
```

源码目录校验使用 `--root /path/to/source`，省略 `--mode static`；如果安装过完整源码，同时加上 `--with-source`。

macOS/Linux 可额外验证所有下载附件：

```sh
shasum -a 256 -c SHA256SUMS
```

`--verify-only` 只检查，不修改文件。任意分包缺失、校验和不符、归档内容不符、安装路径被符号链接指向外部时，安装器明确失败，不会跳过问题继续宣告成功。

## 附件对应关系

| 附件 | 内容与用途 |
| --- | --- |
| `audio-original-partNN.zip` | 原音频路径的兼容资源；每个 ZIP 含 `audio/` 顶层目录。历史 `.opus` 扩展名下可能是 Ogg/Opus 或 MP3，以实际内容为准 |
| `audio-web-partNN.zip` | 浏览器 MP3，包括本轮新音频和用于刷新缓存的版本化文件名 |
| `data.zip` | 当前线上配套 JSON；手动解压到站点 `data/` |
| `web-app.zip` | 当前线上页面、界面资源和服务工作线程；手动解压到站点根目录 |
| `story-images.zip` / `textbook-pages.zip` | 手动解压到站点同名目录 |
| `data-source.zip` | 课文和故事源 JSON；源码安装使用 |
| `web-audio-cache.zip` | 可携带到新目录的已验证转换缓存；源码安装使用 |
| `web-source.zip` | 对应本版的源码、构建输入、README、安装器及脚本 |
| `manifest.json` | 附件大小、SHA-256、安装位置、实际材料规模和源码提交 |
| `files.jsonl` | 每个归档成员的路径、大小、SHA-256，供安装与审计 |
| `SHA256SUMS` | 所有发布附件的校验和 |
| `VALIDATION.json` | 本轮全新安装、旧版升级、构建与播放验证结果 |

手动安装静态站点时，将全部音频 ZIP 解压到站点根目录，再按表中位置解压数据、页面和图片。安装器可以自动完成这些步骤及全部校验。

本包保留 6 册旧版教材路由以兼容既有进度：总计 50 册版本，当前展示 44 册。包含 2,537 个常规课节、320 个单元挑战，常规题 16,203 道、挑战题 4,485 道。技术完整性与播放验证不代表全部内容已经教师逐题听审。本次另提供全部 50 册的 iOS 专用 AAC/M4A 数据及音频包，配套 ios-manifest.json；旧版下载地址和学习记录继续保留。

## 题库保留与升级验收

本版恢复原补齐版 2,356 课、15,117 题，保留新增 2026 秋版数学、视觉数感示范和多孩子档案。原数感题移至三节巩固练习，旧错题仍能复习。合计 2,537 节常规课、16,203 题；每课有讲解且至少六题。

安装完整源码并构建后可运行以下只读检查；静态网站把 `--public` 改成站点根目录，同时提供材料包中的基线文件路径：

```sh
python3 scripts/checks/content-retention.py --public apps/web/out
```

检查逐课比对已发布题库的课程 ID、题目 ID、内容指纹与讲解，不以总题数增加代替原题保留。构建、打包和部署都会运行该检查。教师签审仍待完成。Docker 全新部署和原项目升级命令见 [Docker 说明](https://github.com/wuwangzhang1216/ChinaTextbookStudyFree/blob/main/docs/docker.md)。

## 五册修订版的成绩兼容

旧版仍可从教材切换菜单进入，已选旧版时重新打开首页也保留该选择。新版课时、宝箱和朗读使用独立 ID，原成绩不会算入新版，也不会被清除。Web 更新只轮换页面及教材缓存，不访问或清空 localStorage/IndexedDB。

材料与验证范围见 [五册教材验证](issue-36-37-update-validation-2026-10-24.md)。线上发布验收另见 [发布报告](five-textbooks-release-2026-10-24.md)。
