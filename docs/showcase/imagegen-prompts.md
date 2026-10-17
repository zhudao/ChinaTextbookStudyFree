# 品牌视觉生成记录

日期：2026-10-16。使用 Codex 内置 imagegen；未使用 CLI/API Key 工作流。

这些是以项目熊猫图标与截图为参考生成的品牌概念图，不是产品界面截图。原始 UI 截图保留在 `docs/screenshots/web/`。画面采用浅色摄影棚、统一的立体熊猫、克制中文排版。

| 成品 | 参考 |
| --- | --- |
| `docs/visuals/hero.png` | 项目 `apps/web/public/icons/icon-512.png`、`04-counting.jpg`；初稿后仅调整字重与断行 |

截图路径相对于 `docs/screenshots/web/`。主视觉为品牌概念图；三张设备功能海报的最终提示词另见 [功能海报生成记录](feature-prompts.md)。早期学习、听读和探索的熊猫场景已由功能海报替换。

## 主视觉 · 初稿

```text
Use case: ads-marketing.
Create one finished premium minimalist brand campaign image for the Chinese free open-source primary-school learning app 聪聪学堂. This is a newly generated brand illustration inspired by the references, not an app screenshot or a collage of screenshots.
Input image 1 is the identity reference: the project's original panda mascot icon. Preserve its recognizable round white face, small black ears, long oval black eye patches, big friendly round eyes and small nose/mouth; interpret it as a beautifully crafted soft matte 3D character, not a realistic animal.
Input image 2 is a subject and palette reference only: the counting activity, exactly three red apples, soft green accents and warm welcoming educational mood. Do not reproduce its UI or words.
Art direction: exceptional industrial-design campaign photography of a small sculptural scene. Seamless warm-white/light pale gray studio cyclorama with a barely visible sage tint, abundant clean negative space, refined soft daylight, realistic contact shadows, subtle depth, smooth matte porcelain-like materials with delicate tactile detail. A lovable full-body panda sits beside a simple open book and exactly three beautifully modeled red apples. A tiny fresh green book binding accent ties to the existing brand. Deliberate restrained composition, no toy clutter. Panda and objects occupy the right half and lower right; the left half has editorial typography, aligned cleanly. All objects fully inside safe margins.
Typography, exact Chinese copy only:
"聪聪学堂" as the brand title
"学习，从好奇心开始。" as the main elegant headline, may wrap across two lines
"小学全科 · 免费开源" as one discreet smaller line.
Use dark charcoal clean contemporary Chinese sans serif, sophisticated hierarchy, moderate weight, ample line spacing and generous whitespace. No English anywhere.
Avoid: screens, phones, tablets, browsers, UI panels, fake buttons, screenshot rectangles, heavy borders, gradients with visible bands, neon, particles, confetti, bubbles, extra slogans, dates, engineering status, PR numbers, watermarks, logos from other companies, photorealistic fur. The look should feel like a world-class calm and confident product launch visual, not a busy children's advertisement.
Single landscape composition, approximately 16:10, high-resolution and publication-ready.
```

## 主视觉 · 排版精修

```text
Refine the attached campaign image with ONE targeted change: redesign only its typography to be calmer and more refined. Preserve the generated panda, exact three physical red apples, book, lighting, background, materials, scene and their positions. Do not redraw any UI.
The current text is too bold and large. Use a regular-weight elegant contemporary Chinese sans-serif, not heavy black. Treat the brand name "聪聪学堂" as a small discreet wordmark near the upper left, not the largest text. Main headline below it, with exactly these two lines:
"学习，"
"从好奇心开始。"
The second line must remain entirely on one line; reduce its font size to fit the left column with generous breathing room before the panda. Main headline medium-large, charcoal. Small supporting line below: "小学全科 · 免费开源". Clear hierarchy, restrained typography, airy line spacing, abundant clean white space. No extra text and no English. Premium minimalist product-launch quality. Keep the scene and image dimensions unchanged.
```

