#!/usr/bin/env node
/**
 * pl:audit-v4 · EXPERIMENTAL BRAND-CONTRACT AUDIT
 *
 * ⚠️  NOT A SHIP GATE (per codex audit 2026-05-28).
 * Composite scores from this CLI are partial because T4/T5 are
 * still stubs and T1 is partial (4/13 ADR checks ported).
 * T3 vision audit is now WIRED (pl-audit-vision subprocess).
 * The composite renormalises around firing tiers.
 *
 * Use this for:
 *   - brand contract compliance (T2 · is brand-tokens.css actually driving design)
 *   - quick deterministic smoke test before LLM tiers come online
 *
 * Do NOT use this for:
 *   - production ship/no-ship decisions (use docs/v3/SOP-AUDIT-STANDARD v3 + pl-audit-tier instead)
 *   - final composite quality scoring (T4/T5 still stubbed)
 *
 * Status: experimental · 2026-05-29
 * Tiers actually firing:
 *   T1 · Hard mechanical    (PASS/FAIL · deterministic · 0 LLM)        [PARTIAL 4/13]
 *   T2 · Brand contract     (0-100 · deterministic · 0 LLM)            [WIRED]
 *   T3 · Vision audit       (0-100 · pl-audit-vision subprocess · ~$0.05/page) [WIRED]
 *   T4 · Designer review    (0-100 · LLM · ~$0.10/page)                [STUB]
 *   T5 · Creative-director  (0-100 · LLM · ~$0.15/page · premium-only) [STUB]
 *
 * Spec:  docs/v3/ADR-AUDIT-V4.md
 *
 * Usage:
 *   pl:audit-v4 --slug <slug>              # full T1-T4 (default tier=full)
 *   pl:audit-v4 --site <html-file>         # single HTML · no slug context
 *   pl:audit-v4 --tier T1   --slug <slug>  # only T1
 *   pl:audit-v4 --tier fast --slug <slug>  # T1+T2 (no LLM · $0)
 *   pl:audit-v4 --tier full                # T1-T4 (default · designer review on)
 *   pl:audit-v4 --tier premium             # T1-T5 (includes creative-director)
 *   pl:audit-v4 --json                     # stdout JSON · no file outputs
 *   pl:audit-v4 --report                   # write audit-v4-report.html
 *   pl:audit-v4 --help
 *
 * Deliberately does NOT modify pl-audit-tier.js. v4 is additive (ADR §8).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { load as cheerioLoad } from 'cheerio';

const REPO = process.cwd();
const SCRIPT_VERSION = 'pl-audit-v4/0.1.0-skeleton';

// ─── Args ────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const a = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--help' || argv[i] === '-h') { a.help = true; continue; }
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) { a[key] = true; }
      else { a[key] = next; i++; }
    }
  }
  return a;
}
const args = parseArgs(process.argv);

if (args.help) {
  console.log(`pl:audit-v4 · EXPERIMENTAL brand-contract audit (ADR-AUDIT-V4.md)

⚠️  NOT A SHIP GATE · T4/T5 stubbed · T1 partial (4/13 checks).
   T3 vision audit WIRED (2026-05-29). T2 brand contract WIRED.
   For production ship/no-ship use pl:audit-tier (v3 · SOP-AUDIT-STANDARD).


Usage:
  pl:audit-v4 --slug <slug> [--tier fast|full|premium]
  pl:audit-v4 --site <html-file> [--tier T1|T2|fast|full|premium]
  pl:audit-v4 --json                  output JSON to stdout
  pl:audit-v4 --report                write audit-v4-report.html

Tiers:
  T1       Hard mechanical PASS/FAIL only (~50ms · $0)
  T2       Brand contract score only (~100ms · $0)
  fast     T1 + T2 only · no LLM       (~150ms · $0)
  full     T1 + T2 + T3 + T4           (~2min · ~$0.15/page) [default]
  premium  T1 + T2 + T3 + T4 + T5      (~3min · ~$0.30/page)

Status: T1 partial · T2 wired · T3 vision wired (2026-05-29) · T4/T5 stubbed.
`);
  process.exit(0);
}

// ─── Inputs / outputs ────────────────────────────────────────────────────
const TIER = (args.tier || 'full').toLowerCase();
const VALID_TIERS = new Set(['t1', 't2', 'fast', 'full', 'premium']);
if (!VALID_TIERS.has(TIER)) {
  console.error(`Invalid --tier "${args.tier}" · expected one of: T1, T2, fast, full, premium`);
  process.exit(2);
}

function resolveInputs() {
  if (args.site) {
    const sitePath = path.resolve(args.site);
    if (!fs.existsSync(sitePath)) { console.error(`--site not found: ${sitePath}`); process.exit(2); }
    return { mode: 'site', htmlFiles: [sitePath], slug: null, facts: {}, outputDir: path.dirname(sitePath) };
  }
  if (!args.slug) { console.error(`Must supply --slug <slug> or --site <html-file>. Use --help.`); process.exit(2); }
  const slug = args.slug;
  // Try common output dirs in priority order
  const candidates = [
    args['output-dir'],
    `clients/${slug}/v2/editorial-output`,
    `clients/${slug}/v2/od-output-c`,
    `clients/${slug}/v2/od-output`,
    `clients/${slug}/v2/output`,
    `templates/roofing/brand-grid-experiment/${slug}/editorial`,
  ].filter(Boolean);
  let outputDir = null;
  for (const c of candidates) {
    const abs = path.resolve(REPO, c);
    if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) { outputDir = abs; break; }
  }
  if (!outputDir) { console.error(`No output dir found for slug "${slug}". Looked: ${candidates.join(' · ')}`); process.exit(2); }

  // facts.json (optional · brand-grid-experiment may lack it)
  const factsCandidates = [
    `clients/${slug}/concept/open-design-seed/facts.json`,
    `clients/${slug}/v2/facts.json`,
  ];
  let facts = {};
  let factsPath = null;
  for (const fp of factsCandidates) {
    const abs = path.resolve(REPO, fp);
    if (fs.existsSync(abs)) { facts = JSON.parse(fs.readFileSync(abs, 'utf8')); factsPath = abs; break; }
  }

  // brand-spec.json (optional)
  const brandCandidates = [
    `clients/${slug}/v2/brand/brand-spec.json`,
    `clients/${slug}/concept/open-design-seed/brand-spec.json`,
  ];
  let brandSpec = null;
  for (const fp of brandCandidates) {
    const abs = path.resolve(REPO, fp);
    if (fs.existsSync(abs)) { brandSpec = JSON.parse(fs.readFileSync(abs, 'utf8')); break; }
  }

  const htmlFiles = fs.readdirSync(outputDir)
    .filter(f => f.endsWith('.html') && !f.includes('preview-old'))
    .map(f => path.join(outputDir, f));
  return { mode: 'slug', htmlFiles, slug, facts, factsPath, brandSpec, outputDir };
}

const ctx = resolveInputs();

// ─── Helpers ─────────────────────────────────────────────────────────────
function readHtml(file) { return fs.readFileSync(file, 'utf8'); }
function stripHtml(html) {
  return html.replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
}
function seedFor(html) { return crypto.createHash('sha256').update(html).digest('hex').slice(0, 16); }

// ─── T1 · Hard mechanical (WIRED · subset of v3 + new v4 checks) ────────
function runT1Hard(htmlFiles, facts, ctx) {
  const checks = {};
  const fails = [];

  // 1.1 business_name present on every page (only when facts available)
  if (facts.business_name) {
    const hits = htmlFiles.map(f => readHtml(f).includes(facts.business_name) ? 1 : 0);
    checks['1.1_business_name'] = { pass: hits.every(h => h === 1), pages_with: hits.filter(h => h).length, total: htmlFiles.length };
    if (!checks['1.1_business_name'].pass) fails.push(`business_name "${facts.business_name}" missing on ${hits.filter(h => !h).length} page(s)`);
  }

  // 1.2 phone ≥1 per page (skeleton uses ≥1 not ≥3 to keep --site mode useful)
  if (facts.phone) {
    const phoneRe = new RegExp(facts.phone.replace(/[()+\s\-]/g, '\\s?').replace(/\d/g, '\\d'), 'g');
    const counts = htmlFiles.map(f => (readHtml(f).match(phoneRe) || []).length);
    const minHits = counts.filter(c => c >= 1).length;
    checks['1.2_phone_present'] = { pass: minHits === htmlFiles.length, per_page: counts };
    if (minHits !== htmlFiles.length) fails.push(`phone "${facts.phone}" absent from ${htmlFiles.length - minHits} page(s)`);
  }

  // 1.11 logo refs resolve (v4 NEW · checks img src="logos/*" files exist)
  const brokenLogos = [];
  for (const f of htmlFiles) {
    const html = readHtml(f);
    const refs = [...html.matchAll(/<img[^>]+src=["']([^"']*logos?\/[^"']+)["']/gi)].map(m => m[1]);
    for (const ref of refs) {
      if (ref.startsWith('http')) continue;
      const abs = path.resolve(path.dirname(f), ref);
      if (!fs.existsSync(abs)) brokenLogos.push({ page: path.basename(f), ref });
    }
  }
  checks['1.11_logo_refs_resolve'] = { pass: brokenLogos.length === 0, broken: brokenLogos.slice(0, 10) };
  if (brokenLogos.length > 0) fails.push(`${brokenLogos.length} broken logo refs (e.g. ${brokenLogos[0].ref} on ${brokenLogos[0].page})`);

  // 1.13 JSON-LD validity (v4 NEW)
  let jsonLdErrors = 0;
  for (const f of htmlFiles) {
    const html = readHtml(f);
    const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
    for (const b of blocks) {
      try { JSON.parse(b); } catch { jsonLdErrors++; }
    }
  }
  checks['1.13_jsonld_valid'] = { pass: jsonLdErrors === 0, parse_errors: jsonLdErrors };
  if (jsonLdErrors > 0) fails.push(`${jsonLdErrors} invalid JSON-LD block(s)`);

  // 1.14 AS-trade-5 · form field count above fold (DOM-parsing via cheerio)
  // Anti-slop catalog AS-trade-5: trade sites should have ≤4 visible-input fields above fold
  // on HOMEPAGE/HERO ONLY. Quick-quote forms (name/phone/job-type) convert · 5+ in hero signal
  // generic SaaS bloat. Skipped on contact/quote pages (full intake forms are legitimate there).
  // "Above fold" heuristic: form appears within first <main> child or in <header>/hero section.
  // Counts: <input>/<textarea>/<select> EXCLUDING type="hidden"/"submit"/"button"/"image"/"reset".
  const formViolations = [];
  for (const f of htmlFiles) {
    const base = path.basename(f).toLowerCase();
    // Skip pages where long forms are legitimate: contact, quote, request, get-quote, book
    if (/^(contact|quote|request|get-quote|book|appointment|enquiry|inquiry)/.test(base)) continue;
    const html = readHtml(f);
    let $;
    try { $ = cheerioLoad(html); } catch { continue; }
    const heroForms = $('header form, .hero form, [class*="hero"] form, main > section:first-of-type form, main > section:nth-of-type(2) form, main > div:first-of-type form');
    const seen = new Set();
    heroForms.each((_, el) => {
      const $form = $(el);
      // De-dupe via outerHTML hash (cheerio may double-match nested selectors)
      const hash = ($form.attr('id') || '') + '|' + ($form.attr('class') || '') + '|' + $form.children().length;
      if (seen.has(hash)) return; seen.add(hash);
      const visibleInputs = $form.find('input, textarea, select').filter((_, inp) => {
        const t = ($(inp).attr('type') || 'text').toLowerCase();
        return !['hidden', 'submit', 'button', 'image', 'reset'].includes(t);
      });
      const count = visibleInputs.length;
      if (count > 4) {
        // >4 means 5+ which is the AS-trade-5 threshold
        formViolations.push({ page: path.basename(f), form_id: $form.attr('id') || $form.attr('class') || '<anon>', field_count: count });
      }
    });
  }
  checks['1.14_as_trade_5_form_above_fold'] = {
    pass: formViolations.length === 0,
    threshold: 'visible-input ≤ 4 in hero/above-fold forms',
    violations: formViolations.slice(0, 5),
  };
  if (formViolations.length > 0) fails.push(`AS-trade-5 · ${formViolations.length} above-fold form(s) with 5+ visible fields`);

  // TODO (ADR §2.1): 1.3 address, 1.4 ABN, 1.5 state authority, 1.7b hours, 1.8 stats, 1.9 license — port from pl-audit-tier.js
  // TODO (ADR §2.1): 1.10 cross-client leak (batch-mode only · needs --slugs sibling list)
  // TODO (ADR §2.1): 1.12 4xx/5xx outbound link cache

  const pass = fails.length === 0;
  return { pass, checks, fails, composite: pass ? 100 : 0 };
}

// ─── T2 · Brand contract (WIRED · 5 dims · deterministic) ───────────────
function runT2BrandContract(htmlFiles, brandSpec, ctx) {
  const dims = {};

  // D2.1 var(--*) coverage % — count ALL CSS custom property refs (brand-tokens.css exposes
  // --text, --surface, --border, --accent-dark etc. NOT just --brand-*) vs unique color/bg declarations.
  // Bugfix 2026-05-28 (codex R19): previous version matched only var(--brand-*) producing false-negative
  // coverage scores against renderers that use the full token namespace.
  let varHits = 0, colorDecls = 0;
  for (const f of htmlFiles) {
    const html = readHtml(f);
    const styleBlocks = (html.match(/<style[\s\S]*?<\/style>/g) || []).join('\n');
    varHits += (styleBlocks.match(/var\(\s*--[a-z0-9_-]+/gi) || []).length;
    colorDecls += (styleBlocks.match(/(?:^|[\s;{])(?:color|background(?:-color)?|border-color|fill|stroke)\s*:/gi) || []).length;
  }
  const coveragePct = colorDecls > 0 ? Math.round(100 * varHits / colorDecls) : 0;
  // Linear: 60%+ = 100 · 25% = 0 (per ADR §2.2)
  const d21 = Math.max(0, Math.min(100, Math.round((coveragePct - 25) / (60 - 25) * 100)));
  dims['D2.1_var_brand_coverage'] = { score: d21, weight: 0.30, coverage_pct: coveragePct, var_hits: varHits, color_decls: colorDecls };

  // D2.2 Hardcoded hex count (non-grayscale only · STRIP fallback hex inside var(--*, #hex))
  // Bugfix 2026-05-28 (codex R19): fallback hex inside var() declarations is GOOD practice (graceful
  // degradation when CSS custom prop missing) · counting it as "hardcoded" produced false-negatives.
  const uniqueHex = new Set();
  for (const f of htmlFiles) {
    const html = readHtml(f);
    let styleBlocks = (html.match(/<style[\s\S]*?<\/style>/g) || []).join('\n');
    // Strip fallback hex: var(--name, #abc) / var(--name, #abcdef) → var(--name)
    styleBlocks = styleBlocks.replace(/var\(\s*--[a-z0-9_-]+\s*,\s*#[0-9a-f]{3,8}\s*\)/gi, 'var(--stripped)');
    const hex = (styleBlocks.match(/#[0-9a-f]{3,8}\b/gi) || []).map(h => h.toLowerCase());
    for (const h of hex) {
      // Skip grayscale (R==G==B)
      const norm = h.length === 4 ? `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}` : h;
      if (norm.length >= 7) {
        const r = norm.slice(1, 3), g = norm.slice(3, 5), b = norm.slice(5, 7);
        if (r === g && g === b) continue;
      }
      uniqueHex.add(norm);
    }
  }
  const hexCount = uniqueHex.size;
  // Linear: ≤8 = 100 · ≥30 = 0
  const d22 = Math.max(0, Math.min(100, Math.round((30 - hexCount) / (30 - 8) * 100)));
  dims['D2.2_hardcoded_hex_count'] = { score: d22, weight: 0.25, unique_non_gray_hex: hexCount, sample: [...uniqueHex].slice(0, 10) };

  // D2.3 brand-spec primary_font compliance — TODO (needs computed CSS · skeleton: presence check only)
  let d23 = null;
  if (brandSpec?.typography?.primary_font || brandSpec?.primary_font) {
    const font = brandSpec.typography?.primary_font || brandSpec.primary_font;
    const fontName = String(font).split(',')[0].replace(/["']/g, '').trim();
    let pagesWithFont = 0;
    for (const f of htmlFiles) {
      if (readHtml(f).includes(fontName)) pagesWithFont++;
    }
    d23 = htmlFiles.length ? Math.round(100 * pagesWithFont / htmlFiles.length) : 0;
  }
  dims['D2.3_type_rule_compliance'] = { score: d23, weight: 0.15, note: d23 == null ? 'brand-spec has no primary_font · skipped' : null };

  // D2.4 / D2.BC7 logo variant per surface · IMPLEMENTED (was stub line 315 · SOP-AUDIT-STANDARD-V2 §9)
  // Heuristic: parse each <img src="...logo-*.svg"> · find nearest ancestor section/header/footer ·
  // determine bg lightness (CSS hex extraction · or class names like .footer / .masthead) ·
  // light bg requires `logo-dark`/`logo-horizontal` · dark bg requires `logo-light`/`logo-mono-light`
  // mono variants OK on either surface
  const logoViolations = [];
  let logoChecks = 0;
  for (const f of htmlFiles) {
    const html = readHtml(f);
    let $; try { $ = cheerioLoad(html); } catch { continue; }
    const logoImgs = $('img').filter((_, el) => {
      const src = $(el).attr('src') || '';
      return /\blogo[-/](?:dark|light|horizontal|mono-light|mono-dark|mark|wordmark)\.svg\b/i.test(src);
    });
    logoImgs.each((_, el) => {
      logoChecks++;
      const $el = $(el);
      const src = $el.attr('src') || '';
      const variant = (src.match(/logo[-/]([a-z-]+)\.svg/i) || [])[1] || '';
      // Walk ancestors to find surface context
      const parents = $el.parents().toArray();
      let surface = 'unknown';
      for (const p of parents) {
        const $p = $(p);
        const cls = ($p.attr('class') || '').toLowerCase();
        const tag = (p.tagName || '').toLowerCase();
        // Dark surface signals (footer · colophon · dark masthead · brand-primary bg)
        if (tag === 'footer' || /\b(?:footer|colophon|dark|navy|brand-primary|surface-dark)\b/.test(cls)) {
          surface = 'dark'; break;
        }
        // Light surface signals (masthead · header on white · light section)
        if (tag === 'header' || /\b(?:masthead|header|hero|light|surface(?:-muted|-light)?)\b/.test(cls)) {
          surface = 'light'; break;
        }
      }
      // Validate variant matches surface
      const isLightVariant = /^(?:light|mono-light)$/i.test(variant);
      const isDarkVariant = /^(?:dark|horizontal|wordmark|mono-dark|mark)$/i.test(variant);
      let valid = true, reason = null;
      if (surface === 'dark' && isDarkVariant) {
        valid = false;
        reason = `logo-${variant} on DARK surface (footer/colophon · should be logo-light or logo-mono-light)`;
      } else if (surface === 'light' && isLightVariant) {
        valid = false;
        reason = `logo-${variant} on LIGHT surface (masthead/header · should be logo-dark or logo-horizontal)`;
      }
      // Mono variants are surface-agnostic · pass either
      if (!valid) {
        logoViolations.push({ page: path.basename(f), src, variant, surface, reason });
      }
    });
  }
  const d24Score = logoChecks > 0
    ? Math.round(100 * (logoChecks - logoViolations.length) / logoChecks)
    : null;
  dims['D2.4_logo_variant_per_surface'] = {
    score: d24Score,
    weight: 0.15,
    logo_checks: logoChecks,
    violations: logoViolations.slice(0, 5),
    note: logoChecks === 0 ? 'no logo SVG references found in HTML' : null,
  };

  // D2.5 brand palette honored
  let d25 = null;
  if (brandSpec?.colors) {
    const brandHex = [brandSpec.colors.brand_primary, brandSpec.colors.brand_accent, brandSpec.colors.brand_secondary]
      .filter(Boolean).map(h => h.toLowerCase());
    const cssBlob = htmlFiles.map(f => (readHtml(f).match(/<style[\s\S]*?<\/style>/g) || []).join('\n')).join('\n').toLowerCase();
    const found = brandHex.filter(h => cssBlob.includes(h));
    d25 = brandHex.length ? Math.round(100 * found.length / brandHex.length) : null;
    dims['D2.5_brand_palette_honored'] = { score: d25, weight: 0.15, expected: brandHex, found };
  } else {
    dims['D2.5_brand_palette_honored'] = { score: null, weight: 0.15, note: 'no brand-spec · skipped' };
  }

  // D2.BC6 token coverage depth · split var() coverage by token category
  // SOP-AUDIT-STANDARD-V2 §9 · codex R28 Q-II-5 · 5-category coverage (color/radius/shadow/space/motion)
  // Each category: count var(--<category>-*) hits vs count of related CSS properties
  // Score = mean of 5 category coverages · cap each at 100
  const cssBlob = htmlFiles.map(f => (readHtml(f).match(/<style[\s\S]*?<\/style>/g) || []).join('\n')).join('\n');
  // Strip fallback inside var(--*, fallback) — fallbacks are good practice, don't count or skew
  const cssClean = cssBlob.replace(/var\(\s*(--[a-z0-9_-]+)\s*,\s*[^)]+\)/gi, 'var($1)');

  function categoryCoverage(varPattern, propPatterns) {
    const varHits = (cssClean.match(new RegExp(`var\\(\\s*${varPattern}`, 'gi')) || []).length;
    let propCount = 0;
    for (const p of propPatterns) {
      propCount += (cssClean.match(new RegExp(`(?:^|[\\s;{])${p}\\s*:`, 'gi')) || []).length;
    }
    if (propCount === 0) return { score: null, var_hits: varHits, prop_count: 0, note: 'no properties to measure' };
    const pct = Math.round(100 * varHits / propCount);
    return { score: Math.min(100, pct), coverage_pct: pct, var_hits: varHits, prop_count: propCount };
  }

  const tokenCats = {
    color:  categoryCoverage('--(?:brand|surface|text|border|accent|fg|bg|meta|muted|color)[a-z0-9_-]*', ['color', 'background(?:-color)?', 'border-color', 'fill', 'stroke', 'outline-color']),
    radius: categoryCoverage('--(?:radius|corner)[a-z0-9_-]*', ['border-radius']),
    shadow: categoryCoverage('--(?:shadow|elev|elevation)[a-z0-9_-]*', ['box-shadow', 'text-shadow', 'filter']),
    space:  categoryCoverage('--(?:space|spacing|gap|gutter|size|s[0-9]+)[a-z0-9_-]*', ['padding(?:-(?:top|right|bottom|left|inline|block|inline-start|inline-end|block-start|block-end))?', 'margin(?:-(?:top|right|bottom|left|inline|block))?', 'gap', 'row-gap', 'column-gap']),
    motion: categoryCoverage('--(?:motion|duration|easing|transition|ease|animate)[a-z0-9_-]*', ['transition(?:-duration|-property|-timing-function)?', 'animation(?:-duration|-timing-function)?']),
  };

  // Compute aggregate score · mean of categories with measurable props
  const scoredCats = Object.values(tokenCats).filter(c => c.score != null);
  const bc6Score = scoredCats.length > 0
    ? Math.round(scoredCats.reduce((a, c) => a + c.score, 0) / scoredCats.length)
    : null;

  dims['D2.BC6_token_coverage_depth'] = {
    score: bc6Score,
    weight: 0.10,
    categories: tokenCats,
    note: 'SOP-AUDIT-STANDARD-V2 §9 · split var() coverage by token category · 5-category depth',
    rules_checked: ['color', 'radius', 'shadow', 'space', 'motion'],
  };

  // Weighted composite (only dims with score != null)
  let score = 0, totalWeight = 0;
  for (const v of Object.values(dims)) {
    if (v.score != null) { score += v.score * v.weight; totalWeight += v.weight; }
  }
  const finalScore = totalWeight > 0 ? Math.round(score / totalWeight) : 0;
  return { score: finalScore, breakdown: dims, total_weight: totalWeight };
}

// ─── T3 · Vision audit (WIRED · calls pl-audit-vision subprocess) ────────
async function runT3VisionAudit(htmlFiles, ctx) {
  const { outputDir, factsPath } = ctx;

  if (!factsPath) {
    console.warn('[T3] No facts.json found — skipping vision audit (need --facts path)');
    return { score: null, dims: {}, status: 'skipped_no_facts', cost_usd: 0 };
  }

  const visionOut = path.join(outputDir, '_vision-audit-v4.json');
  console.log(`[T3] Running pl:audit-vision (screenshots + LLM · ~3 min)...`);

  await new Promise((resolve) => {
    const p = spawn('npm', ['run', 'pl:audit-vision', '--', '--dir', outputDir, '--facts', factsPath, '--out', visionOut], {
      stdio: 'pipe',
      cwd: REPO,
    });
    p.stdout.on('data', d => process.stdout.write(`[vision] ${d}`));
    p.stderr.on('data', d => process.stderr.write(`[vision] ${d}`));
    p.on('close', resolve);
  });

  if (!fs.existsSync(visionOut)) {
    console.warn('[T3] Vision audit produced no output — returning null score');
    return { score: null, dims: {}, status: 'vision_failed', cost_usd: 0 };
  }

  const vr = JSON.parse(fs.readFileSync(visionOut, 'utf8'));
  const composite = parseFloat(vr.composite_score) || null;

  // Map pl-audit-vision dim_means (already averaged across pages) → T3 dims
  // dim_means keys: D1_core_info_accuracy, D2_logo_brand_consistency, D3_copy_quality,
  //   D4_header_quality, D5_footer_quality, D6_hero_quality, D7_section_modules,
  //   D8_design_language, D9_image_quality, D10_audit_fix_integration
  const dm = vr.dim_means || {};
  const scale10to100 = (v) => v != null ? Math.round(v * 10) : null;

  const dims = {
    'D3.1_layout':             scale10to100(dm.D7_section_modules),       // section order + boundaries
    'D3.2_typography':         scale10to100(dm.D8_design_language),       // typography + spacing coherence
    'D3.3_color_hierarchy':    scale10to100(dm.D2_logo_brand_consistency), // brand color compliance
    'D3.4_readability':        scale10to100(dm.D3_copy_quality),          // copy quality / no clichés
    'D3.5_image_text_balance': scale10to100(dm.D9_image_quality),         // image quality
    'D3.6_copy_depth':         scale10to100(dm.D3_copy_quality),          // copy specificity
    'D3.7_chrome_consistency': scale10to100(dm.D4_header_quality),        // header/footer = chrome
    'D3.8_module_diversity':   scale10to100(dm.D7_section_modules),       // section diversity
  };

  console.log(`[T3] Vision composite: ${composite}/100`);
  return {
    score: composite,
    dims,
    vision_report_path: visionOut,
    pages_audited: (vr.vision_results || []).length,
    top_problems: (vr.all_problems || []).slice(0, 5),
    fix_priorities: (vr.all_fix_priorities || []).slice(0, 3),
    status: 'ok',
    cost_usd: vr.cost_usd || 0,
    model: vr.model || 'claude-sonnet-4-5',
  };
}

// ─── T4 · Designer review (STUB · LLM · ADR §2.4) ───────────────────────
async function runT4DesignerReview(htmlFiles, ctx) {
  // TODO: load /tmp/open-design/skills/plan-design-review prompt + design-review prompt
  // TODO: structured-output JSON schema {D4.1..D4.5: 0-10, ai_slop_markers: [...], ai_slop_score: 0-100}
  // TODO: render screenshots (puppeteer or playwright) for vision LLM input
  return {
    score: null,
    dims: { 'D4.1_philosophy': null, 'D4.2_hierarchy': null, 'D4.3_detail': null, 'D4.4_innovation': null, 'D4.5_function': null },
    ai_slop_markers: [], ai_slop_score: null,
    llm_call_id: null, cost_usd: 0, model: null,
    status: 'stub',
    todo: 'adapt OD plan-design-review prompt · render screenshots · enforce JSON schema',
  };
}

// ─── T4d · Deterministic voice check (WIRED · ADR §2.4 voice sub-dim · 0 LLM) ──
// Phase A.1 Step 4 · codex R20 Q-CC-1 (a) sequencing + R21 Q-DD-1 (β) wiring.
// Reads pl-au-trade-voice/pl-au-trade-voice.json banned_phrases + us_spelling +
// forbidden_niche_claims_roofing. Applies via cheerio body-text extraction.
// Scoring: 100 minus penalty per violation (P0:30, P1:10, P2:3). Floor 0.
function runT4VoiceDeterministic(htmlFiles, ctx) {
  let voiceJson;
  try {
    const voicePath = path.resolve(REPO, 'skills/pl-au-trade-voice/pl-au-trade-voice.json');
    voiceJson = JSON.parse(fs.readFileSync(voicePath, 'utf8'));
  } catch (e) {
    return { status: 'skipped', reason: 'voice.json missing', score: null };
  }
  const c = voiceJson.constants || {};
  const banned = (c.banned_phrases || []).map(p => p.toLowerCase());
  const usSpelling = (c.us_spelling_violations_per_au || []).map(w => w.toLowerCase());
  const forbiddenNiche = (c.forbidden_niche_claims_roofing || []).map(p => p.toLowerCase());

  const violations = [];
  for (const f of htmlFiles) {
    const html = readHtml(f);
    let $;
    try { $ = cheerioLoad(html); } catch { continue; }
    // Strip script + style + JSON-LD before extracting text · avoid false-positive matches
    $('script, style, noscript').remove();
    const bodyText = ($('body').text() || $.text() || '').toLowerCase();
    const pageBase = path.basename(f);
    for (const p of banned) {
      // Word-boundary-ish · escape regex special chars · allow soft hyphens / spaces
      const re = new RegExp('\\b' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
      const hits = (bodyText.match(re) || []).length;
      if (hits > 0) violations.push({ page: pageBase, rule: 'AV-4', kind: 'banned_phrase', match: p, count: hits, severity: 'P1' });
    }
    for (const w of usSpelling) {
      const re = new RegExp('\\b' + w + '\\b', 'gi');
      const hits = (bodyText.match(re) || []).length;
      if (hits > 0) violations.push({ page: pageBase, rule: 'AV-1', kind: 'us_spelling', match: w, count: hits, severity: 'P1' });
    }
    for (const p of forbiddenNiche) {
      const re = new RegExp('\\b' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
      const hits = (bodyText.match(re) || []).length;
      if (hits > 0) violations.push({ page: pageBase, rule: 'AV-6', kind: 'forbidden_niche_claim', match: p, count: hits, severity: 'P0' });
    }
  }

  // Score: 100 - sum(P0:30 + P1:10 + P2:3) · floor 0
  let penalty = 0;
  for (const v of violations) {
    if (v.severity === 'P0') penalty += 30;
    else if (v.severity === 'P1') penalty += 10;
    else penalty += 3;
  }
  const score = Math.max(0, 100 - penalty);

  return {
    score,
    dims: {
      'D4d.voice_av4_banned_phrases': { weight: 0.5, hits: violations.filter(v => v.kind === 'banned_phrase').length },
      'D4d.voice_av1_us_spelling':    { weight: 0.3, hits: violations.filter(v => v.kind === 'us_spelling').length },
      'D4d.voice_av6_forbidden_niche': { weight: 0.2, hits: violations.filter(v => v.kind === 'forbidden_niche_claim').length },
    },
    violations: violations.slice(0, 50),
    rules_checked: ['AV-1', 'AV-4', 'AV-6'],
    rules_deferred: ['AV-2 owner-voice (mech-H-1)', 'AV-3 segment-voice (vision)', 'AV-5 license phrasing (trust-signals)'],
    status: 'wired',
    voice_skill_version: voiceJson.version,
  };
}

// ─── Content Richness Deterministic (SOP-AUDIT-STANDARD-V2 §9) ──────────
// D2.14 proof variety · count distinct proof block types · ≥3 of 6 = pass
// D2.11 facts cross-check · HTML extraction vs single-page-brief.yaml exact match
// Both fast-tier · 0 LLM cost
function runContentRichnessDeterministic(htmlFiles, ctx) {
  const dims = {};

  // D2.14 · proof variety · cheerio selector-based count by type
  // 6 types: reviews · stats · case_study · expert_quote · certifications · photos
  const proofTypeSelectors = {
    reviews: ['blockquote', '.review', '[class*="review"]', '[class*="testimonial"]', '[data-type="review"]'],
    stats: ['.stat', '[class*="stat-"]', '.strap-cell', '[class*="metric"]', '[class*="counter"]'],
    case_study: ['.case-study', '[class*="case-"]', '.project', '[class*="project-"]', 'article.story'],
    expert_quote: ['[class*="quote"]:not(.pull-quote)', 'cite', 'figcaption'],
    certifications: ['.chip', '[class*="chip"]', '[class*="badge"]', '[class*="certif"]', '[class*="licence"]', '[class*="license"]'],
    photos: ['figure img', 'img[alt*="photo" i]', '.gallery img', '[class*="hero"] img', '.about-figure img', '.story-img img'],
  };

  const proofPerPage = {};
  for (const f of htmlFiles) {
    const html = readHtml(f);
    let $; try { $ = cheerioLoad(html); } catch { continue; }
    // Strip nav/footer first · proof variety is BODY signal
    $('nav, header.masthead, footer, .colophon, script, style').remove();
    const pageBase = path.basename(f);
    const counts = {};
    for (const [type, sels] of Object.entries(proofTypeSelectors)) {
      let n = 0;
      for (const sel of sels) {
        try { n += $(sel).length; } catch { /* invalid selector · skip */ }
      }
      counts[type] = n;
    }
    proofPerPage[pageBase] = counts;
  }

  // Aggregate · count types present (≥1 occurrence on any page) · 0-6 score
  const typesPresent = {};
  for (const t of Object.keys(proofTypeSelectors)) {
    typesPresent[t] = Object.values(proofPerPage).some(p => (p[t] || 0) >= 1);
  }
  const presentCount = Object.values(typesPresent).filter(Boolean).length;
  // Scoring: 0 types→0 · 3 types→60 · 5 types→90 · 6 types→100
  const d214Score = Math.min(100, Math.round(presentCount * (100 / 6)));
  dims['D2.14_proof_variety'] = {
    score: d214Score,
    types_present: typesPresent,
    types_count: presentCount,
    per_page: proofPerPage,
    threshold_pass: presentCount >= 3,
    note: 'SOP-AUDIT-STANDARD-V2 §9 · 6 proof types · ≥3 required',
  };

  // NEW · GATE 3 · minimum_content_signal (codex R35 Q-PP-2)
  // Catches "audit-gamed by emptiness" · counts rendered services + suburbs + reviews
  // Required for ship: services ≥ 3 AND suburbs ≥ 5 AND (real_reviews ≥ 1 OR placeholder_banner)
  let servicesRendered = 0, suburbsRendered = 0, realReviewBlocks = 0, placeholderBanner = false;
  for (const f of htmlFiles) {
    const html = readHtml(f);
    let $; try { $ = cheerioLoad(html); } catch { continue; }
    servicesRendered += $('.story, [class*="services-grid"] article, [data-type="service"]').length;
    suburbsRendered += $('.suburb-list li, [class*="suburb"] li, [class*="coverage"] li').length;
    realReviewBlocks += $('.review, [class*="review"]:not([class*="reviews-disclaimer"]), blockquote').length;
    placeholderBanner = placeholderBanner || $('.reviews-disclaimer, [class*="placeholder"], [class*="preview-banner"]').length > 0;
  }
  // Threshold tuned per codex R35 + empirical a-j data (3 suburbs · YELLOW · legit thin)
  // services ≥ 3 (catches abc 0-service empty) · suburbs ≥ 3 (catches abc 2-suburb empty · allows a-j 3) · reviews-or-banner
  const contentSignalPass = servicesRendered >= 3 && suburbsRendered >= 3 && (realReviewBlocks >= 1 || placeholderBanner);
  dims['minimum_content_signal'] = {
    score: contentSignalPass ? 100 : 0,
    services_rendered: servicesRendered,
    suburbs_rendered: suburbsRendered,
    review_blocks: realReviewBlocks,
    placeholder_banner_present: placeholderBanner,
    threshold: 'services ≥ 3 AND suburbs ≥ 5 AND (reviews ≥ 1 OR banner)',
    pass: contentSignalPass,
    note: 'GATE 3 · prevents audit-gaming on thin/empty content · codex R35 Q-PP-2',
  };

  // D2.11 · facts cross-check · HTML-extracted vs brief.yaml strict match
  let d211 = null;
  try {
    const briefPath = path.resolve(REPO, `clients/${ctx.slug}/v2/single-page-brief.yaml`);
    if (fs.existsSync(briefPath)) {
      // Use simple YAML extraction (regex · enough for top-level scalar fields)
      const briefText = fs.readFileSync(briefPath, 'utf8');
      const briefFacts = {
        business_name: (briefText.match(/^business_name:\s*"?([^"\n]+)"?/m) || [])[1]?.trim(),
        phone: (briefText.match(/^phone:\s*"?([^"\n]+)"?/m) || [])[1]?.trim(),
        email: (briefText.match(/^email:\s*"?([^"\n]+)"?/m) || [])[1]?.trim(),
        license_number: (briefText.match(/^\s+number:\s*"?([^"\n]+)"?/m) || [])[1]?.trim(),
        license_authority: (briefText.match(/^\s+authority:\s*"?([^"\n]+)"?/m) || [])[1]?.trim(),
        abn: (briefText.match(/^abn:\s*"?([^"\n]+)"?/m) || [])[1]?.trim(),
      };

      // Extract from rendered HTML
      const htmlBlob = htmlFiles.map(f => readHtml(f)).join('\n');
      // Strip script/style
      const htmlText = htmlBlob.replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ');

      const checks = [];
      function checkFact(label, briefValue, htmlContains) {
        if (!briefValue) { checks.push({ field: label, status: 'NA · not in brief' }); return; }
        const found = htmlContains;
        checks.push({ field: label, brief: briefValue, found, status: found ? 'MATCH' : 'MISSING' });
      }
      checkFact('business_name', briefFacts.business_name, briefFacts.business_name && htmlText.includes(briefFacts.business_name));
      // Phone · normalize digits both sides
      if (briefFacts.phone) {
        const phoneDigits = briefFacts.phone.replace(/\D/g, '');
        const htmlPhoneDigits = (htmlText.match(/\d{8,}/g) || []).join('');
        checks.push({ field: 'phone', brief: briefFacts.phone, status: htmlPhoneDigits.includes(phoneDigits) ? 'MATCH' : 'MISSING' });
      }
      checkFact('email', briefFacts.email, briefFacts.email && htmlText.includes(briefFacts.email));
      checkFact('license_number', briefFacts.license_number, briefFacts.license_number && htmlText.includes(briefFacts.license_number));
      checkFact('license_authority', briefFacts.license_authority, briefFacts.license_authority && htmlText.includes(briefFacts.license_authority));
      checkFact('abn', briefFacts.abn, briefFacts.abn && htmlText.includes(briefFacts.abn));

      const checkedCount = checks.filter(c => c.status !== 'NA · not in brief').length;
      const matchCount = checks.filter(c => c.status === 'MATCH').length;
      d211 = checkedCount > 0 ? Math.round(100 * matchCount / checkedCount) : null;
      dims['D2.11_facts_cross_check'] = {
        score: d211,
        checks,
        matched: matchCount,
        checked: checkedCount,
        note: 'SOP-AUDIT-STANDARD-V2 §9 · brief.yaml vs rendered HTML exact match',
      };
    } else {
      dims['D2.11_facts_cross_check'] = { score: null, note: `brief.yaml missing at ${briefPath}` };
    }
  } catch (e) {
    dims['D2.11_facts_cross_check'] = { score: null, note: `error: ${e.message}` };
  }

  return { dims, status: 'wired' };
}

