import { chromium } from 'playwright';
import fs from 'fs';
const TOKEN = process.env.ADMIN_ACCESS_TOKEN;
const outDir = 'data/qa/sop2-screenshots';
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const auth = await ctx.newPage();
await auth.goto(`https://profitslocal.com/admin?token=${TOKEN}`, { waitUntil: 'networkidle' });
await auth.close();

const page = await ctx.newPage();
await page.goto('https://profitslocal.com/admin/scoring/sop-2-doc', { waitUntil: 'networkidle' });
// Full page
await page.screenshot({ path: `${outDir}/live-sop2-doc-FULL.png`, fullPage: true });
// First 3 viewports
for (let i = 0; i < 4; i++) {
  await page.evaluate((y) => window.scrollTo(0, y), i * 900);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${outDir}/live-sop2-doc-vp${i}.png`, fullPage: false });
}
console.log('done');
await browser.close();
