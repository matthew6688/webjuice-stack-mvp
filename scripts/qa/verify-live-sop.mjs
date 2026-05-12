import { chromium } from 'playwright';
import fs from 'fs';

const TOKEN = process.env.ADMIN_ACCESS_TOKEN;
if (!TOKEN) { console.error('ADMIN_ACCESS_TOKEN env required'); process.exit(1); }

const outDir = 'data/qa/sop2-screenshots';
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

// First hit: pass token via query string, middleware will set cookie + redirect
const auth = await ctx.newPage();
console.log('authenticating...');
await auth.goto(`https://profitslocal.com/admin/scoring?token=${TOKEN}`, { waitUntil: 'networkidle', timeout: 30000 });
console.log('auth url:', auth.url());
await auth.close();

const results = [];
for (const [url, name, expects] of [
  ['https://profitslocal.com/admin/scoring',          'live-sop2-overview',  ['SOP', '线索筛选', 'SOP-1', 'SOP-2', '$399', '$799', '$1000+']],
  ['https://profitslocal.com/admin/scoring/sop-1',    'live-sop1-placeholder', ['SOP-1', '客户发现', 'Intake', '待写', '搜索任务设计']],
  ['https://profitslocal.com/admin/scoring/sop-2-doc',  'live-sop2-doc',       ['SOP-2', '详细文档', '4-channel', 'Stage 0', 'graduation']],
]) {
  const page = await ctx.newPage();
  console.log(`\nfetching ${url}`);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  console.log('  status url:', page.url(), 'title:', await page.title());

  const fold = `${outDir}/${name}-fold.png`;
  await page.screenshot({ path: fold, fullPage: false });
  console.log('  screenshot →', fold);

  // Verify expected strings present
  const body = await page.content();
  const found = [];
  const missing = [];
  for (const s of expects) {
    if (body.includes(s)) found.push(s);
    else missing.push(s);
  }
  console.log('  found:', found.join(', '));
  if (missing.length) console.log('  ⚠ MISSING:', missing.join(', '));
  results.push({ url, name, ok: missing.length === 0, found, missing });

  await page.close();
}

await browser.close();

console.log('\n═══════════════════════════════════════');
console.log('SUMMARY');
for (const r of results) {
  console.log(`  ${r.ok ? '✓' : '✗'} ${r.name}: ${r.found.length} found${r.missing.length ? `, ${r.missing.length} MISSING` : ''}`);
}
const allOk = results.every(r => r.ok);
process.exit(allOk ? 0 : 1);