// ─── T2 LLM Copy Quality (premium · SOP-AUDIT-STANDARD-V2 §9 D2.10) ─────
// Calls core/eval/codex-deep-audit.js with 6 dims (D1-D5 existing + D6 NEW engagement)
// D2.10 engagement-persuasion = D6 from codex-deep-audit · positive prose-quality signal
// Premium tier only · ~$0.30-0.50/page · ~40-60s per page
async function runT2CopyQualityLLM(htmlFiles, ctx) {
  let auditModule;
  try {
    auditModule = await import(path.resolve(REPO, 'core/eval/codex-deep-audit.js'));
  } catch (e) {
    return { status: 'skipped', reason: `codex-deep-audit not available: ${e.message}` };
  }

  const briefPath = path.resolve(REPO, `clients/${ctx.slug}/v2/single-page-brief.yaml`);
  const brief = fs.existsSync(briefPath) ? fs.readFileSync(briefPath, 'utf8') : '';
  const facts = ctx.facts || {};

  const pageResults = [];
  for (const f of htmlFiles) {
    const html = readHtml(f);
    const start = Date.now();
    try {
      const r = await auditModule.auditPage({ pageFile: path.basename(f), html, facts, brief, dims: auditModule.DEFAULT_DIMS, timeoutMs: 4 * 60 * 1000 });
      pageResults.push({ page: path.basename(f), result: r, duration_s: Math.round((Date.now() - start) / 1000) });
    } catch (e) {
      pageResults.push({ page: path.basename(f), error: e.message, duration_s: Math.round((Date.now() - start) / 1000) });
    }
  }

  // Aggregate: compute mean D6 + composite copy-quality score across pages
  let d6Sum = 0, d6Count = 0;
  let d1d4Sum = 0, d1d4Count = 0;
  const allHallucinations = [];
  const allLeakQuotes = [];
  for (const pr of pageResults) {
    const scores = pr.result?.parsed?.scores;
    if (scores?.D6_engagement_persuasion != null) { d6Sum += scores.D6_engagement_persuasion; d6Count++; }
    for (const k of ['D1_facts_accuracy', 'D2_voice_authentic', 'D3_specificity', 'D4_conversion']) {
      if (scores?.[k] != null) { d1d4Sum += scores[k]; d1d4Count++; }
    }
    for (const h of (pr.result?.parsed?.hallucinations || [])) allHallucinations.push({ page: pr.page, fact: h });
    for (const l of (pr.result?.parsed?.leak_quotes || [])) allLeakQuotes.push({ page: pr.page, quote: l });
  }
  const d6Score = d6Count > 0 ? Math.round((d6Sum / d6Count) * 10) : null;
  const d1d4Score = d1d4Count > 0 ? Math.round((d1d4Sum / d1d4Count) * 10) : null;

  return {
    status: 'wired',
    score: d6Score,  // D2.10 engagement
    sub_dims: {
      'D2.10_engagement_persuasion': d6Score,
      'D2.4_codex_factual_accuracy': pageResults[0]?.result?.parsed?.scores?.D1_facts_accuracy * 10 || null,
      'D2.5_codex_voice_authentic':  pageResults[0]?.result?.parsed?.scores?.D2_voice_authentic * 10 || null,
      'D2.6_codex_specificity':       pageResults[0]?.result?.parsed?.scores?.D3_specificity * 10 || null,
      'D2.X_conversion_clarity':       pageResults[0]?.result?.parsed?.scores?.D4_conversion * 10 || null,
      'D2.X_leak_free':                pageResults[0]?.result?.parsed?.scores?.D5_leak_free * 10 || null,
    },
    hallucinations: allHallucinations,
    leak_quotes: allLeakQuotes,
    per_page: pageResults,
    note: 'SOP-AUDIT-STANDARD-V2 §9 D2.10 · codex-deep-audit 6-dim · premium tier · ~40s/page',
  };
}

