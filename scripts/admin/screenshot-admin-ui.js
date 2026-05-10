#!/usr/bin/env node
/**
 * Screenshot the admin UI for hard-evidence purposes (per the
 * "verify admin UI in browser" rule). Run with the dev server up.
 *
 *   npm run dev      (in another terminal)
 *   npm run admin:screenshot
 *
 * Pages captured:
 *   /admin/scoring                  — V2 algorithm definition page
 *   /admin/leads/<example-slug>     — score breakdown for one real lead
 *
 * Output: data/v2/fixtures/admin-ui/<page>-<ts>.png
 *
 * Acts as a regression checker — if a future change re-introduces the
 * marketing-h1 leak (max-width 12ch + serif 98px), the screenshots will
 * obviously change.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

const BASE = process.env.ADMIN_BASE_URL || 'http://localhost:4321';
const fixturesDir = path.join(repoRoot, 'data/v2/fixtures/admin-ui');
fs.mkdirSync(fixturesDir, { recursive: true });

// Pick a real example slug for lead detail — use Brisbane Roofing Solutions
// since its V2 fix is the showcase example
const EXAMPLE_LEAD_SLUG = 'place_chijo3rniu9fkwsr8jworgytgmy';

const targets = [
  { name: 'admin-overview', url: `${BASE}/admin`, fullPage: false },
  { name: 'admin-leads-list', url: `${BASE}/admin/leads`, fullPage: false },
  { name: 'admin-queue', url: `${BASE}/admin/queue`, fullPage: false },
  { name: 'admin-templates', url: `${BASE}/admin/templates`, fullPage: false },
  { name: 'admin-reports', url: `${BASE}/admin/reports`, fullPage: false },
  { name: 'admin-finance', url: `${BASE}/admin/finance`, fullPage: false },
  { name: 'admin-intakes', url: `${BASE}/admin/intakes`, fullPage: false },
  { name: 'admin-settings', url: `${BASE}/admin/settings`, fullPage: false },
  { name: 'admin-scoring', url: `${BASE}/admin/scoring`, fullPage: false },
  { name: `admin-lead-${EXAMPLE_LEAD_SLUG.slice(0, 18)}`, url: `${BASE}/admin/leads/${EXAMPLE_LEAD_SLUG}`, fullPage: false },
];

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const out = [];

for (const t of targets) {
  const page = await ctx.newPage();
  const start = Date.now();
  await page.goto(t.url, { waitUntil: 'networkidle' });
  const loadMs = Date.now() - start;
  // Slight wait for any final layout settle
  await page.waitForTimeout(300);
  const ssPath = path.join(fixturesDir, `${t.name}.png`);
  await page.screenshot({ path: ssPath, fullPage: t.fullPage });
  await page.close();
  const size = fs.statSync(ssPath).size;
  out.push({ name: t.name, url: t.url, screenshot: ssPath, load_ms: loadMs, file_size: size });
}

await ctx.close();
await browser.close();

console.log(JSON.stringify({ ok: true, base: BASE, captures: out }, null, 2));
