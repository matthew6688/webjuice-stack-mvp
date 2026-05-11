/**
 * Fetch Google reviews via local gosom/google-maps-scraper Docker container.
 *
 * Tier T0 (free, runs on Mac mini). Pulls FULL review history (up to all
 * reviews the place has — typically 50-300+) plus rating distribution
 * (counts per 1★/2★/3★/4★/5★) — way richer than Google Places API's 5.
 *
 * Latency: ~30-60s per place (vs Places API ~1s) — use for high-value
 * leads only. Falls back to Places API path via fetchLeadReviews if the
 * local container is unreachable.
 *
 * Container: gmaps-scraper-web (image: gosom/google-maps-scraper).
 * Started separately by the user; this just shells in via docker exec.
 */

import { execSync, spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { appendLedgerEvent, hashRequest } from '../finance/ledger.js';

const CONTAINER = process.env.GMAPS_SCRAPER_CONTAINER || 'gmaps-scraper-web';

export function gmapsContainerAvailable() {
  try {
    const r = spawnSync('docker', ['inspect', '--format', '{{.State.Running}}', CONTAINER], { encoding: 'utf8' });
    return r.status === 0 && r.stdout.trim() === 'true';
  } catch { return false; }
}

export async function fetchLeadReviewsLocal({
  entity,
  query,                      // override search query; default uses business name + city
  exitOnInactivity = '90s',
  ledgerPath,
  campaignId,
} = {}) {
  if (!gmapsContainerAvailable()) {
    return { ok: false, reason: `docker container "${CONTAINER}" not running`, reviews: [] };
  }
  const latest = entity?.latest || {};
  const searchQuery = query || `${latest.name} ${latest.city || latest.address || ''}`.trim();
  if (!searchQuery) {
    return { ok: false, reason: 'no business name to query', reviews: [] };
  }

  // Write query to a temp file inside the container, run scraper, copy result back.
  const stamp = Date.now();
  const inputFileC = `/tmp/q-${stamp}.txt`;
  const outFileC = `/tmp/out-${stamp}.json`;
  const start = Date.now();

  // 1. Write query
  spawnSync('docker', ['exec', CONTAINER, 'sh', '-c', `echo ${JSON.stringify(searchQuery)} > ${inputFileC}`]);

  // 2. Run scraper with -extra-reviews + -json
  const scrape = spawnSync('docker', [
    'exec', CONTAINER,
    '/usr/bin/google-maps-scraper',
    '-input', inputFileC,
    '-results', outFileC,
    '-extra-reviews',
    '-json',
    '-depth', '1',
    '-exit-on-inactivity', exitOnInactivity,
  ], { encoding: 'utf8', timeout: 240_000 });
  const scrapeMs = Date.now() - start;

  if (scrape.status !== 0) {
    return { ok: false, reason: `scraper exit ${scrape.status}: ${(scrape.stderr || '').slice(0, 200)}`, reviews: [] };
  }

  // 3. Copy result out
  const localOut = path.join(os.tmpdir(), `gmaps-${stamp}.json`);
  const cp = spawnSync('docker', ['cp', `${CONTAINER}:${outFileC}`, localOut], { encoding: 'utf8' });
  if (cp.status !== 0) {
    return { ok: false, reason: `docker cp failed: ${cp.stderr}`, reviews: [] };
  }

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(localOut, 'utf8'));
  } catch (err) {
    return { ok: false, reason: `parse failed: ${err.message}`, reviews: [] };
  }

  // Cleanup containers
  spawnSync('docker', ['exec', CONTAINER, 'rm', '-f', inputFileC, outFileC]);
  try { fs.unlinkSync(localOut); } catch {}

  const extended = raw.user_reviews_extended || raw.user_reviews || [];
  const reviews = extended.map((r) => ({
    author_name: r.Name || r.author_name,
    rating: r.Rating || r.rating,
    text: r.Description || r.description || r.text || '',
    relative_time: r.When || r.relative_time,
    images: r.Images || [],
    profile_photo_url: r.ProfilePicture || null,
  }));

  // Rating distribution per stars (e.g. {1:1, 2:0, 3:0, 4:1, 5:219})
  const ratingDistRaw = raw.reviews_per_rating || {};
  const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const [k, v] of Object.entries(ratingDistRaw)) {
    const n = Number(k);
    if (n >= 1 && n <= 5) ratingDistribution[n] = Number(v) || 0;
  }

  if (ledgerPath || entity?.entityKey) {
    const requestHash = await hashRequest({ provider: 'gmaps_local', endpoint: 'extra_reviews', query: searchQuery });
    appendLedgerEvent({
      type: 'cost',
      category: 'other',
      provider: 'gmaps_local_docker',
      tier: 'T0',
      leadId: entity?.entityKey,
      stage: 'review_mining',
      purpose: 'review_fetch_local',
      requestHash,
      campaignId,
      units: 1,
      unitCost: 0,
      amount: 0,
      currency: process.env.ROI_CURRENCY || 'USD',
      metadata: {
        endpoint: 'extra-reviews',
        query: searchQuery,
        review_count_returned: reviews.length,
        rating_distribution: ratingDistribution,
        title_returned: raw.title,
        place_id: raw.place_id,
        latency_ms: scrapeMs,
      },
    }, ledgerPath);
  }

  return {
    ok: true,
    source: 'gmaps_local_docker',
    placeId: raw.place_id || null,
    cid: raw.cid || null,
    title: raw.title || null,
    rating: raw.review_rating ?? latest.rating,
    review_count: raw.review_count ?? latest.review_count,
    rating_distribution: ratingDistribution,
    reviews,
    images_count: (raw.images || []).length,
    fetched_at: new Date().toISOString(),
    latency_ms: scrapeMs,
  };
}
