import { chromium } from 'playwright';
import fs from 'fs';
const outDir = 'data/qa/sop2-screenshots';
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
for (const [url, name] of [
  ['http://localhost:4323/admin/scoring', 'sop2-with-tabs'],
  ['http://localhost:4323/admin/scoring/sop-1', 'sop1-placeholder'],
  ['http://localhost:4323/admin/scoring/sop-2-doc', 'sop2-doc'],
]) {
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  const fold = `${outDir}/${name}-fold.png`;
  await page.screenshot({ path: fold, fullPage: false });
  console.log('saved', fold);
  await page.close();
}
await browser.close();
