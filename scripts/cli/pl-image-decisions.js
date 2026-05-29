#!/usr/bin/env node
/**
 * pl:image-decisions · codex R86/R87 (P2-1 image resolver · VERIFICATION cut) ·
 * applies the SOP-IMAGE-STRATEGY quality-gated mixed policy to a client's classified images
 * and emits an auditable decision map. READER (image-manifest.json) → sole writer of
 * clients/<slug>/v2/editorial-output/image-decisions.json. No render wiring yet (next cut).
 *
 * Gate (SOP §3/§4):
 *   - hero: real ONLY if quality_score ≥ 8 AND brand_fit ≥ 7 (polish + design fit); else stock
 *     (usage_intent: intentional_design_asset if a stock asset is chosen for polish,
 *      fallback_missing_real if no real candidate existed at all).
 *   - gallery / our-work: real-FIRST, quality ≥ 6 (authenticity > polish); record real count.
 *   - service: real if quality ≥ 6 (category service/gallery/hero); else stock.
 * provenance: real photo → tier verified, source_kind customer_photo. stock → stock_placeholder.
 *
 * Usage: node scripts/cli/pl-image-decisions.js --slug <slug> [--json]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
process.chdir(REPO);
const argv = process.argv.slice(2);
const slug = (() => { const i = argv.indexOf('--slug'); return i >= 0 ? argv[i + 1] : null; })();
const JSON_OUT = argv.includes('--json');
if (!slug) { console.error('--slug required'); process.exit(1); }
const V2 = `clients/${slug}/v2`;
const readJson = (p) => { try { return JSON.parse(fs.readFileSync(path.resolve(p), 'utf8')); } catch { return null; } };

// find image-manifest.json (handoff or photos dir)
const manPath = ['handoff/image-manifest.json', 'handoff/photos/image-manifest.json', 'image-manifest.json']
  .map((p) => path.resolve(`${V2}/${p}`)).find((p) => fs.existsSync(p));
const man = manPath ? readJson(manPath) : null;
if (!man) {
  // honest gap: no classified images → every image slot is missing real content
  const out = { slug, schema_version: 'image-decisions/1', standard: 'docs/v3/SOP-IMAGE-STRATEGY.md', manifest: null, decisions: [], summary: { real_used: 0, stock_used: 0, missing: 'ALL', note: 'no image-manifest.json — run pl:classify-images (two-pass · codex R87) first' } };
  if (JSON_OUT) { console.log(JSON.stringify(out, null, 2)); process.exit(0); }
  fs.mkdirSync(path.resolve(`${V2}/editorial-output`), { recursive: true });
  fs.writeFileSync(path.resolve(`${V2}/editorial-output/image-decisions.json`), JSON.stringify(out, null, 2));
  console.log(`⚠️  ${slug}: no image-manifest.json → all image slots = missing real content (run pl:classify-images first)`);
  process.exit(0);
}

const cls = man.classifications || [];
const rec = man.recommendations || {};
const byFile = Object.fromEntries(cls.map((c) => [c.filename, c]));
const q = (f) => byFile[f]?.quality_score ?? 0;
const fit = (f) => byFile[f]?.brand_fit_for_roofing_site ?? byFile[f]?.brand_fit ?? 0;

const HERO_Q = 8, HERO_FIT = 7, CONTENT_Q = 6;
const realOf = (f, why) => ({ chosen: f, provenance: { tier: 'verified', source_kind: 'customer_photo' }, usage_intent: 'real_content', quality_score: q(f), brand_fit: fit(f), reason: why });
const stockOf = (intent, why) => ({ chosen: null, provenance: { tier: 'stock_placeholder', source_kind: 'template_stock' }, usage_intent: intent, reason: why });

const decisions = [];

// hero (strict gate)
{
  const cand = rec.homepage_hero || (cls.find((c) => c.category === 'hero' && c.usable)?.filename);
  if (cand && q(cand) >= HERO_Q && fit(cand) >= HERO_FIT) decisions.push({ slot: 'hero', ...realOf(cand, `real hero passes gate (q${q(cand)}≥${HERO_Q}, fit${fit(cand)}≥${HERO_FIT})`) });
  else if (cand) decisions.push({ slot: 'hero', ...stockOf('intentional_design_asset', `real hero candidate ${cand} below gate (q${q(cand)}/fit${fit(cand)}) → polished stock preferred`), rejected: [{ file: cand, q: q(cand), fit: fit(cand) }] });
  else decisions.push({ slot: 'hero', ...stockOf('fallback_missing_real', 'no real hero candidate') });
}

// gallery (real-first · authenticity)
{
  const pool = (rec.gallery && rec.gallery.length ? rec.gallery : cls.filter((c) => ['gallery', 'hero'].includes(c.category) && c.usable).map((c) => c.filename));
  const real = [...new Set(pool)].filter((f) => q(f) >= CONTENT_Q);
  decisions.push({ slot: 'gallery', chosen: real, provenance: { tier: 'verified', source_kind: 'customer_photo' }, usage_intent: 'real_content', count: real.length, reason: `real-first · ${real.length} photos q≥${CONTENT_Q}`, note: real.length < 4 ? `only ${real.length} real (<4) · supplement or single-grid` : undefined });
}

// services (real if decent · else stock)
{
  const svc = Object.entries(rec).filter(([k]) => k.startsWith('service_'));
  for (const [k, f] of svc) {
    if (f && q(f) >= CONTENT_Q) decisions.push({ slot: k, ...realOf(f, `real service image q${q(f)}≥${CONTENT_Q}`) });
    else decisions.push({ slot: k, ...stockOf(f ? 'intentional_design_asset' : 'fallback_missing_real', f ? `real ${f} below gate (q${q(f)})` : 'no real service image') });
  }
}

const real_used = decisions.filter((d) => d.usage_intent === 'real_content').length + (decisions.find((d) => d.slot === 'gallery')?.count ? 1 : 0);
const stock_used = decisions.filter((d) => /stock/.test(d.provenance?.tier || '')).length;
const fallback_missing = decisions.filter((d) => d.usage_intent === 'fallback_missing_real').length;
const summary = { total_classified: man.total_classified, total_real_photos: man.total_real_photos, slots: decisions.length, real_slots: decisions.filter((d) => d.usage_intent === 'real_content').length, gallery_real: decisions.find((d) => d.slot === 'gallery')?.count || 0, stock_slots: stock_used, fallback_missing_real: fallback_missing };
const out = { slug, schema_version: 'image-decisions/1', standard: 'docs/v3/SOP-IMAGE-STRATEGY.md', manifest: path.relative(REPO, manPath), summary, decisions };

if (JSON_OUT) { console.log(JSON.stringify(out, null, 2)); process.exit(0); }
fs.mkdirSync(path.resolve(`${V2}/editorial-output`), { recursive: true });
fs.writeFileSync(path.resolve(`${V2}/editorial-output/image-decisions.json`), JSON.stringify(out, null, 2));
console.log(`\n=== image-decisions · ${slug} (SOP-IMAGE-STRATEGY · decision layer · no render wiring yet) ===`);
console.log(`manifest: ${man.total_real_photos}/${man.total_classified} real photos`);
for (const d of decisions) {
  if (d.slot === 'gallery') console.log(`  gallery   → ${d.count} REAL photos (q≥${CONTENT_Q}): ${(d.chosen || []).join(', ')}${d.note ? ' · ⚠️ ' + d.note : ''}`);
  else console.log(`  ${d.slot.padEnd(9)} → ${d.chosen ? 'REAL ' + d.chosen + ` (q${d.quality_score}/fit${d.brand_fit})` : 'STOCK (' + d.usage_intent + ')'}`);
}
console.log(`\nsummary: ${summary.real_slots} real slots · gallery ${summary.gallery_real} real · ${summary.stock_slots} stock (${summary.fallback_missing_real} forced-missing)`);
console.log(`✓ → ${path.relative(REPO, path.resolve(`${V2}/editorial-output/image-decisions.json`))}`);
