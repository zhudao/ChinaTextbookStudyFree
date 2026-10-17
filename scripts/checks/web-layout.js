/** Read-only browser assertions. Evaluate this expression through the browser tool
 * on /shop/, /league/ and /book/:book/ after the page has loaded, at each viewport.
 * It checks rendered geometry and visible duplication, not CSS class names.
 */
(() => {
  const visible = element => {
    const box = element.getBoundingClientRect();
    return box.width > 0 && box.height > 0 && getComputedStyle(element).visibility !== "hidden";
  };
  const failures = [];
  const metrics = {
    route: location.pathname,
    viewport: innerWidth,
    contentWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  };
  const check = (condition, message) => { if (!condition) failures.push(message); };
  check(metrics.scrollWidth <= metrics.contentWidth, "Page has horizontal overflow");
  for (const label of ["红心", "连胜详情"]) {
    const count = Array.from(document.querySelectorAll(`button[aria-label="${label}"]`)).filter(visible).length;
    metrics[label] = count;
    check(count <= 1, `Duplicate visible ${label} controls: ${count}`);
  }
  for (const rail of document.querySelectorAll("aside")) {
    if (visible(rail)) check(rail.scrollWidth <= rail.clientWidth, "Sidebar has horizontal overflow");
  }
  if (location.pathname.startsWith("/shop")) {
    // The fallback also finds the original 72px thumbnail buttons for before/after comparison.
    const cards = Array.from(document.querySelectorAll("[data-shop-card]"));
    if (!cards.length) cards.push(...Array.from(document.querySelectorAll("button")).filter(e => e.querySelector('svg[width="72"]')));
    metrics.cards = cards.length;
    metrics.minimumCardWidth = Math.min(...cards.map(e => e.getBoundingClientRect().width));
    check(cards.length > 0, "Shop cards are missing");
    check(metrics.minimumCardWidth >= 128, "Shop cards are too narrow to read");
    const names = document.querySelectorAll("[data-shop-name], [data-shop-card] .truncate, button .truncate");
    metrics.clippedNames = Array.from(names).filter(e => e.scrollWidth > e.clientWidth).length;
    check(metrics.clippedNames === 0, "Shop names are clipped");
    const preview = document.querySelector(".shop-preview");
    const grid = document.querySelector("[data-shop-grid]");
    if (preview && grid) {
      const a = preview.getBoundingClientRect(), b = grid.getBoundingClientRect();
      metrics.stickyPreview = getComputedStyle(preview).position === "sticky";
      metrics.sideBySide = b.left >= a.right - 1;
      check(!metrics.stickyPreview || metrics.sideBySide, "Sticky preview is enabled in a single column");
      check(metrics.sideBySide || b.top >= a.bottom, "Shop preview overlaps the catalog");
    }
  }
  if (location.pathname.startsWith("/league")) {
    const prompts = document.querySelectorAll('h2, a[aria-label="解锁排行榜"]');
    metrics.lockedPrompts = Array.from(prompts).filter(e => visible(e) && e.textContent.includes("解锁排行榜")).length;
    check(metrics.lockedPrompts <= 1, "Leaderboard unlock prompt is duplicated");
  }
  if (location.pathname.startsWith("/book/")) {
    const entries = Array.from(document.querySelectorAll("[data-path-entry]"));
    metrics.pathEntries = entries.length;
    check(entries.length > 0, "Path has not loaded");
    metrics.minimumLabelGap = null;
    entries.forEach((entry, index) => {
      const label = entry.querySelector("[data-path-label]");
      if (!label) return;
      check(label.scrollWidth <= label.clientWidth, "Path label has horizontal overflow");
      if (!entries[index + 1]) return;
      const next = entries[index + 1].getBoundingClientRect();
      const gap = next.top - label.getBoundingClientRect().bottom;
      metrics.minimumLabelGap = metrics.minimumLabelGap === null ? gap : Math.min(gap, metrics.minimumLabelGap);
      check(gap >= 24, "Path label crowds the next node or unit divider");
    });
  }
  return { passed: failures.length === 0, failures, metrics };
})()
