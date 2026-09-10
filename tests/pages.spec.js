import { test, expect } from '@playwright/test';
import { PAGES, liveUrl, navTarget, scrollThrough } from './helpers.js';

for (const file of PAGES) {
  test.describe(file, () => {
    test('loads without errors or broken assets', async ({ page, baseURL }) => {
      // Only our own files count; third-party embeds (Google Forms, fonts) aren't ours to fix.
      const ours = (url) => !url || url.startsWith(baseURL);
      const problems = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error' && ours(msg.location().url)) problems.push(`console error: ${msg.text()}`);
      });
      page.on('pageerror', (error) => problems.push(`uncaught: ${error.message}`));
      page.on('response', (response) => {
        if (response.url().startsWith(baseURL) && response.status() >= 400) {
          problems.push(`${response.status()} ${response.url()}`);
        }
      });

      const response = await page.goto(file);
      expect(response.status()).toBe(200);

      await scrollThrough(page);

      const brokenImages = () =>
        page.evaluate(() =>
          [...document.images].filter((img) => !img.complete || img.naturalWidth === 0).map((img) => img.src)
        );
      await expect.poll(brokenImages).toEqual([]);

      // site.js fades sections in on scroll; none may be left invisible.
      const invisibleSections = () =>
        page.evaluate(
          () => [...document.querySelectorAll('main > section')].filter((s) => getComputedStyle(s).opacity !== '1').length
        );
      await expect.poll(invisibleSections, { timeout: 5_000 }).toBe(0);

      expect(problems).toEqual([]);
    });

    test('has a complete head and one active nav link', async ({ page }) => {
      await page.goto(file);
      const canonical = liveUrl(file);

      await expect(page).toHaveTitle(/\S \| Watts Analysis$/);
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.{50,}/);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical);
      await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', canonical);
      await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /^https:\/\//);
      await expect(page.locator('h1')).toHaveCount(1);

      const active = page.locator('.site-header nav a.active');
      await expect(active).toHaveCount(1);
      await expect(active).toHaveAttribute('href', navTarget(file));
    });

    test('fits the screen without sideways scrolling', async ({ page }) => {
      await page.goto(file);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });

    test('internal links, images and embeds resolve', async ({ page, request, baseURL }, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop', 'Links are identical at every screen size');
      await page.goto(file);

      const urls = await page.evaluate(() =>
        [...document.querySelectorAll('a[href], img[src], iframe[src], link[rel="icon"]')].map((el) => el.href || el.src)
      );
      const internal = [...new Set(urls.filter((url) => url.startsWith(baseURL)).map((url) => url.split('#')[0]))];
      for (const url of internal) {
        const response = await request.get(url);
        expect.soft(response.status(), url).toBe(200);
      }

      const missingAnchors = await page.evaluate(() =>
        [...document.querySelectorAll('a[href^="#"]')]
          .map((a) => decodeURIComponent(a.getAttribute('href').slice(1)))
          .filter((id) => id && !document.getElementById(id))
      );
      expect(missingAnchors).toEqual([]);
    });
  });
}
