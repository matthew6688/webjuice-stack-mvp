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
const CONFIG_PATH = path.join(__dirname, 'cheap-audit-config.json');

let _config = null;
export function loadCheapAuditConfig() {
  if (_config) return _config;
  _config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  return _config;
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
        const cat = String(latest.category || '').toLowerCase();
        const niche = String(latest.niche || '').toLowerCase();
        const query = String(sourceQuery || latest.sourceQuery || '').toLowerCase();
        const relevant = checkRelevance(cat, niche, query);
        earned = relevant ? rule.max : 0;
        hit = relevant;
        rationale = relevant ? `category "${cat}" matches niche/query` : `category "${cat}" did not match niche "${niche}"`;
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

/** Naive niche-token overlap relevance check (matches V1 spirit). */
function checkRelevance(cat, niche, query) {
  if (!cat) return false;
  const tokens = `${niche} ${query}`.toLowerCase().split(/\W+/).filter(Boolean);
  const expanders = {
    roof: ['roof', 'gutter', 'tile', 'metal'],
    roofing: ['roof', 'gutter', 'tile', 'metal'],
    restaurant: ['restaurant', 'cafe', 'bar', 'pizza', 'food', 'dining', 'bakery', 'noodle'],
    cafe: ['cafe', 'coffee', 'restaurant'],
    dental: ['dental', 'dentist', 'clinic'],
    dentist: ['dental', 'dentist', 'clinic'],
    plumber: ['plumb'],
    plumbing: ['plumb'],
    electrician: ['electric'],
  };
  const expanded = new Set(tokens);
  for (const t of tokens) {
    for (const ex of (expanders[t] || [])) expanded.add(ex);
  }
  for (const t of expanded) {
    if (t.length < 3) continue;
    if (cat.includes(t)) return true;
  }
  return false;
}

/**
 * Apply hard triggers AND threshold-based decision.
 * Returns { action, reason, fired_triggers, threshold_used }.
 */
export function decideAction({ final_score, gbp_quality, redesign_need, entity }) {
  const config = loadCheapAuditConfig();
  const latest = entity.latest || {};
  const ws = latest.websiteStatus || '';
  const has_website_ish = /independent_/.test(ws) || ws === 'social_or_third_party_only';
  const reachable = Boolean(latest.phone || latest.email);
  const fired = [];

  // ─── No-website starter path (bypass redesign_need scoring) ───
  if (ws === 'no_website') {
    if (reachable && gbp_quality >= 30) {
      fired.push('no_website_with_contact');
      return {
        action: 'starter_candidate',
        reason: 'no_website + reachable + gbp_quality ≥ 30 — easiest V2 win',
        fired_triggers: fired, threshold_used: null,
      };
    }
    if (!reachable) {
      return {
        action: 'queued_for_enrichment',
        reason: 'no_website + no contact — try Stage 0.5 search enrichment first',
        fired_triggers: [], threshold_used: null,
      };
    }
    return {
      action: 'manual_review',
      reason: 'no_website + reachable but gbp_quality < 30 — operator decides',
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

  const decision = decideAction({ final_score, gbp_quality, redesign_need, entity });

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
