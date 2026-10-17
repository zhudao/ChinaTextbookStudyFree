# UX 修复分支的资源安装

这一分支修改了题目文本，新增了内容地址音频。按用户2026-10-16的决定，额外音频补齐与公开发布后置，不消耗额外credit，也不作为本轮合并门槛。可继续使用已有基础音频；缺失的修订朗读不回退播放旧题音频。旧 `data.zip` 不能覆盖新的构建输出。

## 暂不补充音频的构建

先安装已有基础资源，再重新生成数据；导出脚本只给实际存在且文本哈希匹配的音频添加引用，缺失字段不生成朗读按钮。以下步骤不调用内容/语音生成API：

```sh
npm ci
bash scripts/download-assets.sh v1.2.0-assets
(cd apps/web && npx tsx scripts/build-data.ts)
npm exec --workspace=china-study-free -- next build
```

有本地补充音频时可继续使用，不要求删除。题目判分、续学与回心不依赖新增朗读；课前讲解保留跳过/无音频继续入口。听读/跟读功能仍需要其原有基础媒体，不能将无声播放计为听读完成。

## 可选：安装已保存的补充包

在仓库根目录运行：

```sh
npm ci
bash scripts/download-assets.sh v1.2.0-assets
gh release download v1.3.0-ux-content --repo wuwangzhang1216/ChinaTextbookStudyFree --pattern ux-content-audio.tar.gz --dir deploy-output
python3 - <<'PY'
import hashlib, json, pathlib
manifest = json.loads(pathlib.Path('docs/ux-content-assets.json').read_text())
bundle = pathlib.Path('deploy-output') / manifest['bundle']
assert bundle.stat().st_size == manifest['bytes']
assert hashlib.sha256(bundle.read_bytes()).hexdigest() == manifest['sha256']
print('音频补充包 SHA256 与长度通过')
PY
tar -xzf deploy-output/ux-content-audio.tar.gz -C apps/web/public
npm run build
npx tsx scripts/check-lesson-revisions.ts
npx tsx scripts/checks/ux-content.ts
python3 scripts/checks/site-integrity.py --public apps/web/public --site apps/web/out --report deploy-output/ux-site-integrity.json
```

`v1.3.0-ux-content` 当前是草稿release，需要有仓库权限并登录 `gh` 才能下载。此包公开发布已后置，不阻塞本轮代码合并；恢复完整音频交付时再发布并验证无认证下载。离线安装可使用本地 `deploy-output/ux-content-audio.tar.gz`，同样先核对提交的manifest。

需要FFmpeg。`npm run build` 会先按新文本生成JSON并验证/转换MP3，再生成静态站点。完整音频交付应运行下面的媒体校验；暂不补齐模式允许缺少新增朗读，仍需核验既有媒体可用，不能将其记为完整音频验收。

## 来源与范围

- `docs/lesson-reviews/` 保存137课模型复核、内容指纹与待完成的教师审核状态；新增297题。
- `docs/ux-content-corrections.json` 保存10道确定性题库修正的前后记录（其中1道是新扩充的概率题）。22段新增朗读来自已安装的macOS Tingting，拼音选项按对应音节生成；详见 `ux-repair-evidence/tts-repairs.json`，需教师听审。
- `docs/ux-content-assets.json` 保存补充包及每个Opus/MP3文件的长度与SHA256。
- 在数据与音频生成后运行 `python3 scripts/bundle-ux-content-assets.py` 可重新打包这些课涉及的全部朗读；不调用付费生成API。
- 本补充包包含已复核修订及10道题库修正涉及的全部音频。其余题库、课文和故事仍依赖基础资源包。
