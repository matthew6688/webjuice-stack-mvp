/**
 * Cheap Audit V2 — Stage 1 GBP triage + Stage 2 site quick scan + final scoring.
 *
 * Reads cheap-audit-config.json for all rules / thresholds / hard-triggers, so
 * the algorithm definition is in data not code. /admin/scoring renders the
 * same JSON for operator visibility.
 *
 * Called per Maps-scrape entity:
 *   const audit = await cheapAuditV2({ entity, fetchPayload? });
 *   audit.final_score, audit.action, audit.gbp_quality, audit.redesign_need,
 *   audit.rule_breakdown, audit.hard_triggers_fired
 *
 * If fetchPayload is omitted AND entity has a website, the caller is expected
 * to fetch via Tinyfish first and pass it in. cheapAuditV2 itself does NOT call
 * the network — keeps it pure and unit-testable.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { siteQuickScan } from './site-quick-scan.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH_CANDIDATES = [
  path.join(__dirname, 'cheap-audit-config.json'),                 // dev / source layout
  path.join(process.cwd(), 'core/scoring/cheap-audit-config.json'), // built output (cwd = repo root)
];

let _config = null;
export function loadCheapAuditConfig() {
  if (_config) return _config;
  for (const p of CONFIG_PATH_CANDIDATES) {
    if (fs.existsSync(p)) {
      _config = JSON.parse(fs.readFileSync(p, 'utf8'));
      return _config;
    }
  }
  throw new Error(`cheap-audit-config.json not found in any of: ${CONFIG_PATH_CANDIDATES.join(', ')}`);
}

/**
 * Reload config from disk (for tests after editing config).
 */
export function reloadConfig() {
  _config = null;
  return loadCheapAuditConfig();
}

/**
 * Stage 1 GBP triage. Pure function — reads only entity payload.
 * Returns { gbp_quality 0-100, rule_breakdown, relevance_pass }.
 */
