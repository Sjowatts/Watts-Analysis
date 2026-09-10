// Serves the checkout the way GitHub Pages does: under /Watts-Analysis/,
// with 404.html (and a 404 status) for anything that isn't published.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PREFIX = '/Watts-Analysis/';
const PORT = Number(process.env.PORT) || 4173;

// Jekyll skips dot/underscore paths and _config.yml excludes the test tooling.
const UNPUBLISHED = /(^|\/)([._]|node_modules\/|tests\/|playwright|package(-lock)?\.json$)/;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
};

async function resolve(pathname) {
  if (!pathname.startsWith(PREFIX)) return null;
  let relative;
  try {
    relative = decodeURIComponent(pathname.slice(PREFIX.length));
  } catch {
    return null;
  }
  if (relative === '' || relative.endsWith('/')) relative += 'index.html';
  if (UNPUBLISHED.test(relative) || relative.split('/').includes('..')) return null;

  const file = join(ROOT, relative);
  try {
    return (await stat(file)).isFile() ? file : null;
  } catch {
    return null;
  }
}

createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  if (pathname === '/' || pathname === PREFIX.slice(0, -1)) {
    res.writeHead(301, { Location: PREFIX });
    return res.end();
  }

  const file = await resolve(pathname);
  const served = file ?? join(ROOT, '404.html');
  res.writeHead(file ? 200 : 404, { 'Content-Type': TYPES[extname(served)] ?? 'application/octet-stream' });
  res.end(await readFile(served));
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Watts Analysis at http://127.0.0.1:${PORT}${PREFIX}`);
});
