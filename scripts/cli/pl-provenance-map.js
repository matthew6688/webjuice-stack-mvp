#!/usr/bin/env node
/**
 * pl:provenance-map · codex R83 (P2-1b) · normalize all existing _source/source/_provenance
 * signals into ONE canonical provenance map (docs/v3/SOP-PROVENANCE.md).
 *
 * READER ONLY (CLAUDE.md §6): reads core-extract / single-page-brief / hero-copy / services /
 * selected — does NOT modify them. SOLE writer of clients/<slug>/v2/provenance-map.json.
 * Deterministic + repeatable.
 *
 * Output: per rendered-section entries {section, field, tier, source_kind, replace_policy,
 * raw_source, raw_field, value_preview} + a summary distribution.
 *
 * Usage: node scripts/cli/pl-provenance-map.js --slug <slug> [--json]
 */
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
process.chdir(REPO);
const argv = process.argv.slice(2);
const slug = (() => { const i = argv.indexOf('--slug'); return i >= 0 ? argv[i + 1] : null; })();
const JSON_OUT = argv.includes('--json');
if (!slug) { console.error('--slug required'); process.exit(1); }
const V2 = `clients/${slug}/v2`;
const readJson = (p) => { try { return JSON.parse(fs.readFileSync(path.resolve(`${V2}/${p}`), 'utf8')); } catch { return null; } };
const readYaml = (p) => { try { return yaml.load(fs.readFileSync(path.resolve(`${V2}/${p}`), 'utf8')); } catch { return null; } };

// ── §3 dialect → canonical normalizer ──
const REPLACE = { verified: 'none', geo_derived: 'none', ai_inferred: 'confirm', ai_placeholder: 'replace_required', stock_placeholder: 'replace_required' };
function normalize(raw) {
  const s = String(raw == null ? '' : raw).toLowerCase().trim();
  let tier, kind;
  if (/^gbp$/.test(s)) [tier, kind] = ['verified', 'gbp'];
  else if (/website[-_ ]?crawl/.test(s)) [tier, kind] = ['verified', 'website_crawl'];
  else if (/^abn$|abn[-_ ]?register/.test(s)) [tier, kind] = ['verified', 'abn_register'];
  else if (/official[-_ ]?registry/.test(s)) [tier, kind] = ['verified', 'official_registry'];
  else if (/tinyfish|directory/.test(s)) [tier, kind] = ['verified', 'directory_mention'];
  else if (/whois/.test(s)) [tier, kind] = ['verified', 'whois'];
  else if (/wayback/.test(s)) [tier, kind] = ['verified', 'wayback'];
  else if (/master[-_. ]?md|customer[-_ ]?(extract|intake|provided)/.test(s)) [tier, kind] = ['verified', 'customer_intake'];
  else if (/stock[_-]?placeholder|^stock$/.test(s)) [tier, kind] = ['stock_placeholder', 'stock'];
  else if (/ai[-_ ]?fabricated|fabricat/.test(s)) [tier, kind] = ['ai_placeholder', 'llm_fabricated'];
  else if (/ai[-_ ]?placeholder|^placeholder$/.test(s)) [tier, kind] = ['ai_placeholder', 'placeholder'];
  else if (/geo_derived|radius[-_ ]?inferred|centroid/.test(s)) [tier, kind] = ['geo_derived', 'centroid_radius'];
  else if (/niche typical|niche[-_ ]?template/.test(s)) [tier, kind] = ['ai_inferred', 'niche_template'];
  else if (/ai[-_ ]?inferred|ai[-_ ]?completed|^ai-completed:|ollama|llm/.test(s)) [tier, kind] = ['ai_inferred', 'llm'];
  else if (/^(verified|real)$/.test(s)) [tier, kind] = ['verified', 'unspecified'];
  else [tier, kind] = ['ai_inferred', 'unknown']; // conservative: unknown → confirm
  return { tier, source_kind: kind, replace_policy: REPLACE[tier] };
}

const ce = readJson('core-extract.json');
const brief = readYaml('single-page-brief.yaml');
const hero = readJson('handoff/od-package/content/hero-copy.json');
const services = readJson('handoff/od-package/content/services.json');
const selected = readJson('handoff/photos/selected.json');

const entries = [];
const add = (section, field, raw, preview) => entries.push({ section, field, ...normalize(raw), raw_source: raw == null ? null : String(raw), value_preview: preview ? String(preview).slice(0, 60) : undefined });
const firstSource = (v) => Array.isArray(v) ? v[0] : v;

// ── facts (core-extract real_facts_sources · per field) ──
const rfs = ce?.brief?.real_facts_sources || {};
const rf = ce?.brief?.real_facts || {};
for (const f of ['business_name', 'phone', 'address', 'abn', 'founded_year', 'email', 'license_numbers']) {
  if (rfs[f] !== undefined || rf[f] !== undefined) add('facts', f, firstSource(rfs[f]) ?? 'verified', JSON.stringify(rf[f])?.slice(0, 40));
}

