/**
 * core/leads/single-enrich-resolver.js · SOP-0 v1.3 Q5
 *
 * Given partial business signals (businessName / phone / city / GBP URL),
 * resolve to a single Google Places lead with place_id + full details,
 * then return a `lead` object ready for `upsertDiscoveryRun`.
 *
 * Strategy (cheap → expensive):
 *   1. GBP URL contains an explicit place_id (rare but cheap)
 *   2. Places `textSearch` with best query → top result place_id
 *   3. Places `details(place_id)` → full lead obj
 *   4. (future) Tinyfish search fallback when Places ZERO_RESULTS
 *
 * Returns:
 *   { ok: true, lead, place_id, candidates, cost_estimate }
 *   { ok: false, reason, candidates? }
 *
 * Cost: ~1× textSearch + 1× details = ~$0.017 (current Places pricing). Quota-guarded.
 *
 * Owner: SOP-0 §3.6 (single-enrich path).
 */

import { GooglePlacesExtractor } from '../extractors/google-places.js';
import { PlacesQuotaGuard, PlacesQuotaCapExceeded } from '../extractors/places-quota-guard.js';

/* ─── Signal normalization ────────────────────────────────────────── */

/**
 * Parse signals from CLI args or LLM extraction.
 * @param {object} input { businessName, phone, email, website, niche, city, gbpUrl }
 */
export function normalizeSignals(input = {}) {
  const s = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  return {
    businessName: s(input.businessName) || s(input.business_name) || s(input.name),
    phone:        s(input.phone),
    email:        s(input.email),
    website:      s(input.website),
    niche:        s(input.niche),
    city:         s(input.city),
    gbpUrl:       s(input.gbpUrl) || s(input.gbp_url) || s(input.url),
  };
}

/* ─── GBP URL → place_id extraction ───────────────────────────────── */

/**
 * Try to pull a place_id directly from a Google Maps URL.
 * Modern long URLs may contain `!1s0x...` (encoded) or `:0x...` cid hex.
 * Short links (goo.gl, maps.app.goo.gl) need a HEAD redirect — we do best-effort.
 *
 * Returns place_id or null.
 */
export async function extractPlaceIdFromUrl(url, { fetchImpl = globalThis.fetch } = {}) {
  if (!url) return null;
  // Direct place_id in query string (rare but cheapest)
  const m1 = url.match(/place_id=([A-Za-z0-9_-]{20,})/);
  if (m1) return m1[1];

  // Short link → follow once
  if (/goo\.gl\/maps|maps\.app\.goo\.gl/i.test(url)) {
    try {
      const r = await fetchImpl(url, { method: 'HEAD', redirect: 'follow' });
      const finalUrl = r.url;
      if (finalUrl && finalUrl !== url) return extractPlaceIdFromUrl(finalUrl, { fetchImpl });
    } catch { /* fall through */ }
  }
  // Couldn't pull place_id directly — caller should fall back to textSearch
  return null;
}

/* ─── Best search query from signals ──────────────────────────────── */

function buildSearchQuery(signals) {
  // V3 bug fix #3 (2026-05-13): never return city-only query. Bare city
  // ("Brisbane") matches the city geo entity, not a business. Require a
  // strong identifier first; city is only a disambiguator.
  const parts = [];
  if (signals.businessName) {
    parts.push(signals.businessName);
    if (signals.city) parts.push(signals.city);
  } else if (signals.phone) {
    parts.push(signals.phone);
    if (signals.city) parts.push(signals.city);
  } else if (signals.website) {
    parts.push(signals.website);
  }
  return parts.join(' ').trim();
}

/* ─── Main resolver ───────────────────────────────────────────────── */

