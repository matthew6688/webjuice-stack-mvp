#!/usr/bin/env node
/**
 * pl:compose-editorial · Render the editorial-newsletter template for a client.
 *
 * Reads existing enrichment SSOTs (per CLAUDE.md §7 existing-work-discovery):
 *   - clients/<slug>/v2/core-extract.json           (brief.real_facts + narrative + content_assets)
 *   - clients/<slug>/v2/master.md                    (YAML frontmatter + summary)
 *   - clients/<slug>/v2/checkpoint.json              (RED/YELLOW/GREEN gate · must NOT be RED)
 *   - clients/<slug>/v2/handoff/od-package/facts.json (locked_facts)
 *   - clients/<slug>/v2/handoff/photos/selected.json (vision-classified images)
 *   - clients/<slug>/v2/handoff/od-package/brand/    (brand-tokens.css + logo-*.svg)
 *   - core/audit/personas/<primary>.js               (voice modifiers)
 *   - skills/pl-au-trade-voice/pl-au-trade-voice.json (banned phrases · niche claims)
 *
 * Renders templates/roofing/editorial-newsletter/template.html via the
 * Mustache helpers in scripts/cli/pl-compose-site.js (single-writer SSOT
 * for render logic).
 *
 * Output: clients/<slug>/v2/editorial-output/index.html
 *
 * Phase B Step 2 · codex R23 GO · parity contract docs/v3/PHASE3-PARITY-CHECKLIST.md.
 *
 * Usage:
 *   npm run pl:compose-editorial -- --slug vicwest-roofing
 *   npm run pl:compose-editorial -- --slug X --skip-checkpoint  (bypass gate · dev only)
 *   npm run pl:compose-editorial -- --slug X --json             (machine-readable)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { load as cheerioLoad } from 'cheerio';
import {
  loadInferred,
  mergeSuburbs,
  mergeOwnerName,
} from '../../core/handoff/merge-inferred.js';
import { buildCopy, normalizeFacts } from '../../core/handoff/copy-builders.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');

function parseArgs() {
  const out = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const k = argv[i].slice(2);
      const n = argv[i + 1];
      if (!n || n.startsWith('--')) out[k] = true;
      else { out[k] = n; i++; }
    }
  }
  return out;
}

function die(msg, code = 1) {
  console.error(`[pl:compose-editorial] ERROR: ${msg}`);
  process.exit(code);
}

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}
function readText(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return ''; }
}
function readYamlFrontmatter(md) {
  const m = md.match(/^---\n([\s\S]+?)\n---/);
  if (!m) return {};
  try { return yaml.load(m[1]) || {}; } catch { return {}; }
}

// ─── Prepared-content adapters (Codex R44) ─────────────────────────────
// Pipeline A: rich authored content produced by pl:enrich-handoff / pl:llm-enrich.
// These files sit under handoff/od-package/content/ and are MORE specific than
// the core-extract fallback. Composer reads them first; falls back to core-extract.
// Codex R44 refinements: normalizeServiceName for matching, strict comment regex.

function normalizeServiceName(s) {
  return String(s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Returns [{name, short_desc, _source}] or null */
function readPreparedServices(odContentDir) {
  const p = path.join(odContentDir, 'services.json');
  try {
    if (!fs.existsSync(p)) return null;
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    const items = data.services || [];
    if (!items.length) return null;
    return items.map(s => ({ name: s.name, short_desc: s.short_desc || '', _source: s._source || 'prepared' }));
  } catch { return null; }
}

/** Returns {headline, subhead, chips, angle, approval_status, _source} or null */
function readPreparedHero(odContentDir) {
  const p = path.join(odContentDir, 'hero-copy.json');
  try {
    if (!fs.existsSync(p)) return null;
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    const candidates = data.candidates || [];
    if (!candidates.length) return null;
    let idx = data.recommended_index ?? 0;
    let approval_status = 'defaulted';
    // Check operator approval sidecar
    const selPath = path.join(odContentDir, 'content-selection.json');
    if (fs.existsSync(selPath)) {
      try {
        const sel = JSON.parse(fs.readFileSync(selPath, 'utf8'));
        if (sel.hero_approved && sel.hero_index != null) {
          idx = sel.hero_index;
          approval_status = `approved (option ${idx + 1})`;
        }
      } catch { /* non-fatal */ }
    }
    const chosen = candidates[idx] || candidates[0];
    return {
      headline: chosen.headline || null,
      subhead: chosen.subheadline || chosen.subhead || null,
      chips: chosen.proof_chips || [],
      angle: chosen.angle || null,
      approval_status,
      _source: chosen._source || 'prepared:hero-copy.json',
    };
  } catch { return null; }
}

/** Returns [paragraph string, …] or null */
/** Returns [{quote, author, location, stars_aria, stars_unicode, source_label}] or null */
function readPreparedReviews(odContentDir) {
  const p = path.join(odContentDir, 'reviews.json');
  try {
    if (!fs.existsSync(p)) return null;
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    const items = data.reviews || [];
    if (!items.length) return null;
    return items.map(r => ({
      stars_aria: r.stars_aria || '5 out of 5 stars',
      stars_unicode: r.stars_unicode || '★ ★ ★ ★ ★',
      quote: String(r.quote || '').trim(),
      author: String(r.author || 'Google Reviewer').trim(),
      location: String(r.location || '').trim(),
      source_label: r.source_label || 'Google review',
    })).filter(r => r.quote.length > 10);
  } catch { return null; }
}

/** Returns {suburbs: [...string], by_arrangement_text: string|null} or null */
function readPreparedCoverage(odContentDir) {
  const p = path.join(odContentDir, 'coverage.json');
  try {
    if (!fs.existsSync(p)) return null;
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    const suburbs = data.suburbs || [];
    if (!suburbs.length) return null;
    return {
      suburbs,
      by_arrangement_text: data.by_arrangement_text || null,
    };
  } catch { return null; }
}

