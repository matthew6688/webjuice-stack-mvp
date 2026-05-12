#!/usr/bin/env node
/**
 * scripts/qa/admin-chrome-compare.mjs
 *
 * Side-by-side chrome dimension comparison for SOP pages.
 * Gold standard = SOP-2 page. Other pages must visually mirror it.
 *
 * Catches the failure mode where pages render with same element-presence
 * but very different layouts (e.g. SOP-1 doc-link buttons cramped 3-wide
 * vs SOP-2's stacked 1-wide).
 *
 * Usage:
 *   ADMIN_ACCESS_TOKEN=... node scripts/qa/admin-chrome-compare.mjs
 *   ADMIN_ACCESS_TOKEN=... node scripts/qa/admin-chrome-compare.mjs --strict
 *
 * SOP_MAINTENANCE_RULES §8 · 2026-05-12 III.
 */

import { chromium } from 'playwright';

const TOKEN = process.env.ADMIN_ACCESS_TOKEN;
const STRICT = process.argv.includes('--strict');

if (!TOKEN) {
  console.error('ADMIN_ACCESS_TOKEN required in env');
  process.exit(2);
}

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

// Compare points: chrome elements that should be similar across SOP pages.
// Tolerance: ±15% on width, ±25% on height (allow content variation).
const COMPARE_POINTS = [
  { name: 'h1', selector: 'h1', tolerance: { width: 0.3, height: 0.25 } },
  { name: 'admin-shell width', selector: '.admin-shell', tolerance: { width: 0.05 } },
  { name: 'sop2-doc-link-btn (first)', selector: '.sop2-doc-link-btn', tolerance: { width: 0.15, height: 0.25 } },
  { name: 'admin-code-sync-banner', selector: '.admin-code-sync-banner', tolerance: { width: 0.15, height: 1.0 } },
  { name: 'admin-page-meta', selector: '.admin-page-meta', tolerance: { width: 0.5, height: 0.5 } },
  { name: 'admin-count', selector: '.admin-count', tolerance: { width: 0.3, height: 0.4 } },
];

const PAGES = [
  { id: 'overview', url: 'https://profitslocal.com/admin/scoring/' },
  { id: 'sop-1',    url: 'https://profitslocal.com/admin/scoring/sop-1' },
  { id: 'sop-2',    url: 'https://profitslocal.com/admin/scoring/sop-2', isGold: true },
];

async function measure(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { width: Math.round(r.width), height: Math.round(r.height) };
  }, selector);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const auth = await ctx.newPage();
await auth.goto(`https://profitslocal.com/admin?token=${TOKEN}`, { waitUntil: 'networkidle' });
await auth.close();

const allResults = {};
for (const p of PAGES) {
  const page = await ctx.newPage();
  await page.goto(`${p.url}?ts=${Date.now()}`, { waitUntil: 'networkidle', timeout: 30000 });
  const out = {};
  for (const cp of COMPARE_POINTS) {
    out[cp.name] = await measure(page, cp.selector);
  }
  allResults[p.id] = out;
  await page.close();
}
await browser.close();

const gold = allResults['sop-2'];
console.log(`\n${YELLOW}admin-chrome-compare${RESET} · gold = SOP-2\n`);
console.log(`  ${'element'.padEnd(36)} ${'gold (sop-2)'.padEnd(18)} ${'overview'.padEnd(16)} ${'sop-1'.padEnd(16)}`);
console.log(`  ${'─'.repeat(36)} ${'─'.repeat(18)} ${'─'.repeat(16)} ${'─'.repeat(16)}`);

let violations = 0;
for (const cp of COMPARE_POINTS) {
  const g = gold[cp.name];
  const fmt = (v) => v ? `${v.width}×${v.height}` : '(missing)';
  const row = [`  ${cp.name.padEnd(36)}`, fmt(g).padEnd(18)];
  for (const id of ['overview', 'sop-1']) {
    const o = allResults[id][cp.name];
    let bad = false;
    if (g && o) {
      const wDiff = Math.abs(o.width - g.width) / g.width;
      const hDiff = Math.abs(o.height - g.height) / g.height;
      if (wDiff > cp.tolerance.width) bad = true;
      if (cp.tolerance.height != null && hDiff > cp.tolerance.height) bad = true;
    } else if (g && !o) {
      bad = true;
    }
    if (bad) {
      violations += 1;
      row.push(`${RED}${fmt(o).padEnd(14)}${RESET}✗`);
    } else {
      row.push(`${fmt(o).padEnd(14)}${GREEN}✓${RESET}`);
    }
  }
  console.log(row.join('  '));
}

console.log('');
if (violations === 0) {
  console.log(`${GREEN}✓ chrome dimensions within tolerance vs gold (SOP-2).${RESET}\n`);
  process.exit(0);
}
console.log(`${RED}✗ ${violations} chrome dimension violation(s) vs gold (SOP-2)${RESET}`);
console.log(`${DIM}Pages should mirror SOP-2 chrome shape. If markup is correct, check CSS / wrapper structure.${RESET}`);
if (!STRICT) {
  console.log(`${YELLOW}⚠ Warning mode. Run with --strict to exit 1.${RESET}\n`);
  process.exit(0);
}
console.log('');
process.exit(1);
