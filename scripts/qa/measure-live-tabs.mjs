import { chromium } from 'playwright';
const TOKEN = process.env.ADMIN_ACCESS_TOKEN;
const ts = Date.now();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const auth = await ctx.newPage();
await auth.goto(`https://profitslocal.com/admin?token=${TOKEN}&_=${ts}`, { waitUntil: 'networkidle' });
await auth.close();
for (const [url, name] of [
  [`https://profitslocal.com/admin/scoring?_=${ts}`, 'live-aligned-overview'],
  [`https://profitslocal.com/admin/scoring/sop-1?_=${ts}`, 'live-aligned-sop-1'],
  [`https://profitslocal.com/admin/scoring/sop-2?_=${ts}`, 'live-aligned-sop-2'],
]) {
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  const tabs = await page.locator('.sop-tabs--global').boundingBox();
  const shell = await page.locator('.admin-shell').boundingBox();
  const activeTab = await page.locator('.sop-tab--active').boundingBox();
  console.log(name, '| tabs x:', Math.round(tabs.x), 'w:', Math.round(tabs.width), '| shell x:', Math.round(shell.x), 'w:', Math.round(shell.width), '| active tab x:', Math.round(activeTab.x));
  await page.screenshot({ path: `data/qa/sop2-screenshots/${name}-header.png`, clip:{x:0,y:0,width:1440,height:700} });
  await page.close();
}
await browser.close();
