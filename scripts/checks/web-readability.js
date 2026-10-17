/** Read-only rendered-text contrast probe. Gradients/images and fading content require visual review. */
(() => {
  const parse = value => {
    const n = value.match(/[\d.]+/g)?.map(Number);
    return n && n.length >= 3 ? [n[0], n[1], n[2], n[3] ?? 1] : null;
  };
  const blend = (front, back) => front.slice(0, 3).map((c, i) => c * front[3] + back[i] * (1 - front[3])).concat(1);
  const lum = rgb => rgb.slice(0, 3).map(c => c / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4).reduce((s, c, i) => s + c * [.2126, .7152, .0722][i], 0);
  const failures = [], skipped = [];
  let checked = 0;
  for (const element of document.querySelectorAll('body *')) {
    const text = Array.from(element.childNodes).filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent).join('').trim();
    if (!text || element.closest('svg,script,style,nextjs-portal,[inert],[aria-hidden="true"]')) continue;
    const r = element.getBoundingClientRect(), style = getComputedStyle(element);
    if (!r.width || !r.height || style.visibility !== 'visible') continue;
    if (element.closest(':disabled,[aria-disabled="true"]')) continue;
    const layers = []; let skip = false;
    for (let node = element; node; node = node.parentElement) {
      const s = getComputedStyle(node);
      if (Number(s.opacity) < .99 || s.backgroundImage !== 'none' || s.filter !== 'none') { skip = true; break; }
      const color = parse(s.backgroundColor); if (color) layers.unshift(color);
    }
    if (skip) { skipped.push(text.slice(0, 60)); continue; }
    let bg = [255, 255, 255, 1]; for (const color of layers) bg = blend(color, bg);
    const fg = parse(style.color); if (!fg) continue;
    const a = lum(blend(fg, bg)), b = lum(bg), ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    const large = Number.parseFloat(style.fontSize) >= 24 || (Number.parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700);
    const minimum = large ? 3 : 4.5; checked++;
    if (ratio + .01 < minimum) failures.push({text: text.slice(0, 90), ratio: +ratio.toFixed(2), minimum, color: style.color, bg, fontSize: style.fontSize, className: element.className});
  }
  return {route: location.pathname + location.search, width: innerWidth, dark: document.documentElement.classList.contains('theme-dark'), checked, failures, skipped};
})()
