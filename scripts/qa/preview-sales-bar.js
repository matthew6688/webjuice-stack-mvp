#!/usr/bin/env node

import fs from 'fs';
import http from 'http';
import path from 'path';
import { chromium } from 'playwright';

const args = parseArgs(process.argv.slice(2));
const distDir = path.resolve(args['dist-dir'] || args.distDir || '/Users/matthew/Developer/webjuice-restaurant/dist');
const port = Number(args.port || 4177);
const orderId = args.order || 'cs_test_preview_footer_001';
const email = args.email || 'owner@example.com';
if (!fs.existsSync(distDir)) throw new Error(`Missing dist dir: ${distDir}`);

const server = http.createServer((request, response) => {
  const url = new URL(request.url || '/', `http://127.0.0.1:${port}`);
  if (url.pathname === '/api/order-status/' && request.method === 'POST') {
    response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify({
      ok: true,
      revision: { used: 1, limit: 3, remaining: 2 },
      links: { extraRevision: `/checkout?tier=extra_revision&order_id=${encodeURIComponent(orderId)}&email=${encodeURIComponent(email)}` },
    }));
    return;
  }
  const filePath = resolveStaticPath(distDir, url.pathname);
  if (!filePath || !fs.existsSync(filePath)) {
    response.writeHead(404, { 'Content-Type': 'text/plain' });
    response.end('Not found');
    return;
  }
  response.writeHead(200, { 'Content-Type': contentType(filePath) });
  fs.createReadStream(filePath).pipe(response);
});
await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));

const browser = await chromium.launch();
const results = [];
try {
  for (const viewport of [
    { name: 'mobile', width: 390, height: 844 },
    { name: 'desktop', width: 1440, height: 1000 },
  ]) {
    const page = await browser.newPage({ viewport });
    const target = `http://127.0.0.1:${port}/?order_id=${encodeURIComponent(orderId)}&email=${encodeURIComponent(email)}`;
    await page.goto(target, { waitUntil: 'networkidle' });
    const result = await page.evaluate(() => {
      const bar = document.querySelector('[data-preview-sales-bar]');
      const approve = document.querySelector('[data-approve-link]');
      const revise = document.querySelector('[data-revise-link]');
      const extra = document.querySelector('[data-extra-link]');
      const body = document.body;
      const barRect = bar?.getBoundingClientRect();
      const mainRect = document.querySelector('main')?.getBoundingClientRect();
      return {
        hasBar: Boolean(bar),
        approveVisible: Boolean(approve && getComputedStyle(approve).display !== 'none'),
        reviseVisible: Boolean(revise && getComputedStyle(revise).display !== 'none'),
        extraVisible: Boolean(extra && getComputedStyle(extra).display !== 'none'),
        approveHref: approve?.getAttribute('href') || '',
        reviseHref: revise?.getAttribute('href') || '',
        extraHref: extra?.getAttribute('href') || '',
        noHorizontalOverflow: body.scrollWidth <= window.innerWidth + 1,
        barWithinViewport: Boolean(barRect && barRect.left >= 0 && barRect.right <= window.innerWidth + 1 && barRect.bottom <= window.innerHeight + 1),
        contentHasBottomRoom: Boolean(mainRect && barRect && mainRect.bottom <= barRect.top + body.scrollHeight),
      };
    });
    await page.screenshot({ path: path.join(distDir, `preview-sales-bar-${viewport.name}.png`), fullPage: true });
    results.push({ viewport: viewport.name, ...result });
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}

const assertions = {
  allHaveBar: results.every((result) => result.hasBar),
  approveVisible: results.every((result) => result.approveVisible),
  reviseVisible: results.every((result) => result.reviseVisible),
  extraVisible: results.every((result) => result.extraVisible),
  approveUsesOfficialFunnel: results.every((result) => result.approveHref.startsWith('https://profitslocal.com/approve?')),
  reviseUsesOfficialFunnel: results.every((result) => result.reviseHref.startsWith('https://profitslocal.com/revision?')),
  extraUsesOfficialFunnel: results.every((result) => result.extraHref.startsWith('https://profitslocal.com/checkout?')),
  approveCarriesOrderAndEmail: results.every((result) => result.approveHref.includes(orderId) && result.approveHref.includes(encodeURIComponent(email))),
  reviseCarriesOrderAndEmail: results.every((result) => result.reviseHref.includes(orderId) && result.reviseHref.includes(encodeURIComponent(email))),
  extraCarriesTierAndOrder: results.every((result) => result.extraHref.includes('tier=extra_revision') && result.extraHref.includes(orderId)),
  noHorizontalOverflow: results.every((result) => result.noHorizontalOverflow),
  barWithinViewport: results.every((result) => result.barWithinViewport),
};
const failed = Object.entries(assertions)
  .filter(([, value]) => value !== true)
  .map(([key]) => key);

console.log(JSON.stringify({
  ok: failed.length === 0,
  distDir,
  screenshots: results.map((result) => path.join(distDir, `preview-sales-bar-${result.viewport}.png`)),
  assertions,
  failed,
  results,
}, null, 2));

if (failed.length) process.exit(1);

function resolveStaticPath(root, pathname) {
  const clean = decodeURIComponent(pathname).replace(/^\/+/, '');
  const candidates = [];
  if (!clean) candidates.push(path.join(root, 'index.html'));
  candidates.push(path.join(root, clean));
  candidates.push(path.join(root, clean, 'index.html'));
  return candidates.find((candidate) => {
    const resolved = path.resolve(candidate);
    return resolved.startsWith(root) && fs.existsSync(resolved) && fs.statSync(resolved).isFile();
  }) || '';
}

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.png')) return 'image/png';
  if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) return 'image/jpeg';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      i += 1;
    }
  }
  return parsed;
}