export function gbpTriage(entity, { sourceQuery = '' } = {}) {
  const config = loadCheapAuditConfig();
  const rules = config.stages.stage_1_gbp_triage.rules;
  const latest = entity.latest || {};
  const signals = latest.signals || {};

  const out = [];
  const earnMap = new Map();

  for (const rule of rules) {
    let earned = 0;
    let hit = false;
    let rationale = '';

    switch (rule.id) {
      case 'has_phone': {
        const has = Boolean(latest.phone || entity.identifiers?.phoneDigits);
        earned = has ? rule.max : 0;
        hit = has;
        rationale = has ? `phone: ${latest.phone}` : 'no phone';
        break;
      }
      case 'rating_high': {
        const rating = Number(latest.rating || 0);
        if (rating >= 4.7) { earned = 15; hit = true; rationale = `★${rating} ≥ 4.7`; }
        else if (rating >= 4.3) { earned = 10; hit = true; rationale = `★${rating} ≥ 4.3`; }
        else if (rating >= 3.5) { earned = 5; hit = true; rationale = `★${rating} ≥ 3.5`; }
        else { earned = 0; rationale = rating ? `★${rating} < 3.5` : 'no rating'; }
        break;
      }
      case 'review_volume': {
        const rc = Number(latest.review_count || 0);
        if (rc >= 100) { earned = 25; hit = true; rationale = `${rc} reviews ≥ 100`; }
        else if (rc >= 50) { earned = 18; hit = true; rationale = `${rc} reviews ≥ 50`; }
        else if (rc >= 20) { earned = 12; hit = true; rationale = `${rc} reviews ≥ 20`; }
        else if (rc >= 5) { earned = 6; rationale = `${rc} reviews ≥ 5`; }
        else { earned = 2; rationale = `${rc} reviews < 5`; }
        break;
      }
      case 'has_website': {
        const ws = latest.websiteStatus || '';
        if (/independent_(http|https)_site/.test(ws)) { earned = 5; hit = true; rationale = ws; }
        else if (ws === 'social_or_third_party_only') { earned = 2; hit = true; rationale = ws; }
        else { earned = 0; rationale = ws || 'no_website'; }
        break;
      }
      case 'image_count': {
        const ic = Number(signals.imageCount || 0);
        if (ic >= 10) { earned = 10; hit = true; rationale = `${ic} images`; }
        else if (ic >= 5) { earned = 6; hit = true; rationale = `${ic} images`; }
        else if (ic >= 1) { earned = 3; rationale = `${ic} images`; }
        else { earned = 0; rationale = '0 images'; }
        break;
      }
      case 'has_popular_times':
        earned = signals.hasPopularTimes ? rule.max : 0;
        hit = Boolean(signals.hasPopularTimes);
        rationale = hit ? 'popular times available' : 'no popular times';
        break;
      case 'has_about_attributes':
        earned = signals.hasAboutAttributes ? rule.max : 0;
        hit = Boolean(signals.hasAboutAttributes);
        rationale = hit ? 'about attributes present' : 'no about attributes';
        break;
      case 'address_complete':
        earned = (latest.address && latest.address.trim().length > 5) ? rule.max : 0;
        hit = earned > 0;
        rationale = hit ? `address: ${latest.address}` : 'address missing or too short';
        break;
      case 'category_relevant': {
        const niche = String(latest.niche || '').toLowerCase();
        const query = String(sourceQuery || latest.sourceQuery || '').toLowerCase();
        // Look at primary category, all secondary categories, AND the
        // business name. Roof Space Renovators has primary
        // "Home improvement store" but name contains "Roof" — clearly
        // a roofer; should not be excluded by primary-only check.
        const haystack = [
          latest.category || '',
          ...(latest.categories || []),
          latest.name || '',
        ].join(' ').toLowerCase();
        const relevant = checkRelevance(haystack, niche, query);
        earned = relevant ? rule.max : 0;
        hit = relevant;
        rationale = relevant ? `relevance match in cat/categories/name` : `cat="${latest.category}" + categories/name had no niche overlap`;
        break;
      }
      default:
        rationale = `unknown rule: ${rule.id}`;
    }

    earnMap.set(rule.id, earned);
    out.push({ id: rule.id, max: rule.max, earned, hit, rationale });
  }

  const earnedTotal = out.reduce((a, r) => a + r.earned, 0);
  const maxTotal = out.reduce((a, r) => a + r.max, 0);
  const gbp_quality = maxTotal === 0 ? 0 : Math.round((earnedTotal / maxTotal) * 100);
  const relevance_pass = earnMap.get('category_relevant') > 0;

  return { gbp_quality, earned_total: earnedTotal, max_total: maxTotal, rules: out, relevance_pass };
}

/**
 * Niche-token overlap relevance check.
 *
 * Only uses niche + niche-expanders — NOT the source query, because the
 * query contains city/geo tokens ("brisbane", "new farm") that match
 * any local business including off-niche ones (Hurricane Digital — SEO
 * agency in Brisbane — was passing because "brisbane" matched).
 */
