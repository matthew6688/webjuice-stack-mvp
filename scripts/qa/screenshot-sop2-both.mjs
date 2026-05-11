import { chromium } from 'playwright';
import fs from 'fs';
const outDir = 'data/qa/sop2-screenshots';
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
for (const [url, name] of [
  ['http://localhost:4322/admin/scoring', 'scoring-with-doc-link'],
  ['http://localhost:4322/admin/scoring/sop-2', 'sop-2-doc'],
]) {
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  const fold = `${outDir}/${name}-fold.png`;
  await page.screenshot({ path: fold, fullPage: false });
  console.log('saved', fold);
  await page.close();
}
await browser.close();
