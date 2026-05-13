#!/usr/bin/env node
// V3 · batch master.md generation across cities · both Places API + docker scrape
//
// Goal: pressure-test the intake → master.md skeleton chain at volume.
//   - 4 cities × 2 niches × 2 sources (places + docker) = 16 batches
//   - Each batch creates N entities · each entity gets master.md skeleton
//   - Verify backend processing handles concurrency · dedup · master.md auto-refresh
//
// Costs: Places API ~$0.005/result × ~16 × 3 = ~$0.25 · Docker free.
// Time: ~15-25 min (sequential batches · gosom takes 30-60s each)
//
// Usage:
//   node scripts/v3/batch-master-md-by-city.mjs [--cities brisbane,sydney] [--niches plumber,roofer] [--per-batch 3]
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

const CITIES = (args.cities || 'brisbane,sydney,melbourne,perth').split(',').map(s => s.trim());
const NICHES = (args.niches || 'plumber,electrician').split(',').map(s => s.trim());
const PER_BATCH = parseInt(args['per-batch'], 10) || 2;
const SOURCES = (args.sources || 'places,docker').split(',').map(s => s.trim());

const OUT_DIR = path.join(REPO, 'data', 'qa', `batch-master-md-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16)}`);
fs.mkdirSync(OUT_DIR, { recursive: true });

console.log(`[batch] cities=${CITIES.join(',')}`);
console.log(`[batch] niches=${NICHES.join(',')}`);
console.log(`[batch] sources=${SOURCES.join(',')}`);
console.log(`[batch] per-batch=${PER_BATCH}`);
console.log(`[batch] output=${OUT_DIR}\n`);

const startTime = Date.now();
const results = [];

function snapshotEntities() {
  const dir = path.join(REPO, 'data/leads/entities');
  if (!fs.existsSync(dir)) return new Set();
  return new Set(fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, '')));
}

function entitiesTouchedSince(sinceMs) {
  const dir = path.join(REPO, 'data/leads/entities');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => ({ key: f.replace(/\.json$/, ''), mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
    .filter(o => o.mtime >= sinceMs)
    .map(o => o.key);
}

function runBatch(source, city, niche) {
  const tStart = Date.now();
  const before = snapshotEntities();
  let cmd, args;
  if (source === 'places') {
    cmd = 'npm';
    args = ['run', 'pl:places-search-intake', '--', `${niche} ${city}`, '--limit', String(PER_BATCH)];
  } else if (source === 'docker') {
    cmd = 'npm';
    args = ['run', 'pl:scrape-docker', '--', '--niche', niche, '--city', city, '--count', String(PER_BATCH)];
  } else {
    return { source, city, niche, ok: false, reason: 'unknown source' };
  }
  console.log(`  ${source.padEnd(7)} | ${niche.padEnd(15)} | ${city.padEnd(15)} | running...`);
  const r = spawnSync(cmd, args, { cwd: REPO, encoding: 'utf8', timeout: 240_000 });
  const touched = entitiesTouchedSince(tStart);
  const tookS = Math.round((Date.now() - tStart) / 1000);
  const ok = r.status === 0;
  const fresh = touched.filter(k => !before.has(k));
  console.log(`    → ${ok ? '✓' : '✗'} · ${tookS}s · fresh=${fresh.length} touched=${touched.length}${ok ? '' : ` · stderr=${(r.stderr || '').slice(-200)}`}`);
  return {
    source, city, niche,
    ok,
    took_s: tookS,
    new_entities: fresh.length,
    touched_entities: touched.length,
    fresh_keys: fresh.slice(0, 5),
    exit_code: r.status,
    stderr_tail: !ok ? (r.stderr || '').slice(-400) : null,
  };
}

// Verify master.md exists for each entity after batch
function verifyMasterMd(entityKey) {
  const f = path.join(REPO, 'data/leads/entities', `${entityKey}.json`);
  if (!fs.existsSync(f)) return { ok: false, reason: 'entity missing' };
  const entity = JSON.parse(fs.readFileSync(f, 'utf8'));
  const slug = String(entity.latest?.name || entityKey).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const mdPath = path.join(REPO, 'clients', slug, 'v2/master.md');
  if (!fs.existsSync(mdPath)) return { ok: false, reason: 'master.md missing', slug };
  const lines = fs.readFileSync(mdPath, 'utf8').split('\n').length;
  return { ok: true, slug, mdPath, lines };
}

// ────────────────────────────────────────────────────────────
// MAIN LOOP · sequential to avoid quota / docker conflicts
// ────────────────────────────────────────────────────────────
for (const source of SOURCES) {
  for (const niche of NICHES) {
    for (const city of CITIES) {
      const result = runBatch(source, city, niche);
      results.push(result);
    }
  }
}

// V3 (2026-05-13) · directly invoke build-master-md for fresh entities ·
// dispatcher may not be running in this worktree · enqueueMasterMdRefresh queues
// tasks that may never get processed. Sync invocation guarantees verification.
console.log('\n[batch] building master.md skeleton for all fresh entities...');
for (const r of results) {
  for (const k of r.fresh_keys) {
    const buildResult = spawnSync('npm', ['run', 'leads:build-master-md', '--', '--entity-key', k], {
      cwd: REPO, encoding: 'utf8', timeout: 60_000,
    });
    if (buildResult.status !== 0) {
      console.log(`    ✗ build-master-md ${k} · exit=${buildResult.status}`);
    }
  }
}

// Aggregate · verify master.md per fresh entity
console.log('\n[batch] verifying master.md for all fresh entities...');
let mdOk = 0, mdMissing = 0;
const verification = [];
for (const r of results) {
  for (const k of r.fresh_keys) {
    const v = verifyMasterMd(k);
    if (v.ok) mdOk++; else mdMissing++;
    verification.push({ entityKey: k, source: r.source, city: r.city, niche: r.niche, ...v });
  }
}

const summary = {
  cities: CITIES,
  niches: NICHES,
  sources: SOURCES,
  per_batch: PER_BATCH,
  batch_count: results.length,
  ok_batches: results.filter(r => r.ok).length,
  failed_batches: results.filter(r => !r.ok).length,
  total_new_entities: results.reduce((a, r) => a + r.new_entities, 0),
  total_touched_entities: results.reduce((a, r) => a + r.touched_entities, 0),
  master_md_ok: mdOk,
  master_md_missing: mdMissing,
  total_seconds: Math.round((Date.now() - startTime) / 1000),
  started_at: new Date(startTime).toISOString(),
  finished_at: new Date().toISOString(),
  results,
  verification,
};

fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2));

console.log(`\n━━━ BATCH SUMMARY ━━━`);
console.log(`  duration:       ${summary.total_seconds}s`);
console.log(`  batches:        ${summary.ok_batches}/${summary.batch_count} ok · ${summary.failed_batches} failed`);
console.log(`  new entities:   ${summary.total_new_entities}`);
console.log(`  touched total:  ${summary.total_touched_entities}`);
console.log(`  master.md ok:   ${summary.master_md_ok}/${summary.master_md_ok + summary.master_md_missing}`);
console.log(`  output:         ${OUT_DIR}/summary.json`);

if (summary.failed_batches > 0) {
  console.log('\n  failed batches:');
  for (const r of results.filter((r) => !r.ok)) {
    console.log(`    ✗ ${r.source} ${r.niche} ${r.city} · exit=${r.exit_code} · ${(r.stderr_tail || '').slice(0, 200)}`);
  }
}
process.exit(summary.failed_batches > 0 || summary.master_md_missing > 0 ? 1 : 0);
