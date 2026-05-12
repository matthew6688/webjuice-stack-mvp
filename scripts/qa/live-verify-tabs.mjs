import { chromium } from 'playwright';
import fs from 'fs';
const TOKEN = process.env.ADMIN_ACCESS_TOKEN;
const ts = Date.now();
const outDir = 'data/qa/sop2-screenshots';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const auth = await ctx.newPage();
await auth.goto(`https://profitslocal.com/admin?token=${TOKEN}&_=${ts}`, { waitUntil: 'networkidle' });
await auth.close();
for (const [url, name] of [
  [`https://profitslocal.com/admin/scoring?_=${ts}`, 'live-final-overview'],
  [`https://profitslocal.com/admin/scoring/sop-1?_=${ts}`, 'live-final-sop-1'],
  [`https://profitslocal.com/admin/scoring/sop-2?_=${ts}`, 'live-final-sop-2'],
]) {
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.screenshot({ path: `${outDir}/${name}-header.png`, clip: { x: 0, y: 0, width: 1440, height: 700 } });
  const hasYellow = await page.locator('.admin-count').first().evaluate(el => getComputedStyle(el).backgroundColor).catch(() => '');
  const tabs = await page.locator('.sop-tab').count();
  console.log(name, '| tabs:', tabs, '| admin-count bg:', hasYellow);
  await page.close();
}
await browser.close();
