/**
 * core/leads/discovery-score.js
 *
 * M1-D2 · Unified discovery-score function used by all 4 intake entry points:
 *   - pl:scrape-docker          (gosom)
 *   - pl:places-search-intake   (places_search)
 *   - pl:single-enrich          (single_enrich)
 *   - pl:ingest-image           (image_lead)
 *
 * Produces a consistent 0-100 score regardless of source, so the same business
 * arriving via different channels gets the same prioritization.
 *
 * Formula lifted from core/leads/maps-scraper-discovery.js#scoreDiscoveryLead
 * (the canonical V1 formula for AU local-business discovery) and made null-safe.
 */

import {
  WEBSITE_STATUS,
  classifyWebsiteStatus as classifyWebsiteStatusRaw,
  scoreDiscoveryLead,
} from './maps-scraper-discovery.js';

// Re-export for callers and tests (D2 contract requires it).
export function classifyWebsiteStatus(entity) {
  if (!entity || typeof entity !== 'object') return '';
  const raw = entity.websiteStatus ?? entity.latest?.websiteStatus ?? '';
  if (raw) return normalizeStatus(raw);
  const website = entity.website ?? entity.latest?.website ?? '';
  if (website) return classifyWebsiteStatusRaw(website);
  return ''; // unknown — caller should not apply website-derived bonus
}

// Accept multiple spellings ("https", "http", "NO_WEBSITE", canonical lowercase, etc.)
function normalizeStatus(value) {
  const s = String(value).trim();
  if (!s) return '';
  const upper = s.toUpperCase();
  if (upper === 'HTTPS' || upper === 'INDEPENDENT_HTTPS') return WEBSITE_STATUS.INDEPENDENT_HTTPS;
  if (upper === 'HTTP' || upper === 'INDEPENDENT_HTTP') return WEBSITE_STATUS.INDEPENDENT_HTTP;
  if (upper === 'NO_WEBSITE' || upper === 'NONE') return WEBSITE_STATUS.NO_WEBSITE;
  if (upper === 'SOCIAL' || upper === 'SOCIAL_OR_THIRD_PARTY' || upper === 'SOCIAL_OR_THIRD_PARTY_ONLY') {
    return WEBSITE_STATUS.SOCIAL_OR_THIRD_PARTY;
  }
  // already canonical (e.g. 'independent_https_site')
  return s;
}

/**
 * Compute a 0-100 discoveryScore for an entity-shaped object.
 * Accepts flat (gosom row) or entity (.latest, .signals) shapes.
 * Null-safe: empty input → 0, no crash.
 */
export function computeDiscoveryScore(entity) {
  if (!entity || typeof entity !== 'object') return 0;

  const latest = entity.latest || {};
  const signals = entity.signals || latest.signals || {};

  const websiteStatus = classifyWebsiteStatus(entity);
  const phone = entity.phone ?? latest.phone ?? '';
  const reviewCount = Number(entity.review_count ?? latest.review_count ?? 0);
  const rating = Number(entity.rating ?? latest.rating ?? 0);
  const imageCount = Number(
    entity.imageCount ??
    entity.image_count ??
    (Array.isArray(entity.images) ? entity.images.length : 0) ??
    0,
  );
  const hasMenuLink = Boolean(signals.hasMenuLink || entity.hasMenuLink);
  const hasReservationLink = Boolean(signals.hasReservationLink || entity.hasReservationLink);
  const hasOrderOnlineLink = Boolean(signals.hasOrderOnlineLink || entity.hasOrderOnlineLink);

  // Null-safe: scoreDiscoveryLead handles missing fields, but we must not pass
  // an "unknown" websiteStatus that would accidentally trigger the NO_WEBSITE
  // bonus. Pass '' so none of the websiteStatus branches match.
  const safeStatus = websiteStatus || '';

  const score = scoreDiscoveryLead({
    websiteStatus: safeStatus,
    phone,
    reviewCount,
    rating,
    imageCount,
    hasMenuLink,
    hasReservationLink,
    hasOrderOnlineLink,
  });

  return Number.isFinite(score) ? score : 0;
}

export { WEBSITE_STATUS };