export async function resolveBusinessFromSignals(signals, {
  guard = null,
  ledgerPath = null,
  onProgress = null,
} = {}) {
  const sigs = normalizeSignals(signals);
  const progress = (step, detail = '') => { if (onProgress) onProgress(step, detail); };

  const query = buildSearchQuery(sigs);
  if (!query && !sigs.gbpUrl) {
    return { ok: false, reason: 'no usable signal (need businessName, phone, website, OR gbpUrl)' };
  }

  // Try direct GBP URL → place_id
  let placeId = null;
  if (sigs.gbpUrl) {
    progress('gbp_url.resolve_start', sigs.gbpUrl);
    placeId = await extractPlaceIdFromUrl(sigs.gbpUrl).catch(() => null);
    if (placeId) progress('gbp_url.place_id', placeId);
  }

  // Quota-guarded Places search
  let quotaGuard;
  try {
    quotaGuard = guard || new PlacesQuotaGuard();
  } catch (err) {
    return { ok: false, reason: `places quota guard init failed: ${err.message}` };
  }

  let apiKey, keyId;
  try {
    ({ apiKey, keyId } = quotaGuard.selectAvailableKey());
  } catch (err) {
    if (err instanceof PlacesQuotaCapExceeded) {
      return { ok: false, reason: `places quota cap exceeded: ${err.keyIds?.join(',') || 'all keys'}` };
    }
    throw err;
  }

  const extractor = new GooglePlacesExtractor({ apiKey, ledgerPath, leadId: 'single-enrich-' + Date.now() });

  // Text search if we don't have place_id yet
  let candidates = [];
  if (!placeId) {
    progress('places.text_search', query);
    try {
      candidates = await extractor.searchText({ query, count: 5, niche: sigs.niche, city: sigs.city });
    } catch (err) {
      return { ok: false, reason: `places textSearch failed: ${err.message}` };
    }
    try { await quotaGuard.checkAndCharge(1, { skuLabel: 'text_search', keyId }); } catch {}
    if (!candidates || candidates.length === 0) {
      return { ok: false, reason: `places returned 0 results for "${query}"` };
    }
    // Take top result. If multiple, pick by closest name match if we have businessName.
    placeId = pickBest(candidates, sigs).place_id;
    progress('places.top_pick', placeId + ' from ' + candidates.length + ' candidates');
  }

  // Now fetch details
  progress('places.details_start', placeId);
  let detail;
  try {
    detail = await extractor.details({ placeId, niche: sigs.niche, city: sigs.city });
  } catch (err) {
    return { ok: false, reason: `places details failed: ${err.message}`, candidates };
  }
  try { await quotaGuard.checkAndCharge(1, { skuLabel: 'details_basic', keyId }); } catch {}
  progress('places.details_done', detail.name || placeId);

  // Build a lead obj suitable for upsertDiscoveryRun
  const lead = {
    place_id:        detail.place_id || placeId,
    sourceType:      'single_enrich',
    name:            detail.name || sigs.businessName,
    address:         detail.address || null,
    city:            sigs.city || detail.city || null,
    niche:           sigs.niche || detail.niche || null,
    phone:           detail.phone || sigs.phone || null,
    website:         detail.website || sigs.website || null,
    category:        detail.category || null,
    categories:      detail.categories || [],
    rating:          detail.rating ?? null,
    review_count:    detail.review_count ?? null,
    google_maps_url: detail.google_maps_url || null,
    sourceQuery:     query || sigs.gbpUrl || '',
    recommendedAction: 'audit_candidate',
    discoveryScore:  null,
  };

  return {
    ok: true,
    lead,
    place_id: placeId,
    candidates,
    cost_estimate: 0.017,
  };
}

function pickBest(candidates, signals) {
  if (candidates.length === 1) return candidates[0];
  // Prefer name substring match when businessName given
  if (signals.businessName) {
    const lc = signals.businessName.toLowerCase();
    const hit = candidates.find((c) => (c.name || '').toLowerCase().includes(lc.split(/\s+/)[0]));
    if (hit) return hit;
  }
  return candidates[0];
}