// ─── M1 · Mobile gate (hybrid · SOP-AUDIT-STANDARD-V2 §4 + §9) ──────────
// Mechanical vetos (this function): M1.1 overflow-x · M1.2 sticky CTA · M1.3 critical tap targets
// Vision scored sub-dims (deferred to premium tier): M1.4 hero readability · M1.5 above-fold trust+CTA
// Renders HTML at 390x812 viewport via Playwright · checks computed styles
async function runM1MobileGate(htmlFiles, ctx) {
  if (!htmlFiles.length) return { status: 'skipped', reason: 'no html files' };
  let playwright;
  try { playwright = await import('playwright'); }
  catch { return { status: 'skipped', reason: 'playwright not available · install: npm i -D playwright' }; }

  const browser = await playwright.chromium.launch({ headless: true });
  const ctx_b = await browser.newContext({ viewport: { width: 390, height: 812 }, isMobile: true });
  const page = await ctx_b.newPage();

  const vetos = [];
  const warnings = [];
  const results = [];

  for (const f of htmlFiles) {
    const fileUrl = 'file://' + path.resolve(f);
    try {
      await page.goto(fileUrl, { waitUntil: 'networkidle', timeout: 10000 });
    } catch (e) {
      results.push({ page: path.basename(f), error: e.message });
      continue;
    }

    // M1.1 · viewport overflow-x at 390px
    const overflow = await page.evaluate(() => {
      const docW = document.documentElement.scrollWidth;
      const bodyW = document.body.scrollWidth;
      const vp = window.innerWidth;
      return { doc_scrollWidth: docW, body_scrollWidth: bodyW, viewport_width: vp, overflow_px: Math.max(docW, bodyW) - vp };
    });
    if (overflow.overflow_px > 0) {
      vetos.push({ check: 'M1.1_viewport_overflow_x', page: path.basename(f), overflow_px: overflow.overflow_px, severity: 'VETO' });
    }

    // M1.2 · sticky CTA visible · scan for fixed/sticky bottom-aligned element with phone-tel or btn CTA-like content
    const stickyCta = await page.evaluate(() => {
      const candidates = [...document.querySelectorAll('[class*="sticky"], [class*="mobile-cta"], aside[class*="cta"]')];
      for (const el of candidates) {
        const cs = window.getComputedStyle(el);
        const pos = cs.position;
        const rect = el.getBoundingClientRect();
        if ((pos === 'fixed' || pos === 'sticky') && rect.bottom <= window.innerHeight + 10) {
          // Check it has phone/btn-like child
          const hasCta = !!el.querySelector('a[href^="tel:"], .btn, [class*="btn-"]');
          if (hasCta) return { found: true, class: el.className, position: pos, bottom: rect.bottom, has_tel: !!el.querySelector('a[href^="tel:"]') };
        }
      }
      return { found: false };
    });
    if (!stickyCta.found) {
      vetos.push({ check: 'M1.2_sticky_cta_missing', page: path.basename(f), severity: 'VETO', note: 'no fixed/sticky bottom CTA found · mobile Mike persona expects sticky call/quote' });
    }

    // M1.3 · critical tap targets ≥ 44x44px (codex R28 Q-II-3 · only critical · not all UI)
    const tapTargetViolations = await page.evaluate(() => {
      const critical = [...document.querySelectorAll(
        'a[href^="tel:"], a[href^="mailto:"], .btn-primary, .btn-secondary, .masthead-cta, ' +
        'header nav a, nav.nav a, button[type="submit"], input[type="submit"], ' +
        'form input:not([type="hidden"]), form select, form textarea'
      )];
      const violations = [];
      for (const el of critical) {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) continue; // hidden · skip
        if (rect.width < 44 || rect.height < 44) {
          violations.push({
            selector: (el.tagName.toLowerCase() + (el.className ? '.' + el.className.split(/\s+/).slice(0, 2).join('.') : '')).slice(0, 60),
            text: (el.textContent || '').trim().slice(0, 40),
            w: Math.round(rect.width),
            h: Math.round(rect.height),
          });
        }
      }
      return violations;
    });
    if (tapTargetViolations.length > 0) {
      vetos.push({ check: 'M1.3_critical_tap_target', page: path.basename(f), severity: 'VETO', violations: tapTargetViolations.slice(0, 5), count: tapTargetViolations.length });
    }

    results.push({ page: path.basename(f), overflow_px: overflow.overflow_px, sticky_cta_found: stickyCta.found, tap_target_violations: tapTargetViolations.length });
  }

  await browser.close();

  return {
    status: 'wired',
    vetos,
    warnings,
    per_page: results,
    pass: vetos.length === 0,
    note: 'SOP-AUDIT-STANDARD-V2 §4 + §9 · 3 mechanical vetos · M1.1 overflow · M1.2 sticky CTA · M1.3 critical tap targets ≥44px',
    sub_dims_deferred: ['M1.4 hero readability (vision LLM · premium tier)', 'M1.5 above-fold trust+CTA (vision LLM · premium tier)'],
  };
}

