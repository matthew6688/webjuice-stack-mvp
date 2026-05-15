/**
 * cycle-27 · TDD test · archive auto_archive_duration = 7 days (10080 min)
 *
 * Matthew (2026-05-15 "set up 7 days archive is fine"):
 *   Old threads in #website-leads / #website-projects returned 404 on
 *   re-fetch. Discord was auto-purging archived threads · we set
 *   auto_archive_duration: 60 (1h) at archive · Discord interpreted that
 *   as "OK to purge after short window."
 *
 * Fix: use 10080 (7 days · Discord max) at every archive site so threads
 * persist long enough for operator history review + Goal 4 history checks.
 *
 * Contract:
 *   - archiveAndLockThread PATCH body has auto_archive_duration: 10080
 *   - pl-rearchive-zombie-threads.js also uses 10080
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); failed++; }
}

console.log('cycle-27 · archive auto_archive_duration = 10080 (7 days)\n');

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');

// ─── T1 · archiveAndLockThread uses 10080 ─────────────────────────────
t('lead-thread-sync.js archiveAndLockThread sets auto_archive_duration: 10080', () => {
  const src = fs.readFileSync(path.join(ROOT, 'core/funnel/lead-thread-sync.js'), 'utf8');
  const fn = src.split('export async function archiveAndLockThread')[1] || '';
  const slice = fn.split('export ')[0];
  assert.ok(/auto_archive_duration:\s*10080/.test(slice),
    'archiveAndLockThread must set auto_archive_duration: 10080 (7 days)');
  assert.ok(!/auto_archive_duration:\s*60\b/.test(slice),
    'archiveAndLockThread must NOT use the legacy 60-minute value');
});

// ─── T2 · pl-rearchive-zombies CLI uses 10080 ────────────────────────
t('pl-rearchive-zombie-threads.js uses auto_archive_duration: 10080', () => {
  const src = fs.readFileSync(path.join(ROOT, 'scripts/cli/pl-rearchive-zombie-threads.js'), 'utf8');
  assert.ok(/auto_archive_duration:\s*10080/.test(src),
    'pl-rearchive-zombie-threads must set 10080');
  assert.ok(!/auto_archive_duration:\s*60\b/.test(src),
    'pl-rearchive-zombie-threads must NOT use legacy 60');
});

// ─── T3 · no other archive site uses 60-minute window ────────────────
t('no archive code path still sets auto_archive_duration: 60', () => {
  function walk(dir, out = []) {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, f.name);
      if (full.includes('node_modules') || full.includes('/_archive/')) continue;
      if (f.isDirectory()) walk(full, out);
      else if (/\.(m?js)$/.test(f.name)) out.push(full);
    }
    return out;
  }
  const files = walk(path.join(ROOT, 'core')).concat(walk(path.join(ROOT, 'scripts')));
  const offenders = [];
  for (const file of files) {
    if (file.includes('/test-')) continue;
    // QA demo scripts create ephemeral test threads · 60-min idle is fine
    if (file.includes('/scripts/qa/sop1-')) continue;
    const txt = fs.readFileSync(file, 'utf8');
    if (/auto_archive_duration:\s*60\b/.test(txt)) offenders.push(path.relative(ROOT, file));
  }
  assert.equal(offenders.length, 0,
    `still using 60-min archive in production code · update to 10080:\n  ${offenders.join('\n  ')}`);
});

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed === 0 ? 0 : 1);
