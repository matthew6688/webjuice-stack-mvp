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
const ts = Date.now();
for (const [url, name] of [
  [`https://profitslocal.com/admin/scoring/?ts=${ts}`, 'v11-overview'],
  [`https://profitslocal.com/admin/scoring/sop-overview-doc/?ts=${ts}`, 'v11-overview-doc'],
  [`https://profitslocal.com/admin/scoring/sop-1/?ts=${ts}`, 'v11-sop-1'],
  [`https://profitslocal.com/admin/scoring/sop-1-doc/?ts=${ts}`, 'v11-sop-1-doc'],
  [`https://profitslocal.com/admin/scoring/sop-2/?ts=${ts}`, 'v11-sop-2'],
  [`https://profitslocal.com/admin/scoring/sop-2-doc/?ts=${ts}`, 'v11-sop-2-doc'],
]) {
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.screenshot({ path: `${outDir}/${name}-fold.png`, fullPage: false });
    await page.screenshot({ path: `${outDir}/${name}-full.png`, fullPage: true });
    const status = await page.evaluate(() => ({
      title: document.title,
      hasMeta: !!document.querySelector('.admin-page-meta'),
      hasSyncBanner: !!document.querySelector('.admin-code-sync-banner'),
      hasDocBody: !!document.querySelector('.sop2-doc-body'),
      docLinks: Array.from(document.querySelectorAll('a[href*="/admin/scoring/sop"]')).map(a => a.getAttribute('href')).slice(0, 6),
    }));
    console.log(name, JSON.stringify(status));
  } catch (e) { console.error(name, 'ERR', e.message); }
  await page.close();
}
await browser.close();