// V3 D43 cycle-9 (Matthew 2026-05-14): niche normalization · 单复数/-er/-ing 都同义
// Bug: niche="roofer" 不匹配 "Roofing contractor" 因为 expander 只有 roof/roofing。
// Fix: 把 niche 先归一到 base form · 再 lookup expanders · 同时 expanders 用 stem
// substring 而不是精确 token includes。
const NICHE_ALIASES = {
  // roofing family
  roof: 'roofing', roofs: 'roofing', roofer: 'roofing', roofers: 'roofing', roofing: 'roofing',
  // plumbing family
  plumb: 'plumbing', plumber: 'plumbing', plumbers: 'plumbing', plumbing: 'plumbing',
  // electrical family
  electrician: 'electrical', electricians: 'electrical', electrical: 'electrical', electric: 'electrical',
  // food/restaurant
  restaurant: 'restaurant', restaurants: 'restaurant', cafe: 'cafe', cafes: 'cafe', coffee: 'cafe',
  food: 'restaurant', dining: 'restaurant',
  // dental
  dental: 'dental', dentist: 'dental', dentists: 'dental',
  // hair / beauty
  hair: 'hair', hairdresser: 'hair', hairdressers: 'hair', salon: 'hair', salons: 'hair', barber: 'hair', barbers: 'hair',
  beauty: 'beauty', spa: 'beauty', spas: 'beauty',
  // auto
  auto: 'auto', mechanic: 'auto', mechanics: 'auto', panelbeater: 'auto', panelbeaters: 'auto', smash: 'auto',
  // painting
  painter: 'painting', painters: 'painting', painting: 'painting', paint: 'painting',
  // hvac
  hvac: 'hvac', heating: 'hvac', cooling: 'hvac', aircon: 'hvac',
  // solar
  solar: 'solar',
  // pet/vet
  vet: 'pet', vets: 'pet', veterinary: 'pet', pet: 'pet',
  // landscape / garden
  landscape: 'landscape', landscaping: 'landscape', garden: 'landscape', gardener: 'landscape', gardeners: 'landscape',
  // cleaning
  cleaning: 'cleaning', cleaner: 'cleaning', cleaners: 'cleaning',
};

// Expanders use SUBSTRING (stem) match · "roof" matches "roofing/roofer/roofed"
const NICHE_EXPANDERS = {
  roofing: ['roof', 'gutter', 'tile', 'metal roof', 'skylight', 'restorat', 'colorbond', 'ridge cap'],
  plumbing: ['plumb', 'drain', 'pipe', 'hot water'],
  electrical: ['electric', 'sparky', 'wiring'],
  restaurant: ['restaurant', 'cafe', 'bar', 'pizza', 'food', 'dining', 'bakery', 'noodle', 'eatery'],
  cafe: ['cafe', 'coffee', 'espresso'],
  dental: ['dental', 'dentist', 'orthodont', 'endodont', 'oral surg'],
  hair: ['hair', 'salon', 'barber', 'stylist'],
  beauty: ['beauty', 'spa', 'wellness', 'cosmetic'],
  auto: ['auto', 'mechanic', 'panelbeat', 'smash repair', 'car repair', 'tyre', 'mufflers'],
  painting: ['painter', 'painting'],
  hvac: ['hvac', 'heating', 'cooling', 'aircon', 'air condition'],
  solar: ['solar', 'photovoltaic'],
  pet: ['vet', 'veterinary', 'animal hospital', 'pet'],
  landscape: ['landscap', 'garden', 'lawn', 'mowing', 'arborist', 'tree care'],
  cleaning: ['clean'],
};

function checkRelevance(haystack, niche, _query) {
  if (!haystack) return false;
  const lower = String(niche || '').toLowerCase().trim();
  if (!lower) return true; // no niche specified · let through

  // 1. Tokenize niche · normalize each token to canonical base via NICHE_ALIASES
  const nicheTok = lower.split(/\W+/).filter(Boolean);
  const canonical = new Set();
  for (const t of nicheTok) {
    canonical.add(NICHE_ALIASES[t] || t);
  }

  // 2. Expand each canonical base to its stems
  const stems = new Set();
  for (const c of canonical) {
    stems.add(c);
    for (const s of (NICHE_EXPANDERS[c] || [])) stems.add(s);
  }

  // 3. Substring (stem) match against haystack — "roof" hits "roofing/roofer/roofed/re-roof"
  for (const s of stems) {
    if (s.length < 3) continue;
    if (haystack.includes(s)) return true;
  }
  return false;
}

/**
 * Known third-party landing-page hosts. Businesses on these "websites"
 * don't actually have a site we can audit — the page is a billing app
 * profile, social directory, or no-code template host. Treated as
 * effectively no_website for decision purposes (and a strong sales
 * angle: "you don't have a real website").
 */
