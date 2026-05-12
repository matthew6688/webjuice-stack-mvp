import { chromium } from 'playwright';
import fs from 'fs';
const outDir = 'data/qa/sop2-screenshots';
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
for (const [url, name] of [
  ['http://localhost:4325/admin/scoring', 'ds-overview'],
  ['http://localhost:4325/admin/scoring/sop-1', 'ds-sop-1'],
  ['http://localhost:4325/admin/scoring/sop-2', 'ds-sop-2'],
  ['http://localhost:4325/admin/scoring/sop-2-doc', 'ds-sop-2-doc'],
]) {
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.screenshot({ path: `${outDir}/${name}-fold.png`, fullPage: false });
  await page.screenshot({ path: `${outDir}/${name}-full.png`, fullPage: true });
  console.log(name, '✓');
  await page.close();
}
await browser.close();
