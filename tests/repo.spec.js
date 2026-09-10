import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { PAGES, ROOT, liveUrl, readSiteFile } from './helpers.js';

// File checks with no browser involved; the config runs these once, under desktop.

const cacheBusters = (html, asset) =>
  [...html.matchAll(new RegExp(`${asset.replace('.', '\\.')}\\?v=([\\w-]+)`, 'g'))].map((m) => m[1]);

test('every page links style.css and site.js with the same cache-buster', () => {
  const versions = new Set();
  for (const file of [...PAGES, '404.html']) {
    const html = readSiteFile(file);
    for (const asset of ['style.css', 'site.js']) {
      const found = cacheBusters(html, asset);
      expect(found, `${file} should link ${asset} once, with ?v=`).toHaveLength(1);
      versions.add(found[0]);
    }
  }
  expect([...versions], 'all pages should share one cache-buster').toHaveLength(1);
});

test('cache-buster was bumped if style.css or site.js changed since the last push', () => {
  const git = (...args) =>
    execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

  let pushedIndex;
  try {
    pushedIndex = git('show', 'origin/main:index.html');
  } catch {
    test.skip(true, 'origin/main is not available to compare against');
  }

  let assetsChanged = false;
  try {
    git('diff', '--quiet', 'origin/main', '--', 'style.css', 'site.js');
  } catch {
    assetsChanged = true;
  }
  test.skip(!assetsChanged, 'style.css and site.js are unchanged since origin/main');

  expect(
    cacheBusters(readSiteFile('index.html'), 'style.css')[0],
    'style.css or site.js changed: bump ?v= on every page, or GitHub Pages keeps serving the old files'
  ).not.toBe(cacheBusters(pushedIndex, 'style.css')[0]);
});

test('sitemap lists every page exactly once', () => {
  const locs = [...readSiteFile('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  expect(locs.sort()).toEqual(PAGES.map(liveUrl).sort());
});