const THIRD_PARTY_HOSTS = [
  'billdu.me',
  'sites.google.com',
  'business.site',           // Google Business Profile websites
  'wix.com', 'wixsite.com',
  'squarespace.com',
  'godaddysites.com',
  'mywebsiteforfree.com',
  'webnode.com',
  'tilda.cc',
  'carrd.co',
  'linktr.ee', 'linktree.com',
  'strikingly.com',
  'webs.com',
  'simplesite.com',
  'jimdofree.com', 'jimdo.com',
];

export function detectThirdPartyHost(url) {
  if (!url) return null;
  let host;
  try { host = new URL(url).hostname.toLowerCase().replace(/^www\./, ''); }
  catch { return null; }
  for (const tp of THIRD_PARTY_HOSTS) {
    if (host === tp || host.endsWith('.' + tp)) return tp;
  }
  return null;
}

/**
 * Apply hard triggers AND threshold-based decision.
 * Returns { action, reason, fired_triggers, threshold_used }.
 */
export function decideAction({ final_score, gbp_quality, redesign_need, entity, relevance_pass = true }) {
  const config = loadCheapAuditConfig();
  const latest = entity.latest || {};
  const ws = latest.websiteStatus || '';
  const has_website_ish = /independent_/.test(ws) || ws === 'social_or_third_party_only';
  const reachable = Boolean(latest.phone || latest.email);
  const fired = [];

  // ─── Niche mismatch hard exclusion ───
  // If the GBP category doesn't match the searched niche, the lead was
  // discovered by mistake (e.g. SEO agency surfaced for "roofing"). Skip
  // outright regardless of rating/review volume — auditing the wrong
  // industry burns time + Places API budget for zero conversion chance.
  if (!relevance_pass) {
    fired.push('niche_mismatch');
    return {
      action: 'skip',
      reason: `category "${latest.category || '?'}" does not match niche "${latest.niche || '?'}" — wrong industry`,
      fired_triggers: fired, threshold_used: null,
    };
  }

  // ─── Third-party landing-page detection ───
  // billdu.me, sites.google.com, etc — they don't have a real website,
  // they have a billing/directory profile. Treat as no_website with a
  // stronger pitch ("we'd give you an actual site").
  // V3 D43 (Matthew 2026-05-14): manual_review + starter_candidate 合并 ·
  // 都给他建站 · 不同的只是 priority (gbp_quality 决定排序)。
  const thirdParty = detectThirdPartyHost(latest.website);
  if (thirdParty) {
    fired.push('third_party_landing_page');
    if (reachable) {
      return {
        action: 'starter_candidate',
        priority: gbp_quality, // gbp_quality 直接做 priority · 越高越先建
        reason: `"website" is on ${thirdParty} — not a real site; reachable · gbp_quality ${gbp_quality} → 给建站 (priority ${gbp_quality})`,
        fired_triggers: fired, threshold_used: null,
      };
    }
    // 没 phone/email · 必须先 enrichment
    return {
      action: 'queued_for_enrichment',
      reason: `"website" is on ${thirdParty} · 没 phone/email · 先补联系方式再建站`,
      fired_triggers: fired, threshold_used: null,
    };
  }

  // ─── No-website starter path ───
  // V3 D43: reachable 一律 starter_candidate · 不分 gbp≥30 / <30
  // 优先级用 gbp_quality 排 · 销售看 priority desc
  if (ws === 'no_website') {
    if (reachable) {
      fired.push('no_website_with_contact');
      return {
        action: 'starter_candidate',
        priority: gbp_quality,
        reason: `no_website + reachable (phone/email) · 给建站 (priority ${gbp_quality})`,
        fired_triggers: fired, threshold_used: null,
      };
    }
    // 没联系方式 · 必须 enrichment 补
    return {
      action: 'queued_for_enrichment',
      reason: 'no_website + no contact · 先补 phone/email 再决定 (enrichment 自动跑)',
      fired_triggers: [], threshold_used: null,
    };
  }

  // ─── Hard triggers for has-website leads ───
  if (ws === 'independent_http_site' && (latest.review_count || 0) >= 50) {
    fired.push('missing_https_with_evidence');
    return {
      action: 'audit_candidate',
      reason: 'HTTP-only with proven traction (≥50 reviews) = obvious redesign win',
      fired_triggers: fired, threshold_used: null,
    };
  }

  let high_traction_floor = false;
  if ((latest.review_count || 0) >= 100 && (latest.rating || 0) >= 4.5) {
    fired.push('high_traction_old_site');
    high_traction_floor = true;
  }

  // ─── Threshold-based decision ───
  for (const t of config.thresholds) {
    if (final_score >= t.min) {
      let action = t.action;
      // Hard-trigger floor: never go below audit_candidate if high traction
      if (high_traction_floor && (action === 'skip' || action === 'manual_review')) {
        action = 'audit_candidate';
      }
      return {
        action,
        reason: t.label + (high_traction_floor && action === 'audit_candidate' && t.action !== 'audit_candidate' ? ' (lifted by high_traction_old_site trigger)' : ''),
        fired_triggers: fired,
        threshold_used: t,
      };
    }
  }
  return { action: 'skip', reason: 'below all thresholds', fired_triggers: fired, threshold_used: null };
}