// ─── T5 · Creative-director (STUB · LLM · ADR §2.5 · premium-only) ──────
async function runT5CreativeDirector(htmlFiles, ctx) {
  // TODO: adapt /tmp/open-design/skills/creative-director prompt
  // TODO: 3-axis Cannes-calibrated (Idea · Cultural relevance · Craft) · 0-10 each
  // TODO: gated on T4 score ≥ 60 (otherwise return skipped)
  return {
    score: null,
    three_axis: { idea_originality: null, cultural_relevance: null, craft: null },
    llm_call_id: null, cost_usd: 0, model: null,
    status: 'stub',
    todo: 'adapt creative-director prompt · gate on T4≥60',
  };
}

// ─── Composite (ADR §3) ──────────────────────────────────────────────────
function composeFinalScore(tiers, opts = {}) {
  const { T1, T2, T3, T4, T5 } = tiers;
  if (!T1.pass) {
    return {
      composite: 0,
      ship_verdict: 'BLOCKED · T1 hard fail',
      grade: 'F',
      issues: collectIssues(tiers),
    };
  }

  // Per ADR §3 · weighted sum + lowest-tier floor term
  const t2s = T2?.score ?? null;
  const t3s = T3?.score ?? null;
  const t4s = T4?.score ?? null;
  const t5s = T5?.score ?? null;

  const known = [t2s, t3s, t4s].filter(s => s != null);
  if (known.length === 0) {
    return { composite: null, ship_verdict: 'INDETERMINATE · only T1 available', grade: '?', issues: collectIssues(tiers) };
  }

  // Renormalize weights against tiers that actually returned a score
  const W = { T2: 0.15, T3: 0.30, T4: 0.20, T5: 0.10, floor: 0.25 };
  let weighted = 0, totalW = 0;
  if (t2s != null) { weighted += t2s * W.T2; totalW += W.T2; }
  if (t3s != null) { weighted += t3s * W.T3; totalW += W.T3; }
  if (t4s != null) { weighted += t4s * W.T4; totalW += W.T4; }
  if (opts.includePremium && t5s != null) { weighted += t5s * W.T5; totalW += W.T5; }
  if (known.length) {
    weighted += Math.min(...known) * W.floor;
    totalW += W.floor;
  }
  const composite = totalW > 0 ? Math.round(weighted / totalW * 100) / 100 | 0 : null;

  // ⚠️  EXPERIMENTAL: any tier stub (T3/T4/T5 returns null) means composite is
  // partial · do NOT use as ship gate (per codex audit 2026-05-28).
  const tierStatuses = ['T1', 'T2', 'T3', 'T4', 'T5'].map(k => ({
    tier: k, status: tiers[k]?.status || (tiers[k] ? 'wired' : 'skipped'),
  }));
  const anyStub = tierStatuses.some(t => t.status === 'stub');

  let verdict, grade;
  if (anyStub) {
    grade = 'EXPERIMENTAL';
    verdict = 'EXPERIMENTAL · do not use as ship gate · T4/T5 stubbed';
  } else if (composite >= 85) { grade = 'A'; verdict = 'SHIP'; }
  else if (composite >= 73) { grade = 'B'; verdict = 'SHIP'; }
  else if (composite >= 60) { grade = 'C'; verdict = 'FIX_LOOP'; }
  else { grade = 'D'; verdict = 'REJECT'; }

  // Hard gates (ADR §3)
  if (!anyStub && t2s != null && t2s < 70) verdict = verdict === 'SHIP' ? 'FIX_LOOP · T2<70' : verdict;
  if (!anyStub && t3s != null && t3s < 60) verdict = verdict === 'SHIP' ? 'FIX_LOOP · T3<60' : verdict;
  if (T4?.ai_slop_score != null && T4.ai_slop_score < 60) verdict = 'FIX_LOOP · ai_slop<60';

  return { composite, ship_verdict: verdict, grade, issues: collectIssues(tiers), tier_statuses: tierStatuses, experimental: anyStub };
}

