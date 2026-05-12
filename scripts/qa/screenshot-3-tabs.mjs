import { chromium } from 'playwright';
import fs from 'fs';
const outDir = 'data/qa/sop2-screenshots';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
for (const [url, name] of [
  ['http://localhost:4330/admin/scoring', 'tab-overview'],
  ['http://localhost:4330/admin/scoring/sop-1', 'tab-sop-1'],
  ['http://localhost:4330/admin/scoring/sop-2', 'tab-sop-2'],
]) {
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  // capture just the area down to the first section after tab strip
  await page.screenshot({ path: `${outDir}/${name}-header.png`, clip: { x: 0, y: 0, width: 1440, height: 700 } });
  console.log(name, '✓');
  await page.close();
}
await browser.close();
