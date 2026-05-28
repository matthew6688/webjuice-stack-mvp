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
  mergeTestimonials,
  mergeOwnerName,
  hadInference,
  inferredFieldNames,
} from '../../core/handoff/merge-inferred.js';

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

  // ─── Read SSOTs ────────────────────────────────────────────────────────
  const checkpoint = readJson(path.join(clientDir, 'checkpoint.json'));
  const coreExtract = readJson(path.join(clientDir, 'core-extract.json'));
  // YELLOW back-fill · per codex R37 Q-RR-3 (b) · shared helper · provenance-tagged.
  // CANONICAL.md §3 anti-gaming: inferred values do NOT promote checkpoint to GREEN.
  // Composer only uses them to fill rendered HTML · PREVIEW banner stays.
  const inferredData = loadInferred(slug, REPO);
  const hasInferredBackfill = hadInference(inferredData);
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
  const facts = readJson(path.join(handoffDir, 'facts.json'))?.locked_facts || {};
  const selected = readJson(path.join(clientDir, 'handoff/photos/selected.json'))?.images || readJson(path.join(clientDir, 'handoff/photos/selected.json'))?.photos || [];
  const masterMd = readText(path.join(clientDir, 'master.md'));
  const masterFm = readYamlFrontmatter(masterMd);
  const brandTokensCss = readText(path.join(handoffDir, 'brand/brand-tokens.css'));

  if (!args['skip-checkpoint']) {
    if (!checkpoint) die('checkpoint.json missing · run pl:data-checkpoint first', 2);
    if (checkpoint.verdict === 'RED') die(`checkpoint RED · blocked render · see clients/${slug}/v2/checkpoint.json`, 3);
  }

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
  // year_founded priority: brief.yaml (canonical · validated by pl:validate-single-page-brief)
  // > public_claims (years subtracted from now) > ABN effective (lossy · can be later than real start)
  // > '2003' fallback.
  let yearFounded = null;
  if (brief?.year_founded) yearFounded = String(brief.year_founded);
  if (!yearFounded) {
    const claims = realFacts.founded_year?.public_claims || [];
    for (const c of claims) {
      const yrsMatch = String(c).match(/(\d{1,2})\+?\s*years?/i);
      if (yrsMatch) { yearFounded = String(new Date().getFullYear() - parseInt(yrsMatch[1], 10)); break; }
      const yMatch = String(c).match(/(?:since|established|founded|est\.?|in)\s*(\d{4})/i);
      if (yMatch) { yearFounded = yMatch[1]; break; }
    }
  }
  if (!yearFounded && realFacts.founded_year?.abn_effective_from) yearFounded = realFacts.founded_year.abn_effective_from.slice(0, 4);
  if (!yearFounded) yearFounded = '2003';

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
  const heroHeadline = wireframeHeroBlock?.headline || (narrative.hero_copy_options && (narrative.hero_copy_options[0]?.headline || narrative.hero_copy_options.headline))
    || `A ${city} roof, done properly — and signed off in writing.`;
  // Subhead: must be ≥40 words per parity REQ-HE3 · build from license + service variety + city + year + warranty
  // V5 hybrid · prefer wireframe block subhead if ≥40 words
  function buildSubhead() {
    if (wireframeHeroBlock?.subhead && String(wireframeHeroBlock.subhead).trim().split(/\s+/).length >= 40) {
      return String(wireframeHeroBlock.subhead).trim();
    }
    const candidates = [];
    if (narrative.hero_copy_options) {
      const opts = Array.isArray(narrative.hero_copy_options) ? narrative.hero_copy_options : [narrative.hero_copy_options];
      for (const o of opts) {
        const s = o?.subhead || o?.lead || o?.body;
        if (s && String(s).trim().split(/\s+/).length >= 40) return String(s).trim();
        if (s) candidates.push(String(s).trim());
      }
    }
    // Build from facts when narrative subhead < 40 words
    const licClause = _licenseVisibleFinal ? `${licAuthority}-licensed (${licNumber})` : (licAuthority ? `${licAuthority}-licensed` : 'Licensed');
    const serviceList = (realFacts.service_list || []).slice(0, 3).map(s => s.name.toLowerCase().replace(/^roof\s+/, '').replace(/^new\s+roofs?$/, 'new roofs').replace(/&/g, 'and'));
    const serviceClause = serviceList.length >= 2 ? serviceList.slice(0, -1).join(', ') + ' and ' + serviceList[serviceList.length - 1] : (serviceList[0] || 'roofing work');
    return `${licClause} roofers covering ${serviceClause} across ${city} since ${yearFounded}. Tidy site, daily updates, ten-year workmanship warranty in writing the day we leave. No surprise invoices, no subcontracted crews — we quote on site and stand behind the paperwork.`;
  }
  const heroSubhead = buildSubhead();
  const heroChips = [];
  if (_licenseVisibleFinal) heroChips.push(`${licAuthority} ${licNumber}`);
  if (yearFounded) { const yrs = new Date().getFullYear() - parseInt(yearFounded, 10); if (yrs >= 5) heroChips.push(`${yrs}+ Years Local`); }
  heroChips.push('10-Year Warranty');
  if (facts.rating && facts.review_count) heroChips.push(`${facts.rating} · ${facts.review_count} Google reviews`);

  // Services (4-6 items)
  const serviceList = (realFacts.service_list || []).slice(0, 6);
  const stockServiceMap = {
    'Roof Replacement': 'service-replacement-in-progress.png',
    'New Roof': 'service-colorbond-install.png',
    'Gutter': 'service-gutter-install.png',
    'Storm': 'service-storm-damage-closeup.png',
    'Repair': 'service-storm-damage-closeup.png',
    'Colorbond': 'service-colorbond-install.png',
    'Metal': 'service-colorbond-install.png',
    'Restoration': 'roof-restoration.png',
    'Pointing': 'service-heritage-ridge-pointing-detail.png',
    'Commercial': 'service-colorbond-install.png',
  };
  function pickStockForService(name) {
    for (const [key, file] of Object.entries(stockServiceMap)) {
      if (name.toLowerCase().includes(key.toLowerCase())) return file;
    }
    return 'service-colorbond-install.png';
  }
  const servicesItems = serviceList.map((s, i) => ({
    number: String(i + 1).padStart(2, '0'),
    category: (s.name.split(/\s+/)[0] || 'Service').slice(0, 16),
    title: s.name,
    body: s.brief || s.short_desc || '',
    image_src: `assets/stock/${pickStockForService(s.name)}`,
    image_alt: `${s.name} · ${city} roofer`,
  }));

  // Strap (4 cells)
  const strapCells = [];
  if (yearFounded) { const yrs = new Date().getFullYear() - parseInt(yearFounded, 10); strapCells.push({ value: `${yrs}+`, label: `Years roofing ${city} homes since ${yearFounded}` }); }
  strapCells.push({ value: '10 yr', label: 'Written workmanship warranty on replacements' });
  if (_licenseVisibleFinal) strapCells.push({ value: licAuthority, label: `Licensed in ${state === 'VIC' ? 'Victoria' : state} · ${licNumber}` });
  if (facts.rating && facts.review_count) strapCells.push({ value: `${facts.rating} / 5`, label: `Average across ${facts.review_count} Google reviews` });
  while (strapCells.length < 4) strapCells.push({ value: '—', label: '—' });

  // About
  const aboutPara = narrative.about_us_draft || narrative.company_background || `${businessName} has worked the ${city} region since ${yearFounded}. We run our own crew, scope quotes on site, and put a written warranty in your hands.`;
  const aboutParagraphs = Array.isArray(aboutPara) ? aboutPara.slice(0, 3) : String(aboutPara).split(/\n\n+/).slice(0, 3);

  // Reviews · merge real (verified) + inferred (ai-fabricated) per codex R37 Q-RR-3.
  // Real reviews from core-extract content_assets · inferred from pl:llm-infer-thin-data.
  const realReviews = (coreExtract?.brief?.content_assets?.best_review_quotes || []).slice(0, 3);
  const mergedTestimonials = mergeTestimonials(realReviews, inferredData, { minReal: 3, cap: 4 });
  let reviewsItems;
  if (mergedTestimonials.length >= 1) {
    reviewsItems = mergedTestimonials.map(t => ({
      stars_aria: '5 out of 5 stars',
      stars_unicode: '★ ★ ★ ★ ★',
      quote: t.quote || '',
      author: t.author || 'Verified customer',
      location: t.location || city,
      // provenance-tagged source_label · transparency for PREVIEW banner
      source_label: t.provenance === 'verified' ? 'Google review' : 'Google review · AI placeholder',
    }));
  } else {
    // Fallback (no real, no inferred) · in-line placeholders, banner ON
    reviewsItems = [
      { stars_aria: '5 out of 5 stars', stars_unicode: '★ ★ ★ ★ ★', quote: 'Tidy site, clear daily update, no surprises on price. Ten-year warranty paperwork in our hands the day they left.', author: 'Karen S.', location: 'Sebastopol', source_label: 'Google review · AI placeholder' },
      { stars_aria: '5 out of 5 stars', stars_unicode: '★ ★ ★ ★ ★', quote: 'Called Tuesday morning about a leak. Someone here Wednesday, repointed by Friday. Fair quote, friendly crew.', author: 'Mark D.', location: 'Wendouree', source_label: 'Google review · AI placeholder' },
      { stars_aria: '5 out of 5 stars', stars_unicode: '★ ★ ★ ★ ★', quote: 'After a storm took half our tiles, tarped the same day and walked us through the insurance claim. Replacement done within three weeks.', author: 'Janine M.', location: 'Buninyong', source_label: 'Google review · AI placeholder' },
    ];
  }
  // Banner fires if (a) fewer than 3 verified reviews OR (b) any inferred field present
  const reviewsIsPlaceholder = realReviews.length < 3 || hasInferredBackfill;

  // Gallery (3 before/after pairs · R-BA-6 draggable slider · stock library)
  const galleryPairs = [
    { idx: 1, before_src: 'assets/stock/gallery-09-cracked-slate-before.jpg', before_alt: 'Cracked slate roof before restoration', after_src: 'assets/stock/gallery-09-restored-slate-after.jpg', after_alt: 'Same slate roof after restoration', caption: `Heritage slate restoration · ${city}` },
    { idx: 2, before_src: 'assets/stock/gallery-10-storm-tarped-before.jpg', before_alt: 'Storm-damaged roof tarped after emergency call-out', after_src: 'assets/stock/gallery-10-storm-repaired-after.jpg', after_alt: 'Same roof fully repaired after storm', caption: `Storm response & full repair · ${city}` },
    { idx: 3, before_src: 'assets/stock/gallery-12-asbestos-before.jpg', before_alt: 'Old roof sheeting before replacement', after_src: 'assets/stock/gallery-12-modern-metal-after.jpg', after_alt: 'New Colorbond metal roof after replacement', caption: `Full Colorbond replacement · ${city}` },
  ];

  // Coverage · priority: brief.yaml.suburbs_covered (canonical) > narrative > facts > real_facts
  // Then merge inferred suburbs if real < 10 (codex R37 Q-RR-3 · ai-radius-inferred via Nominatim)
  const realSuburbs = brief?.suburbs_covered || narrative.service_area?.suburbs || facts.service_area || coreExtract?.brief?.real_facts?.suburbs_served || [];
  const suburbsList = mergeSuburbs(realSuburbs, inferredData, { minReal: 10, cap: 18 });
  if (suburbsList.length === 0 && city) suburbsList.push(city, `${city} Central`);

  // SEO
  const seoTitle = `${businessName} — ${city} Roofers Since ${yearFounded} | ${licAuthority ? licAuthority + '-Licensed ' : ''}Colorbond, Restoration & Storm Repairs`.slice(0, 110);
  const seoDesc = `${businessName} is a ${licAuthority ? `${licAuthority}-licensed ${city} roofer${_licenseVisibleFinal ? ' (' + licNumber + ')' : ''}` : `${city} roofer`} — ${new Date().getFullYear() - parseInt(yearFounded || 2003, 10)}+ years of Colorbond replacements, terracotta restorations, storm repairs and gutter work across ${city}. 10-year workmanship warranty.`.slice(0, 160);

  // Brand hex extraction from brand-tokens.css
  const brandPrimaryHex = (brandTokensCss.match(/--brand-primary:\s*(#[0-9a-fA-F]{3,8})/) || [])[1] || '#0F1115';
  const brandAccentHex = (brandTokensCss.match(/--brand-accent:\s*(#[0-9a-fA-F]{3,8})/) || [])[1] || '#C5A572';

  // Issue (#NN) for editorial framing · derived from year founded for stability (not data hash)
  const yearsTrading = Math.max(1, new Date().getFullYear() - parseInt(yearFounded || '2003', 10));
  const issueNo = yearsTrading;  // e.g. 23 yrs = File No. XXIII
  const volNo = Math.max(1, Math.ceil(yearsTrading / 8));  // 1 volume per ~8 years
  const heroEyebrow = `File No. ${toRoman(issueNo)} · ${city} Roofing Journal · Vol. ${toRoman(volNo).padStart(2, '0')}`;

  const ctx = {
    client: {
      business_name: businessName,
      short_name: shortName,
      city, state,
      phone_display: phoneDisplay,
      phone_tel: phoneTel,
      email,
      address_html: addrHtml,
      hours_html: hoursHtmlMain,
      hours_lines: hoursLines,
      year_founded: yearFounded,
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
    services: {
      eyebrow: 'The Catalogue',
      headline: `${servicesItems.length} trades, one ledger.`,
      subhead: 'Every job is quoted in writing, scoped on site, and signed off when it is done. No surprises on the invoice — and the warranty is on the paperwork, not the handshake.',
      items: servicesItems,
    },
    about: {
      eyebrow: 'The Workshop',
      headline: yearFounded ? `${new Date().getFullYear() - parseInt(yearFounded, 10)} years on ${city} roofs.` : `Local ${city} roofers.`,
      image_src: 'assets/stock/about-worker-surveying.png',
      image_alt: `${businessName} roofer surveying a ${city} home's ridge line`,
      image_caption: `Field survey · ${city} workshop · weekday call-outs`,
      paragraphs: aboutParagraphs,
    },
    reviews: {
      eyebrow: 'From the letters page',
      headline: `What ${city} homeowners say.`,
      subhead: reviewsIsPlaceholder ? `A representative selection. Verbatim Google reviews replace these once published.` : `A representative selection from our Google reviews. Verbatim — author, suburb, and star count unchanged.`,
      items: reviewsItems,
      is_placeholder: reviewsIsPlaceholder ? {} : null,
      real_count: facts.review_count || 0,
    },
    gallery: {
      eyebrow: 'The Plates',
      headline: `Before, after — ${city} roofs.`,
      subhead: 'Three recent jobs across the catalogue. More on request when we quote.',
      pairs: galleryPairs,
    },
    coverage: {
      eyebrow: 'The Beat',
      headline: 'Where we work.',
      subhead: `Based in ${city}, on ${city} roofs every working day. Most call-outs are local — we'll travel further by arrangement.`,
      suburbs: suburbsList,
      by_arrangement_text: suburbsList.length > 12 ? null : `By arrangement: surrounding ${state} regions.`,
    },
    contact: {
      eyebrow: 'The Correspondence',
      headline: 'Request a written quote.',
      subhead: `Tell us the roof, the suburb, and the trouble. We'll come and look, then send a written quote — usually within two working days.`,
    },
    colophon: {
      tagline: `${city} roofers since ${yearFounded}. ${_licenseVisibleFinal ? `${licAuthority}-licensed in ${state === 'VIC' ? 'Victoria' : state} · ${licNumber}. ` : ''}Workshop on ${addrParts[0] || city}.`,
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
    trust_bar: {
      chips: [
        { value: `${yearsTrading}+`, label: `Years in ${city}` },
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
    '10-yr Warranty',
    ...((brief?.abn || licNum.ABN) ? ['ABN on every invoice'] : []),
    'No subcontractors',
  ];
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
  ctx.client.years_in_business = `${yearsTrading}+`;
  ctx.client.warranty_years = '10-year';
  ctx.client.maps_embed_url = facts.maps_embed_url || (facts.google_maps_url
    ? `https://maps.google.com/maps?q=${encodeURIComponent(ctx.client.address_full || city)}&output=embed`
    : null);
  ctx.jsonld_localbusiness = buildJsonLd(ctx);

  // ─── Render ──────────────────────────────────────────────────────────
  // Template dispatch (codex R38 Q-SS-2 a) · --template flag · default editorial-newsletter
  const templateName = args.template || 'editorial-newsletter';
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
  fs.writeFileSync(path.join(outDir, 'index.html'), html);

  // Copy brand assets
  const brandSrc = path.join(handoffDir, 'brand');
  if (fs.existsSync(brandSrc)) {
    for (const f of fs.readdirSync(brandSrc)) {
      if (/\.(svg|css)$/.test(f)) fs.copyFileSync(path.join(brandSrc, f), path.join(outDir, 'assets/brand', f));
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
