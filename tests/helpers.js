import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const LIVE_URL = 'https://sjowatts.github.io/Watts-Analysis/';

// Every published page, read from disk so a new page is tested without editing a list.
export const PAGES = readdirSync(ROOT)
  .filter((file) => file.endsWith('.html') && file !== '404.html')
  .sort();

export const PROJECT_PAGES = PAGES.filter((file) => file.startsWith('project-'));

export const readSiteFile = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');

// index.html is published at the site root; every other page under its filename.
export const liveUrl = (file) => LIVE_URL + (file === 'index.html' ? '' : file);

// Project pages highlight Portfolio in the nav.
export const navTarget = (file) => (file.startsWith('project-') ? 'portfolio.html' : file);

// Step down the page so lazy images load and reveal-on-scroll sections fire.
export async function scrollThrough(page) {
  await page.evaluate(async () => {
    const step = window.innerHeight / 2;
    for (let y = 0; y <= document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  });
}
