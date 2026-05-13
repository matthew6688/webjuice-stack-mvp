#!/usr/bin/env node
/**
 * 截图 OD smoke 输出的 HTML · M1 学习评估
 * 桌面 + 手机 · full page · 输出到 data/qa/od-learn/
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const CLIENT_DIR = path.resolve('/Users/matthew/Developer/google-map-website/clients/rich-and-rare-learn-smoke-1778629677/concept/open-design');
const HTML_PATH = path.join(CLIENT_DIR, 'index.html');
const OUT_DIR = '/Users/matthew/Developer/google-map-website/data/qa/od-learn';

if (!fs.existsSync(HTML_PATH)) {
  console.error(`HTML 不存在: ${HTML_PATH}`);
  process.exit(1);
}

const fileUrl = pathToFileURL(HTML_PATH).href;
console.log('→', fileUrl);

const browser = await chromium.launch();

// Desktop 1440x900
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(fileUrl, { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(OUT_DIR, 'od-desktop-fold.png') });
  await page.screenshot({ path: path.join(OUT_DIR, 'od-desktop-full.png'), fullPage: true });
  const title = await page.title();
  const h1 = await page.locator('h1').first().textContent().catch(() => '?');
  const sections = await page.locator('section').count();
  console.log(`desktop: ${title} · H1="${h1}" · ${sections} sections`);
  await ctx.close();
}

// Mobile (iPhone 15) 393x852
{
  const ctx = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    isMobile: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Safari/605.1.15',
  });
  const page = await ctx.newPage();
  await page.goto(fileUrl, { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(OUT_DIR, 'od-mobile-fold.png') });
  await page.screenshot({ path: path.join(OUT_DIR, 'od-mobile-full.png'), fullPage: true });
  console.log('mobile: done');
  await ctx.close();
}

await browser.close();

console.log('\n截图输出:');
for (const f of fs.readdirSync(OUT_DIR).filter(f => f.startsWith('od-'))) {
  const s = fs.statSync(path.join(OUT_DIR, f));
  console.log(`  ${f}  ${Math.round(s.size / 1024)}KB`);
}
