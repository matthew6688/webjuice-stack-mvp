#!/usr/bin/env node
// Deep E2E · real reference-adapter run on a real customer (not mock).
// Verifies the V3 M3 default handoff path end-to-end:
//   master.md → buildAdapterPayload → claude CLI → adapted HTML → Playwright screenshot
//
// Cost: ~$0.30 per customer (claude CLI). Default runs 1 customer.
// Time: ~3-4 min.
//
// Usage:
//   node scripts/v3/e2e-deep-reference-adapter.mjs [--slug <customer-slug>]
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');
process.chdir(REPO);

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const next = arr[i + 1];
      acc.push([k, next && !next.startsWith('--') ? next : true]);
    }
    return acc;
  }, [])
);
const slug = args.slug || 'roof-space-renovators';

const t0 = Date.now();
const phases = [];
let current = null;
function start(name) {
  current = { name, steps: [], started_at: new Date().toISOString() };
  phases.push(current);
  console.log(`\n━━━ ${name} ━━━`);
}
async function step(label, fn) {
  const r = { label, passed: false, error: null, took_ms: 0 };
  const ts = Date.now();
  try {
    const v = await fn();
    if (v === false) throw new Error('false');
    r.passed = true;
    if (v && typeof v === 'object') r.data = v;
  } catch (err) {
    r.error = err?.message || String(err);
  }
  r.took_ms = Date.now() - ts;
  current.steps.push(r);
  console.log(`  [${r.passed ? 'PASS' : 'FAIL'}] ${label}${r.error ? ' · ' + r.error : ''}`);
  return r.passed;
}

// ─────────────────────────────────────────────────────────────────
// Phase 1 · core module · build prompt without LLM
// ─────────────────────────────────────────────────────────────────
start('Phase 1 · build payload (no LLM)');

const mod = await import(path.join(REPO, 'core/leads/reference-adapter-handoff.js'));
const masterMdPath = path.join(REPO, 'clients', slug, 'v2', 'master.md');
const masterMd = fs.existsSync(masterMdPath) ? fs.readFileSync(masterMdPath, 'utf8') : null;

let payload = null;
await step(`load master.md for ${slug}`, () => {
  if (!masterMd) throw new Error(`master.md missing for ${slug}`);
  return { length: masterMd.length };
});

await step('resolveReferenceSite picks classic-premium-roftix for roofing', () => {
  const ref = mod.resolveReferenceSite({ niche: 'roofing' });
  if (ref.family !== 'classic-premium-roftix') throw new Error(`family=${ref.family}`);
  return { family: ref.family };
});

let entity = null;
await step(`load entity from master.md frontmatter`, () => {
  const m = masterMd.match(/business_id:\s*"([^"]+)"/);
  if (!m) throw new Error('business_id not in frontmatter');
  const ef = path.join(REPO, 'data', 'leads', 'entities', `${m[1]}.json`);
  if (!fs.existsSync(ef)) throw new Error(`entity file missing: ${ef}`);
  entity = JSON.parse(fs.readFileSync(ef, 'utf8'));
  return { entityKey: entity.entityKey, name: entity.latest?.name };
});

await step('buildAdapterPayload returns prompt + assetsDir + family', () => {
  payload = mod.buildAdapterPayload({ slug, entity, masterMd });
  if (typeof payload.prompt !== 'string' || payload.prompt.length < 40_000) {
    throw new Error(`prompt size unexpected: ${payload.prompt?.length}`);
  }
  if (!fs.existsSync(payload.assetsDir)) throw new Error('assetsDir missing');
  return { promptBytes: payload.prompt.length, family: payload.family };
});

// ─────────────────────────────────────────────────────────────────
// Phase 2 · invoke real CLI (claude · ~3 min · ~$0.30)
// ─────────────────────────────────────────────────────────────────
start('Phase 2 · claude CLI live invocation');

let outHtml = null;
await step(`pl:build-from-reference --slug ${slug}`, () => {
  const r = spawnSync('npm', ['run', 'pl:build-from-reference', '--', '--slug', slug], {
    cwd: REPO, encoding: 'utf8', timeout: 6 * 60 * 1000, stdio: 'pipe',
  });
  if (r.status !== 0) throw new Error(`exit ${r.status}\n${(r.stderr || '').slice(-400)}`);
  outHtml = path.join(REPO, 'clients', slug, 'v2', 'concept', 'reference-adapter', 'index.html');
  if (!fs.existsSync(outHtml)) throw new Error(`output HTML missing: ${outHtml}`);
  return { outPath: outHtml, bytes: fs.statSync(outHtml).size };
});

await step('output HTML is valid <!doctype html>', () => {
  const body = fs.readFileSync(outHtml, 'utf8');
  if (!/^<!doctype html/i.test(body.trim())) throw new Error('missing <!doctype html>');
  if (!body.includes('</html>')) throw new Error('missing </html>');
  return { firstLine: body.split('\n')[0] };
});

