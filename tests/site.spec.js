import { test, expect } from '@playwright/test';
import { PROJECT_PAGES } from './helpers.js';

const titlesTagged = (cards, filter) =>
  cards.evaluateAll(
    (els, f) =>
      els
        .filter((el) => f === 'all' || el.dataset.tags.split(' ').includes(f))
        .map((el) => el.querySelector('h2').textContent),
    filter
  );

test.describe('portfolio', () => {
  test('each filter shows exactly the projects tagged with it', async ({ page }) => {
    await page.goto('portfolio.html');
    const cards = page.locator('.project-card');
    const filters = await page.locator('.filter-button').evaluateAll((buttons) => buttons.map((b) => b.dataset.filter));

    // Finish on "all" so resetting the filter is covered too.
    for (const filter of [...filters.filter((f) => f !== 'all'), 'all']) {
      const button = page.locator(`.filter-button[data-filter="${filter}"]`);
      await button.click();

      const expected = await titlesTagged(cards, filter);
      await expect(button).toHaveAttribute('aria-pressed', 'true');
      await expect(cards.filter({ visible: true }).locator('h2')).toHaveText(expected);
      await expect(page.locator('.filter-status')).toHaveText(
        `${expected.length} project${expected.length === 1 ? '' : 's'} shown`
      );
      await expect(page).toHaveURL(filter === 'all' ? /portfolio\.html$/ : new RegExp(`portfolio\\.html#${filter}$`));
    }
  });

  test('a shared filter link opens with that filter applied', async ({ page }) => {
    await page.goto('portfolio.html#basketball');
    const cards = page.locator('.project-card');

    await expect(page.locator('.filter-button[data-filter="basketball"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(cards.filter({ visible: true }).locator('h2')).toHaveText(await titlesTagged(cards, 'basketball'));
  });

  test('lists every project page, and the snapshot count matches', async ({ page }) => {
    await page.goto('portfolio.html');

    const linked = await page
      .locator('.project-card a.button-link')
      .evaluateAll((links) => links.map((a) => a.getAttribute('href')));
    expect(linked.sort()).toEqual([...PROJECT_PAGES].sort());
    await expect(page.locator('.fact-card').filter({ hasText: 'projects' }).locator('strong')).toHaveText(
      String(PROJECT_PAGES.length)
    );
  });
});

test('every nav link is on screen', async ({ page }) => {
  await page.goto('index.html');
  for (const link of await page.locator('.site-header nav a').all()) {
    await expect(link).toBeInViewport();
  }
});

test('skip link jumps keyboard users to the main content', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Keyboard navigation is checked on desktop');
  await page.goto('index.html');

  await page.keyboard.press('Tab');
  const skipLink = page.locator('.skip-link');
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeInViewport();

  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
});

test('missing pages return the custom 404', async ({ page }) => {
  const response = await page.goto('this-page-does-not-exist.html');
  expect(response.status()).toBe(404);
  await expect(page).toHaveTitle('Page Not Found | Watts Analysis');
  await expect(page.locator('h1')).toBeVisible();
});
