# 聪聪学堂 · 产品视觉

README 使用一张品牌主视觉与三张功能海报。功能海报以产品截图为参考，通过内置 imagegen 生成手机、平板与笔记本展示场景，统一浅色背景、柔和光线与简约中文排版。

| 素材 | 尺寸 | 内容 |
| --- | --- | --- |
| [品牌横幅](../banner.svg) | 1600×500 · SVG | 聪聪学堂与熊猫聪聪 |
| [品牌主视觉](../visuals/hero.png) | 1586×992 · PNG | 学习，从好奇心开始 |
| [互动练习](../visuals/feature-learning.png) | 1586×992 · PNG | 双 iPhone：点数、反馈、保存进度 |
| [课文听读](../visuals/feature-reading.png) | 1586×992 · PNG | 平板与手机：原页对照、听全文、跟读 |
| [故事与衣橱](../visuals/feature-explore.png) | 1586×992 · PNG | 笔记本与平板：故事阅读、阅读理解、装扮 |

## 查看

[静态画廊](../web-showcase.html) 可在本地打开并放大图片；也可在仓库根目录运行：

```sh
python3 scripts/media/preview_showcase.py
```

访问 `http://127.0.0.1:3037/web-showcase.html`。支持键盘打开图片、Esc关闭并返回原焦点。

## 生成与来源

2026-10-16 使用 Codex 内置 imagegen 生成，输出原生1586×992 PNG，没有放大或裁切。主视觉提示词见 [品牌生成记录](imagegen-prompts.md)，三张设备海报的提示词与截图映射见 [功能生成记录](feature-prompts.md)。新的功能图应以 `feature-learning.png` 作为设备、光线与排版风格参考。

功能海报是设备展示效果图，屏幕内容有生成重绘，不是原始截图，也不构成真机运行、验收或原生App支持的证据。真实UI以 [原始截图](../screenshots/web/) 和实际产品为准。截图采集于2026-10-15的 `codex/ux-quality-repairs` 本地生产构建，手机画面为浏览器视口模拟；iOS历史截图另行标记。UX修复状态见 [PR #13](https://github.com/wuwangzhang1216/ChinaTextbookStudyFree/pull/13)。

横幅直接编辑 `docs/banner.svg`，复用项目现有熊猫图标。全部素材的像素尺寸、长度与SHA256见 [素材清单](capture-manifest.json)。
