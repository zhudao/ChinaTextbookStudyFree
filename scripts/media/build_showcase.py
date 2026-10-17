#!/usr/bin/env python3
"""Render static product posters from intact UI captures. No APIs or animation.

Requires Python 3 and Pillow; system fonts are used locally, not redistributed.
"""
from __future__ import annotations
import argparse
import functools
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
SHOTS = ROOT / "docs/screenshots/web"
POSTERS = ROOT / "docs/posters"
OUT = ROOT / "docs/showcase"
W, H = 2400, 1500
INK, MUTED = "#1d1d1f", "#6e6e73"


def find_font(candidates):
    for path in candidates:
        if Path(path).exists():
            return path
    raise SystemExit("Pass --cjk-font and --latin-font with installed font paths.")


@functools.lru_cache(maxsize=48)
def font(size, bold=False, latin=False):
    path = LATIN if latin else CJK
    index = 0 if latin or not bold or "Hiragino" not in path else 2
    return ImageFont.truetype(path, size=size, index=index)


def text(im, xy, value, size, bold=False, color=INK, anchor="lt", latin=False):
    ImageDraw.Draw(im).text(xy, value, font=font(size, bold, latin), fill=color, anchor=anchor)


def centered(im, y, value, size, bold=False, color=INK):
    text(im, (W // 2, y), value, size, bold, color, "mt")


def background(dark=False, height=H):
    im = Image.new("RGB", (W, height))
    draw = ImageDraw.Draw(im)
    a, b = ((17, 19, 22), (30, 35, 40)) if dark else ((250, 250, 251), (240, 242, 244))
    for y in range(height):
        t = y / max(1, height - 1)
        col = tuple(round(start + (end - start) * t) for start, end in zip(a, b))
        draw.line((0, y, W, y), fill=col)
    return im.convert("RGBA")


def frame(name, width=None, height=None, phone=False, dark=False):
    src = Image.open(SHOTS / name).convert("RGB")
    if height:
        width = round(src.width * height / src.height)
    else:
        height = round(src.height * width / src.width)
    inset, margin = (12, 68) if phone else (10, 68)
    outer_w, outer_h = width + 2 * inset, height + 2 * inset
    layer = Image.new("RGBA", (outer_w + margin * 2, outer_h + margin * 2))
    radius = 42 if phone else 24
    mask = Image.new("L", layer.size)
    ImageDraw.Draw(mask).rounded_rectangle((margin, margin + 18, margin + outer_w, margin + outer_h + 18), radius, fill=80 if dark else 38)
    shadow = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    shadow.putalpha(mask.filter(ImageFilter.GaussianBlur(28)))
    layer.alpha_composite(shadow)
    draw = ImageDraw.Draw(layer)
    draw.rounded_rectangle((margin, margin, margin + outer_w, margin + outer_h), radius, fill="#202226" if phone else "#ffffff", outline="#55575b" if phone else "#dfe1e5", width=2)
    screen = src.resize((width, height), Image.Resampling.LANCZOS).convert("RGBA")
    clip = Image.new("L", screen.size)
    ImageDraw.Draw(clip).rounded_rectangle((0, 0, width - 1, height - 1), max(8, radius - inset), fill=255)
    screen.putalpha(clip)
    layer.alpha_composite(screen, (margin + inset, margin + inset))
    return layer


def display(im, name, x, y, width=None, height=None, phone=False, dark=False):
    # Coordinates locate the visible frame; extra room around it is shadow only.
    layer = frame(name, width, height, phone, dark)
    im.alpha_composite(layer, (x - 68, y - 68))


def footer(im, dark=False):
    color = "#8c929b" if dark else "#777d84"
    text(im, (140, im.height - 70), "聪聪学堂", 24, color=color)
    text(im, (W - 140, im.height - 70), "WEB 修复分支预览 / 2026.10", 22, color=color, anchor="rt")


def save(im, name):
    im.convert("RGB").save(POSTERS / name, optimize=True)


def hero():
    im = background()
    text(im, (140, 122), "CHINASTUDYFREE", 27, latin=True)
    text(im, (135, 360), "学习，", 140, True)
    text(im, (135, 540), "从好奇心开始。", 140, True)
    text(im, (143, 810), "小学全科。免费，开源。", 45, color=MUTED)
    text(im, (145, 950), "互动练习    ·    逐句听读    ·    自主探索", 29, color=MUTED)
    display(im, "04-counting.jpg", 1285, 230, height=1040, phone=True)
    display(im, "05-feedback.jpg", 1840, 405, height=890, phone=True)
    footer(im)
    save(im, "hero.png")


def learning():
    im = background(height=1600)
    centered(im, 115, "从第一步，到小小的进步。", 100, True)
    centered(im, 280, "选年级，动手数，再看懂每一次反馈。", 38, color=MUTED)
    specs = [("01-onboarding.jpg", 420, "找到起点"), ("04-counting.jpg", 985, "亲手探索"), ("05-feedback.jpg", 1550, "看懂为什么")]
    for name, x, caption in specs:
        display(im, name, x, 420, height=960, phone=True)
        text(im, (x + 233, 1430), caption, 35, True, anchor="mt")
    footer(im)
    save(im, "learning.png")


def reading():
    im = background(True)
    centered(im, 125, "把课文，读进心里。", 110, True, "#f5f5f7")
    centered(im, 295, "课本原页。逐句听读。", 38, color="#a1a1a6")
    display(im, "06-reading.jpg", 150, 490, width=1550, dark=True)
    display(im, "06-reading-mobile.jpg", 1845, 485, height=820, phone=True, dark=True)
    footer(im, True)
    save(im, "reading.png")


def explore():
    im = background()
    centered(im, 125, "好奇心，不止于课堂。", 110, True)
    centered(im, 295, "读一个故事，给聪聪换一种模样。", 38, color=MUTED)
    display(im, "08-story-reader.jpg", 150, 500, width=995)
    display(im, "09-wardrobe.jpg", 1255, 500, width=995)
    text(im, (150, 1175), "在故事里，发现新世界。", 42, True)
    text(im, (1255, 1175), "努力，也有自己的模样。", 42, True)
    text(im, (152, 1265), "插画故事与阅读理解", 29, color=MUTED)
    text(im, (1257, 1265), "用学习获得的宝石，给聪聪换装", 29, color=MUTED)
    footer(im)
    save(im, "explore.png")


def write_manifest():
    files = sorted([*POSTERS.glob("*.png"), *SHOTS.glob("*.jpg")])
    records = []
    for path in files:
        with Image.open(path) as image:
            pixels = [image.width, image.height]
        records.append({"path": str(path.relative_to(ROOT)), "bytes": path.stat().st_size,
                        "pixels": pixels, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
    data = {"date": "2026-10-15", "format": "static product posters and intact browser screenshots",
            "branch": "codex/ux-quality-repairs", "screenshot_base_commit": "acde104e22321d4e0f84764fc62fd158a324a05f",
            "release_state": "unmerged; not deployed", "css_viewports": {"desktop": [1280,720], "mobile": [390,844]},
            "notes": ["Poster typography and framing are editorial; UI content is not altered.",
                      "Original capture pixels are listed individually; some exclude page edges.",
                      "Mobile images are browser simulations; iOS images remain separately labeled historical material."],
            "files": records}
    (OUT / "capture-manifest.json").write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")


def main():
    global CJK, LATIN
    parser = argparse.ArgumentParser()
    parser.add_argument("--cjk-font")
    parser.add_argument("--latin-font")
    args = parser.parse_args()
    CJK = args.cjk_font or find_font(["/System/Library/Fonts/Hiragino Sans GB.ttc", "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"])
    LATIN = args.latin_font or find_font(["/System/Library/Fonts/Avenir Next.ttc", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"])
    POSTERS.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    hero(); learning(); reading(); explore(); write_manifest()
    print("Created four static PNG posters and capture manifest.")


if __name__ == "__main__":
    main()
