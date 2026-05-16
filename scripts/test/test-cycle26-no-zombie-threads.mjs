/**
 * cycle-26 · TDD test 26/?? · "1 entity = 1 visible thread" invariant.
 *
 * Bug class: Discord auto-unarchives forum threads on POST · so archive +
 * subsequent post = zombie (locked=true · archived=false · still visible).
 * Matthew complaint: duplicate threads visible (leads + projects same entity).
 *
 * Tests:
 *   1. archiveAndLockThread PATCH body INCLUDES auto_archive_duration
 *   2. archiveAndLockThread sends archived=true AND locked=true together
 *   3. CLI pl:rearchive-zombies exists · scans both channels · re-archives
 *   4. Static asserts on lead-thread-sync.js · no regression
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { setCardRefreshScheduler } from '../../core/leads/discovery-store.js';
import { archiveAndLockThread } from '../../core/funnel/lead-thread-sync.js';

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); failed++; }
}
async function ta(name, fn) {
  try { await fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); failed++; }
}

console.log('cycle-26 · test 26/?? · no zombie threads invariant\n');

setCardRefreshScheduler(null);
process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN = 'test-token';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');

// ─── T1 · archiveAndLockThread sends archived + locked + auto_archive_duration ──
await ta('archiveAndLockThread PATCH body includes auto_archive_duration (prevents zombie)',
  async () => {
    const calls = [];
    const fetchImpl = async (url, opts = {}) => {
      calls.push({ url, method: opts.method || 'GET', body: opts.body });
      if (opts.method === 'PATCH') return { ok: true, status: 200, text: async () => '{}' };
      if (opts.method === 'POST') return { ok: true, status: 200, text: async () => '{}' };
      return { ok: true, status: 200, json: async () => ({}) };
    };
    const r = await archiveAndLockThread('9999', { reason: 'test', fetchImpl });
    assert.ok(r.ok, `expected ok · got ${JSON.stringify(r)}`);
    // cycle-27 (Mackay Roof Restoration fix · 2nd recurrence):
    // archiveAndLockThread now does 2-step PATCH · across BOTH PATCHes:
    //   1st PATCH: { locked, auto_archive_duration }
    //   2nd PATCH: { archived }  (Discord respects archived only when sent alone)
    const patches = calls.filter((c) => c.method === 'PATCH');
    assert.ok(patches.length >= 2, `expected 2-step PATCH · got ${patches.length}`);
    // Aggregate fields across patches
    const fields = {};
    for (const p of patches) Object.assign(fields, JSON.parse(p.body));
    assert.equal(fields.archived, true, 'archived must be true (set in some PATCH)');
    assert.equal(fields.locked, true, 'locked must be true (set in some PATCH)');
    assert.ok(fields.auto_archive_duration,
      `auto_archive_duration missing · Discord forum threads need it to prevent purge`);
  });

// ─── T2 · Static source assertion on archiveAndLockThread impl ─────────────
t('lead-thread-sync.js · archiveAndLockThread PATCH body has auto_archive_duration literal', () => {
  const src = fs.readFileSync(path.join(ROOT, 'core/funnel/lead-thread-sync.js'), 'utf8');
  const archiveFn = src.split('export async function archiveAndLockThread')[1] || '';
  assert.ok(archiveFn.includes('auto_archive_duration'),
    'archiveAndLockThread must reference auto_archive_duration in PATCH body');
});

// ─── T3 · pl:rearchive-zombies CLI exists + correct shape ──────────────────
t('pl:rearchive-zombies CLI exists at scripts/cli/pl-rearchive-zombie-threads.js', () => {
  const p = path.join(ROOT, 'scripts/cli/pl-rearchive-zombie-threads.js');
  assert.ok(fs.existsSync(p), `CLI missing: ${p}`);
});

t('pl:rearchive-zombies · scans BOTH #leads + #projects channels', () => {
  const src = fs.readFileSync(path.join(ROOT, 'scripts/cli/pl-rearchive-zombie-threads.js'), 'utf8');
  assert.ok(src.includes('WEBSITE_LEADS_DISCORD_CHANNEL_ID'), 'must scan leads channel');
  assert.ok(src.includes('WEBSITE_PROJECTS_DISCORD_CHANNEL_ID'), 'must scan projects channel');
});

t('pl:rearchive-zombies · zombie definition: locked=true AND archived !== true', () => {
  const src = fs.readFileSync(path.join(ROOT, 'scripts/cli/pl-rearchive-zombie-threads.js'), 'utf8');
  // Should check thread_metadata.locked AND thread_metadata.archived
  assert.ok(src.includes('locked') && src.includes('archived'),
    'zombie detection must check locked+archived');
});

t('pl:rearchive-zombies · npm script registered', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.ok(pkg.scripts && pkg.scripts['pl:rearchive-zombies'], 'missing npm script');
});

t('pl:rearchive-zombies · supports --dry-run', () => {
  const src = fs.readFileSync(path.join(ROOT, 'scripts/cli/pl-rearchive-zombie-threads.js'), 'utf8');
  assert.ok(src.includes('dry-run') || src.includes('dryRun'), 'must support --dry-run flag');
});

// ─── T4 · Behavioral: PATCH endpoint correct for archive ───────────────────
await ta('archiveAndLockThread targets PATCH /channels/<threadId>',
  async () => {
    const calls = [];
    const fetchImpl = async (url, opts = {}) => {
      calls.push({ url, method: opts.method });
      return { ok: true, status: 200, text: async () => '{}' };
    };
    await archiveAndLockThread('12345', { reason: 'x', fetchImpl });
    const patch = calls.find((c) => c.method === 'PATCH');
    assert.ok(patch, 'no PATCH');
    assert.ok(patch.url.includes('/channels/12345'), `wrong endpoint: ${patch.url}`);
  });

// ─── T5 · Invariant doc: cycle-doctor / heartbeat must NOT post to archived ──
t('appendThreadMessage still guards archived (no regression to zombie creation)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'core/funnel/lead-thread-sync.js'), 'utf8');
  // P6 added the guard · regression check
  assert.ok(src.includes('skipped: \'archived\'') || src.includes("skipped: 'archived'"),
    'appendThreadMessage must skip archived threads');
});

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed === 0 ? 0 : 1);