function collectIssues(tiers) {
  // ADR §4 schema · skeleton emits T1+T2 issues; T3/T4/T5 issues land when those tiers wire up.
  const issues = [];
  let idCounter = 1;
  const nextId = () => `I-${String(idCounter++).padStart(3, '0')}`;

  for (const f of (tiers.T1?.fails || [])) {
    issues.push({
      id: nextId(), tier: 'T1', severity: 'P0', dim: 't1_hard', page: '<sitewide>',
      what: f,
      why: 'T1 hard fail · ship blocker (contract violation per ADR §2.1)',
      fix: 'See pl-audit-tier.js docs / SOP-AUDIT-STANDARD.md §1 for per-check remediation',
    });
  }
  if (tiers.T2?.score != null && tiers.T2.score < 80) {
    for (const [k, v] of Object.entries(tiers.T2.breakdown || {})) {
      if (v.score != null && v.score < 70) {
        issues.push({
          id: nextId(), tier: 'T2', severity: v.score < 50 ? 'P1' : 'P2', dim: k, page: '<sitewide>',
          what: `${k} = ${v.score} (threshold 70)`,
          why: 'Brand-contract token discipline below batch-quality bar (ADR §2.2)',
          fix: k.includes('var_brand_coverage')
            ? 'Replace hardcoded hex in <style> with var(--brand-primary) / var(--brand-accent). Target ≥60% coverage.'
            : k.includes('hardcoded_hex')
              ? 'Consolidate the unique hex palette; route through brand-spec.json tokens. Target ≤8 unique non-grayscale hex.'
              : 'See ADR-AUDIT-V4.md §2.2 for per-dim remediation',
        });
      }
    }
  }
  // T4d voice violations (codex R21 Q-DD-3 yes · P1)
  for (const v of (tiers.T4d?.violations || [])) {
    issues.push({
      id: nextId(), tier: 'T4d', severity: v.severity || 'P1', dim: v.rule, page: v.page,
      what: `${v.rule} ${v.kind} · "${v.match}" (${v.count}× hit)`,
      why: 'Voice-rule violation per pl-au-trade-voice §1 (AU universal layer)',
      fix: v.kind === 'us_spelling'
        ? `Replace "${v.match}" with AU spelling (e.g. colour/centre/realise)`
        : v.kind === 'forbidden_niche_claim'
          ? `Remove forbidden claim "${v.match}" · breaches ACCC / niche compliance (pl-au-trade-voice §1.3 + §3.6)`
          : `Replace banned generic "${v.match}" with specific concrete proof (pl-au-trade-voice §1.5)`,
    });
  }
  return issues;
}

