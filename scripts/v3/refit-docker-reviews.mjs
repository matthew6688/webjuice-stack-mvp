#!/usr/bin/env node
// Bug 17 fix · refit reviews via gosom docker (extra_reviews:true) for entities
// currently stuck at Places API 5-review limit.
//
// Usage: node scripts/v3/refit-docker-reviews.mjs [--slug X | --all-stale]
//   --all-stale  · auto-pick entities whose fixture has <8 reviews + audit_score set
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchLeadReviewsLocal, gmapsContainerAvailable } from '../../core/reviews/fetch-reviews-local.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');
process.chdir(REPO);

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) { const k = a.slice(2); const next = arr[i + 1]; acc.push([k, next && !next.startsWith('--') ? next : true]); }
  return acc;
}, []));

if (!gmapsContainerAvailable()) {
  console.error('gosom docker container not running. Start it first.');
  process.exit(1);
}

let candidates = [];
if (args.slug) {
  const ek = readBusinessId(args.slug);
  if (ek) candidates.push(ek);
} else if (args['all-stale']) {
  candidates = pickStale();
}
if (!candidates.length) {
  console.error('No candidates. Pass --slug X or --all-stale.');
  process.exit(1);
}

console.log(`[refit] ${candidates.length} entities · target ≥ 8 reviews each`);

for (const entityKey of candidates) {
  const ePath = path.join(REPO, 'data/leads/entities', `${entityKey}.json`);
  if (!fs.existsSync(ePath)) { console.log(`  ✗ ${entityKey} · entity file missing`); continue; }
  const entity = JSON.parse(fs.readFileSync(ePath, 'utf8'));
  const name = entity.latest?.name || entityKey;
  console.log(`\n  · ${entityKey} (${name})`);

  const t0 = Date.now();
  let out;
  try {
    out = await fetchLeadReviewsLocal({
      entity,
      ledgerPath: path.join(REPO, 'data/finance/ledger.jsonl'),
    });
  } catch (err) {
    console.log(`    ✗ fetch threw: ${err.message}`);
    continue;
  }
  const tookS = Math.round((Date.now() - t0) / 1000);
  if (!out?.ok) {
    console.log(`    ✗ ${out?.reason} · ${tookS}s`);
    continue;
  }
  // Write fixture in same shape as existing reviews/<key>.json
  const fxPath = path.join(REPO, 'data/v2/fixtures/reviews', `${entityKey}.json`);
  const existing = fs.existsSync(fxPath) ? JSON.parse(fs.readFileSync(fxPath, 'utf8')) : {};
  const fixture = {
    ...existing,
    fetched: {
      source: out.source,
      placeId: out.placeId,
      title: out.title,
      rating: out.rating,
      review_count: out.review_count,
      rating_distribution: out.rating_distribution,
      reviews: out.reviews,
      images_count: out.images_count,
      fetched_at: out.fetched_at,
      latency_ms: out.latency_ms,
    },
  };
  fs.writeFileSync(fxPath, JSON.stringify(fixture, null, 2));
  console.log(`    ✓ ${out.reviews.length} reviews · source=${out.source} · ${tookS}s · ${fxPath}`);
}

function readBusinessId(slug) {
  const mdPath = path.join(REPO, 'clients', slug, 'v2/master.md');
  if (!fs.existsSync(mdPath)) return null;
  const m = fs.readFileSync(mdPath, 'utf8').match(/business_id:\s*"([^"]+)"/);
  return m?.[1] || null;
}

function pickStale() {
  const fxDir = path.join(REPO, 'data/v2/fixtures/reviews');
  if (!fs.existsSync(fxDir)) return [];
  const stale = [];
  for (const f of fs.readdirSync(fxDir)) {
    if (!f.endsWith('.json')) continue;
    const ek = f.replace(/\.json$/, '');
    try {
      const r = JSON.parse(fs.readFileSync(path.join(fxDir, f), 'utf8'));
      const count = r.fetched?.reviews?.length || 0;
      const source = r.fetched?.source || '';
      if (count < 8 && source !== 'gmaps_local_docker') stale.push(ek);
    } catch {}
  }
  return stale;
}
