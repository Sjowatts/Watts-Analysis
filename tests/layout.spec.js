import { test, expect } from '@playwright/test';
import { PAGES } from './helpers.js';

// Text has to sit inside its tile, button or chip at every common screen width.
// Arial is forced so the check measures the same metrics everywhere: Arial on a
// Mac, and the metric-compatible Liberation Sans on the Linux CI runner.
// FIT_FONT=native skips that and measures the real system font instead.
const WIDTHS = [320, 375, 414, 600, 768, 834, 1024, 1180, 1440, 1920];

const BOXES = [
  '.highlight-card', '.content-panel', '.service-card', '.project-card', '.stat-card', '.media-card',
  '.contact-card', '.impact-card', '.pillar-card', '.process-card', '.feature-card', '.timeline-item',
  '.contact-method', '.premium-aside', '.page-hero-aside', '.summary-card', '.status-note', '.fact-card',
  '.hero-stat', '.proof-item', '.site-header', 'footer',
].join(', ');

const PILLS = [
  '.button-link', '.download-btn', '.filter-button', '.rail-cta', '.tag', '.chip', '.trust-pill',
  '.meta-pill', '.site-header nav a', '.back-link',
].join(', ');

for (const file of [...PAGES, '404.html']) {
  test(`${file}: text fits its boxes at every width`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Widths are set explicitly, so one project covers them');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(file);
    if (process.env.FIT_FONT !== 'native') {
      await page.addStyleTag({ content: '*, *::before, *::after { font-family: Arial, "Liberation Sans", sans-serif !important; }' });
    }

    const problems = [];
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      const found = await page.evaluate(measureFit, { boxes: BOXES, pills: PILLS });
      problems.push(...found.map((problem) => `${width}px: ${problem}`));
    }
    expect([...new Set(problems)]).toEqual([]);
  });
}

// Runs in the page, so it has to be self-contained.
function measureFit({ boxes, pills }) {
  const problems = [];
  const shown = (el) => {
    const style = getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && el.getClientRects().length > 0 && !el.closest('.visually-hidden');
  };
  const textIn = (root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.textContent.trim() && shown(node.parentElement)) nodes.push(node);
    }
    return nodes;
  };
  const rectsOf = (node, start = 0, end = node.textContent.length) => {
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, end);
    return [...range.getClientRects()].filter((rect) => rect.width > 0);
  };
  const lineCount = (rects) => new Set(rects.map((rect) => Math.round(rect.top / 4))).size;
  const overlap = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
  const short = (text) => text.trim().replace(/\s+/g, ' ').slice(0, 40);
  const name = (el) => (el.classList.length ? `.${el.classList[0]}` : el.tagName.toLowerCase());

  const viewport = document.documentElement.clientWidth;
  if (document.documentElement.scrollWidth > viewport + 1) {
    problems.push(`page scrolls sideways (${document.documentElement.scrollWidth}px wide)`);
  }

  for (const box of document.querySelectorAll(boxes)) {
    if (!shown(box)) continue;
    const bounds = box.getBoundingClientRect();
    for (const node of textIn(box)) {
      if (rectsOf(node).some((rect) => rect.right > bounds.right + 1 || rect.left < bounds.left - 1)) {
        problems.push(`"${short(node.textContent)}" spills out of ${name(box)}`);
      }
    }
  }

  // A run of letters between natural break points must never be split across lines.
  for (const node of textIn(document.body)) {
    for (const match of node.textContent.matchAll(/[^\s\-\/–—@.]{4,}/g)) {
      if (lineCount(rectsOf(node, match.index, match.index + match[0].length)) > 1) {
        problems.push(`"${match[0]}" breaks mid-word in ${name(node.parentElement)}`);
      }
    }
  }

  for (const pill of document.querySelectorAll(pills)) {
    if (!shown(pill)) continue;
    if (lineCount(textIn(pill).flatMap((node) => rectsOf(node))) > 1) {
      problems.push(`"${short(pill.textContent)}" wraps onto two lines in ${name(pill)}`);
    }
  }

  const header = [...document.querySelectorAll('.site-header nav a')].map((link) => [link.textContent.trim(), link.getBoundingClientRect()]);
  const neighbours = ['.brand-link', '.rail-cta'].map((selector) => document.querySelector(selector)?.getBoundingClientRect()).filter(Boolean);
  header.forEach(([label, rect], index) => {
    const others = [...neighbours, ...header.slice(index + 1).map(([, other]) => other)];
    if (others.some((other) => overlap(rect, other))) problems.push(`nav link "${label}" overlaps another header item`);
  });

  for (const card of document.querySelectorAll('.project-card')) {
    const tags = card.querySelector('.project-tags');
    const placeholder = card.querySelector('.project-placeholder');
    if (!tags || !placeholder || !shown(card)) continue;
    const tagBounds = tags.getBoundingClientRect();
    if (textIn(placeholder).some((node) => rectsOf(node).some((rect) => overlap(rect, tagBounds)))) {
      problems.push(`tags cover the placeholder caption "${short(placeholder.textContent)}"`);
    }
  }

  return problems;
}