await step('output references customer business name (not demo)', () => {
  const body = fs.readFileSync(outHtml, 'utf8');
  const name = entity?.latest?.name || '';
  if (!name) throw new Error('no customer name to verify');
  // Verify name appears AND demo name does NOT appear (except possibly in comments)
  if (!body.toLowerCase().includes(name.toLowerCase().split(' ')[0])) {
    throw new Error(`customer name "${name}" not in output`);
  }
  // Demo name "Brisbane Premium Roof Co" should NOT appear in customer-facing copy
  // (may appear in HTML comments which is fine)
  const visibleDemo = body.replace(/<!--[\s\S]*?-->/g, '').includes('Brisbane Premium Roof Co');
  if (visibleDemo) throw new Error('demo name "Brisbane Premium Roof Co" leaked into customer output');
  return { name };
});

await step('LOCKED tokens preserved (CSS vars unchanged)', () => {
  const body = fs.readFileSync(outHtml, 'utf8');
  const lockedColors = ['#0E6B4F', '#0B2F57', '#FF6F3C', '#F7F5F0'];
  for (const c of lockedColors) {
    if (!body.includes(c)) throw new Error(`locked color ${c} missing`);
  }
  if (!body.includes('Playfair Display')) throw new Error('locked font Playfair Display missing');
  return { lockedColors: lockedColors.length };
});

await step('anti-template phrases not present', () => {
  const body = fs.readFileSync(outHtml, 'utf8').toLowerCase();
  const blacklist = ['trusted partner', 'your roof deserves better', 'quality you can count on', 'welcome to '];
  const hits = blacklist.filter(p => body.includes(p));
  if (hits.length) throw new Error(`anti-template hits: ${hits.join(', ')}`);
  return { checked: blacklist.length };
});

// ─────────────────────────────────────────────────────────────────
// Phase 3 · screenshot the adapted site
// ─────────────────────────────────────────────────────────────────
start('Phase 3 · Playwright screenshot');

const screenshotsRoot = path.dirname(outHtml);
await step('render desktop screenshot', () => {
  // Use the social-flow playwright since v3 repo doesn't have it installed.
  const sf = '/Users/matthew/social-flow';
  if (!fs.existsSync(path.join(sf, 'node_modules/playwright'))) {
    throw new Error('social-flow playwright not found');
  }
  const helper = path.join(sf, '__deep_e2e_screenshot.mjs');
  fs.writeFileSync(helper, `
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('file://${outHtml}', { waitUntil: 'load' });
await p.waitForTimeout(1500);
await p.screenshot({ path: '${screenshotsRoot}/desktop.png', fullPage: true });
await b.close();
console.log('OK');
  `);
  const r = spawnSync('node', [helper], { cwd: sf, encoding: 'utf8', timeout: 120_000 });
  fs.unlinkSync(helper);
  if (r.status !== 0) throw new Error(`playwright failed: ${r.stderr}`);
  return { path: path.join(screenshotsRoot, 'desktop.png') };
});

await step('screenshot file size reasonable (>50KB)', () => {
  const s = fs.statSync(path.join(screenshotsRoot, 'desktop.png'));
  if (s.size < 50_000) throw new Error(`screenshot too small: ${s.size}`);
  return { size: s.size };
});

// ─────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────
const totalSteps = phases.reduce((a, p) => a + p.steps.length, 0);
const passed = phases.reduce((a, p) => a + p.steps.filter(s => s.passed).length, 0);
const overall = totalSteps === passed ? 'PASS' : 'FAIL';
const tookMin = Math.round((Date.now() - t0) / 60_000 * 10) / 10;

const summary = {
  overall,
  total_steps: totalSteps,
  passed,
  failed: totalSteps - passed,
  customer: slug,
  output_html: outHtml,
  ran_at: new Date().toISOString(),
  took_min: tookMin,
  phases,
};

const outDir = path.join(REPO, 'data', 'qa', 'deep-e2e-reference-adapter');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, `${slug}.json`), JSON.stringify(summary, null, 2));

console.log(`\n━━━ DEEP E2E SUMMARY (${slug}) ━━━`);
for (const p of phases) {
  const pPass = p.steps.filter(s => s.passed).length;
  console.log(`  ${pPass === p.steps.length ? '✓' : '✗'} ${p.name} · ${pPass}/${p.steps.length}`);
}
console.log(`\nOverall: ${overall} · ${passed}/${totalSteps} · ${tookMin} min`);
console.log(`Evidence: data/qa/deep-e2e-reference-adapter/${slug}.json`);
process.exit(overall === 'PASS' ? 0 : 1);