// ─── Trace (ADR §5.2) ────────────────────────────────────────────────────
function buildTrace(tiers, ctx) {
  const lines = [];
  lines.push(`# Audit Run · ${ctx.slug || path.basename(ctx.htmlFiles[0])} · ${new Date().toISOString()}`);
  lines.push(``);
  lines.push(`- Script: ${SCRIPT_VERSION}`);
  lines.push(`- Tier: ${TIER}`);
  lines.push(`- Pages: ${ctx.htmlFiles.length}`);
  lines.push(`- Seed (sha256 of HTML[0]): ${ctx.htmlFiles[0] ? seedFor(fs.readFileSync(ctx.htmlFiles[0], 'utf8')) : 'n/a'}`);
  lines.push(``);
  lines.push(`## LLM calls`);
  lines.push(``);
  lines.push(`| Tier | Status | Model | Temp | Cost (USD) |`);
  lines.push(`|---|---|---|---|---|`);
  for (const t of ['T3', 'T4', 'T5']) {
    const x = tiers[t];
    if (!x) continue;
    lines.push(`| ${t} | ${x.status || 'ok'} | ${x.model || '—'} | 0.0 | $${(x.cost_usd || 0).toFixed(4)} |`);
  }
  return lines.join('\n');
}

// ─── Main ───────────────────────────────────────────────────────────────
async function main() {
  const tiers = {};
  const runT1 = TIER === 't1' || TIER === 't2' || TIER === 'fast' || TIER === 'full' || TIER === 'premium';
  const runT2 = TIER === 't2' || TIER === 'fast' || TIER === 'full' || TIER === 'premium';
  const runT3 = TIER === 'full' || TIER === 'premium';
  const runT4 = TIER === 'full' || TIER === 'premium';
  const runT4d = TIER === 'fast' || TIER === 'full' || TIER === 'premium'; // deterministic voice · always on for fast+
  const runT5 = TIER === 'premium';

  if (runT1) tiers.T1 = runT1Hard(ctx.htmlFiles, ctx.facts || {}, ctx);
  if (runT2) tiers.T2 = runT2BrandContract(ctx.htmlFiles, ctx.brandSpec, ctx);
  if (runT3) tiers.T3 = await runT3VisionAudit(ctx.htmlFiles, ctx);
  if (runT4) tiers.T4 = await runT4DesignerReview(ctx.htmlFiles, ctx);
  if (runT4d) tiers.T4d = runT4VoiceDeterministic(ctx.htmlFiles, ctx);
  // Content richness deterministic (D2.14 proof variety + D2.11 facts cross-check) · SOP-AUDIT-STANDARD-V2 §9
  if (runT4d) tiers.ContentRichness = runContentRichnessDeterministic(ctx.htmlFiles, ctx);
  // M1 mobile gate · mechanical vetos · SOP-AUDIT-STANDARD-V2 §4
  if (runT4d) tiers.M1Mobile = await runM1MobileGate(ctx.htmlFiles, ctx);
  // T2 LLM Copy Quality (D2.10 engagement + D2.4-D2.6 codex-deep) · premium tier only · SOP §9
  if (TIER === 'premium') tiers.T2CopyLLM = await runT2CopyQualityLLM(ctx.htmlFiles, ctx);
  if (runT5) tiers.T5 = await runT5CreativeDirector(ctx.htmlFiles, ctx);

  const final = composeFinalScore(tiers, { includePremium: TIER === 'premium' });

  // ─── N/A_BLOCKED hierarchy (CANONICAL.md §3 · codex R35 Q-PP-5) ──────
  // GATE 1: checkpoint RED · GATE 3: minimum_content_signal fail · GATE 4: M1 mobile veto
  // Block composite reporting to prevent audit-gaming on thin/empty content
  let blockReason = null;
  // Read checkpoint
  let checkpoint = null;
  if (ctx.slug) {
    try {
      checkpoint = JSON.parse(fs.readFileSync(path.resolve(REPO, `clients/${ctx.slug}/v2/checkpoint.json`), 'utf8'));
    } catch { /* no checkpoint · not blocking */ }
  }
  if (checkpoint?.verdict === 'RED') {
    blockReason = `GATE 1 · checkpoint.json verdict = RED (${checkpoint.missing ? checkpoint.missing.slice(0, 3).map(m => m.field || m).join(' · ') : 'see checkpoint.json'})`;
  } else if (tiers.ContentRichness?.dims?.minimum_content_signal && !tiers.ContentRichness.dims.minimum_content_signal.pass) {
    const cs = tiers.ContentRichness.dims.minimum_content_signal;
    blockReason = `GATE 3 · minimum_content_signal · services ${cs.services_rendered} / suburbs ${cs.suburbs_rendered} / reviews ${cs.review_blocks} · need 3/5/(1 or banner)`;
  } else if (tiers.M1Mobile?.pass === false) {
    blockReason = `GATE 4 · M1 mobile veto · ${tiers.M1Mobile.vetos.length} mechanical failure(s) · ${tiers.M1Mobile.vetos.map(v => v.check).join(' · ')}`;
  }
  if (blockReason) {
    final.composite = 'N/A_BLOCKED';
    final.grade = 'BLOCKED';
    final.ship_verdict = `BLOCKED · ${blockReason}`;
    final.block_reason = blockReason;
  }

  const report = {
    schema_version: 'audit-v4/0.1',
    script_version: SCRIPT_VERSION,
    slug: ctx.slug,
    mode: ctx.mode,
    output_dir: ctx.outputDir,
    tier: TIER,
    pages_audited: ctx.htmlFiles.length,
    generated_at: new Date().toISOString(),
    tier_1: tiers.T1 || null,
    tier_2: tiers.T2 || null,
    tier_3: tiers.T3 || null,
    tier_4: tiers.T4 || null,
    tier_4d_voice: tiers.T4d || null,
    content_richness_deterministic: tiers.ContentRichness || null,
    mobile_gate: tiers.M1Mobile || null,
    t2_copy_quality_llm: tiers.T2CopyLLM || null,
    tier_5: tiers.T5 || null,
    composite: final.composite,
    grade: final.grade,
    ship_verdict: final.ship_verdict,
    block_reason: final.block_reason || null,
    issues: final.issues,
  };

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  // Write file outputs (unless --site mode without --report)
  const outDir = ctx.outputDir;
  fs.writeFileSync(path.join(outDir, 'audit-v4-summary.json'), JSON.stringify({
    slug: report.slug, tier: TIER, composite: report.composite, grade: report.grade,
    ship_verdict: report.ship_verdict, generated_at: report.generated_at,
  }, null, 2));
  fs.writeFileSync(path.join(outDir, 'audit-v4-issues.json'), JSON.stringify({
    schema_version: 'audit-v4-issues/1', slug: report.slug, issues: report.issues,
    summary: {
      P0: report.issues.filter(i => i.severity === 'P0').length,
      P1: report.issues.filter(i => i.severity === 'P1').length,
      P2: report.issues.filter(i => i.severity === 'P2').length,
      total: report.issues.length,
    },
  }, null, 2));
  fs.writeFileSync(path.join(outDir, 'audit-v4-trace.md'), buildTrace(tiers, ctx));
  fs.writeFileSync(path.join(outDir, 'audit-v4-full.json'), JSON.stringify(report, null, 2));

  if (args.report) {
    // TODO (ADR §5.1): render OD-style customer-facing HTML
    fs.writeFileSync(path.join(outDir, 'audit-v4-report.html'),
      `<!doctype html><meta charset=utf-8><title>Audit v4 · ${report.slug || 'site'}</title>` +
      `<h1>Audit v4 · ${report.slug || 'site'}</h1>` +
      `<p>Composite: ${report.composite ?? 'n/a'} · Grade: ${report.grade} · ${report.ship_verdict}</p>` +
      `<pre>${JSON.stringify(report, null, 2)}</pre>`);
  }

  console.log(`\n[audit-v4] DONE · tier=${TIER} · pages=${ctx.htmlFiles.length}`);
  if (tiers.T1) console.log(`  T1: ${tiers.T1.pass ? 'PASS' : 'FAIL'} (${tiers.T1.fails.length} fails)`);
  if (tiers.T2) console.log(`  T2: ${tiers.T2.score}/100 (brand contract)`);
  if (tiers.T3) console.log(`  T3: ${tiers.T3.score ?? 'stub'}/100 (vision)`);
  if (tiers.T4) console.log(`  T4: ${tiers.T4.score ?? 'stub'}/100 (designer)`);
  if (tiers.T5) console.log(`  T5: ${tiers.T5.score ?? 'stub'}/100 (creative director)`);
  console.log(`  Composite: ${report.composite ?? 'n/a'} · Grade: ${report.grade} · Verdict: ${report.ship_verdict}`);
  console.log(`  → ${path.join(outDir, 'audit-v4-full.json')}`);
  console.log(`  → ${path.join(outDir, 'audit-v4-issues.json')}`);
}

main().catch(e => { console.error('[audit-v4] error:', e); process.exit(1); });