function readPreparedAbout(odContentDir) {
  const p = path.join(odContentDir, 'about.md');
  try {
    if (!fs.existsSync(p)) return null;
    let text = fs.readFileSync(p, 'utf8');
    // Strip YAML frontmatter
    text = text.replace(/^---\n[\s\S]+?\n---\n?/, '');
    // Strip HTML source-annotation comments (Codex R44)
    text = text.replace(/<!--\s*source:[\s\S]*?-->/g, '');
    // Strip "## 备注" dev-note section and everything after it (R46 fix · MVP placeholder leaks)
    text = text.replace(/##\s*备注[\s\S]*/g, '');
    // Strip any remaining markdown headings (# ## etc) — they render as raw text in HTML
    text = text.replace(/^#{1,6}\s+.*/gm, '');
    // Strip lines that look like dev metadata (Chinese chars + common dev phrase patterns)
    text = text.replace(/^.*?(MVP 阶段|LLM 综合|niche typical|Phase B|Cascade A|HANDOFF-STRUCTURE).*$/gm, '');
    // Strip lines containing Chinese characters (MVP placeholder data — not real about copy)
    text = text.replace(/^.*[一-鿿].*$/gm, '');
    // Strip "Key: value" data lines (e.g. "Google 评分: 5★ · 0 条评论")
    text = text.replace(/^[A-Za-z\s]+[:：].+$/gm, (line) => {
      // Only strip if it looks like a raw data field (short, no sentence structure)
      const wordCount = line.split(/\s+/).length;
      return wordCount < 8 ? '' : line;
    });
    // Split into non-empty paragraphs ≥ 20 chars
    const paras = text.split(/\n\n+/).map(p => p.trim()).filter(p => p.length >= 20);
    if (!paras.length) return null;
    // Quality gate: reject if total English word count < 40 (MVP placeholder with no real prose)
    const totalWords = paras.join(' ').replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean).length;
    if (totalWords < 40) return null;
    return paras;
  } catch { return null; }
}

// ─── Mustache helpers (verbatim from pl-compose-site.js) ────────────────
function getPath(obj, p) {
  if (!obj || !p) return null;
  let cur = obj;
  for (const part of p.split('.')) {
    if (part === '__item__') { cur = cur.__item__ ?? cur; continue; }
    if (part === '@index' || part === '@first' || part === '@last') return obj[part];
    if (cur == null) return null;
    cur = cur[part];
  }
  return cur;
}
function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function render(tpl, ctx) {
  if (!tpl) return '';
  // {{#list}}...{{/list}} iteration / object / truthy-object conditional
  tpl = tpl.replace(/\{\{#([\w.]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (m, name, inner) => {
    const v = getPath(ctx, name);
    if (Array.isArray(v)) {
      return v.map((item, i) => {
        const itemCtx = (item && typeof item === 'object')
          ? { ...ctx, ...item, __item__: item, '@index': i + 1 }
          : { ...ctx, __item__: item, '@index': i + 1 };
        // support {{.}} → __item__ for primitive arrays
        return render(inner.replace(/\{\{\.\}\}/g, '{{__item__}}'), itemCtx);
      }).join('');
    }
    if (v && typeof v === 'object') return render(inner, { ...ctx, ...v });
    return '';
  });
  // {{?cond}}...{{/cond}} conditional · render inner if truthy (any type · including primitive string/number/bool)
  tpl = tpl.replace(/\{\{\?([\w.]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (m, name, inner) => {
    const v = getPath(ctx, name);
    return (v && (!Array.isArray(v) || v.length > 0)) ? render(inner, ctx) : '';
  });
  // {{^cond}}...{{/cond}} negated conditional
  tpl = tpl.replace(/\{\{\^([\w.]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (m, name, inner) => {
    const v = getPath(ctx, name);
    return (!v || (Array.isArray(v) && v.length === 0)) ? render(inner, ctx) : '';
  });
  // {{{var}}} unescaped
  tpl = tpl.replace(/\{\{\{([\w.@]+)\}\}\}/g, (m, name) => {
    const v = getPath(ctx, name);
    return v == null ? '' : String(v);
  });
  // {{var}} escaped
  tpl = tpl.replace(/\{\{([\w.@]+)\}\}/g, (m, name) => {
    const v = getPath(ctx, name);
    return v == null ? '' : escapeHtml(v);
  });
  return tpl;
}

// ─── Phone formatter (AU · prevents tel:tel: bug per Matthew's audit) ────
function formatPhoneTel(phoneStr) {
  if (!phoneStr) return '';
  const digits = String(phoneStr).replace(/\D/g, '');
  if (digits.startsWith('61')) return '+' + digits;
  if (digits.startsWith('0')) return '+61' + digits.slice(1);
  return '+61' + digits;
}
function formatPhoneDisplay(phoneStr) {
  if (!phoneStr) return '';
  const digits = String(phoneStr).replace(/\D/g, '');
  // 04XX XXX XXX format
  if (digits.length === 10 && digits.startsWith('04')) {
    return digits.slice(0, 4) + ' ' + digits.slice(4, 7) + ' ' + digits.slice(7);
  }
  return phoneStr;
}

// ─── Roman numeral (for editorial volume / file no) ──────────────────────
function toRoman(n) {
  const map = [['M',1000],['CM',900],['D',500],['CD',400],['C',100],['XC',90],['L',50],['XL',40],['X',10],['IX',9],['V',5],['IV',4],['I',1]];
  let out = ''; let v = n;
  for (const [r, k] of map) { while (v >= k) { out += r; v -= k; } }
  return out;
}

// ─── LocalBusiness JSON-LD builder (uses facts.normalized fields) ────────
function buildJsonLd(ctx) {
  const c = ctx.client;
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'RoofingContractor',
    name: c.business_name,
    image: ctx.seo.canonical_url ? (ctx.seo.canonical_url.replace(/\/$/, '') + '/og.jpg') : undefined,
    url: ctx.seo.canonical_url || undefined,
    telephone: c.phone_tel,
    email: c.email,
    priceRange: '$$',
    foundingDate: String(c.year_founded || '').slice(0, 4) || undefined,
    description: ctx.seo.meta_description,
    address: c.postal_address,
    geo: c.geo,
    openingHoursSpecification: c.opening_hours_spec,
    hasMap: c.google_maps_url || undefined,
    areaServed: ctx.coverage.suburbs,
    aggregateRating: c.rating ? { '@type': 'AggregateRating', ratingValue: String(c.rating), reviewCount: String(c.review_count || 0) } : undefined,
    identifier: c.license_visible ? { '@type': 'PropertyValue', propertyID: `${c.license_authority} License`, value: c.license_number } : undefined,
  };
  // strip undefined
  Object.keys(ld).forEach(k => ld[k] === undefined && delete ld[k]);
  return JSON.stringify(ld, null, 2);
}

// ─── Image path resolver (customer first · stock fallback) ───────────────
// `selected.json` items have `local_path` relative to handoff/photos/source/ ·
// composer copies them to editorial-output/assets/ and rewrites paths.
function resolveImage(ctx, role, fallbackStockName) {
  const sel = (ctx._selected_photos || []).find(p => p.best_placement === role);
  if (sel && sel.local_path) return { src: `assets/${path.basename(sel.local_path)}`, alt: sel.alt_text || sel.description || '', _source: sel._source || 'customer-extract' };
  if (fallbackStockName) return { src: `assets/stock/${fallbackStockName}`, alt: fallbackStockName.replace(/[-_]/g, ' ').replace(/\.[^.]+$/, ''), _source: 'template-stock' };
  return { src: '', alt: '', _source: 'missing' };
}

// ─── Main · build context + render ───────────────────────────────────────
async function main() {
  const args = parseArgs();
  if (args.help || !args.slug) {
    console.log('Usage: pl:compose-editorial --slug <slug> [--skip-checkpoint] [--json]');
    process.exit(args.help ? 0 : 1);
  }
  const slug = args.slug;
  const clientDir = path.join(REPO, 'clients', slug, 'v2');
  if (!fs.existsSync(clientDir)) die(`client dir not found: clients/${slug}/v2/`);

  // Template + voice profile (codex R39 Q-TT-2 c) · drives copy builders downstream
  // editorial-newsletter = warm-editorial poetic voice · trade-classic = direct trade voice
  // New templates declare profile in their contract.json (added later) · default editorial
  const templateName = args.template || 'editorial-newsletter';
  const TEMPLATE_PROFILES = {
    'editorial-newsletter': 'editorial',
    'trade-classic': 'direct',
  };
  const templateProfile = TEMPLATE_PROFILES[templateName] || 'editorial';

  // ─── Read SSOTs ────────────────────────────────────────────────────────
  const checkpoint = readJson(path.join(clientDir, 'checkpoint.json'));
  const coreExtract = readJson(path.join(clientDir, 'core-extract.json'));
  // YELLOW back-fill · per codex R37 Q-RR-3 (b) · shared helper · provenance-tagged.
  // CANONICAL.md §3 anti-gaming: inferred values do NOT promote checkpoint to GREEN.
  // Composer only uses them to fill rendered HTML · PREVIEW banner stays.
  const inferredData = loadInferred(slug, REPO);
  // V5 hybrid · codex R32 Q-MM-2 (c) · read wireframe-home-<llm>.json if --use-wireframe set
  // Wireframe is LLM-generated persona-aware copy (Phase A.1 Step 5 output)
  // Use as PRIMARY copy source for hero block · narrative as fallback
  let wireframe = null;
  if (args['use-wireframe']) {
    const wfLlm = args['wireframe-llm'] || 'codex';
    const wfPath = path.join(clientDir, `wireframes/wireframe-home-${wfLlm}.json`);
    if (fs.existsSync(wfPath)) {
      try { wireframe = readJson(wfPath); }
      catch (e) { console.error(`warn: wireframe parse failed: ${e.message}`); }
    } else {
      console.error(`warn: --use-wireframe set but ${wfPath} not found · falling back to narrative`);
    }
  }
  // Brief.yaml is the canonical claim source (codex R16 hybrid · validated by pl:validate-single-page-brief).
  // Composer reads it for fields that core-extract / facts.json don't structure (e.g. license_number,
  // year_founded, suburbs_covered) · authoritative when present.
  let brief = null;
  try {
    const briefText = fs.readFileSync(path.join(clientDir, 'single-page-brief.yaml'), 'utf8');
    brief = yaml.load(briefText);
  } catch { /* optional · falls back to core-extract */ }
  const handoffDir = path.join(clientDir, 'handoff/od-package');
  const odContentDir = path.join(handoffDir, 'content');  // R44 prepared-content adapters
  const facts = readJson(path.join(handoffDir, 'facts.json'))?.locked_facts || {};
  const selected = readJson(path.join(clientDir, 'handoff/photos/selected.json'))?.images || readJson(path.join(clientDir, 'handoff/photos/selected.json'))?.photos || [];
  const masterMd = readText(path.join(clientDir, 'master.md'));
  const masterFm = readYamlFrontmatter(masterMd);
  const brandTokensCss = readText(path.join(handoffDir, 'brand/brand-tokens.css'));

  if (!args['skip-checkpoint']) {
    if (!checkpoint) die('checkpoint.json missing · run pl:data-checkpoint first', 2);
    if (checkpoint.verdict === 'RED') die(`checkpoint RED · blocked render · see clients/${slug}/v2/checkpoint.json`, 3);
  }

  // ─── R44+R46 Prepared-content reads (Pipeline A · take priority over core-extract fallback) ──
  const _preparedServices = readPreparedServices(odContentDir);   // [{name, short_desc, _source}] | null
  const _preparedHero     = readPreparedHero(odContentDir);       // {headline, subhead, chips, ...} | null
  const _preparedAbout    = readPreparedAbout(odContentDir);      // [string, ...] | null
  const _preparedReviews  = readPreparedReviews(odContentDir);    // R46: [{quote,author,...}] | null
  const _preparedCoverage = readPreparedCoverage(odContentDir);   // R46: {suburbs,by_arrangement_text} | null

  const realFacts = coreExtract?.brief?.real_facts || {};
  const narrative = coreExtract?.brief?.narrative || {};

  // ─── Build context ─────────────────────────────────────────────────────
  const phoneRaw = (realFacts.phone && realFacts.phone[0]) || facts.phone || '';
  const phoneTel = formatPhoneTel(phoneRaw);
  const phoneDisplay = formatPhoneDisplay(phoneRaw);
  const email = (realFacts.email && realFacts.email[0]) || facts.email || '';
  const city = realFacts.city || masterFm.city || facts.city || '';
  const state = realFacts.state || facts.state || '';
  const businessName = realFacts.business_name || facts.business_name || masterFm.business_name || '';
  const shortName = businessName.replace(/\s+Roofing|\s+Roof.*$/i, '').trim() || businessName;
  // brandMark · 2-letter monogram for logo badges (codex R39 Q-TT-3)
  // Tokenize · drop structural words · take first letters of first 2 significant tokens · uppercase
  // Examples: "Vicwest Roofing" → VR · "A & J Roofing Solutions" → AJ · "Mark Squire Roof Restorations" → MS
  const STOPWORDS = new Set(['&', 'and', 'of', 'the', 'by', 'in', 'for', 'a', 'an']);
  const _markTokens = (businessName || '')
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => t.length > 0 && !STOPWORDS.has(t.toLowerCase()));
  const brandMark = _markTokens.length >= 2
    ? (_markTokens[0][0] + _markTokens[1][0]).toUpperCase()
    : (businessName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2) || 'XX').toUpperCase();
  // year_founded priority: brief.yaml (canonical · validated by pl:validate-single-page-brief)
  // > explicit public "since/established/founded YYYY" claim only.
  // Never back-calculate a founding year from "X years experience" or ABN active date.
  // Those are separate trust signals and must not become entity-age claims.
  let yearFounded = null;
  let experienceYears = null;
  if (brief?.year_founded) yearFounded = String(brief.year_founded);
  const foundingClaims = [
    ...(Array.isArray(realFacts.founded_year?.public_claims) ? realFacts.founded_year.public_claims : []),
    ...(typeof realFacts.founded_year === 'string' ? [realFacts.founded_year] : []),
  ];
  for (const c of foundingClaims) {
    const claim = String(c);
    if (!yearFounded) {
      const yMatch = String(c).match(/(?:since|established|founded|est\.?|in)\s*(\d{4})/i);
      if (yMatch) yearFounded = yMatch[1];
    }
    const expMatch = claim.match(/(?:over|more than|at least|around|approx(?:imately)?|about)?\s*(\d{1,2})\+?\s*years?(?:'|\u2019)?\s+(?:of\s+)?(?:(?:roofing|local)\s+)?(?:experience|serving|service)/i);
    if (!experienceYears && expMatch) experienceYears = parseInt(expMatch[1], 10);
    const serviceAgeMatch = claim.match(/\b(?:servicing|serving)\b[\s\S]{0,80}\b(?:over|more than|at least|around|approx(?:imately)?|about)?\s*(\d{1,2})\+?\s*years?\b/i);
    if (!experienceYears && serviceAgeMatch) experienceYears = parseInt(serviceAgeMatch[1], 10);
  }
  const abnEffectiveYear = realFacts.founded_year?.abn_effective_from
    ? String(realFacts.founded_year.abn_effective_from).slice(0, 4)
    : null;
  // No fabricated fallback · yearFounded stays null when unverified.

  const warrantyBlob = [
    realFacts.warranty_years,
    facts.warranty_years,
    brief?.warranty_years,
    realFacts.guarantee,
    ...(realFacts.service_list || []).map(s => s.brief),
    narrative.trust_signals_catalog,
  ].filter(Boolean).join('\n');
  let warrantyYearsVerified = null;
  let warrantyKind = 'warranty';
  const warrantyMatch = warrantyBlob.match(/\b(\d{1,2})\s*[- ]?\s*(?:year|yr)s?\s+(?:workmanship\s+)?(warranty|guarantee)\b/i)
    || warrantyBlob.match(/\b(warranty|guarantee)\b[^\d]{0,40}\b(\d{1,2})\s*[- ]?\s*(?:year|yr)s?\b/i);
  if (typeof realFacts.warranty_years === 'number' || typeof facts.warranty_years === 'number' || typeof brief?.warranty_years === 'number') {
    warrantyYearsVerified = Number(realFacts.warranty_years || facts.warranty_years || brief.warranty_years);
  } else if (warrantyMatch) {
    const numPart = /^\d+$/.test(warrantyMatch[1] || '') ? warrantyMatch[1] : warrantyMatch[2];
    const kindPart = /^\d+$/.test(warrantyMatch[1] || '') ? warrantyMatch[2] : warrantyMatch[1];
    warrantyYearsVerified = parseInt(numPart, 10);
    warrantyKind = /guarantee/i.test(kindPart || '') ? 'guarantee' : 'warranty';
  }

  // License (provenance-aware · only show when visible).
  // Priority: brief.yaml.license (canonical · codex R16) > facts.license_numbers (extracted) > narrative (fallback)
  const licNum = realFacts.license_numbers || {};
  let licAuthority = null, licNumber = null;
  if (brief?.license?.authority && brief?.license?.number && brief?.license?.status === 'active') {
    licAuthority = brief.license.authority;
    licNumber = brief.license.number;
  } else if (state === 'VIC' && licNum.VBA) { licAuthority = 'VBA'; licNumber = licNum.VBA; }
  else if (state === 'QLD' && licNum.QBCC) { licAuthority = 'QBCC'; licNumber = licNum.QBCC; }
  else if (state === 'NSW' && licNum.other_state_license) { licAuthority = 'NSW Fair Trading'; licNumber = licNum.other_state_license; }
  // Fallback: mine license# from narrative text where pl:enrich-handoff didn't structure it.
  // TODO upstream: enrich-handoff should populate license_numbers.VBA · this branch is a temporary
  // until that fix lands (Phase B Step 5).
  if (!licAuthority || !licNumber) {
    const narrativeBlob = JSON.stringify(narrative);
    // Match: VBA · CDB-U 65938 / VBA CDB-U 65938 / VBA license CDB-U 65938 etc.
    const m = narrativeBlob.match(/\b(VBA|QBCC|NSW\s+Fair\s+Trading|Fair\s+Trading)\b[^\d]{0,30}((?:CDB-U|CC|BSA|BLD|BL)[\s-]?\d{3,8}|\d{5,8})/i);
    if (m) { licAuthority = m[1].toUpperCase(); licNumber = m[2].replace(/\s+/g, '-').replace(/^(CDB)U/, '$1-U'); }
  }
  // license_visible = derived after both passes (single canonical flag for template)
  const _licenseVisibleFinal = !!(licAuthority && licNumber);

  // Hours (HTML lines from real_facts.hours dict)
  const hoursDict = realFacts.hours || facts.hours_dict || {};
  const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const hoursLines = [];
  let wkOpen = null, wkClose = null, satOpen = null, satClose = null;
  for (const d of days) {
    const v = hoursDict[d];
    if (!v || /closed/i.test(v)) continue;
    const tm = v.match(/(\d{1,2}:\d{2}\s*[AP]M)\s*[–\-]\s*(\d{1,2}:\d{2}\s*[AP]M)/);
    if (tm) {
      if (d === 'Saturday') { satOpen = tm[1]; satClose = tm[2]; }
      else if (d !== 'Sunday') { wkOpen = wkOpen || tm[1]; wkClose = wkClose || tm[2]; }
    }
  }
  if (wkOpen && wkClose) hoursLines.push(`Mon–Fri · ${wkOpen}–${wkClose}`);
  if (satOpen && satClose) hoursLines.push(`Sat · ${satOpen}–${satClose}`);
  hoursLines.push('Sun · closed');
  // R34: only push After-hours line if emergency_phone present in facts (codex Q-OO-3 hallucination strict factual context)
  const hasEmergency = !!(facts.emergency_phone || realFacts.emergency_phone);
  if (hasEmergency) hoursLines.push('After-hours emergency by phone');
  const hoursHtmlMain = `${wkOpen && wkClose ? `Mon–Fri ${wkOpen.replace(' ', '')}–${wkClose.replace(' ', '')}<br/>` : ''}${satOpen && satClose ? `Sat ${satOpen.replace(' ', '')}–${satClose.replace(' ', '')}<br/>` : ''}${hasEmergency ? `<span style="color:var(--text-muted);font-size:var(--text-sm);font-family:var(--font-body);">After-hours emergency by phone</span>` : ''}`;

  // Address HTML (split on comma · first 2 parts in main line · rest below)
  const addrFull = realFacts.address || facts.address || '';
  const addrParts = addrFull.split(',').map(s => s.trim()).filter(Boolean);
  const addrHtml = addrParts.length >= 2
    ? `${escapeHtml(addrParts[0])},<br/>${escapeHtml(addrParts.slice(1, 3).join(', '))}`
    : escapeHtml(addrFull);

  // Hero
  // V5 hybrid · prefer wireframe-home.blocks[hero].content over narrative.hero_copy_options
  const wireframeHeroBlock = wireframe?.blocks?.find(b => b.type === 'hero')?.content || null;
  // Hero copy bank · per template profile (codex R39 Q-TT-2 c)
  // editorial: poetic warm voice ("A Ballarat roof, done properly · signed off in writing")
  // direct: trade voice with concrete services + region ("Metal & tile roofing across Ballarat & Western Victoria")
  const _serviceKeywords = (() => {
    const all = (realFacts.service_list || facts.service_list || [])
      .map(s => typeof s === 'string' ? s : (s.name || s.title || ''))
      .map(s => s.toLowerCase());
    const has = (re) => all.some(s => re.test(s));
    const parts = [];
    if (has(/metal|colorbond/i)) parts.push('Metal');
    if (has(/tile|terracotta/i)) parts.push('tile');
    if (parts.length === 0 && has(/restoration|repair/i)) parts.push('Roof restoration');
    if (parts.length === 0) parts.push('Roofing');
    return parts.length === 2 ? `${parts[0]} & ${parts[1]}` : parts[0];
  })();
  function isVerifiedProofText(text) {
    const s = String(text || '');
    if (!s.trim()) return false;
    const sinceMatch = s.match(/\bsince\s+(\d{4})\b/i);
    if (sinceMatch && String(yearFounded) !== sinceMatch[1]) return false;
    if (/review|\brating\b|\bstar|★|\/\s*5/i.test(s)) {
      return !!(facts.rating && facts.review_count)
        && s.includes(String(facts.review_count))
        && s.includes(String(facts.rating));
    }
    if (/\b(?:warranty|guarantee)\b/i.test(s)) return !!warrantyYearsVerified && s.includes(String(warrantyYearsVerified));
    const yearsMatch = s.match(/\b(\d{1,2})\+?\s*(?:years|yrs?)\b/i);
    if (yearsMatch) {
      const n = parseInt(yearsMatch[1], 10);
      return n === experienceYears || n === warrantyYearsVerified || (yearFounded && n === new Date().getFullYear() - parseInt(yearFounded, 10));
    }
    if (/\b(?:licensed|licence|license|QBCC|VBA|NSW Fair Trading)\b/i.test(s)) return !!_licenseVisibleFinal;
    if (/\bABN\b/i.test(s)) return !!(brief?.abn || licNum.ABN);
    return true;
  }
  const preparedHeroHeadline = _preparedHero?.headline && isVerifiedProofText(_preparedHero.headline) ? _preparedHero.headline : null;
  const narrativeHeroHeadline = (narrative.hero_copy_options && (narrative.hero_copy_options[0]?.headline || narrative.hero_copy_options.headline));
  const safeNarrativeHeroHeadline = narrativeHeroHeadline && isVerifiedProofText(narrativeHeroHeadline) ? narrativeHeroHeadline : null;
  // Editorial path uses wireframe override · direct path IGNORES wireframe (voice mismatch)
  // BUGFIX 2026-05-29 (codex R39-followup): direct profile must not inherit editorial wireframe headline
  // R44: prepared hero-copy.json takes priority for editorial (higher specificity than formula).
  //      Wireframe (--use-wireframe flag) still overrides when explicitly requested.
  const heroHeadlineEditorial = wireframeHeroBlock?.headline
    || preparedHeroHeadline
    || safeNarrativeHeroHeadline
    || `A ${city} roof, done properly — and signed off in writing.`;
  const heroHeadlineDirect = `${_serviceKeywords} roofing across ${city} & ${state === 'VIC' ? 'Western Victoria' : state === 'QLD' ? 'Far North Queensland' : 'surrounds'}.`;
  const heroHeadline = templateProfile === 'direct' ? heroHeadlineDirect : heroHeadlineEditorial;
  // Subhead per template profile (codex R39 Q-TT-2 c · R39-followup bugfix)
  // editorial: warm prose · "Tidy site · daily updates · warranty in writing the day we leave"
  // direct: concise trade pitch · "Re-screw, re-coat, replace — with a 10-year written warranty"
  // BUGFIX 2026-05-29 (codex R39-followup): profile branch BEFORE wireframe override.
  // Otherwise --use-wireframe with trade-classic would inherit 40+ word editorial wireframe subhead.
  function buildSubhead() {
    const licClause = _licenseVisibleFinal ? `${licAuthority}-licensed (${licNumber})` : (licAuthority ? `${licAuthority}-licensed` : 'Licensed');
    const serviceList = (realFacts.service_list || []).slice(0, 3).map(s => s.name.toLowerCase().replace(/^roof\s+/, '').replace(/^new\s+roofs?$/, 'new roofs').replace(/&/g, 'and'));
    const serviceClause = serviceList.length >= 2 ? serviceList.slice(0, -1).join(', ') + ' and ' + serviceList[serviceList.length - 1] : (serviceList[0] || 'roofing work');

    if (templateProfile === 'direct') {
      // Trade voice · short · concrete · no poetics · IGNORE wireframe (editorial voice)
      // Drop "since YYYY" when yearFounded unverified (codex R40 3rd-pass hallucination guard)
      const sinceClause = yearFounded
        ? ` and on ${city} roofs since ${yearFounded}`
        : (experienceYears ? ` with ${experienceYears}+ years' roofing experience` : ` and working ${city} roofs`);
      return `Re-screw, re-coat, replace — written workmanship warranty. ${licClause}, fully insured${sinceClause}.`;
    }
    // editorial (warm-editorial default) · wireframe override valid here
    if (wireframeHeroBlock?.subhead && String(wireframeHeroBlock.subhead).trim().split(/\s+/).length >= 40) {
      return String(wireframeHeroBlock.subhead).trim();
    }
    // R44: prepared subhead from hero-copy.json (higher specificity than formula)
    if (_preparedHero?.subhead) return String(_preparedHero.subhead).trim();
    const candidates = [];
    if (narrative.hero_copy_options) {
      const opts = Array.isArray(narrative.hero_copy_options) ? narrative.hero_copy_options : [narrative.hero_copy_options];
      for (const o of opts) {
        const s = o?.subhead || o?.lead || o?.body;
        if (s && String(s).trim().split(/\s+/).length >= 40) return String(s).trim();
        if (s) candidates.push(String(s).trim());
      }
    }
    // Codex R40 3rd-pass: drop "since YYYY" if unverified; drop "ten-year warranty" hardcode
    const tenureClause = yearFounded
      ? ` since ${yearFounded}`
      : (experienceYears ? ` with ${experienceYears}+ years' roofing experience` : '');
    return `${licClause} roofers covering ${serviceClause} across ${city}${tenureClause}. Tidy site, daily updates, written workmanship warranty in the client's hands the day we leave. No surprise invoices, no subcontracted crews — we quote on site and stand behind the paperwork.`;
  }
  const heroSubhead = buildSubhead();
  // R44: use prepared chips when available (editorial profile only · trade uses formula stats)
  const heroChips = (_preparedHero?.chips?.length && templateProfile === 'editorial')
    ? _preparedHero.chips.filter(isVerifiedProofText)
    : (() => {
        const chips = [];
        if (_licenseVisibleFinal) chips.push(`${licAuthority} ${licNumber}`);
        if (yearFounded) { const yrs = new Date().getFullYear() - parseInt(yearFounded, 10); if (yrs >= 5) chips.push(`${yrs}+ Years Local`); }
        else if (experienceYears) chips.push(`${experienceYears}+ Years Roofing Experience`);
        if (warrantyYearsVerified) chips.push(`${warrantyYearsVerified}-Year ${warrantyKind === 'guarantee' ? 'Guarantee' : 'Warranty'}`);
        if (facts.rating && facts.review_count) chips.push(`${facts.rating} · ${facts.review_count} Google reviews`);
        return chips;
      })();

  // Services (4-6 items) · image picker with no-repeat fallback (codex R39 Q-TT-4 b)
  // R44: use prepared services.json list DIRECTLY when available — it's a curated set
  // with richer copy than core-extract. Names differ intentionally (curated vs scraped).
  const serviceList = (_preparedServices?.length
    ? _preparedServices
    : (realFacts.service_list || [])
  ).slice(0, 6);
  // Keyword map · CHECKED IN ORDER · most specific keywords FIRST (broad like
  // 'replacement' / 'repair' last) · prevents "Gutter & Pipe Replacement" hitting
  // 'replacement' before 'gutter'
  const stockServiceMap = {
    'gutter':        'service-gutter-install.png',
    'downpipe':      'service-gutter-install.png',
    'fascia':        'service-gutter-install.png',
    'pointing':      'service-heritage-ridge-pointing-detail.png',
    're-bed':        'service-heritage-ridge-pointing-detail.png',
    'ridge':         'service-heritage-ridge-pointing-detail.png',
    'storm':         'service-storm-damage-closeup.png',
    'emergency':     'service-storm-damage-closeup.png',
    'leak':          'service-storm-damage-closeup.png',
    'tile restoration': 'roof-restoration.png',
    'restoration':   'roof-restoration.png',
    'recoat':        'roof-restoration.png',
    'paint':         'roof-restoration.png',
    'new roof':      'service-colorbond-install.png',
    'colorbond':     'service-colorbond-install.png',
    'metal':         'service-colorbond-install.png',
    'cladding':      'service-colorbond-install.png',
    'tile':          'service-heritage-ridge-pointing-detail.png',
    'repair':        'service-storm-damage-closeup.png',
    'replacement':   'service-replacement-in-progress.png',
    'commercial':    'service-replacement-in-progress.png',
    'insulation':    'service-replacement-in-progress.png',
  };
  // Fallback rotation pool · used when no keyword matches OR a matched image already chosen this render
  const FALLBACK_POOL = [
    'service-replacement-in-progress.png',
    'service-colorbond-install.png',
    'roof-restoration.png',
    'service-gutter-install.png',
    'service-heritage-ridge-pointing-detail.png',
    'service-storm-damage-closeup.png',
  ];
  const usedStock = new Set();
  const stockWarnings = [];  // codex R39-followup Q-UU-4 b · log fallback rotation for stock-coverage audit
  function pickStockForService(name, idx) {
    const lower = name.toLowerCase();
    for (const [key, file] of Object.entries(stockServiceMap)) {
      if (lower.includes(key)) {
        if (!usedStock.has(file)) { usedStock.add(file); return file; }
        // matched but already used · fall through to rotation
        stockWarnings.push(`service "${name}" matched stock "${file}" but already used · rotated to fallback`);
        break;
      }
    }
    // rotation · pick next pool entry not yet used; if all used, cycle by idx
    let matchedKey = null;
    for (const [key] of Object.entries(stockServiceMap)) if (lower.includes(key)) { matchedKey = key; break; }
    if (!matchedKey) stockWarnings.push(`service "${name}" no stock keyword match · rotated to fallback`);
    for (const f of FALLBACK_POOL) {
      if (!usedStock.has(f)) { usedStock.add(f); return f; }
    }
    return FALLBACK_POOL[idx % FALLBACK_POOL.length];
  }
  const servicesItems = serviceList.map((s, i) => ({
    number: String(i + 1).padStart(2, '0'),
    category: (s.name.split(/\s+/)[0] || 'Service').slice(0, 16),
    title: s.name,
    // R44: prepared services.json provides rich short_desc; core-extract s.brief is usually empty
    body: s.short_desc || s.brief || '',
    _source: _preparedServices ? (s._source || 'prepared:services.json') : 'core-extract',
    image_src: `assets/stock/${pickStockForService(s.name, i)}`,
    image_alt: `${s.name} · ${city} roofer`,
  }));

  // Strap (4 cells)
  const strapCells = [];
  if (yearFounded) {
    const yrs = new Date().getFullYear() - parseInt(yearFounded, 10);
    strapCells.push({ value: `${yrs}+`, label: `Years roofing ${city} homes since ${yearFounded}` });
  } else if (experienceYears) {
    strapCells.push({ value: `${experienceYears}+`, label: 'Years roofing experience' });
  }
  if (warrantyYearsVerified) {
    strapCells.push({
      value: `${warrantyYearsVerified} yr`,
      label: warrantyKind === 'guarantee' ? 'Verified roof restoration guarantee' : 'Written workmanship warranty on replacements',
    });
  }
  if (_licenseVisibleFinal) strapCells.push({ value: licAuthority, label: `Licensed in ${state === 'VIC' ? 'Victoria' : state} · ${licNumber}` });
  if (facts.rating && facts.review_count) strapCells.push({ value: `${facts.rating} / 5`, label: `Average across ${facts.review_count} Google reviews` });
  if (strapCells.length < 4 && abnEffectiveYear) strapCells.push({ value: 'ABN', label: `Active since ${abnEffectiveYear}` });

  // About paragraphs now built via copy-builders.js (codex R40 Q-VV-3) · removed old split-based code.

  // Reviews · priority chain (R46):
  //   1. prepared reviews.json (from pl:extract-site-ctx --write-content · real Google reviews)
  //   2. core-extract content_assets · best_review_quotes + merged inferred
  //   3. in-line fallback placeholders
  let reviewsItems;
  let reviewsIsPlaceholder;

  if (_preparedReviews?.length >= 3) {
    // R46: prepared reviews.json has real reviews · use directly · no placeholder banner
    reviewsItems = _preparedReviews.slice(0, 4);
    reviewsIsPlaceholder = false;
  } else {
    // R37 formula fallback
    const realReviews = (coreExtract?.brief?.content_assets?.best_review_quotes || []).slice(0, 3);
    // Also try real_facts.testimonials if content_assets is thin
    const testimonialFallback = (coreExtract?.brief?.real_facts?.testimonials || []).slice(0, 3);
    const bestReal = realReviews.length >= 3 ? realReviews : testimonialFallback;
    if (bestReal.length >= 1) {
      reviewsItems = bestReal.map(t => ({
        stars_aria: '5 out of 5 stars',
        stars_unicode: '★ ★ ★ ★ ★',
        quote: t.quote || '',
        author: t.author || 'Verified customer',
        location: t.location || city,
        source_label: 'Google review',
      }));
    } else {
      reviewsItems = [];
    }
    reviewsIsPlaceholder = false;
  }

  // Gallery (4 before/after pairs · R-BA-6 draggable slider · 2x2 grid balanced · Matthew 2026-05-29)
  const galleryPairs = [
    { idx: 1, before_src: 'assets/stock/gallery-09-cracked-slate-before.jpg', before_alt: 'Cracked slate roof before restoration', after_src: 'assets/stock/gallery-09-restored-slate-after.jpg', after_alt: 'Same slate roof after restoration', caption: `Heritage slate restoration · ${city}` },
    { idx: 2, before_src: 'assets/stock/gallery-10-storm-tarped-before.jpg', before_alt: 'Storm-damaged roof tarped after emergency call-out', after_src: 'assets/stock/gallery-10-storm-repaired-after.jpg', after_alt: 'Same roof fully repaired after storm', caption: `Storm response & full repair · ${city}` },
    { idx: 3, before_src: 'assets/stock/gallery-12-asbestos-before.jpg', before_alt: 'Old roof sheeting before replacement', after_src: 'assets/stock/gallery-12-modern-metal-after.jpg', after_alt: 'New Colorbond metal roof after replacement', caption: `Full Colorbond replacement · ${city}` },
    { idx: 4, before_src: 'assets/stock/gallery-07-moss-before.jpg', before_alt: 'Moss-covered terracotta tile roof before pressure clean', after_src: 'assets/stock/gallery-07-moss-after.jpg', after_alt: 'Same tile roof after pressure-clean and recoat', caption: `Pressure clean & recoat · ${city}` },
  ];

  // codex R88: real "Completed Projects" from image-decisions.json (verified photos · single
  // images · NO fake before/after · SOP §9). Files copied to assets/ after outDir is defined.
  let completedProjects = [];
  try {
    const dec = readJson(path.join(clientDir, 'editorial-output/image-decisions.json'));
    const galDec = (dec?.decisions || []).find((d) => d.slot === 'gallery');
    const realFiles = (galDec?.chosen || []).filter(Boolean);
    const srcDir = path.join(clientDir, 'handoff/photos/source');
    completedProjects = realFiles
      .filter((f) => fs.existsSync(path.join(srcDir, f)))
      .slice(0, 6)
      .map((f, i) => ({ idx: i + 1, file: f, src: `assets/${f}`, alt: `Completed roofing project in ${city}`, caption: `${city} project` }));
  } catch { /* no decisions · stay on before/after fallback */ }
  const hasRealProjects = completedProjects.length >= 3;

  // Coverage · priority: brief.yaml.suburbs_covered (canonical) > narrative > facts > real_facts
  // Coverage · priority chain (R46):
  //   1. prepared coverage.json (from pl:extract-site-ctx --write-content)
  //   2. brief.yaml.suburbs_covered > narrative > facts > real_facts
  //   3. merge inferred if real < 10
  const realSuburbs = brief?.suburbs_covered || narrative.service_area?.suburbs || facts.service_area || coreExtract?.brief?.real_facts?.suburbs_served || [];
  let suburbsList;
  let coverageByArrangement = null;
  if (_preparedCoverage?.suburbs?.length >= 3) {
    suburbsList = _preparedCoverage.suburbs.slice(0, 18);
    coverageByArrangement = _preparedCoverage.by_arrangement_text || null;
  } else {
    suburbsList = mergeSuburbs(realSuburbs, inferredData, { minReal: 10, cap: 18 });
    if (suburbsList.length === 0 && city) suburbsList.push(city, `${city} Central`);
  }

  // SEO
  // Codex R40 3rd-pass: SEO clauses drop "Since YYYY" / "23+ years" when year unverified
  const seoSinceClause = yearFounded ? `Since ${yearFounded} ` : '';
  const seoYearsClause = yearFounded
    ? `${new Date().getFullYear() - parseInt(yearFounded, 10)}+ years of `
    : (experienceYears ? `${experienceYears}+ years of ` : '');
  const seoTitle = `${businessName} — ${city} Roofers ${seoSinceClause}| ${licAuthority ? licAuthority + '-Licensed ' : ''}Colorbond, Restoration & Storm Repairs`.replace(/\s+/g, ' ').slice(0, 110);
  const seoDesc = `${businessName} is a ${licAuthority ? `${licAuthority}-licensed ${city} roofer${_licenseVisibleFinal ? ' (' + licNumber + ')' : ''}` : `${city} roofer`} — ${seoYearsClause}Colorbond replacements, terracotta restorations, storm repairs and gutter work across ${city}. Written workmanship warranty.`.slice(0, 160);

  // Brand hex extraction from brand-tokens.css
  const brandPrimaryHex = (brandTokensCss.match(/--brand-primary:\s*(#[0-9a-fA-F]{3,8})/) || [])[1] || '#0F1115';
  const brandAccentHex = (brandTokensCss.match(/--brand-accent:\s*(#[0-9a-fA-F]{3,8})/) || [])[1] || '#C5A572';

  // Issue (#NN) for editorial framing · derived from year founded for stability (not data hash)
  // Codex R40 3rd-pass: yearsTrading is null when yearFounded unverified · downstream consumers guard
  const yearsTrading = yearFounded ? Math.max(1, new Date().getFullYear() - parseInt(yearFounded, 10)) : null;
  const issueNo = yearsTrading;  // e.g. 23 yrs = File No. XXIII
  const volNo = Math.max(1, Math.ceil((yearsTrading || experienceYears || 1) / 8));  // 1 volume per ~8 years
  // hero eyebrow per profile (editorial = magazine "File No." · direct = simple location chip)
  const heroEyebrow = templateProfile === 'direct'
    ? `${city} · ${state}${_licenseVisibleFinal ? ` · ${licAuthority}-licensed` : ''}`
    : `File No. ${issueNo || experienceYears || 1} · ${city} Roofing Journal · Vol. ${toRoman(volNo).padStart(2, '0')}`;

  // Build section copy via profile dispatch (codex R40 Q-VV-1 B · Q-VV-5 b)
  // Codex R40 3rd-pass hallucination guards (Q-XX-1, Q-XX-2):
  // - warranty_years_verified · only pass if confirmed by source data · else null (builder uses generic clause)
  // - suburbs_verified · ONLY real-source suburbs · NEVER inferred · used for "We cover X" coverage claim
  const _normalizedFacts = normalizeFacts({
    business_name: businessName,
    short_name: shortName,
    city, state,
    year_founded: yearFounded,
    years_in_business: yearsTrading,
    experience_years: experienceYears,
    warranty_years_verified: warrantyYearsVerified,
    license_authority: licAuthority,
    license_number: licNumber,
    license_visible: _licenseVisibleFinal,
    services_count: servicesItems.length,
    suburbs_count: suburbsList.length,
    suburbs: suburbsList,
    suburbs_verified: realSuburbs,  // verified only · pre-merge with inferred
    rating: facts.rating,
    review_count: facts.review_count,
  });
  const _copy = buildCopy(templateProfile, _normalizedFacts, {
    narrativeAbout: narrative.about_us_draft || narrative.company_background || null,
  });

  const ctx = {
    client: {
      business_name: businessName,
      short_name: shortName,
      brand_mark: brandMark,
      city, state,
      phone_display: phoneDisplay,
      phone_tel: phoneTel,
      email,
      address_html: addrHtml,
      hours_html: hoursHtmlMain,
      hours_lines: hoursLines,
      year_founded: yearFounded,
      brand_folio: yearFounded ? `${city} · Est. ${yearFounded}` : `${city} · ${state}`,
      abn: brief?.abn || licNum.ABN || null,  // R30: prefer brief.yaml canonical · audit D2.11 caught missing
      license_authority: licAuthority,
      license_number: licNumber,
      license_visible: _licenseVisibleFinal ? {} : null,  // obj=truthy for {{#X}} conditional
      google_maps_url: facts.google_maps_url || null,
      postal_address: addrParts.length >= 3 ? {
        '@type': 'PostalAddress',
        streetAddress: addrParts[0],
        addressLocality: addrParts[1].split(/\s+/)[0],
        addressRegion: state,
        postalCode: (addrParts.slice(-2)[0] || '').match(/\d{4}/)?.[0],
        addressCountry: 'AU',
      } : undefined,
      geo: facts.geo || (facts.latitude && facts.longitude ? { '@type': 'GeoCoordinates', latitude: facts.latitude, longitude: facts.longitude } : undefined),
      opening_hours_spec: (wkOpen && wkClose) ? [
        { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday','Tuesday','Wednesday','Thursday','Friday'], opens: wkOpen, closes: wkClose },
        ...(satOpen && satClose ? [{ '@type': 'OpeningHoursSpecification', dayOfWeek: 'Saturday', opens: satOpen, closes: satClose }] : []),
      ] : undefined,
      rating: facts.rating,
      review_count: facts.review_count,
    },
    brand: {
      primary_hex: brandPrimaryHex,
      accent_hover_hex: '#A88A5C',
      accent_active_hex: '#8E7148',
    },
    brand_tokens_css_inline: brandTokensCss,
    seo: {
      title: seoTitle,
      meta_description: seoDesc,
      canonical_url: facts.existing_website || `https://${slug.replace(/-/g, '')}.com.au/`,
      og_title: seoTitle.split(' — ')[0] + ' — ' + (seoTitle.split(' — ')[1] || ''),
      og_description: seoDesc,
    },
    asset: {
      favicon_path: 'assets/brand/favicon.svg',
      logo_horizontal_path: 'assets/brand/logo-horizontal.svg',
      logo_mono_light_path: 'assets/brand/logo-mono-light.svg',
    },
    hero: {
      eyebrow: heroEyebrow,
      headline: heroHeadline,
      subhead: heroSubhead,
      cta_primary_label: 'Request a written quote',
      cta_secondary_label: `Call ${phoneDisplay}`,
      chips: heroChips,
      image: { src: 'assets/stock/detail-colorbond-metal.png', alt: `Detail of Colorbond metal roof sheeting installed on a ${city} home`, plate_label: 'Plate 01', caption: `Colorbond replacement · ${suburbsList[1] || city}` },
    },
    strap: { cells: strapCells.slice(0, 4) },
    // ─── Section copy · dispatched via core/handoff/copy-builders.js (codex R40 Q-VV-1/5) ──
    // Each profile's builder produces eyebrow/headline/subhead per section · pure fn · fixture-testable.
    // About paragraphs · direct = fact-built 3 paragraphs · editorial = defensive sentence-grouped from narrative.
    // Non-copy data (items/pairs/suburbs/images) spread in below.
    services: { ...(_copy.services), items: servicesItems },
    about: {
      ...(_copy.about),
      image_src: 'assets/stock/about-worker-surveying.png',
      image_alt: `${businessName} roofer surveying a ${city} home's ridge line`,
    },
    reviews: {
      ...(_copy.reviews),
      // pick subhead variant based on placeholder vs real
      subhead: reviewsIsPlaceholder ? _copy.reviews.subhead_placeholder : _copy.reviews.subhead_real,
      items: reviewsItems,
      is_placeholder: reviewsIsPlaceholder ? {} : null,
      real_count: facts.review_count || 0,
    },
    gallery: {
      ...(_copy.gallery),
      // codex R88: real verified projects win → render single-photo grid, suppress stock before/after.
      // (mutually exclusive arrays · avoids nested-section lookup in the simple Mustache engine)
      projects: hasRealProjects ? completedProjects : [],
      pairs: hasRealProjects ? [] : galleryPairs,
      // projects mode shows single completed-work photos · the "Before, after" copy no longer fits
      ...(hasRealProjects ? { eyebrow: 'Our work', headline: `Recent ${city} projects`, subhead: 'A selection of completed roofs. More available on request when we quote.' } : {}),
    },
    coverage: {
      ...(_copy.coverage),
      suburbs: suburbsList,
      // R46: prefer prepared by_arrangement_text; fallback to formula
      by_arrangement_text: coverageByArrangement !== null
        ? coverageByArrangement
        : (suburbsList.length > 12 ? null : `By arrangement: surrounding ${state} regions.`),
    },
    contact: {
      ..._copy.contact,
    },
    colophon: {
      // Codex R40 3rd-pass: drop "since YYYY" when unverified
      tagline: `${city} roofers${yearFounded ? ` since ${yearFounded}` : experienceYears ? ` with ${experienceYears}+ years' roofing experience` : ''}. ${_licenseVisibleFinal ? `${licAuthority}-licensed in ${state === 'VIC' ? 'Victoria' : state} · ${licNumber}. ` : ''}Workshop on ${addrParts[0] || city}.`,
      year: new Date().getFullYear(),
    },
    // ─── Trade-classic template extensions (R38) · additive · editorial-newsletter ignores these ──
    // Process steps (universal trade flow · static copy · 6 steps)
    process: {
      eyebrow: 'How it works',
      headline_html: `Six steps from &ldquo;I think we&rsquo;ve got a leak&rdquo;<br>to &ldquo;It&rsquo;s sorted, mate.&rdquo;`,
      steps: [
        { num: '01', title: 'Call or form', desc: 'Same-day callback during business hours. We&#39;ll ask what you&#39;re seeing.' },
        { num: '02', title: 'On-site quote', desc: 'We climb up, photograph, measure. Free, no obligation.' },
        { num: '03', title: 'Written quote', desc: 'Fixed price, itemised, with materials brand &amp; warranty terms.' },
        { num: '04', title: 'Schedule', desc: 'Slotted within 2-4 weeks (faster for emergency &amp; insurance).' },
        { num: '05', title: 'Job', desc: '3-5 days for most replacements. Daily photo update from the site.' },
        { num: '06', title: 'Handover', desc: 'Walk-around, warranty paperwork, and the same number for callbacks.' },
      ],
    },
    // Trust-bar chips (the 4 stats above-fold)
    // Codex R40 3rd-pass: drop years chip when yearsTrading unverified
    trust_bar: {
      chips: [
        ...(yearsTrading ? [{ value: `${yearsTrading}+`, label: `Years in ${city}` }] : (experienceYears ? [{ value: `${experienceYears}+`, label: 'Years roofing experience' }] : [])),
        ...(facts.rating && facts.review_count
          ? [{ value: `${facts.rating}★`, label: `${facts.review_count} Google reviews` }]
          : []),
        { value: `${suburbsList.length}+`, label: 'Suburbs served' },
        { value: '0', label: 'Subcontractors used' },
      ].slice(0, 4),
    },
    _selected_photos: selected,
  };
  // About chips (trust signals · brand-agnostic · attach after ctx so we can read brief.abn cleanly)
  ctx.about.chips = [
    ...(_licenseVisibleFinal ? [`${licAuthority} Licensed`] : []),
    'Fully Insured',
    ...(warrantyYearsVerified ? [`${warrantyYearsVerified}-yr ${warrantyKind === 'guarantee' ? 'Guarantee' : 'Warranty'}`] : []),
    ...((brief?.abn || licNum.ABN) ? ['ABN on every invoice'] : []),
    'No subcontractors',
  ];
  // R44: override about paragraphs with prepared about.md content (richer than formula)
  // Codex R44: only override .paragraphs, not section headings/eyebrow
  if (_preparedAbout?.length) {
    ctx.about.paragraphs = _preparedAbout;
  }
  const aboutHasInstructionLeak = (ctx.about.paragraphs || []).some(p => /\b(?:should|redesign|new site|website team|supplied corpus|audit corpus|once .*verified|client confirms?|do not|before launch|XXX)\b/i.test(String(p)));
  if (aboutHasInstructionLeak) {
    const serviceNames = servicesItems.slice(0, 3).map(s => s.title.toLowerCase());
    const serviceText = serviceNames.length >= 2
      ? `${serviceNames.slice(0, -1).join(', ')} and ${serviceNames[serviceNames.length - 1]}`
      : (serviceNames[0] || 'roofing work');
    ctx.about.paragraphs = [
      `${businessName} is a ${city} roofing business${addrParts[0] ? ` based at ${addrParts[0]}` : ''}. ${experienceYears ? `The public record supports ${experienceYears}+ years of roofing experience.` : yearFounded ? `The public record supports operation since ${yearFounded}.` : `The business works across ${city} and nearby service areas.`}`,
      `The service focus is practical: ${serviceText}. Enquiries are scoped around roof type, access, condition, timing and the details needed for a clear written quote.`,
      `${_licenseVisibleFinal ? `${licAuthority} ${licNumber} is listed for the business. ` : ''}${brief?.abn || licNum.ABN ? `ABN ${brief?.abn || licNum.ABN}. ` : ''}Call ${phoneDisplay} or send the roof details through the quote form.`,
    ];
  }
  // Hero raw-html variant for templates that want italics in headline
  ctx.hero.headline_html = ctx.hero.headline;
  ctx.hero.eyebrow_location = `${city} · ${state}${_licenseVisibleFinal ? ` · ${licAuthority}-licensed` : ''}`;
  // Headline raw-html versions (no <br> by default · trade-classic just uses single line)
  ctx.about.headline_html = ctx.about.headline;
  ctx.services.headline_html = ctx.services.headline;
  ctx.reviews.headline_html = ctx.reviews.headline;
  ctx.gallery.headline_html = ctx.gallery.headline;
  ctx.coverage.headline_html = ctx.coverage.headline;
  ctx.contact.headline_html = ctx.contact.headline;
  // Additional client fields for trade-classic
  ctx.client.address_full = addrParts.length >= 2 ? addrParts.join(', ') : (facts.address || '');
  ctx.client.suburb = facts.suburb || (addrParts[1] || '').split(/\s+/)[0] || city;
  ctx.client.years_in_business = yearsTrading ? `${yearsTrading}+` : null;
  ctx.client.warranty_years = warrantyYearsVerified ? `${warrantyYearsVerified}-year` : null;
  ctx.client.maps_embed_url = facts.maps_embed_url || (facts.google_maps_url
    ? `https://maps.google.com/maps?q=${encodeURIComponent(ctx.client.address_full || city)}&output=embed`
    : null);
  ctx.jsonld_localbusiness = buildJsonLd(ctx);

  // ─── Render ──────────────────────────────────────────────────────────
  // templateName + templateProfile defined at top of main() (codex R39 Q-TT-2)
  const templatePath = path.join(REPO, 'templates/roofing', templateName, 'template.html');
  if (!fs.existsSync(templatePath)) {
    die(`template not found: templates/roofing/${templateName}/template.html · check spelling or use --template editorial-newsletter`);
  }
  const tpl = readText(templatePath);
  if (!tpl) die('template empty: ' + templatePath);
  const html = render(tpl, ctx);

  // ─── Write output ────────────────────────────────────────────────────
  const outDir = path.join(clientDir, 'editorial-output');
  fs.mkdirSync(path.join(outDir, 'assets/brand'), { recursive: true });
  fs.mkdirSync(path.join(outDir, 'assets/stock'), { recursive: true });
  // codex R88: copy verified real project photos → assets/ (Completed Projects grid)
  for (const p of completedProjects) {
    const src = path.join(clientDir, 'handoff/photos/source', p.file);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(outDir, 'assets', p.file));
  }
  fs.writeFileSync(path.join(outDir, 'index.html'), html);

  // ─── Write ctx-snapshot.json (R44 provenance artifact) ─────────────────
  // Records which source was used for each content area so master.md can surface it.
  const ctxSnapshot = {
    slug,
    template: templateName,
    rendered_at: new Date().toISOString(),
    sources: {
      hero: _preparedHero ? (_preparedHero._source || 'prepared:hero-copy.json') : 'core-extract:formula',
      services: _preparedServices ? 'prepared:services.json' : 'core-extract:formula',
      about: _preparedAbout ? 'prepared:about.md' : 'core-extract:narrative',
      reviews: _preparedReviews?.length >= 3 ? 'prepared:reviews.json' : 'core-extract:formula',
      coverage: _preparedCoverage?.suburbs?.length >= 3 ? 'prepared:coverage.json' : 'core-extract:formula',
    },
    prepared_hero_angle: _preparedHero?.angle || null,
    prepared_hero_approval: _preparedHero?.approval_status || null,
    services_prepared_count: _preparedServices?.length ?? 0,
    services_matched_count: servicesItems.filter(s => s._source !== 'core-extract').length,
    about_paragraphs_count: ctx.about.paragraphs?.length ?? 0,
    reviews_real_count: reviewsIsPlaceholder ? 0 : reviewsItems.length,
    suburbs_count: suburbsList.length,
  };
  fs.writeFileSync(path.join(outDir, 'ctx-snapshot.json'), JSON.stringify(ctxSnapshot, null, 2));

  // Copy brand assets — check handoff/od-package/brand first, fall back to v2/brand
  // (some clients have brand kit in v2/brand/ without a full od-package)
  const brandSrcs = [path.join(handoffDir, 'brand'), path.join(clientDir, 'brand')];
  for (const brandSrc of brandSrcs) {
    if (!fs.existsSync(brandSrc)) continue;
    for (const f of fs.readdirSync(brandSrc)) {
      const dest = path.join(outDir, 'assets/brand', f);
      // Don't overwrite — priority source wins (first in list)
      if (/\.(svg|css)$/.test(f) && !fs.existsSync(dest)) {
        fs.copyFileSync(path.join(brandSrc, f), dest);
      }
    }
  }
  // Ensure logo-horizontal.svg exists — template masthead requires it.
  // Some brand kits only include logo-wordmark.svg (generated without horizontal variant).
  const logoHorizontalDest = path.join(outDir, 'assets/brand/logo-horizontal.svg');
  if (!fs.existsSync(logoHorizontalDest)) {
    for (const fb of ['logo-wordmark.svg', 'logo-dark.svg', 'logo-light.svg']) {
      const fbSrc = path.join(outDir, 'assets/brand', fb);
      if (fs.existsSync(fbSrc)) { fs.copyFileSync(fbSrc, logoHorizontalDest); break; }
    }
  }

  // Copy stock images referenced
  const stockSrc = path.join(REPO, 'templates/roofing/stock-library');
  const stockImgs = [
    'detail-colorbond-metal.png',
    'about-worker-surveying.png',
    'service-replacement-in-progress.png',
    'service-colorbond-install.png',
    'service-gutter-install.png',
    'service-storm-damage-closeup.png',
    'service-heritage-ridge-pointing-detail.png',
    'roof-restoration.png',
    'gallery-09-cracked-slate-before.jpg',
    'gallery-09-restored-slate-after.jpg',
    'gallery-10-storm-tarped-before.jpg',
    'gallery-10-storm-repaired-after.jpg',
    'gallery-12-asbestos-before.jpg',
    'gallery-12-modern-metal-after.jpg',
    'gallery-07-moss-before.jpg',
    'gallery-07-moss-after.jpg',
  ];
  for (const f of stockImgs) {
    // Files might live in flat dir OR subdir
    const candidates = [path.join(stockSrc, f)];
    const subdirs = ['detail', 'about', 'service', 'gallery'];
    for (const d of subdirs) candidates.push(path.join(stockSrc, d, f));
    for (const c of candidates) {
      if (fs.existsSync(c)) { fs.copyFileSync(c, path.join(outDir, 'assets/stock', f)); break; }
    }
  }

  console.log(`[pl:compose-editorial] DONE`);
  console.log(`  slug: ${slug} · checkpoint: ${checkpoint?.verdict || 'skipped'} · pages: 1 (single-page editorial-newsletter)`);
  console.log(`  output: ${path.relative(REPO, outDir)}/index.html · ${(html.length/1024).toFixed(1)}KB`);
  console.log(`  license: ${_licenseVisibleFinal ? `${licAuthority} ${licNumber}` : 'NOT-VISIBLE (needs-client-supplied)'}`);
  console.log(`  reviews: ${reviewsIsPlaceholder ? `PLACEHOLDER (${reviewsItems.length} sample · banner shown)` : `REAL (${reviewsItems.length})`}`);
  console.log(`  services: ${servicesItems.length} · suburbs: ${suburbsList.length} · gallery pairs: ${galleryPairs.length}`);
  if (stockWarnings.length) {
    console.log(`  ⚠ stock coverage gaps (${stockWarnings.length}):`);
    stockWarnings.forEach(w => console.log(`    · ${w}`));
  }

  if (args.json) {
    console.log(JSON.stringify({
      slug, output_path: path.relative(REPO, path.join(outDir, 'index.html')),
      checkpoint_verdict: checkpoint?.verdict,
      license_visible: _licenseVisibleFinal,
      reviews_placeholder: reviewsIsPlaceholder,
      services_count: servicesItems.length,
      suburbs_count: suburbsList.length,
      file_size_bytes: html.length,
    }, null, 2));
  }
}

main().catch(e => { console.error('[pl:compose-editorial] FATAL:', e.message, e.stack); process.exit(1); });
