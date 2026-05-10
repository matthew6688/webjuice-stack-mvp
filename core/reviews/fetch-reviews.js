/**
 * Fetch Google reviews for a lead via Google Places "Place Details" API.
 *
 * Tier T2 (paid). Returns up to 5 reviews curated by Google relevance —
 * enough for sales-pitch quotes + first-look sentiment. For deeper mining
 * (50+ reviews, full distribution) we'd swap to Apify/Outscraper later;
 * this is the cheap-enough baseline that uses a key already configured.
 *
 * place_id resolution: most entities don't store place_id directly, but
 * the maps URL contains it after `!19s`. Returns ok:false if it can't be
 * resolved — caller can decide whether to skip or escalate.
 */

import { appendLedgerEvent, hashRequest } from '../finance/ledger.js';

const PLACE_DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json';
const REVIEW_FIELDS = ['place_id', 'name', 'rating', 'user_ratings_total', 'reviews', 'url'].join(',');

export function placeIdFromMapsUrl(url) {
  if (!url) return null;
  const m = url.match(/!19s([^?!&]+)/);
  return m?.[1] || null;
}

export async function fetchLeadReviews({
  entity,
  apiKey = process.env.GOOGLE_PLACES_API_KEY,
  ledgerPath,
  campaignId,
  fetchImpl = globalThis.fetch,
} = {}) {
  const latest = entity?.latest || {};
  const placeId = placeIdFromMapsUrl(latest.google_maps_url);
  if (!placeId) {
    return { ok: false, reason: 'no place_id resolvable from google_maps_url', reviews: [] };
  }
  if (!apiKey) {
    return { ok: false, reason: 'GOOGLE_PLACES_API_KEY not set', reviews: [] };
  }

  const url = new URL(PLACE_DETAILS_URL);
  url.searchParams.set('place_id', placeId);
  url.searchParams.set('fields', REVIEW_FIELDS);
  url.searchParams.set('reviews_no_translations', 'true');
  url.searchParams.set('reviews_sort', 'most_relevant');
  url.searchParams.set('key', apiKey);

  const start = Date.now();
  let data;
  try {
    const res = await fetchImpl(url);
    data = await res.json();
  } catch (err) {
    return { ok: false, reason: `fetch failed: ${err.message}`, reviews: [] };
  }
  const latencyMs = Date.now() - start;

  if (data.status !== 'OK') {
    return { ok: false, reason: `Places Details ${data.status}: ${data.error_message || ''}`.trim(), reviews: [] };
  }

  const result = data.result || {};
  const reviews = (result.reviews || []).map((r) => ({
    author_name: r.author_name,
    rating: r.rating,
    text: r.text,
    relative_time: r.relative_time_description,
    timestamp: r.time,
    language: r.language,
    profile_photo_url: r.profile_photo_url,
    author_url: r.author_url,
  }));

  if (ledgerPath || entity?.entityKey) {
    const requestHash = await hashRequest({ provider: 'google_places', endpoint: 'details', placeId, fields: REVIEW_FIELDS });
    appendLedgerEvent({
      type: 'cost',
      category: 'google_places',
      provider: 'google_places',
      tier: 'T2',
      leadId: entity?.entityKey,
      stage: 'review_mining',
      purpose: 'review_fetch',
      requestHash,
      campaignId,
      units: 1,
      // Place Details with reviews field is in the "Contact Data" SKU at $0.017
      unitCost: 0.017,
      amount: 0.017,
      currency: process.env.ROI_CURRENCY || 'USD',
      metadata: {
        endpoint: 'details',
        place_id: placeId,
        review_count_returned: reviews.length,
        rating: result.rating,
        user_ratings_total: result.user_ratings_total,
        latency_ms: latencyMs,
      },
    }, ledgerPath);
  }

  return {
    ok: true,
    placeId,
    rating: result.rating ?? latest.rating,
    review_count: result.user_ratings_total ?? latest.review_count,
    reviews,
    fetched_at: new Date().toISOString(),
  };
}
