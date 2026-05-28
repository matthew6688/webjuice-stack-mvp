#!/usr/bin/env node
/**
 * pl:extract-site-ctx
 *
 * Reads master.md + core-extract.json → writes site-ctx.json
 *
 * This is the "middle contract" that all downstream copy-generation tools read.
 * Zero LLM. Deterministic parse. Fast.
 *
 * Usage:
 *   npm run pl:extract-site-ctx -- --slug vicwest-roofing
 *   npm run pl:extract-site-ctx -- --slug vicwest-roofing --force
 *   npm run pl:extract-site-ctx -- --slug vicwest-roofing --write-content
 *
 * Flags:
 *   --force          Regenerate even if site-ctx.json is < 24 hours old
 *   --write-content  Also write reviews.json + coverage.json to handoff/od-package/content/
 *
 * Output: clients/<slug>/v2/site-ctx.json
 *         clients/<slug>/v2/handoff/od-package/content/reviews.json  (if --write-content)
 *         clients/<slug>/v2/handoff/od-package/content/coverage.json (if --write-content)
 *
 * Codex R45+R46 consensus: Option B+C hybrid
 *   - YAML frontmatter → direct parse (zero LLM)
 *   - core-extract.json real_facts → structured fields
 *   - master.md body sections → not parsed here (data already in core-extract)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

// ── args ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const slugIdx = args.indexOf('--slug');
const slug = slugIdx !== -1 ? args[slugIdx + 1] : null;
const force = args.includes('--force');
const writeContent = args.includes('--write-content');

if (!slug) {
  console.error('Usage: pl:extract-site-ctx --slug <slug> [--force]');
  process.exit(1);
}

// ── paths ─────────────────────────────────────────────────────────────────────

const clientDir   = path.join(ROOT, 'clients', slug, 'v2');
const masterMdPath = path.join(clientDir, 'master.md');
const coreExtractPath = path.join(clientDir, 'core-extract.json');
const factsPath   = path.join(clientDir, 'facts.json');
const outPath     = path.join(clientDir, 'site-ctx.json');

// ── skip if already exists (use --force to regenerate) ───────────────────────

if (fs.existsSync(outPath) && !force) {
  const existing = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  const age = Date.now() - new Date(existing.generated_at || 0).getTime();
  if (age < 24 * 60 * 60 * 1000) { // < 24 hours old
    console.log(`[skip] site-ctx.json is fresh (${Math.round(age / 60000)}min old) · use --force to regenerate`);
    process.exit(0);
  }
}

// ── parse master.md YAML frontmatter ─────────────────────────────────────────

function parseMasterMdFrontmatter(mdPath) {
  if (!fs.existsSync(mdPath)) return {};
  const content = fs.readFileSync(mdPath, 'utf8');
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  // Simple YAML parser for known fields (no dependencies)
  const yaml = match[1];
  const result = {};

  // Scalar fields
  const scalarFields = [
    'business_id', 'business_name', 'niche', 'city', 'rating', 'review_count',
    'website', 'audit_score', 'deploy_url', 'deploy_stage',
    'visual_age', 'generated_at',
  ];
  for (const field of scalarFields) {
    const m = yaml.match(new RegExp(`^${field}:\\s*"?([^"\\n]+)"?`, 'm'));
    if (m) result[field] = m[1].trim().replace(/^"(.*)"$/, '$1');
  }

  // Numeric coercion
  for (const f of ['rating', 'review_count', 'audit_score']) {
    if (result[f] !== undefined) {
      const n = parseFloat(result[f]);
      result[f] = isNaN(n) ? null : n;
    }
  }

  // license block (nested)
  const licenseBlock = yaml.match(/^license:\n((?:[ \t]+.+\n?)+)/m);
  if (licenseBlock) {
    const lb = licenseBlock[1];
    result.license = {};
    const fields = ['status', 'authority', 'licence_number', 'licensee_name', 'lookup_tier'];
    for (const f of fields) {
      const m = lb.match(new RegExp(`${f}:\\s*"?([^"\\n]+)"?`));
      if (m) result.license[f] = m[1].trim().replace(/^"(.*)"$/, '$1');
    }
  }

  // assets block (nested)
  const assetsBlock = yaml.match(/^assets:\n((?:[ \t]+.+\n?)+)/m);
  if (assetsBlock) {
    const ab = assetsBlock[1];
    result.assets = {};
    const fields = ['video_url', 'desktop_screenshot', 'mobile_screenshot'];
    for (const f of fields) {
      const m = ab.match(new RegExp(`${f}:\\s*"?([^"\\n]+)"?`));
      if (m) result.assets[f] = m[1].trim().replace(/^"(.*)"$/, '$1');
    }
  }

  return result;
}

// ── load core-extract.json ────────────────────────────────────────────────────

function loadCoreExtract(cePath) {
  if (!fs.existsSync(cePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(cePath, 'utf8'));
  } catch {
    return null;
  }
}

// ── build trust signals from available data ───────────────────────────────────

function buildTrustSignals({ frontmatter, realFacts }) {
  const signals = [];

  // License
  const lic = frontmatter.license;
  if (lic && lic.status === 'active' && lic.authority && lic.licence_number) {
    signals.push(`Licensed ${lic.authority} — ${lic.licence_number}`);
  }

  // Rating
  if (frontmatter.rating >= 4.0 && frontmatter.review_count > 0) {
    signals.push(`${frontmatter.rating}★ on Google (${frontmatter.review_count} reviews)`);
  }

  // ABN
  if (realFacts?.abn?.number) {
    signals.push(`ABN ${realFacts.abn.number}`);
  }

  // Founded / trading since
  if (realFacts?.abn?.effective_from) {
    const year = new Date(realFacts.abn.effective_from).getFullYear();
    if (year && year > 2000) {
      signals.push(`Trading since ${year}`);
    }
  }

  return signals;
}

// ── normalise reviews ─────────────────────────────────────────────────────────

function normaliseReviews(testimonials) {
  if (!Array.isArray(testimonials)) return [];
  return testimonials
    .filter(t => t.quote && t.quote.length > 20)
    .slice(0, 5)
    .map(t => ({
      quote: String(t.quote || '').trim(),
      author: String(t.author || 'Google Reviewer').trim(),
      location: t.location || null,
      stars: t.stars || 5,
    }));
}

// ── normalise suburbs ─────────────────────────────────────────────────────────

function normaliseSuburbs(realSuburbs, aiSuburbs, city) {
  const all = [];
  const seen = new Set();

  // Real/verified suburbs first
  for (const s of (realSuburbs || [])) {
    const name = String(s).trim();
    if (name && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      all.push({ suburb: name, source: 'verified' });
    }
  }

  // AI-inferred suburbs (labelled)
  for (const s of (aiSuburbs || [])) {
    const name = String(s.suburb || s).trim();
    if (name && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      all.push({ suburb: name, source: s.source || 'ai-inferred' });
    }
  }

  return all;
}

// ── normalise services ────────────────────────────────────────────────────────

function normaliseServices(serviceList) {
  if (!Array.isArray(serviceList)) return [];
  return serviceList.slice(0, 6).map(s => ({
    name: String(s.name || '').trim(),
    brief: String(s.brief || s.short_desc || '').trim(),
    _source: s._source || 'core-extract:real_facts',
  }));
}

// ── normalise FAQs ────────────────────────────────────────────────────────────

function normaliseFaqs(suggestedFaqs) {
  if (!Array.isArray(suggestedFaqs)) return [];
  return suggestedFaqs.slice(0, 8).map(f => ({
    q: String(f.q || f.question || '').trim(),
    a: String(f.a || f.answer || '').trim(),
    _source: f.source || 'ai-inferred',
  }));
}

// ── main ──────────────────────────────────────────────────────────────────────

console.log(`[pl:extract-site-ctx] slug=${slug}`);

const frontmatter = parseMasterMdFrontmatter(masterMdPath);
const ce = loadCoreExtract(coreExtractPath);
const realFacts = ce?.brief?.real_facts || {};
const brandSignals = ce?.brief?.brand_signals || {};
const aiExtensions = ce?.brief?.ai_extensions || {};
const narrative = ce?.brief?.narrative || {};

if (!frontmatter.business_name) {
  console.error(`[error] Could not parse YAML frontmatter from ${masterMdPath}`);
  process.exit(1);
}

// Build phone display
const phoneRaw = Array.isArray(realFacts.phone)
  ? realFacts.phone[0]
  : (realFacts.phone || null);
const phoneDisplay = phoneRaw ? String(phoneRaw).trim() : null;
const phoneTel = phoneDisplay ? phoneDisplay.replace(/\s+/g, '') : null;

// Build ABN display
const abn = realFacts.abn?.number || null;
const abnFormatted = abn
  ? abn.replace(/(\d{2})(\d{3})(\d{3})(\d{3})/, '$1 $2 $3 $4')
  : null;

const siteCtx = {
  slug,
  generated_at: new Date().toISOString(),

  // ── business facts ──────────────────────────────────────────────────────────
  business: {
    name: frontmatter.business_name || realFacts.business_name || slug,
    niche: frontmatter.niche || 'roofer',
    city: frontmatter.city || null,
    state: frontmatter.city ? deriveState(frontmatter.city, realFacts.address) : null,
    address: realFacts.address || null,
    phone_display: phoneDisplay,
    phone_tel: phoneTel,
    email: realFacts.email || null,
    website: frontmatter.website || null,
    abn: abnFormatted,
    license_authority: frontmatter.license?.authority || null,
    license_number: frontmatter.license?.licence_number || null,
    license_status: frontmatter.license?.status || null,
    rating: frontmatter.rating || null,
    review_count: frontmatter.review_count || 0,
    year_founded: realFacts.founded_year || (
      realFacts.abn?.effective_from
        ? new Date(realFacts.abn.effective_from).getFullYear()
        : null
    ),
    owner_name: realFacts.owner_name || null,
    deploy_url: frontmatter.deploy_url || null,
    deploy_stage: frontmatter.deploy_stage || null,
  },

  // ── brand ───────────────────────────────────────────────────────────────────
  brand: {
    logo_url: brandSignals.logo_url || null,
    primary_color: brandSignals.primary_color || null,
    accent_color: brandSignals.accent_color || null,
    font_family: brandSignals.font_family || null,
    voice_tone: brandSignals.voice_tone || [],
  },

  // ── content ─────────────────────────────────────────────────────────────────
  services: normaliseServices(realFacts.service_list),
  suburbs: normaliseSuburbs(
    realFacts.suburbs_served,
    aiExtensions.suggested_suburbs,
    frontmatter.city
  ),
  reviews: normaliseReviews(realFacts.testimonials),
  faqs_seed: normaliseFaqs(aiExtensions.suggested_faqs),

  // ── trust signals ────────────────────────────────────────────────────────────
  trust_signals: buildTrustSignals({ frontmatter, realFacts }),

  // ── narrative drafts (from core-extract ai work) ─────────────────────────────
  narrative_drafts: {
    hero_copy_options: narrative.hero_copy_options || aiExtensions.hero_copy_options || [],
    about_us_draft: narrative.about_us_draft || null,
    trust_signals_catalog: narrative.trust_signals_catalog || null,
  },

  // ── assets ───────────────────────────────────────────────────────────────────
  assets: {
    video_url: frontmatter.assets?.video_url || null,
    desktop_screenshot: frontmatter.assets?.desktop_screenshot || null,
    mobile_screenshot: frontmatter.assets?.mobile_screenshot || null,
  },

  // ── provenance ───────────────────────────────────────────────────────────────
  _sources: {
    business: 'master.md:yaml + core-extract.json:real_facts',
    services: 'core-extract.json:real_facts.service_list',
    suburbs: 'core-extract.json:real_facts.suburbs_served + ai_extensions.suggested_suburbs',
    reviews: 'core-extract.json:real_facts.testimonials',
    faqs_seed: 'core-extract.json:ai_extensions.suggested_faqs',
    trust_signals: 'derived:license+rating+abn',
    brand: 'core-extract.json:brand_signals',
  },
};

// ── helper: derive state from address or city ─────────────────────────────────

function deriveState(city, address) {
  if (!city && !address) return null;
  const src = `${city || ''} ${address || ''}`.toUpperCase();
  const stateMap = {
    VIC: ['BALLARAT', 'MELBOURNE', 'GEELONG', 'BENDIGO', 'VIC '],
    NSW: ['SYDNEY', 'NEWCASTLE', 'WOLLONGONG', 'NSW '],
    QLD: ['BRISBANE', 'CAIRNS', 'TOWNSVILLE', 'GOLD COAST', 'QLD '],
    WA: ['PERTH', 'BUNBURY', 'GERALDTON', 'WA '],
    SA: ['ADELAIDE', 'SA '],
    TAS: ['HOBART', 'LAUNCESTON', 'TAS '],
    NT: ['DARWIN', 'NT '],
    ACT: ['CANBERRA', 'ACT '],
  };
  for (const [state, keywords] of Object.entries(stateMap)) {
    if (keywords.some(k => src.includes(k))) return state;
  }
  return null;
}

// Fix: call deriveState with correct args (re-assign in business)
siteCtx.business.state = deriveState(frontmatter.city, realFacts.address);

// ── write output ──────────────────────────────────────────────────────────────

fs.mkdirSync(clientDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(siteCtx, null, 2));

console.log(`[ok] site-ctx.json written → ${path.relative(ROOT, outPath)}`);
console.log(`     business: ${siteCtx.business.name} · ${siteCtx.business.city}`);
console.log(`     services: ${siteCtx.services.length}`);
console.log(`     suburbs: ${siteCtx.suburbs.length} (${siteCtx.suburbs.filter(s=>s.source==='verified').length} verified)`);
console.log(`     reviews: ${siteCtx.reviews.length}`);
console.log(`     faqs_seed: ${siteCtx.faqs_seed.length}`);
console.log(`     trust_signals: ${siteCtx.trust_signals.length}`);
console.log(`     hero_copy_options: ${siteCtx.narrative_drafts.hero_copy_options.length}`);

// ── optionally write content files to handoff/od-package/content/ ─────────────

if (writeContent) {
  const contentDir = path.join(clientDir, 'handoff', 'od-package', 'content');
  fs.mkdirSync(contentDir, { recursive: true });

  // reviews.json — formats real reviews for the template composer
  // Format: {reviews: [{quote, author, location, stars, stars_aria, stars_unicode, source_label}]}
  if (siteCtx.reviews.length > 0) {
    const reviewsOut = {
      _source: 'site-ctx:real_facts.testimonials',
      _generated_at: siteCtx.generated_at,
      reviews: siteCtx.reviews.map(r => ({
        quote: r.quote,
        author: r.author,
        location: r.location || siteCtx.business.city,
        stars: r.stars || 5,
        stars_aria: `${r.stars || 5} out of 5 stars`,
        stars_unicode: '★ ★ ★ ★ ★',
        source_label: 'Google review',
      })),
    };
    const reviewsPath = path.join(contentDir, 'reviews.json');
    fs.writeFileSync(reviewsPath, JSON.stringify(reviewsOut, null, 2));
    console.log(`[ok] reviews.json written → ${siteCtx.reviews.length} real reviews`);
  } else {
    console.log(`[skip] reviews.json — no real reviews in site-ctx (will use formula fallback)`);
  }

  // coverage.json — suburb list for coverage section
  // Format: {suburbs: [string], by_arrangement_text: string, _source: string}
  const verifiedSuburbs = siteCtx.suburbs.filter(s => s.source === 'verified').map(s => s.suburb);
  const inferredSuburbs = siteCtx.suburbs.filter(s => s.source !== 'verified').map(s => s.suburb);

  // Use verified first, then inferred to fill to 18 max
  const allSuburbStrings = [...verifiedSuburbs, ...inferredSuburbs].slice(0, 18);

  if (allSuburbStrings.length > 0) {
    const coverageOut = {
      _source: 'site-ctx:real_facts.suburbs_served + ai_extensions.suggested_suburbs',
      _generated_at: siteCtx.generated_at,
      suburbs: allSuburbStrings,
      verified_count: verifiedSuburbs.length,
      by_arrangement_text: inferredSuburbs.length > 0
        ? `Coverage by arrangement across ${siteCtx.business.state || 'regional'} areas — call to confirm.`
        : null,
    };
    const coveragePath = path.join(contentDir, 'coverage.json');
    fs.writeFileSync(coveragePath, JSON.stringify(coverageOut, null, 2));
    console.log(`[ok] coverage.json written → ${allSuburbStrings.length} suburbs (${verifiedSuburbs.length} verified)`);
  } else {
    console.log(`[skip] coverage.json — no suburbs in site-ctx`);
  }
}
