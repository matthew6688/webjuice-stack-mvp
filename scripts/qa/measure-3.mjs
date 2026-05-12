import { chromium } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
for (const url of ['http://localhost:4334/admin/scoring', 'http://localhost:4334/admin/scoring/sop-1', 'http://localhost:4334/admin/scoring/sop-2']) {
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  const tabs = await page.locator('.sop-tabs--global').boundingBox();
  const shell = await page.locator('.admin-shell').boundingBox();
  const activeTab = await page.locator('.sop-tab--active').boundingBox();
  const pageName = url.split('/').pop() || 'overview';
  console.log(pageName.padEnd(12), '| tabs x:', Math.round(tabs.x), 'w:', Math.round(tabs.width), '| shell x:', Math.round(shell.x), 'w:', Math.round(shell.width), '| active x:', Math.round(activeTab.x));
  await page.close();
}
await browser.close();
