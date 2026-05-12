import { chromium } from 'playwright';
const TOKEN = process.env.ADMIN_ACCESS_TOKEN;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const auth = await ctx.newPage();
await auth.goto(`https://profitslocal.com/admin?token=${TOKEN}`, { waitUntil: 'networkidle' });
await auth.close();
const ts = Date.now();
for (const [url, name] of [
  [`https://profitslocal.com/admin/scoring/?ts=${ts}`, 'c4-overview'],
  [`https://profitslocal.com/admin/scoring/sop-1/?ts=${ts}`, 'c2-sop1'],
  [`https://profitslocal.com/admin/scoring/sop-2/?ts=${ts}`, 'c3-sop2'],
]) {
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.screenshot({ path: `data/qa/sop2-screenshots/${name}-full.png`, fullPage: true });
    const s = await page.evaluate(() => ({
      title: document.title,
      h1: document.querySelector('h1')?.innerText?.slice(0, 60),
      hasPayloadSample: !!document.querySelector('.admin-payload-card'),
      hasDecisionDiamond: !!document.querySelector('.admin-flow-decision-diamond'),
      sectionCount: document.querySelectorAll('.admin-paper-section').length,
      sop1Mentions: (document.body.innerText.match(/SOP-1/g) || []).length,
      hasOldDiscordIn2: document.body.innerText.includes('客户在 Discord 里走的 4 段路'),
    }));
    console.log(name, JSON.stringify(s));
  } catch (e) { console.error(name, 'ERR', e.message); }
  await page.close();
}
await browser.close();
