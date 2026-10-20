"""Smoke-test the built site in real Chrome, with an isolated temporary profile.

Requires Python Playwright and Chrome. Serve apps/web/out with a range-capable
static server; defaults to http://127.0.0.1:8080.
"""
import argparse
import json
import re
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--origin", default="http://127.0.0.1:8080")
    parser.add_argument("--output", type=Path, default=ROOT / "deploy-output/local-smoke")
    parser.add_argument("--narration-receipts", type=Path, help="Also play three newly generated question recordings from real lesson pages")
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    origin = args.origin.rstrip("/")
    def fetch(path):
        with urllib.request.urlopen(origin + path, timeout=30) as response:
            return json.load(response)
    passages = fetch("/data/books/chinese-g2up/passages.json")["passages"]
    passage = next(p for p in passages if p["sentences"][0].get("audio"))
    stories = fetch("/data/books/chinese-g2up/stories.json")["stories"]
    story = next(s for s in stories if s.get("image"))
    audio = passage["sentences"][0]["audio"]
    assert audio.endswith(".mp3")
    request = urllib.request.Request(origin + audio, headers={"Range": "bytes=0-31"})
    with urllib.request.urlopen(request, timeout=30) as response:
        assert response.status == 206
        assert response.headers.get_content_type() == "audio/mpeg"
        assert len(response.read()) == 32
    report = {"origin": origin, "range_request": "passed", "viewports": [], "errors": []}
    new_questions = []
    if args.narration_receipts:
        generated = set()
        for receipt in args.narration_receipts.glob("receipts-*.jsonl"):
            for line in receipt.read_text(encoding="utf-8").splitlines():
                item = json.loads(line)
                if item["status"] == "generated":
                    generated.add(item["hash"])
        for file in sorted((ROOT / "apps/web/out/data/books").glob("*/lessons/*.json")):
            lesson = json.loads(file.read_text(encoding="utf-8"))
            if not lesson.get("bookId", "").startswith("g") or lesson.get("knowledge") is not None or not lesson.get("questions"):
                continue
            source = lesson["questions"][0].get("audio", {}).get("question", "")
            if Path(source).stem in generated and source not in [x[1] for x in new_questions]:
                new_questions.append((f"/lesson/{lesson['bookId']}/{lesson['id']}/", source))
                if len(new_questions) == 3:
                    break
        assert len(new_questions) == 3, "Need three built lessons referencing new question audio"
        for _, source in new_questions:
            request = urllib.request.Request(origin + source, headers={"Range": "bytes=0-31"})
            with urllib.request.urlopen(request, timeout=30) as response:
                assert response.status == 206 and response.headers.get_content_type() == "audio/mpeg"
                assert len(response.read()) == 32
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True)
        for width, height in [(390, 844), (1280, 800)]:
            context = browser.new_context(viewport={"width": width, "height": height}, reduced_motion="reduce")
            page = context.new_page()
            page.on("pageerror", lambda error: report["errors"].append(str(error)))
            page.on("response", lambda response: report["errors"].append(f"HTTP {response.status}: {response.url}") if response.status >= 400 else None)
            page.add_init_script("""(() => {
                const NativeAudio = window.Audio; window.__smokeAudio = [];
                window.Audio = function(...args) { const audio = new NativeAudio(...args); window.__smokeAudio.push(audio); return audio; };
                window.Audio.prototype = NativeAudio.prototype;
            })();""")
            page.goto(origin, wait_until="networkidle")
            page.get_by_role("button", name=re.compile("我读二年级")).click()
            page.get_by_role("button", name="继续", exact=True).click()
            page.wait_for_url("**/grade/2/", wait_until="networkidle")
            routes = ["/book/g2up/", "/lesson/g1up/g1up-u1-kp1/", "/book/g3up/guide/8/", "/reading/chinese-g2up/",
                      f"/reading/chinese-g2up/{passage['id']}/", "/stories/chinese-g2up/",
                      f"/stories/chinese-g2up/{story['id']}/", "/profile/", "/review/", "/shop/"]
            checked = []
            for route in routes:
                response = page.goto(origin + route, wait_until="networkidle")
                assert response.status == 200, route
                page.locator("main").first.wait_for(state="visible")
                dimensions = page.evaluate("({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth})")
                assert dimensions["scroll"] <= dimensions["client"] + 1, (route, dimensions)
                assert page.locator("body").inner_text().strip(), route
                if route == "/book/g3up/guide/8/":
                    page.locator(".katex").first.wait_for(state="visible")
                    page.screenshot(path=str(args.output / f"fractions-{width}.png"))
                if route.startswith("/reading/") and route.endswith(passage["id"] + "/"):
                    page.get_by_role("button", name="朗读第 1 句", exact=True).click()
                    page.wait_for_function("src => window.__smokeAudio.some(a => a.src.endsWith(src) && a.currentTime > 0)", arg=audio, timeout=20000)
                    page.screenshot(path=str(args.output / f"reading-{width}.png"))
                if route.endswith(story["id"] + "/"):
                    image = page.locator(f'img[src="{story["image"]}"]')
                    image.wait_for(state="visible")
                    assert image.evaluate("image => image.complete && image.naturalWidth > 0")
                    page.screenshot(path=str(args.output / f"story-{width}.png"))
                checked.append(route)
            for index, (route, source) in enumerate(new_questions):
                response = page.goto(origin + route, wait_until="networkidle")
                assert response.status == 200
                page.get_by_role("button", name="朗读题目", exact=True).click()
                page.wait_for_function("src => window.__smokeAudio.some(a => a.src.endsWith(src) && a.currentTime > 0 && !a.error)", arg=source, timeout=20000)
                page.screenshot(path=str(args.output / f"new-narration-{index}-{width}.png"))
                checked.append(route)
            report["viewports"].append({"width": width, "height": height, "onboarding": "passed", "sentence_playback": "passed", "new_question_playback": [source for _, source in new_questions], "routes": checked})
            context.close()
        browser.close()
    report["status"] = "failed" if report["errors"] else "passed"
    (args.output / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False))
    assert not report["errors"]


if __name__ == "__main__":
    main()