/**
 * Full V2 cheap audit — runs Stage 1 + (optional) Stage 2 + final scoring + decision.
 *
 * @param {object} input
 * @param {object} input.entity — discovery store entity { identifiers, latest, signals, ... }
 * @param {object?} input.fetchPayload — { url, markdown, rawHtml? } if has_website
 * @param {string?} input.sourceQuery
 * @returns {object} full audit
 */
export function cheapAuditV2({ entity, fetchPayload, sourceQuery = '' } = {}) {
  if (!entity) throw new Error('entity is required');
  const stage1 = gbpTriage(entity, { sourceQuery });

  const latest = entity.latest || {};
  const ws = latest.websiteStatus || '';
  const has_website = /independent_/.test(ws);

  let stage2 = null;
  if (has_website && fetchPayload && fetchPayload.markdown) {
    stage2 = siteQuickScan({
      url: fetchPayload.url || latest.website,
      markdown: fetchPayload.markdown,
      rawHtml: fetchPayload.rawHtml,
      businessCity: latest.city || '',
      businessSuburb: extractSuburb(latest.address),
      phoneDigits: entity.identifiers?.phoneDigits || (latest.phone || '').replace(/\D+/g, ''),
    });
  }

  const config = loadCheapAuditConfig();
  const gbp_quality = stage1.gbp_quality;
  const redesign_need = stage2?.redesign_need ?? null;

  // Final score
  let final_score;
  if (redesign_need !== null) {
    final_score = Math.round(gbp_quality * config.scoring.dimensions.gbp_quality.weight + redesign_need * config.scoring.dimensions.redesign_need.weight);
  } else {
    // No website scan — final score is gbp_quality alone (different decision path)
    final_score = gbp_quality;
  }

  const decision = decideAction({ final_score, gbp_quality, redesign_need, entity, relevance_pass: stage1.relevance_pass });

  return {
    config_version: config.version,
    final_score,
    gbp_quality,
    redesign_need,
    action: decision.action,
    reason: decision.reason,
    fired_triggers: decision.fired_triggers,
    threshold_used: decision.threshold_used,
    stage_1: stage1,
    stage_2: stage2,
    relevance_pass: stage1.relevance_pass,
    has_website,
    timestamp: new Date().toISOString(),
  };
}

function extractSuburb(address) {
  if (!address) return '';
  // "5/84 Merthyr Rd, New Farm QLD 4005" → "New Farm"
  const m = address.match(/,\s*([A-Z][A-Za-z\s]+?)\s+[A-Z]{2,3}\s+\d{4}/);
  return m ? m[1].trim() : '';
}
