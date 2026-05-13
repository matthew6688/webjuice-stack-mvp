#!/usr/bin/env node
/**
 * pl:migrate-to-projects-channel · V3 D34 6-channel architecture migration
 *
 * 一次性迁 11 真客户 entity (现 #website-leads · 多数无 thread) → #website-projects:
 *   1. Archive 4 个现有 #website-leads thread (swap-archive + lock)
 *   2. Dedup-merge Queensland Roofing 2 entity → 1 (via pl:dedup-merge)
 *   3. Set Roof Space Renovators (D-grade) phase=archived (不开 projects thread)
 *   4. Hurricane Digital (已 archived) · skip
 *   5. 为剩余 8 entity 各开 1 个 #website-projects thread
 *
 * Dry-run default · --apply 真动。
 *
 * Usage:
 *   npm run pl:migrate-to-projects-channel              # dry-run
 *   npm run pl:migrate-to-projects-channel -- --apply
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ARGS = process.argv.slice(2);
const APPLY = ARGS.includes('--apply');

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ENTITIES_DIR = path.join(REPO, 'data/leads/entities');

function slugify(n) {
  return String(n || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function readEntity(key) {
  const p = path.join(ENTITIES_DIR, `${key}.json`);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function entityName(e) {
  return e?.latest?.name || e?.entityKey || '?';
}

// Per Matthew Q1-Q4 (DISCORD-CHANNELS-PRD §10 answers):
//   Q1: archive 4 existing leads thread (swap-archive + lock · 不真 close)
//   Q2: dedup-merge Queensland Roofing 2 entities → 1
//   Q3: Roof Space Renovators (D-grade) → archived (不开 projects)
//   Q4: Hurricane Digital · no change (已 archived)

const ALL_KEEPERS = fs.readdirSync(ENTITIES_DIR).filter((f) => f.endsWith('.json'))
  .map((f) => f.replace(/\.json$/, ''));

const QUEENSLAND_PRIMARY = 'place_chij-9wdzxxakwsr-lljrd1u3jq';     // Queensland Roofing (place_id 主)
const QUEENSLAND_DUP = 'domain_queenslandroofing.com.au';            // Queensland Roofing (domain merge into primary)
const ROOF_SPACE = 'place_chija7rmbn38k2srv29x1ubwqmg';              // Roof Space Renovators (D · archive)
const HURRICANE_KEY_PREFIX = 'place_chijywypvhjzkwsr6clfddpq0nc';    // Hurricane (already archived · skip)

// Entities that should get #website-projects thread (8 个)
const PROJECTS_TARGETS = ALL_KEEPERS.filter((k) =>
  k !== QUEENSLAND_DUP &&         // merged into primary
  k !== ROOF_SPACE &&              // D-archived
  k !== HURRICANE_KEY_PREFIX       // already archived · skip
);

console.log('\n=== V3 D34 · Migrate to #website-projects · plan ===');
console.log(`Mode: ${APPLY ? 'APPLY ✅' : 'DRY-RUN'}`);
console.log(`Keeper entities: ${ALL_KEEPERS.length}`);
console.log(`Projects targets: ${PROJECTS_TARGETS.length} (skip: ${QUEENSLAND_DUP} merged · ${ROOF_SPACE} D-archived · ${HURRICANE_KEY_PREFIX} pre-archived)`);
console.log('');

// Show plan
console.log('--- Step 1: Archive existing #website-leads threads ---');
const leadsThreadsToArchive = [];
for (const key of ALL_KEEPERS) {
  const e = readEntity(key);
  if (e?.discord_thread_id) {
    leadsThreadsToArchive.push({ key, threadId: e.discord_thread_id, name: entityName(e) });
    console.log(`  archive thread ${e.discord_thread_id} (${entityName(e)})`);
  }
}
if (leadsThreadsToArchive.length === 0) console.log('  (无 thread 需 archive)');

console.log('\n--- Step 2: Dedup-merge Queensland Roofing ---');
console.log(`  pl:dedup-merge --winner ${QUEENSLAND_PRIMARY} --loser ${QUEENSLAND_DUP} --confirm`);

console.log('\n--- Step 3: Archive Roof Space Renovators (D-grade) ---');
const roofSpace = readEntity(ROOF_SPACE);
if (roofSpace) {
  console.log(`  setEntityPhase('archived') · ${ROOF_SPACE} (${entityName(roofSpace)})`);
}

console.log('\n--- Step 4: Open #website-projects threads ---');
for (const key of PROJECTS_TARGETS) {
  const e = readEntity(key);
  if (!e) continue;
  // Skip if entity is itself archived (Hurricane case)
  if (e.phase === 'archived') {
    console.log(`  SKIP (already archived) · ${key} (${entityName(e)})`);
    continue;
  }
  console.log(`  openProjectThread · ${key} (${entityName(e)})`);
}

if (!APPLY) {
  console.log('\n[DRY-RUN] 仅列举计划 · 加 --apply 实际执行');
  process.exit(0);
}

// ========== APPLY ==========
console.log('\n========== APPLY ==========');

const sync = (label, fn) => fn().then((r) => { console.log(`  [${label}] ${r.ok ? '✓' : '✗'} · ${JSON.stringify(r).slice(0, 120)}`); return r; });

(async () => {
  // Lazy import (after dry-run path)
  const { archiveAndLockThread, openProjectThread } = await import(path.join(REPO, 'core/funnel/lead-thread-sync.js'));
  const { setEntityPhase, ENTITY_PHASE } = await import(path.join(REPO, 'core/leads/discovery-store.js'));

  const results = { archived: [], merged: null, archivedRoofSpace: null, opened: [], failed: [] };

  // Step 1: archive existing leads threads (200ms apart to respect rate limit)
  for (const item of leadsThreadsToArchive) {
    try {
      const r = await archiveAndLockThread(item.threadId, { reason: `Migrated to #website-projects (D34)` });
      results.archived.push({ ...item, ok: r.ok, reason: r.reason });
      console.log(`  [archive] ${r.ok ? '✓' : '✗'} ${item.threadId} (${item.name}) · ${r.reason || 'ok'}`);
    } catch (err) {
      results.failed.push({ step: 'archive', key: item.key, error: err.message });
      console.error(`  [archive] ✗ ${item.threadId} · ${err.message}`);
    }
    await new Promise((res) => setTimeout(res, 250));
  }

  // Step 2: Dedup-merge Queensland Roofing (call existing pl:dedup-merge CLI)
  console.log('\n  [merge] running pl:dedup-merge...');
  const mergeResult = spawnSync('node', [
    path.join(REPO, 'scripts/cli/pl-dedup-merge.js'),
    '--winner', QUEENSLAND_PRIMARY,
    '--loser', QUEENSLAND_DUP,
    '--confirm',
    '--operator', 'pl:migrate-to-projects-channel',
  ], { cwd: REPO, encoding: 'utf8', timeout: 30_000 });
  results.merged = { exit: mergeResult.status, stdout_tail: (mergeResult.stdout || '').slice(-300) };
  console.log(`  [merge] ${mergeResult.status === 0 ? '✓' : '✗'} exit=${mergeResult.status}`);

  // Step 3: Archive Roof Space Renovators
  if (roofSpace) {
    try {
      const r = setEntityPhase({
        entityKey: ROOF_SPACE,
        phase: ENTITY_PHASE.ARCHIVED,
        archive_reason: 'D-grade · not worth demo build (V3 D34 migration)',
        note: 'pl:migrate-to-projects-channel',
      });
      results.archivedRoofSpace = { ok: r.ok !== false, ...r };
      console.log(`  [archive-roof-space] ${r.ok !== false ? '✓' : '✗'} · ${r.reason || 'ok'}`);
    } catch (err) {
      results.failed.push({ step: 'archive-roof-space', error: err.message });
      console.error(`  [archive-roof-space] ✗ ${err.message}`);
    }
  }

  // Step 4: Open #website-projects threads
  for (const key of PROJECTS_TARGETS) {
    const e = readEntity(key);
    if (!e) continue;
    if (e.phase === 'archived') continue; // skip pre-archived (Hurricane)
    try {
      const r = await openProjectThread(key);
      results.opened.push({ key, name: entityName(e), threadId: r.threadId, ok: r.ok, reason: r.reason });
      console.log(`  [project-thread] ${r.ok ? '✓' : '✗'} ${key} → ${r.threadId || r.reason}`);
    } catch (err) {
      results.failed.push({ step: 'project-thread', key, error: err.message });
      console.error(`  [project-thread] ✗ ${key} · ${err.message}`);
    }
    await new Promise((res) => setTimeout(res, 250));
  }

  // Write manifest
  const iso = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const manifestPath = path.join(REPO, 'data/leads/_archive', `migration-d34-${iso}.json`);
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify({
    migrated_at: new Date().toISOString(),
    reason: 'V3 D34 · 6-channel architecture · per DISCORD-CHANNELS-PRD',
    results,
  }, null, 2));

  console.log('\n========== SUMMARY ==========');
  console.log(`  archived (leads threads):  ${results.archived.filter((a) => a.ok).length}/${results.archived.length}`);
  console.log(`  merged (queensland):       ${results.merged?.exit === 0 ? '✓' : '✗'}`);
  console.log(`  archived (roof-space):     ${results.archivedRoofSpace?.ok ? '✓' : '✗'}`);
  console.log(`  opened (projects threads): ${results.opened.filter((o) => o.ok).length}/${results.opened.length}`);
  console.log(`  failed:                    ${results.failed.length}`);
  console.log(`  manifest:                  ${manifestPath}`);
  console.log('');

  process.exit(results.failed.length > 0 ? 1 : 0);
})().catch((err) => {
  console.error('FATAL:', err.stack || err.message);
  process.exit(1);
});
