#!/usr/bin/env node
/**
 * pl:places-enrich — enrich a V2 entity with Google Places API data.
 *
 * Triggered manually (or by SOP-2 grade ≥ B). Calls Places Details (Basic
 * SKU) for the entity's place_id, writes entity.latest.places_enrichment.
 *
 * Cost guard: PlacesQuotaGuard caps at 11,000 calls/month (free tier).
 * Beyond the cap → hard error, push alert to Discord, NO call made.
 *
 * Adds 3 audit dimensions Places gives that gosom doesn't:
 *   - types[] (multi-category, finer niche match)
 *   - international_phone (E.164 for outreach)
 *   - photo references (for visual audit + master.md asset lib · TODO G-13)
 *
 * Usage:
 *   npm run pl:places-enrich -- --entity-key place_chij... [--dry-run]
 *
 * SOP-1 G-7 · 2026-05-12.
 */

import fs from 'node:fs';
import path from 'node:path';
import { GooglePlacesExtractor } from '../../core/extractors/google-places.js';
import { PlacesQuotaGuard, PlacesQuotaCapExceeded } from '../../core/extractors/places-quota-guard.js';
import { pushAlert } from '../../core/ops/alert-pusher.js';
import { computeSalesContactTime } from '../../core/leads/sales-contact-time.js';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, tok, i, arr) => {
    if (tok.startsWith('--')) {
      const key = tok.slice(2);
      const next = arr[i + 1];
      acc.push([key, next && !next.startsWith('--') ? next : true]);
    }
    return acc;
  }, [])
);

const ENTITY_KEY = args['entity-key'] || args.k;
const DRY_RUN = !!args['dry-run'];

if (!ENTITY_KEY) {
  console.error('Usage: pl:places-enrich --entity-key place_<id> [--dry-run]');
  process.exit(2);
}

const ENTITY_PATH = path.resolve(process.cwd(), `data/leads/entities/${ENTITY_KEY}.json`);
if (!fs.existsSync(ENTITY_PATH)) {
  console.error(`Entity not found: ${ENTITY_PATH}`);
  process.exit(2);
}

const entity = JSON.parse(fs.readFileSync(ENTITY_PATH, 'utf8'));
const placeId = entity.identifiers?.place_id;
if (!placeId) {
  console.error(`Entity ${ENTITY_KEY} has no identifiers.place_id (image-lead or non-Google source) — Places enrichment skipped.`);
  process.exit(0);
}

const guard = new PlacesQuotaGuard();
const aggregateStatus = guard.status();
const totalUsed = aggregateStatus.total_used;
const totalLimit = aggregateStatus.total_limit;
console.log(`Places API quota: ${totalUsed}/${totalLimit} calls used in ${aggregateStatus.month} across ${aggregateStatus.keys.length} key(s) (${(aggregateStatus.total_pct * 100).toFixed(1)}%)`);

if (DRY_RUN) {
  console.log(JSON.stringify({
    ok: true,
    dry_run: true,
    entity_key: ENTITY_KEY,
    place_id: placeId,
    would_call: 'place_details_basic',
    quota: aggregateStatus,
  }, null, 2));
  process.exit(0);
}

// G-12: select first key with capacity remaining (multi-key rotation)
let selectedKey;
try {
  selectedKey = guard.selectAvailableKey();
} catch (err) {
  if (err instanceof PlacesQuotaCapExceeded) {
    console.error(`HARD CAP: ${err.message}`);
    await pushAlert({
      title: 'Google Places API · all keys capped',
      detail: `All ${aggregateStatus.keys.length} Places API key(s) capped for ${err.month}.\nEnrichment will fail until 1st of next month, OR add another GCP account + GOOGLE_PLACES_API_KEY_${aggregateStatus.keys.length + 1}.\n\nEntity requested: \`${ENTITY_KEY}\``,
      severity: 'error',
      source: 'pl:places-enrich',
      fields: [
        { name: 'keys', value: aggregateStatus.keys.length.toString(), inline: true },
        { name: 'total used', value: String(totalUsed), inline: true },
        { name: 'month', value: err.month, inline: true },
      ],
      url: 'https://profitslocal.com/admin/scoring/sop-x-tooling',
    });
    process.exit(1);
  }
  throw err;
}

console.log(`  Using key: ${selectedKey.keyId} (rotation auto-select)`);

let quotaAfter;
try {
  quotaAfter = await guard.checkAndCharge(1, { skuLabel: 'details_basic', keyId: selectedKey.keyId });
} catch (err) {
  console.error(`charge failed: ${err.message}`);
  process.exit(1);
}

const extractor = new GooglePlacesExtractor({ apiKey: selectedKey.apiKey });

try {
  const detail = await extractor.details({ placeId, niche: entity.latest?.niche, city: entity.latest?.city });

  // detail is normalized output from extractor.details() (see core/extractors/google-places.js
  // #normalizeDetailsResult): fields are `phone`, `review_count`, `hours` (weekday_text array),
  // `photo_references` (string array), `google_maps_url`. NOT raw API names.
  const enrichment = {
    fetched_at: new Date().toISOString(),
    sku: 'details_basic',
    types: detail.types || [],
    international_phone: detail.phone || '',
    google_canonical_url: detail.google_maps_url || '',
    rating_verified: detail.rating ?? null,
    user_ratings_total: detail.review_count ?? null,
    photo_references: (detail.photo_references || []).filter(Boolean),
    opening_hours_verified: detail.hours ? { weekday_text: detail.hours } : null,
    quota_at_call: quotaAfter,
  };

  entity.latest = entity.latest || {};
  // Merge enrichment into existing object instead of replacing — preserves
  // downstream fields like photo_urls / photos_downloaded_at written by
  // pl:download-places-photos (G-13). enrichment fields take precedence over
  // older same-name fields.
  entity.latest.places_enrichment = {
    ...(entity.latest.places_enrichment || {}),
    ...enrichment,
  };

  // G-14: compute sales-contact-time signal from opening_hours_verified
  const salesTime = computeSalesContactTime(entity);
  if (salesTime) {
    entity.latest.sales_signals = entity.latest.sales_signals || {};
    entity.latest.sales_signals.best_contact_time = salesTime;
  }
  entity.history = [
    ...(entity.history || []),
    {
      at: enrichment.fetched_at,
      event: 'places_enrichment_added',
      photo_count: enrichment.photo_references.length,
      types_count: enrichment.types.length,
    },
  ].slice(-100);
  entity.lastSeenAt = enrichment.fetched_at;

  fs.writeFileSync(ENTITY_PATH, JSON.stringify(entity, null, 2));

  console.log(JSON.stringify({
    ok: true,
    entity_key: ENTITY_KEY,
    place_id: placeId,
    photos: enrichment.photo_references.length,
    types: enrichment.types,
    international_phone: enrichment.international_phone,
    quota_after: quotaAfter,
  }, null, 2));
} catch (err) {
  console.error(`Places enrichment failed: ${err.message}`);
  await pushAlert({
    title: 'Places enrichment failed',
    detail: `Entity \`${ENTITY_KEY}\` enrichment failed: ${err.message}`,
    severity: 'warn',
    source: 'pl:places-enrich',
  });
  process.exit(1);
}
