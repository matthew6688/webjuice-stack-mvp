#!/usr/bin/env node
/**
 * pl:compose-site · deterministic page composer using Module Library.
 *
 * Skips OD freestyle entirely. Reads:
 *   - handoff/od-package/{facts.json, content/*, structure/*, shared/*, assets/}
 *   - templates/roofing/modules/<type>/<variant>.html (template library)
 *
 * For each page in page-map:
 *   - HTML <head> with shared.css link
 *   - shared/header.html (verbatim)
 *   - For each block in section-bindings: pick module → substitute placeholders → concat
 *   - shared/footer.html (verbatim)
 *
 * Output: deterministic multi-page site · byte-identical header/footer.
 *
 * Usage:
 *   npm run pl:compose-site -- \
 *     --handoff clients/<slug>/v2/handoff/od-package \
 *     --modules templates/roofing/modules \
 *     --out clients/<slug>/v2/composed-output
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');

function parseArgs() {
  const out = {};
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (a.startsWith('--')) out[a.slice(2)] = process.argv[++i];
  }
  return out;
}

function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } }
function readText(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function exists(p) { return fs.existsSync(p); }

// ─── Mini-Mustache renderer ────────────────────────────────────────────
// Supports:
//   {{var}}                        · escaped substitution
//   {{{var}}}                      · unescaped (for HTML)
//   {{#list}}...{{/list}}          · iteration (current context = each item)
//   {{?cond}}...{{/cond}}          · conditional (truthy)
//   {{^cond}}...{{/cond}}          · inverted (falsy)
//   {{var.sub.path}}               · dot path
//   {{@index}}                     · iteration index inside #list (1-based)
function getPath(obj, p) {
  if (!obj || !p) return undefined;
  if (p === '.') return obj['__item__'];  // current scalar item inside {{#list}}{{.}}{{/list}}
  const parts = p.split('.');
  let cur = obj;
  for (const k of parts) {
    if (cur == null) return undefined;
    cur = cur[k];
  }
  return cur;
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// LocalBusiness JSON-LD partial · single writer (pl:compose-site)
// Hydrates from `facts` (which is v2.facts unified with handoff facts.json locked_facts).
// `services` is the list of service offerings · used for hasOfferCatalog.
// Returns JSON string (NOT pre-wrapped in <script>) · caller injects into <head>.
// Bug-prevention: silently drops null/missing fields rather than emitting `"name": null`.
function buildLocalBusinessJsonLd(facts, services, canonicalUrl) {
  if (!facts || !facts.business_name) return null; // no JSON-LD without anchor fields
  const f = facts;
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'RoofingContractor',
    name: f.business_name,
  };
  if (canonicalUrl) ld.url = canonicalUrl;
  if (f.phone || f.phone_tel_link) ld.telephone = f.phone || f.phone_tel_link.replace(/^tel:/, '');
  if (f.email) ld.email = f.email;
  if (f.address) {
    const addrParts = String(f.address).split(',').map(s => s.trim()).filter(Boolean);
    const postalParts = { '@type': 'PostalAddress' };
    if (addrParts.length) postalParts.streetAddress = addrParts[0];
    if (f.city) postalParts.addressLocality = f.city;
    // Try extracting state/postcode from the address segment after city
    const stateMatch = addrParts.find(p => /\b[A-Z]{2,3}\s+\d{4}\b/.test(p));
    if (stateMatch) {
      const m = stateMatch.match(/\b([A-Z]{2,3})\s+(\d{4})\b/);
      if (m) {
        postalParts.addressRegion = postalParts.addressRegion || f.state || m[1];
        postalParts.postalCode = m[2];
      }
    } else if (f.state) {
      postalParts.addressRegion = f.state;
    }
    postalParts.addressCountry = 'AU';
    ld.address = postalParts;
  }
  if (Array.isArray(f.service_area) && f.service_area.length) {
    ld.areaServed = f.service_area.slice(0, 30).map(s => (typeof s === 'string' ? s : s.name)).filter(Boolean);
  }
  if (f.rating && f.review_count) {
    ld.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: String(f.rating),
      reviewCount: String(f.review_count),
    };
  }
  if (f.hours && typeof f.hours === 'string') {
    // Pass through human-readable hours · openingHours mapping is a Phase A.2 enrichment
    ld.openingHoursSpecification = { '@type': 'OpeningHoursSpecification', description: f.hours };
  }
  if (Array.isArray(services) && services.length) {
    ld.hasOfferCatalog = {
      '@type': 'OfferCatalog',
      name: `${f.business_name} services`,
      itemListElement: services.slice(0, 20).map((s, i) => ({
        '@type': 'Offer',
        position: i + 1,
        itemOffered: { '@type': 'Service', name: s.name || s.title || s },
      })).filter(o => o.itemOffered.name),
    };
  }
  return JSON.stringify(ld, null, 2);
}

function render(tpl, ctx) {
  if (!tpl) return '';

  // Iterations {{#list}}...{{/list}}
  tpl = tpl.replace(/\{\{#([\w.]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (m, name, inner) => {
    const v = getPath(ctx, name);
    if (!Array.isArray(v)) {
      // Object treated as single-item context
      if (v && typeof v === 'object') return render(inner, { ...ctx, ...v });
      return '';
    }
    return v.map((item, i) => {
      const itemCtx = (item && typeof item === 'object')
        ? { ...ctx, ...item, '__item__': item, '@index': i + 1, '@first': i === 0, '@last': i === v.length - 1 }
        : { ...ctx, '__item__': item, '@index': i + 1, '@first': i === 0, '@last': i === v.length - 1 };
      return render(inner, itemCtx);
    }).join('');
  });

  // Conditionals {{?cond}}...{{/cond}}  and  {{^cond}}...{{/cond}}
  tpl = tpl.replace(/\{\{\?([\w.]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (m, name, inner) => {
    const v = getPath(ctx, name);
    return (v && (!Array.isArray(v) || v.length > 0)) ? render(inner, ctx) : '';
  });
  tpl = tpl.replace(/\{\{\^([\w.]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (m, name, inner) => {
    const v = getPath(ctx, name);
    return (!v || (Array.isArray(v) && v.length === 0)) ? render(inner, ctx) : '';
  });

  // Unescaped {{{var}}}
  tpl = tpl.replace(/\{\{\{([\w.@]+)\}\}\}/g, (m, name) => {
    const v = getPath(ctx, name);
    return v == null ? '' : String(v);
  });

  // Escaped {{var}}
  tpl = tpl.replace(/\{\{([\w.@]+)\}\}/g, (m, name) => {
    const v = getPath(ctx, name);
    return v == null ? '' : escapeHtml(v);
  });

  return tpl;
}

// Module type aliases · normalize section-bindings legacy names
const TYPE_ALIASES = {
  'cta': 'cta-band',
  'cta-strip': 'cta-band',
  'hero-section': 'hero',
  'services': 'services-grid',
  'trust-strip': 'trust-bar',
  'why-choose-us': 'why-us',
  'process-timeline': 'process',
  'service-area': 'service-areas',
  'contact-details': 'contact-form',
  'map': null, // skip · map embed not implemented yet
  'split-detail': 'why-us',
  'log': null, // skip
  'case-study-card': 'case-study',
  'project-detail': 'case-study',
  'timeline': 'about-timeline',
  'team': 'team-grid',
  'staff': 'team-grid',
  'map': 'map-embed',
};

// ─── Module loader ─────────────────────────────────────────────────────
function loadModule(modulesDir, type, variant) {
  const aliased = TYPE_ALIASES.hasOwnProperty(type) ? TYPE_ALIASES[type] : type;
  if (aliased === null) return null; // explicitly skip
  const resolvedType = aliased || type;
  const dir = path.join(modulesDir, resolvedType);
  if (!exists(dir)) return null;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.html'));
  if (files.length === 0) return null;
  const wanted = variant ? `${variant}.html` : files[0];
  const file = files.includes(wanted) ? wanted : files[0];
  const assetsDir = path.join(dir, '_assets');
  return {
    html: readText(path.join(dir, file)),
    type: resolvedType,
    assetsDir: exists(assetsDir) ? assetsDir : null,
  };
}

// ─── Path adjust per page depth + page-aware absolute-to-relative ─────
// `currentFile` is the page being rendered (e.g. "services/roof-replacement.html")
// `validSlugs` maps slug → file path (e.g. "/about" → "about.html") for converting absolute hrefs
function adjustPaths(html, depth, currentFile = '', validSlugs = null) {
  // First: convert absolute hrefs (/about, /services/foo) → page-relative .html paths
  if (validSlugs) {
    const currentDir = path.dirname(currentFile);
    html = html.replace(/href="(\/[^"#?]*)([#?][^"]*)?"/g, (m, slug, qs = '') => {
      // Skip if it's already a known asset path
      if (slug.startsWith('/brand') || slug.startsWith('/assets') || slug.startsWith('/shared') || slug.startsWith('/modules-assets')) return m;
      // Try direct slug match, then with /index
      let targetFile = validSlugs[slug] || validSlugs[slug + '/'] || validSlugs[slug.replace(/\/$/, '')];
      if (!targetFile && slug === '/') targetFile = 'index.html';
      if (!targetFile) {
        // Best-guess: strip leading / and append .html
        targetFile = slug.replace(/^\//, '') + (slug.endsWith('.html') ? '' : '.html');
      }
      // Compute relative path from currentDir → targetFile
      let rel = path.relative(currentDir, targetFile);
      if (!rel) rel = path.basename(targetFile);
      return `href="${rel}${qs || ''}"`;
    });
  }
  if (depth === 0) return html;
  const up = '../'.repeat(depth);
  return html
    .replace(/href="(brand\/[^"]+)"/g, `href="${up}$1"`)
    .replace(/src="(brand\/[^"]+)"/g, `src="${up}$1"`)
    .replace(/href="(assets\/[^"]+)"/g, `href="${up}$1"`)
    .replace(/src="(assets\/[^"]+)"/g, `src="${up}$1"`)
    .replace(/href="(shared\/[^"]+)"/g, `href="${up}$1"`)
    // Inline-style url('...') and url("...") for asset/brand/modules-assets paths
    .replace(/url\((['"]?)(assets\/[^'")]+)\1\)/g, (m, q, p) => `url(${q}${up}${p}${q})`)
    .replace(/url\((['"]?)(brand\/[^'")]+)\1\)/g, (m, q, p) => `url(${q}${up}${p}${q})`)
    .replace(/url\((['"]?)(modules-assets\/[^'")]+)\1\)/g, (m, q, p) => `url(${q}${up}${p}${q})`)
    .replace(/href="(?!#|\/|http|tel:|mailto:|\.\.\/)([^"]+\.html)"/g, `href="${up}$1"`);
}

// ─── Main ──────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs();
  if (!args.handoff || !args.out) {
    console.error('Usage: --handoff <od-package-dir> [--modules <module-lib>] [--skip-validate] --out <output-dir>');
    process.exit(1);
  }
  const handoffDir = path.resolve(args.handoff);
  const outDir = path.resolve(args.out);
  const modulesDir = args.modules ? path.resolve(args.modules) : path.join(REPO, 'templates/roofing/modules');

  if (!exists(modulesDir)) {
    console.error(`Module library not found: ${modulesDir}`);
    console.error('Build modules first OR pass --modules <path>');
    process.exit(1);
  }

  // ─── Validate-handoff hard gate (codex P1 #4) ───
  // Composer refuses to run on a handoff that hasn't passed validate-handoff.
  // Spawns pl-validate-handoff synchronously, parses exit code.
  // Bypass with --skip-validate for legacy clients / smoke tests.
  let validationGate = 'skipped';
  // Robust boolean flag detection (parseArgs greedily eats next arg as value, so check argv directly)
  // --single-page implies --skip-validate (single-page spec has different shape; spike-stage gate)
  const skipValidate = process.argv.includes('--skip-validate') || process.argv.includes('--single-page');
  if (!skipValidate) {
    const slugMatch = handoffDir.match(/clients\/([^/]+)\/v2\/handoff(\/od-package)?\/?$/);
    const slug = slugMatch ? slugMatch[1] : null;
    if (!slug) {
      console.warn(`[compose-site] ⚠ could not infer slug from --handoff ${handoffDir} · validate-handoff gate skipped`);
      validationGate = 'skipped-no-slug';
    } else {
      const { spawnSync } = await import('node:child_process');
      const r = spawnSync('npm', ['run', '--silent', 'pl:validate-handoff', '--', '--slug', slug], {
        cwd: REPO,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const stdout = r.stdout?.toString() || '';
      const stderr = r.stderr?.toString() || '';
      if (r.status === 0) {
        validationGate = 'passed';
        console.log(`[compose-site] ✓ validate-handoff PASS for slug=${slug}`);
      } else {
        validationGate = 'refused';
        console.error(`[compose-site] ✗ validate-handoff FAIL for slug=${slug} — refusing to compose`);
        // Echo validate's own output so the operator sees the errors
        const tail = (stdout + stderr).split('\n').slice(-20).join('\n');
        console.error(tail);
        console.error(`\n  · fix errors then re-run:  npm run pl:validate-handoff -- --slug ${slug}`);
        console.error(`  · or bypass (not recommended):  npm run pl:compose-site -- ${process.argv.slice(2).join(' ')} --skip-validate`);
        process.exit(1);
      }
    }
  } else {
    console.warn(`[compose-site] ⚠ --skip-validate: bypassing validate-handoff gate`);
  }
  console.log(`[compose-site] validationGate=${validationGate}`);

  // ─── V2 schema loader · single source of truth ────────────────────
  // If v2-spec.json exists, hydrate composer's internal vars from it.
  // Override with --spec-file flag (e.g., v2-spec-ai-designed.json from llm-design-site).
  // --single-page flag: prefer v2-spec.single-page.json when present.
  const singlePageFlag = process.argv.includes('--single-page');
  let specFileName = args['spec-file'];
  if (!specFileName) {
    if (singlePageFlag && exists(path.join(handoffDir, 'v2-spec.single-page.json'))) {
      specFileName = 'v2-spec.single-page.json';
    } else {
      specFileName = 'v2-spec.json';
    }
  }
  const v2SpecPath = path.join(handoffDir, specFileName);
  const v2 = exists(v2SpecPath) ? readJson(v2SpecPath) : null;
  if (v2) console.log(`[compose-site] loaded ${specFileName}${v2.mode ? ` (mode=${v2.mode})` : ''}`);
  const isSinglePage = singlePageFlag || v2?.mode === 'single-page';
  if (isSinglePage) console.log(`[compose-site] single-page mode ON · only rendering 'home' page`);

  const facts = v2 ? {
    business_name: v2.facts?.business_name,
    city: v2.facts?.city,
    state: v2.facts?.state,
    phone: v2.facts?.phone?.display,
    phone_tel_link: v2.facts?.phone?.tel ? (v2.facts.phone.tel.startsWith('tel:') ? v2.facts.phone.tel : 'tel:' + v2.facts.phone.tel) : null,
    email: v2.facts?.email,
    address: v2.facts?.address,
    google_maps_url: v2.facts?.google_maps_url,
    rating: v2.facts?.rating,
    review_count: v2.facts?.review_count,
    years_in_business: v2.facts?.years_in_business,
    warranty_workmanship_years: v2.facts?.warranty_workmanship_years,
    licensing_authority: readJson(path.join(handoffDir, 'facts.json'))?.locked_facts?.licensing_authority
      || v2.facts?.licensing?.full_name
      || v2.facts?.licensing?.authority,
    service_area: v2.facts?.service_area || [],
    hours: v2.facts?.hours,
  } : (readJson(path.join(handoffDir, 'facts.json'))?.locked_facts || {});

  let services = v2 ? (v2.services || []).map((s) => {
    const pg = (v2.pages || []).find((p) => p.id === s.page_id);
    return { ...s, page_slug: pg?.slug || null };
  }) : (readJson(path.join(handoffDir, 'content/services.json'))?.services || []);

  const faqs = v2 ? (v2.narrative_content?.faqs || []) : (readJson(path.join(handoffDir, 'content/faq.json'))?.faqs || []);
  const heroes = v2
    ? Object.entries(v2.narrative_content?.hero_copy || {}).map(([angle, h]) => ({ angle, headline: h.headline, subheadline: h.subhead, primary_cta: h.primary_cta, secondary_cta: h.secondary_cta, proof_chips: h.proof_chips }))
    : (readJson(path.join(handoffDir, 'content/hero-copy.json'))?.candidates || []);
  const aboutMd = v2 ? (v2.narrative_content?.about_md || '') : readText(path.join(handoffDir, 'content/about.md')).replace(/^---[\s\S]*?---\n/, '');
  let pageMap = v2 ? v2.pages.map((p) => ({ slug: p.slug, file: p.file, h1: p.h1, od_page_type: p.role, service_ref: p.service_ref })) : (readJson(path.join(handoffDir, 'structure/page-map.json'))?.pages || []);
  let bindings = v2
    ? { pages: v2.pages.map((p) => ({ slug: p.slug, blocks: p.blocks })) }
    : (readJson(path.join(handoffDir, 'structure/section-bindings.json')) || { pages: [] });
  if (isSinglePage) {
    // Filter to just the home page (id="home" OR slug="/")
    const homePage = (v2?.pages || []).find((p) => p.id === 'home' || p.slug === '/');
    if (!homePage) {
      console.error(`[compose-site] --single-page: no 'home' page found in spec`);
      process.exit(1);
    }
    pageMap = [{ slug: homePage.slug, file: 'index.html', h1: homePage.h1, od_page_type: 'single-page', service_ref: null }];
    bindings = { pages: [{ slug: homePage.slug, blocks: homePage.blocks }] };
    console.log(`[compose-site] filtered to single page: ${homePage.blocks.length} blocks`);
  }
  const brandSpec = readJson(path.join(handoffDir, 'brand/brand-spec.json')) || {};

  // Fallback · derive services from page-map slugs when services.json is empty
  if (services.length === 0) {
    const cityName = facts.city || 'Australia';
    services = pageMap
      .filter((p) => /service|roof|gutter|tile|metal|repair|replace|restore|paint|leak|storm|emergency/i.test(p.slug || '') && p.slug !== '/services' && p.slug !== '/')
      .map((p) => {
        const slug = p.slug.replace(/^\//, '').replace(/^services\//, '');
        const name = slug.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
        return {
          name,
          short_desc: `Professional ${name.toLowerCase()} across ${cityName} and surrounding suburbs · written quote · ${facts.warranty_workmanship_years || 10}-year workmanship warranty.`,
          long_desc: `${name} delivered by ${facts.licensing_authority?.split('(')[0]?.trim() || 'licensed'} roofers. We inspect on-site, photograph everything, give you an itemised written quote within 48 hours, and stand behind the work with a ${facts.warranty_workmanship_years || 10}-year workmanship warranty in writing.`,
          page_slug: p.slug,
        };
      });
    if (services.length === 0) {
      // Final fallback — generic roofer service trio
      services = [
        { name: 'Roof Replacement', short_desc: `Full Colorbond® re-roofs across ${cityName}.`, page_slug: '/services/roof-replacement' },
        { name: 'Roof Repair', short_desc: `Storm damage · leak repairs · same-week response.`, page_slug: '/services/roof-repair' },
        { name: 'Gutter Replacement', short_desc: `Colorbond gutter, fascia, and downpipe replacement.`, page_slug: '/services/gutter-replacement' },
      ];
    }
  }

  // Asset inventory
  const assetsDir = path.join(handoffDir, 'assets');
  // Prefer close-up roof shots over aerial drone wires/dirt-pit shots
  const heroImage = exists(path.join(assetsDir, 'hero-roof-restoration.png')) ? 'assets/hero-roof-restoration.png' :
                    exists(path.join(assetsDir, 'hero-roof-restoration.jpg')) ? 'assets/hero-roof-restoration.jpg' :
                    exists(path.join(assetsDir, 'home-trust-restored-roof.png')) ? 'assets/home-trust-restored-roof.png' :
                    exists(path.join(assetsDir, 'hero-roof.jpg')) ? 'assets/hero-roof.jpg' :
                    exists(path.join(assetsDir, 'hero-roof.png')) ? 'assets/hero-roof.png' :
                    exists(path.join(assetsDir, 'hero-aerial.jpg')) ? 'assets/hero-aerial.jpg' : null;
  const galleryImages = exists(path.join(assetsDir, 'work'))
    ? fs.readdirSync(path.join(assetsDir, 'work')).filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f)).map((f) => ({ src: `assets/work/${f}`, alt: `${facts.business_name || 'Project'} project ${f}` }))
    : [];

  const heroPick = heroes[0] || {};
  const heroForm = heroPick.hero_form_fields || ['name', 'phone', 'suburb', 'service_interest'];

  // Context for templates
  const baseCtx = {
    business_name: facts.business_name,
    phone: facts.phone,
    tel_link: facts.phone_tel_link || (facts.phone ? `tel:${facts.phone.replace(/[^\d+]/g, '')}` : ''),
    email: facts.email,
    email_link: facts.email ? `mailto:${facts.email}` : '',
    address: facts.address,
    city: facts.city,
    state: facts.state,
    rating: facts.rating,
    review_count: facts.review_count,
    years_in_business: facts.years_in_business,
    licensing_authority: facts.licensing_authority?.split('(')[0]?.trim() || facts.licensing_authority,
    licensing_authority_full: facts.licensing_authority,
    warranty_years: facts.warranty_workmanship_years || 10,
    google_maps_url: facts.google_maps_url || `https://maps.google.com/?q=${encodeURIComponent(facts.address || '')}`,
    service_area: facts.service_area || [],
    social_links: facts.social_links || {},
    hours: facts.hours || 'By appointment',
    hero: (() => {
      // Compose a SHORT, scannable hero headline (≤ 6 words) and push the rest into subheadline.
      // Hard limits: h1 ≤ 6 words / 40 chars · subheadline ≤ 220 chars (2 short sentences).
      const rawHeadline = heroPick.headline || `${facts.business_name || 'Local'} in ${facts.city || 'Australia'}`;
      const rawSub = heroPick.subheadline || '';
      const trimWords = (s, max) => {
        const w = s.trim().split(/\s+/);
        return w.length <= max ? s.trim() : w.slice(0, max).join(' ');
      };
      const trimChars = (s, max) => {
        if (s.length <= max) return s.trim();
        const cut = s.slice(0, max);
        const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
        return (lastStop > 60 ? cut.slice(0, lastStop + 1) : cut.replace(/[,;:]?\s+\S*$/, '') + '…').trim();
      };
      const cityCap = facts.city || 'Your Area';
      const years = facts.years_in_business;
      // Prefer a sharp city/years-based hook over a long AI headline
      let h1, sub;
      const rawWords = rawHeadline.trim().split(/\s+/);
      if (rawWords.length <= 6) {
        h1 = rawHeadline.trim();
        sub = trimChars(rawSub, 220);
      } else {
        // Long AI headline → make a short fact-based hook, push original into subheadline
        h1 = years ? `${years}+ Years on ${cityCap} Roofs` : `Trusted ${cityCap} Roofing`;
        const combinedSub = rawHeadline.trim().replace(/\.$/, '') + (rawSub ? '. ' + rawSub : '.');
        sub = trimChars(combinedSub, 220);
      }
      return {
      headline: h1,
      subheadline: sub,
      primary_cta_label: heroPick.primary_cta?.label || `Call ${facts.phone}`,
      primary_cta_href: heroPick.primary_cta?.href || (facts.phone ? `tel:${facts.phone.replace(/[^\d+]/g, '')}` : '#'),
      secondary_cta_label: heroPick.secondary_cta?.label || 'Free quote',
      secondary_cta_href: heroPick.secondary_cta?.href || '#quote-form',
      proof_chips: heroPick.proof_chips || [],
      image: heroImage,
      form_fields: heroForm,
      };
    })(),
    services: services.map((s) => ({
      name: s.name,
      short_desc: s.short_desc || s.desc || '',
      long_desc: s.long_desc || s.desc || s.short_desc || '',
      page_slug: s.page_slug,
      persuasion: s.persuasion || null,
      pain_hook: s.persuasion?.pain_hook,
      process_summary: s.persuasion?.process_summary,
    })),
    faqs: faqs.map((f) => ({ q: f.q, a: f.a })),
    about_html: (() => {
      const paragraphs = aboutMd
        .replace(/^\s*#\s+.+\n/, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .split('\n\n')
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
      // Cap at first 2 paragraphs (~ 1 screen) · about-body sections that exceed are unreadable
      const capped = paragraphs.slice(0, 2);
      return capped
        .map((p) => `<p>${escapeHtml(p).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')}</p>`)
        .join('\n');
    })(),
    gallery: galleryImages,
    why_us: [
      { title: `${facts.years_in_business || '20'}+ years on ${facts.city || 'local'} roofs`, body: `From single-storey re-roofs in older suburbs to multi-storey new builds on subdivisions. ${facts.owner_name ? `${facts.owner_name} stays on the tools — quoting, supervising and signing off the work.` : `We keep the same supervising team across quote, install and sign-off — no subcontractor handovers.`}` },
      { title: `${facts.warranty_workmanship_years || '10'}-year workmanship warranty in writing`, body: `Full repair, no proportional reduction. Transferable to the next owner if you sell. Lodged with your insurer on request.` },
      { title: `${facts.licensing_authority?.split('(')[0]?.trim() || 'Licensed'} registered + WorkSafe`, body: `Public liability $20M · workers comp on every crew member · SWMS prepared before the first sheet comes off.` },
      { title: `${facts.rating || '4.1'}★ across ${facts.review_count || '18'} Google reviews`, body: `Real verified ratings on the Google Business Profile · not curated testimonials. Ask us about any name you see there.` },
    ],
    team: v2 ? (v2.narrative_content?.team || null) : (readJson(path.join(handoffDir, 'content/team.json'))?.team || null),
    timeline: v2 ? (v2.narrative_content?.timeline || null) : (readJson(path.join(handoffDir, 'content/timeline.json'))?.timeline || null),
    case_studies: v2 ? (v2.narrative_content?.case_studies || null) : (readJson(path.join(handoffDir, 'content/case-studies.json'))?.case_studies || null),
    reviews: v2
      ? (Array.isArray(v2.narrative_content?.reviews) && v2.narrative_content.reviews.length
          ? v2.narrative_content.reviews
          : (v2.narrative_content?.testimonials || null))
      : (readJson(path.join(handoffDir, 'content/reviews.json'))?.reviews || null),
    stats: v2 ? (v2.narrative_content?.stats || null) : (readJson(path.join(handoffDir, 'content/stats.json'))?.stats || null),
    process: [
      { step: 1, title: 'On-site assessment', body: 'We climb the roof, photograph every plane, valley, and flashing. Measure to the metre. Talk you through what we found and what your options actually cost — not a salesperson reading from a script.' },
      { step: 2, title: 'Written quote within 48 hours', body: 'Itemised: sheet metres of Colorbond, profile, colour, gutter linear metres, flashings, removal & tip fees. You can compare it line-for-line against any other quote.' },
      { step: 3, title: 'Schedule around your week', body: 'Weather-aware booking · we don\'t start a strip-and-replace if rain is forecast inside the install window. Daily SMS update from the site supervisor while we\'re on your roof.' },
      { step: 4, title: 'Final walk + warranty pack', body: `${facts.warranty_workmanship_years || 10}-year workmanship warranty in writing · BlueScope coating warranty registered · photo log of the completed job · cleanup signed off before invoice.` },
    ],
  };

  console.log(`[compose-site] handoff: ${path.relative(REPO, handoffDir)}`);
  console.log(`  business: ${facts.business_name || '?'} · city: ${facts.city || '?'}`);
  console.log(`  services: ${services.length} · faqs: ${faqs.length} · gallery: ${galleryImages.length}`);
  console.log(`  pages: ${pageMap.length}`);

  // Set up out dir
  if (exists(outDir)) fs.rmSync(outDir, { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });

  // Copy shared/ · brand/ · assets/
  function copyRec(src, dst) {
    fs.mkdirSync(dst, { recursive: true });
    for (const e of fs.readdirSync(src, { withFileTypes: true })) {
      if (e.name.startsWith('.')) continue;
      const sf = path.join(src, e.name);
      const df = path.join(dst, e.name);
      if (e.isDirectory()) copyRec(sf, df);
      else fs.copyFileSync(sf, df);
    }
  }
  for (const sub of ['shared', 'brand', 'assets']) {
    const src = path.join(handoffDir, sub);
    if (exists(src)) copyRec(src, path.join(outDir, sub));
  }
  console.log(`  ✓ copied shared/ + brand/ + assets/`);

  // Header/footer: V2 generates from spec at compose time; V1 reads pre-baked
  let headerHtml, footerHtml;
  if (v2) {
    // Ensure v2.facts has verbatim licensing_authority so footer disclaimer matches T1 locked-facts check
    const lockedLicAuthority = readJson(path.join(handoffDir, 'facts.json'))?.locked_facts?.licensing_authority;
    if (lockedLicAuthority && !v2.facts.licensing_authority) {
      v2.facts.licensing_authority = lockedLicAuthority;
    }
    // Propagate ABN from locked_facts so footer renders it (T1 requires verbatim presence)
    const lockedFacts = readJson(path.join(handoffDir, 'facts.json'))?.locked_facts || {};
    if (lockedFacts.abn && !v2.facts.abn) v2.facts.abn = lockedFacts.abn;
    // Hours: use facts.hours if structured object (per-day), otherwise leave default
    if (lockedFacts.hours && !v2.facts.hours_raw) v2.facts.hours_raw = lockedFacts.hours;
    const buildHF = await import('./_pl-header-footer-builder.js');
    headerHtml = buildHF.buildHeader(v2, pageMap);
    footerHtml = buildHF.buildFooter(v2, pageMap, services);
  } else {
    headerHtml = readText(path.join(handoffDir, 'shared/header.html'));
    footerHtml = readText(path.join(handoffDir, 'shared/footer.html'));
  }

  // Per-page composition
  const bindingsByPage = new Map();
  for (const p of (bindings.pages || [])) bindingsByPage.set(p.slug, p);

  // Default block list per OD-page-type (if no bindings for a page)
  // home/about/contact aligned with weatherproof template page-flow (reference-parity target)
  const DEFAULT_BLOCKS = {
    home:               ['hero', 'about-intro', 'services-grid', 'value-prop-with-image', 'stats-band', 'reviews', 'value-prop-band', 'before-after', 'financing-band', 'faq', 'cta-band'],
    'service-detail':   ['hero', 'about-intro', 'process', 'value-prop-with-image', 'before-after', 'reviews', 'faq', 'lead-form', 'cta-band'],
    'services-overview':['hero', 'services-grid', 'value-prop-with-image', 'process', 'reviews', 'faq', 'lead-form', 'cta-band'],
    about:              ['hero', 'about-intro', 'about-body', 'about-timeline', 'value-prop-with-image', 'team-grid', 'reviews', 'value-prop-band', 'lead-form', 'cta-band'],
    gallery:            ['hero', 'before-after', 'gallery', 'value-prop-with-image', 'reviews', 'cta-band'],
    contact:            ['hero', 'contact-form', 'map-embed', 'value-prop-with-image', 'service-areas', 'faq', 'cta-band'],
    legal:              ['hero', 'legal-body'],
  };
  // Page-role aliases · normalize legacy / alternate type names
  const ROLE_ALIASES = {
    service: 'service-detail',
    'service-page': 'service-detail',
    services: 'services-overview',
    'our-work': 'gallery',
    work: 'gallery',
    portfolio: 'gallery',
    'single-page': 'home',
  };

  // Hero variant per page role · so each page feels visually distinct
  const HERO_VARIANT_BY_ROLE = {
    home: 'fullbleed-with-form',                   // text-left + quote form-right (conversion)
    'service-detail': 'cinematic-with-bundled-photo',  // dramatic for service intent
    'services-overview': 'split-image-right',     // text+image split
    about: 'compact-banner',                       // centered banner, no big image
    gallery: 'compact-banner',
    contact: 'compact-banner',
    legal: 'compact-banner',
  };

  // Track modules used across all pages so we can copy their _assets/ once.
  const usedModuleAssets = new Map(); // type -> assetsDir

  // Build slug → file map once (for absolute-path → page-relative conversion in adjustPaths)
  const validSlugs = {};
  for (const p of pageMap) {
    const file = p.file || (p.slug === '/' ? 'index.html' : (p.slug || '').replace(/^\//, '') + '.html');
    validSlugs[p.slug] = file;
  }

  let composed = 0;
  for (const page of pageMap) {
    const slug = page.slug || '/';
    const rawRole = page.od_page_type || page.type || (slug === '/' ? 'home' : 'service-detail');
    const role = ROLE_ALIASES[rawRole] || rawRole;
    const filePath = page.file || (slug === '/' ? 'index.html' : slug.replace(/^\//, '') + '.html');
    const depth = filePath.split('/').length - 1;

    const binding = bindingsByPage.get(slug);
    const blocks = binding?.blocks?.length ? binding.blocks : (DEFAULT_BLOCKS[role] || DEFAULT_BLOCKS.home).map((t) => ({ type: t }));

    // Page-specific context (override hero if binding has more specific copy)
    let pageCtx = { ...baseCtx, page_title: page.h1 || facts.business_name, page_slug: slug, page_role: role };

    // Per-role hero copy override (so each page feels distinct, not the same PAS headline everywhere)
    const cityState = `${facts.city || 'Local'} · ${facts.state || 'AU'}`;
    if (role === 'home') {
      // Home: brand-led, factual, not emergency PAS
      const nonPas = heroes.find((h) => h.angle && !/PAS|storm/i.test(h.angle));
      const rawH = nonPas?.headline || pageCtx.hero.headline;
      const rawS = nonPas?.subheadline || pageCtx.hero.subheadline || '';
      const hWords = (rawH || '').trim().split(/\s+/);
      const trimChars = (s, max) => {
        if (!s || s.length <= max) return (s || '').trim();
        const cut = s.slice(0, max);
        const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
        return (lastStop > 60 ? cut.slice(0, lastStop + 1) : cut.replace(/[,;:]?\s+\S*$/, '') + '…').trim();
      };
      const cityCap = facts.city || 'Your Area';
      const years = facts.years_in_business;
      let homeH1, homeSub;
      if (hWords.length <= 6) {
        homeH1 = rawH.trim();
        homeSub = trimChars(rawS, 220);
      } else {
        // Pick the sharpest available hook from a small fact-aware bank
        const bank = [];
        if (years) bank.push(`${years}+ years on ${cityCap} roofs`);
        if (facts.review_count && parseFloat(facts.rating || 0) >= 4.5) bank.push(`${cityCap}'s ${facts.rating}★ roofing crew`);
        if (facts.warranty_workmanship_years) bank.push(`${facts.warranty_workmanship_years}-yr warranty · ${cityCap} roofs`);
        bank.push(`Roofs Built to Last · ${cityCap}`);
        bank.push(`${cityCap} Roofing · Done Right`);
        homeH1 = bank[0]; // sharpest = first available
        const combined = rawH.trim().replace(/\.$/, '') + (rawS ? '. ' + rawS : '.');
        homeSub = trimChars(combined, 220);
      }
      pageCtx.hero = {
        ...pageCtx.hero,
        headline: homeH1,
        subheadline: homeSub,
        primary_cta_label: nonPas?.primary_cta?.label || pageCtx.hero.primary_cta_label,
        primary_cta_href: nonPas?.primary_cta?.href || pageCtx.hero.primary_cta_href,
        secondary_cta_label: nonPas?.secondary_cta?.label || pageCtx.hero.secondary_cta_label,
        secondary_cta_href: nonPas?.secondary_cta?.href || pageCtx.hero.secondary_cta_href,
        proof_chips: nonPas?.proof_chips || pageCtx.hero.proof_chips,
        eyebrow: cityState,
      };
    } else if (role === 'about') {
      pageCtx.hero = {
        ...pageCtx.hero,
        headline: `${facts.years_in_business || '20'}+ years on ${facts.city || 'local'} roofs`,
        subheadline: `${facts.owner_name ? `${facts.owner_name} on site for every quote. ` : ''}Same trade team, same standard, since the company started. Here's how ${facts.business_name || 'we'} got here — and who answers when you call.`,
        eyebrow: 'About us',
      };
    } else if (role === 'services-overview') {
      pageCtx.hero = {
        ...pageCtx.hero,
        headline: `What we install across ${facts.city || 'the region'}`,
        subheadline: `Re-roofs · new builds · storm repair · gutters. ${facts.licensing_authority?.split('(')[0]?.trim() || 'Licensed'} crew · ${facts.warranty_workmanship_years || 10}-year workmanship warranty in writing · no subcontracted surprise.`,
        eyebrow: 'Services',
      };
    } else if (role === 'gallery') {
      pageCtx.hero = {
        ...pageCtx.hero,
        headline: `Recent ${facts.city || 'local'} roofs · with the receipts`,
        subheadline: `Every project documented · materials specified · before/after pairs · written quotes. Drag the slider to see the difference; ask us about any address you recognise.`,
        eyebrow: 'Our Work',
      };
    } else if (role === 'contact') {
      pageCtx.hero = {
        ...pageCtx.hero,
        headline: `Free quote · same-week site visit`,
        subheadline: `Call ${facts.phone || 'us'} or fill out the form below. We respond within one business day. Tell us your suburb and what you're chasing — we'll come measure, photograph, and quote in writing.`,
        eyebrow: `Contact ${facts.business_name || ''}`.trim(),
      };
    } else if (role === 'service-detail' || slug.startsWith('/services/')) {
      // Normalize slugs: strip leading '/', strip trailing 's' (plural), lowercase, collapse hyphens.
      // Lets 'roof-repair' page match service id 'roof-repairs', etc.
      const norm = (x) => (x || '').toLowerCase().replace(/^\//, '').replace(/\.html$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').replace(/s$/, '');
      const slugN = norm(slug);
      const titleFromSlug = (slug.replace(/^\//, '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));
      const svc = services.find((s) => norm(s.page_slug) === slugN
                                    || norm(s.id) === slugN
                                    || norm(s.name) === slugN
                                    || norm(s.name).startsWith(slugN)
                                    || slugN.startsWith(norm(s.id))
                                    || slugN.startsWith(norm(s.name)));
      // Fallback: derive a sensible service name from the URL slug even when no svc data exists
      const svcName = svc?.name || titleFromSlug;
      const svcDesc = svc?.long_desc || svc?.short_desc || svc?.desc || `${facts.business_name || 'Our crew'} delivers ${titleFromSlug.toLowerCase()} across ${facts.city || 'the region'} — ${facts.licensing_authority?.split('(')[0]?.trim() || 'licensed'} crew, written quotes, ${facts.warranty_workmanship_years || 10}-year workmanship warranty.`;
      pageCtx.hero = {
        ...pageCtx.hero,
        headline: svcName + (facts.city ? ' in ' + facts.city : ''),
        subheadline: svcDesc,
        eyebrow: `${facts.city || 'Service'} · ${facts.state || ''} · ${facts.licensing_authority?.split('(')[0]?.trim() || 'licensed'}`.replace(/\s+·\s+·\s+/, ' · '),
      };
    } else if (role === 'legal') {
      pageCtx.hero = {
        ...pageCtx.hero,
        headline: page.h1 || 'Legal',
        subheadline: '',
        eyebrow: facts.business_name || '',
      };
    }

    // Per-page template_assets base path (relative to this page's location)
    const templateAssetsBase = (depth === 0 ? '' : '../'.repeat(depth)) + 'modules-assets';

    // Compose body
    let body = '';
    let postFooter = ''; // blocks that must render OUTSIDE main (after </footer>) · e.g. sticky-mobile-bar
    for (const block of blocks) {
      const type = block.type;
      // Hero variant: per-block override > per-role default > module default
      let variant = block.variant || null;
      if (!variant && type === 'hero' && HERO_VARIANT_BY_ROLE[role]) variant = HERO_VARIANT_BY_ROLE[role];
      const mod = loadModule(modulesDir, type, variant);
      if (!mod) {
        console.warn(`  [warn] module not found: ${type}${variant ? '/' + variant : ''} · skipping on ${slug}`);
        continue;
      }
      if (mod.assetsDir && !usedModuleAssets.has(mod.type)) {
        usedModuleAssets.set(mod.type, mod.assetsDir);
      }
      // Per-block content override (AI-designed spec) · merge into pageCtx for the right module shape
      const blockCtxOverride = { ...(block.context || {}) };
      if (block.content) {
        const c = block.content;
        // Hero blocks: merge content into pageCtx.hero (nested shape modules expect)
        if (type === 'hero') {
          blockCtxOverride.hero = { ...(pageCtx.hero || {}), ...c };
        }
        // Trust-bar: content.chips → render via {{#chips}} (module update would be needed) · stash for now
        // Why-us / process: content.items → pageCtx.why_us / process arrays
        else if (type === 'why-us' && Array.isArray(c.items)) {
          blockCtxOverride.why_us = c.items;
        } else if (type === 'process' && Array.isArray(c.items)) {
          blockCtxOverride.process = c.items;
        } else if (type === 'faq' && Array.isArray(c.items)) {
          blockCtxOverride.faqs = c.items;
        } else if (type === 'reviews' && Array.isArray(c.items)) {
          blockCtxOverride.reviews = c.items;
        } else if (type === 'stats-band' && Array.isArray(c.items)) {
          blockCtxOverride.stats = c.items;
        } else if (type === 'cta-band') {
          blockCtxOverride.cta_band = c;
        }
        // Other blocks: pass content as flat additional fields (module may or may not consume)
        else {
          Object.assign(blockCtxOverride, c);
        }
      }
      const rendered = '\n' + render(mod.html, { ...pageCtx, ...blockCtxOverride, template_assets: templateAssetsBase }) + '\n';
      if (type === 'sticky-mobile-bar') {
        postFooter += rendered;
      } else {
        body += rendered;
      }
    }

    // Assemble page
    const cssLink = depth === 0 ? 'shared/shared.css' : '../'.repeat(depth) + 'shared/shared.css';
    const adjustedHeader = adjustPaths(headerHtml, depth, filePath, validSlugs);
    const adjustedFooter = adjustPaths(footerHtml, depth, filePath, validSlugs);
    const adjustedBody = adjustPaths(body, depth, filePath, validSlugs);
    const adjustedPostFooter = adjustPaths(postFooter, depth, filePath, validSlugs);

    const pageTitle = page.h1 ? `${page.h1} · ${facts.business_name}` : `${facts.business_name} · ${facts.city}`;
    const pageDesc = pageCtx.hero?.subheadline || baseCtx.hero.subheadline || `${facts.business_name} · ${facts.city}, ${facts.state}`;

    // LocalBusiness JSON-LD · only on home / single-page (root depth) · avoids duplicate writers across pages
    const canonicalUrl = v2?.facts?.canonical_url || facts.existing_website || null;
    const jsonLd = (depth === 0)
      ? buildLocalBusinessJsonLd(facts, services, canonicalUrl)
      : null;
    const jsonLdTag = jsonLd ? `\n  <script type="application/ld+json">${jsonLd}</script>` : '';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="description" content="${escapeHtml(pageDesc).slice(0, 160)}" />
  <link rel="stylesheet" href="${cssLink}" />
  <link rel="icon" href="${depth === 0 ? '' : '../'.repeat(depth)}brand/favicon.svg" />${jsonLdTag}
</head>
<body>

${adjustedHeader}

<main>${adjustedBody}</main>

${adjustedFooter}

${adjustedPostFooter}

<script>
// Header dropdown toggle · keyboard + tap support (desktop hover handled by CSS)
document.querySelectorAll('.site-header .nav-trigger').forEach(function(btn){
  btn.addEventListener('click', function(e){
    e.stopPropagation();
    var open = btn.getAttribute('aria-expanded') === 'true';
    document.querySelectorAll('.site-header .nav-trigger').forEach(function(b){ b.setAttribute('aria-expanded','false'); });
    btn.setAttribute('aria-expanded', open ? 'false' : 'true');
  });
});
document.addEventListener('click', function(){
  document.querySelectorAll('.site-header .nav-trigger').forEach(function(b){ b.setAttribute('aria-expanded','false'); });
});
</script>

</body>
</html>
`;

    const outPath = path.join(outDir, filePath);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, html);
    composed++;
    console.log(`  ✓ ${filePath} (${blocks.length} blocks · ${(html.length / 1024).toFixed(1)}KB)`);
  }

  // Copy bundled module _assets/ into output/modules-assets/<type>/
  if (usedModuleAssets.size > 0) {
    const moduleAssetsOut = path.join(outDir, 'modules-assets');
    fs.mkdirSync(moduleAssetsOut, { recursive: true });
    for (const [type, src] of usedModuleAssets) {
      copyRec(src, path.join(moduleAssetsOut, type));
    }
    console.log(`  ✓ copied bundled module assets · ${usedModuleAssets.size} module(s)`);
  }

  console.log(`[compose-site] composed ${composed} pages → ${path.relative(REPO, outDir)}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
