#!/usr/bin/env node
// Bug 18 fix · run pl:places-enrich + pl:download-places-photos for any
// entity whose latest.places_enrichment.photo_references is empty.
//
// This populates clients/<slug>/v2/concept-photos/ (via Cloudinary if configured)
// AND data/v2/fixtures/places-photos/<entityKey>/photo-NN.jpg locally.
//
// Cost: places-details ~$0.005 + places-photos $0.007/photo · ~$0.05 per entity for 6 photos.
//
// Usage: node scripts/v3/enrich-photos-for-all.mjs [--limit 6]
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');
process.chdir(REPO);

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) { const k = a.slice(2); const next = arr[i + 1]; acc.push([k, next && !next.startsWith('--') ? next : true]); }
  return acc;
}, []));

const LIMIT = parseInt(args.limit, 10) || 6;
const entitiesDir = path.join(REPO, 'data/leads/entities');

// Candidates: place_* entities with no photos yet
const candidates = [];
for (const f of fs.readdirSync(entitiesDir)) {
  if (!f.startsWith('place_')) continue;
  if (!f.endsWith('.json')) continue;
  const ek = f.replace(/\.json$/, '');
  const e = JSON.parse(fs.readFileSync(path.join(entitiesDir, f), 'utf8'));
  const refs = e.latest?.places_enrichment?.photo_references || [];
  if (refs.length > 0) continue; // already enriched
  // Only do entities we have master.md for (real customers, not E2E junk)
  const slug = String(e.latest?.name || ek).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!fs.existsSync(path.join(REPO, 'clients', slug, 'v2/master.md'))) continue;
  candidates.push({ ek, slug, name: e.latest?.name });
}

console.log(`[enrich-photos] ${candidates.length} candidate entities (no photo_references yet)`);
for (const c of candidates) console.log(`  · ${c.ek} (${c.name})`);

const summary = { enriched: [], downloaded: [], failed: [] };
for (const { ek, name } of candidates) {
  console.log(`\n=== ${ek} (${name}) ===`);

  // Stage 1: places-enrich
  console.log('  [1/2] pl:places-enrich');
  const enrich = spawnSync('npm', ['run', 'pl:places-enrich', '--', '--entity-key', ek], {
    cwd: REPO, encoding: 'utf8', timeout: 60_000,
  });
  if (enrich.status !== 0) {
    console.log(`    ✗ enrich exit ${enrich.status}: ${(enrich.stderr || '').slice(-200)}`);
    summary.failed.push({ ek, stage: 'enrich' });
    continue;
  }
  summary.enriched.push(ek);

  // Re-read entity to check photo_references after enrich
  const e = JSON.parse(fs.readFileSync(path.join(entitiesDir, `${ek}.json`), 'utf8'));
  const refs = e.latest?.places_enrichment?.photo_references || [];
  if (refs.length === 0) {
    console.log(`    ⚠ enrich done but no photo_references returned by Places API`);
    continue;
  }
  console.log(`    ✓ photo_references=${refs.length}`);

  // Stage 2: download-places-photos
  console.log('  [2/2] pl:download-places-photos');
  const dl = spawnSync('npm', ['run', 'pl:download-places-photos', '--', '--entity-key', ek, '--limit', String(LIMIT)], {
    cwd: REPO, encoding: 'utf8', timeout: 120_000,
  });
  if (dl.status !== 0) {
    console.log(`    ✗ download exit ${dl.status}: ${(dl.stderr || '').slice(-200)}`);
    summary.failed.push({ ek, stage: 'download' });
    continue;
  }
  const dir = path.join(REPO, 'data/v2/fixtures/places-photos', ek);
  const count = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.jpg')).length : 0;
  console.log(`    ✓ ${count} photos downloaded`);
  summary.downloaded.push({ ek, count });
}

console.log('\n=== SUMMARY ===');
console.log(`  enriched: ${summary.enriched.length}`);
console.log(`  downloaded: ${summary.downloaded.length}`);
console.log(`  failed: ${summary.failed.length}`);
fs.writeFileSync(path.join(REPO, 'data/qa/enrich-photos-summary.json'), JSON.stringify(summary, null, 2));