// ── hero (composer reads hero-copy candidate) ──
if (hero?.candidates?.length) {
  const idx = hero.recommended_index ?? 0;
  const c = hero.candidates[idx] || hero.candidates[0];
  add('hero', `candidate[${idx}].headline/subheadline`, c._source || c.source || 'ai-inferred', c.headline);
}

// ── services (composer reads services.json short_desc) ──
for (const s of (services?.services || [])) add('services', s.name, firstSource(s.source) || s._source || 'ai-inferred', s.short_desc || s.desc);

// ── suburbs (brief: verified covered + candidates) ──
for (const s of (brief?.suburbs_covered || [])) add('suburbs', s, 'verified', s);
for (const s of (brief?.suburbs_candidates || [])) add('suburbs', (s.suburb || s.name), s.provenance || 'ai-inferred', `${s.suburb || s.name}${s.distance_km != null ? ' ' + s.distance_km + 'km' : ''}`);

// ── license / footer ──
if (brief?.license) {
  if (brief.license.status === 'omit' || !brief.license.number) add('footer.license', 'license', 'verified', 'omitted (ABN-only · no displayable licence)');
  else add('footer.license', 'license', 'official_registry', `${brief.license.authority} ${brief.license.number}`);
}

// ── reviews (brief provenance enum) ──
for (const r of (brief?.reviews || [])) add('reviews', r.name || 'review', r._provenance || r.provenance || 'ai_placeholder', r.text);

// ── images (selected.json · real customer photo vs stock/ai) ──
const imgs = selected?.selected || selected?.by_category || selected?.classifications || [];
for (const im of (Array.isArray(imgs) ? imgs : [])) {
  const isReal = /customer|real|upload/i.test(JSON.stringify(im._source || im.source || im.kind || ''));
  add('images', im.category || im.role || im.filename || 'image', isReal ? 'customer-extract' : (im._source || im.source || 'stock'), im.filename || im.description);
}

// ── missing_sections (codex R84 #2: material GAP · NOT faked as ai_placeholder · separate) ──
const missing_sections = [];
const realReviews = (brief?.reviews || []).filter((r) => /^real$/i.test(r._provenance || r.provenance || ''));
if (realReviews.length === 0) missing_sections.push({ section: 'reviews', expected: '≥3 real Google reviews', reason: (brief?.reviews || []).length ? 'only placeholder reviews present' : 'no reviews populated', client_action: 'provide_real_content' });
const realImgs = (Array.isArray(imgs) ? imgs : []).filter((im) => /customer|real|upload/i.test(JSON.stringify(im._source || im.source || im.kind || '')));
if (realImgs.length === 0) missing_sections.push({ section: 'images', expected: 'real customer job photos', reason: (Array.isArray(imgs) && imgs.length) ? 'only stock/AI images present' : 'no curated photos', client_action: 'provide_real_content' });

// ── summary ──
const summary = { verified: 0, geo_derived: 0, ai_inferred: 0, ai_placeholder: 0, stock_placeholder: 0, replace_required: 0, confirm: 0, none: 0 };
for (const e of entries) { summary[e.tier]++; summary[e.replace_policy]++; }
summary.missing_sections = missing_sections.length;
summary.client_action_required = summary.replace_required + missing_sections.length;

const out = { slug, schema_version: 'provenance-map/1', standard: 'docs/v3/SOP-PROVENANCE.md', summary, missing_sections, sections: entries };
if (JSON_OUT) { console.log(JSON.stringify(out, null, 2)); process.exit(0); }
fs.writeFileSync(path.resolve(`${V2}/provenance-map.json`), JSON.stringify(out, null, 2));
console.log(`\n=== provenance-map · ${slug} ===`);
console.log(`entries: ${entries.length} · verified ${summary.verified} · geo_derived ${summary.geo_derived} · ai_inferred ${summary.ai_inferred} · ai_placeholder ${summary.ai_placeholder} · stock ${summary.stock_placeholder}`);
console.log(`replace_required: ${summary.replace_required} · confirm: ${summary.confirm} · keep(none): ${summary.none}`);
if (missing_sections.length) console.log(`missing_sections (client must provide real content): ${missing_sections.map((m) => m.section).join(', ')}`);
console.log(`client_action_required: ${summary.client_action_required} (replace_required ${summary.replace_required} + missing ${missing_sections.length})`);
const byPolicy = (p) => entries.filter((e) => e.replace_policy === p);
for (const p of ['replace_required', 'confirm']) {
  const list = byPolicy(p); if (!list.length) continue;
  console.log(`\n[${p}]`);
  list.slice(0, 12).forEach((e) => console.log(`  · ${e.section}/${e.field} — ${e.tier}/${e.source_kind}${e.value_preview ? ' · "' + e.value_preview + '"' : ''}`));
  if (list.length > 12) console.log(`  …(+${list.length - 12} more)`);
}
console.log(`\n✓ → ${path.relative(REPO, path.resolve(`${V2}/provenance-map.json`))}`);
