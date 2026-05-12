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
const status0 = guard.status();
console.log(`Places API quota: ${status0.used}/${status0.limit} calls used in ${status0.month} (${(status0.pct * 100).toFixed(1)}%)`);

if (DRY_RUN) {
  console.log(JSON.stringify({
    ok: true,
    dry_run: true,
    entity_key: ENTITY_KEY,
    place_id: placeId,
    would_call: 'place_details_basic',
    quota: status0,
  }, null, 2));
  process.exit(0);
}

let quotaAfter;
try {
  quotaAfter = await guard.checkAndCharge(1, { skuLabel: 'details_basic' });
} catch (err) {
  if (err instanceof PlacesQuotaCapExceeded) {
    console.error(`HARD CAP: ${err.message}`);
    await pushAlert({
      title: 'Google Places API hard cap reached',
      detail: `Places API quota exhausted for ${err.month}: ${err.used}/${err.limit} calls.\nEnrichment requests will fail until 1st of next month, or until rotation (G-12 backlog) is built.\n\nEntity requested: \`${ENTITY_KEY}\``,
      severity: 'error',
      source: 'pl:places-enrich',
      fields: [
        { name: 'used', value: String(err.used), inline: true },
        { name: 'limit', value: String(err.limit), inline: true },
        { name: 'month', value: err.month, inline: true },
      ],
      url: 'https://profitslocal.com/admin/scoring/sop-x-tooling',
    });
    process.exit(1);
  }
  throw err;
}

const extractor = new GooglePlacesExtractor();

try {
  const detail = await extractor.details({ placeId, niche: entity.latest?.niche, city: entity.latest?.city });

  const enrichment = {
    fetched_at: new Date().toISOString(),
    sku: 'details_basic',
    types: detail.types || [],
    international_phone: detail.international_phone_number || detail.formatted_phone_number || '',
    google_canonical_url: detail.google_maps_url || detail.url || '',
    rating_verified: detail.rating ?? null,
    user_ratings_total: detail.user_ratings_total ?? null,
    photo_references: (detail.photos || []).map((p) => ({
      ref: p.photo_reference,
      width: p.width,
      height: p.height,
      attributions: p.html_attributions || [],
    })),
    opening_hours_verified: detail.opening_hours || null,
    quota_at_call: quotaAfter,
  };

  entity.latest = entity.latest || {};
  entity.latest.places_enrichment = enrichment;
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
