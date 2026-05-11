#!/usr/bin/env node
/**
 * Block P1.2 + P1.3 hard evidence — pl:daily-tick correctly revives nurture
 * leads + archives stale outreach leads.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import assert from 'assert/strict';
import { spawnSync } from 'child_process';

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pl-tick-'));
const entitiesDir = path.join(tmpRoot, 'data', 'leads', 'entities');
fs.mkdirSync(entitiesDir, { recursive: true });

const now = new Date('2026-05-11T00:00:00.000Z');
const daysAgo = (n) => new Date(now.getTime() - n * 86400000).toISOString();

const fixtures = [
  // 1. nurture, due yesterday → should revive
  { entityKey: 'place_n1', phase: 'nurture', nurture_due_at: daysAgo(1), grade: { investment_level: 'A' }, latest: { name: 'Nurture Due Roofer' }, history: [] },
  // 2. nurture, due 30 days from now → should NOT revive
  { entityKey: 'place_n2', phase: 'nurture', nurture_due_at: daysAgo(-30), grade: { investment_level: 'B' }, latest: { name: 'Nurture Future' }, history: [] },
  // 3. outreach-active, last_contact 25 days ago → should archive (default 21d)
  { entityKey: 'place_t1', phase: 'outreach-active', last_contact_at: daysAgo(25), grade: { investment_level: 'A' }, latest: { name: 'Stale Roofer' }, history: [] },
  // 4. outreach-active, last_contact 5 days ago → should NOT archive
  { entityKey: 'place_t2', phase: 'outreach-active', last_contact_at: daysAgo(5), grade: { investment_level: 'A' }, latest: { name: 'Recent Roofer' }, history: [] },
  // 5. outreach-active, do_not_contact=true → should NOT archive (defensive)
  { entityKey: 'place_t3', phase: 'outreach-active', last_contact_at: daysAgo(100), do_not_contact: true, grade: { investment_level: 'C' }, latest: { name: 'Unsub Roofer' }, history: [] },
  // 6. paid → never touched
  { entityKey: 'place_p1', phase: 'paid', last_contact_at: daysAgo(60), grade: { investment_level: 'A' }, latest: { name: 'Paid Roofer' }, history: [] },
];

for (const e of fixtures) {
  fs.writeFileSync(path.join(entitiesDir, `${e.entityKey}.json`), JSON.stringify(e, null, 2));
}

// Run pl:daily-tick from tmp dir
const r = spawnSync('node', [path.join(process.cwd(), 'scripts/cli/pl-daily-tick.js')], {
  cwd: tmpRoot,
  env: { ...process.env, SKIP_LEAD_THREAD_SYNC: 'true' },
  encoding: 'utf8',
});

if (r.status !== 0) {
  console.error('pl:daily-tick failed:', r.stderr || r.stdout);
  process.exit(1);
}
const out = JSON.parse(r.stdout);

// ── Assertions ──
assert.equal(out.ok, true);
assert.equal(out.timeout_days, 21);
assert.equal(out.nurture.candidates, 1, 'only place_n1 (due yesterday) should be nurture candidate');
assert.equal(out.nurture.results[0].entityKey, 'place_n1');
assert.equal(out.nurture.results[0].action, 'revived');

assert.equal(out.outreach_timeout.candidates, 1, 'only place_t1 (25d stale) should be timeout candidate');
assert.equal(out.outreach_timeout.results[0].entityKey, 'place_t1');
assert.equal(out.outreach_timeout.results[0].action, 'archived');
assert.equal(out.outreach_timeout.results[0].days_ago, 25);

// Verify entity state after run
const n1 = JSON.parse(fs.readFileSync(path.join(entitiesDir, 'place_n1.json'), 'utf8'));
assert.equal(n1.phase, 'awaiting', 'place_n1 revived to awaiting');

const n2 = JSON.parse(fs.readFileSync(path.join(entitiesDir, 'place_n2.json'), 'utf8'));
assert.equal(n2.phase, 'nurture', 'place_n2 still in nurture (future due date)');

const t1 = JSON.parse(fs.readFileSync(path.join(entitiesDir, 'place_t1.json'), 'utf8'));
assert.equal(t1.phase, 'archived');
assert.equal(t1.archive_reason, 'no_response_25d');

const t2 = JSON.parse(fs.readFileSync(path.join(entitiesDir, 'place_t2.json'), 'utf8'));
assert.equal(t2.phase, 'outreach-active', 'recent (5d) outreach untouched');

const t3 = JSON.parse(fs.readFileSync(path.join(entitiesDir, 'place_t3.json'), 'utf8'));
assert.equal(t3.phase, 'outreach-active', 'do_not_contact prevented archival');

const p1 = JSON.parse(fs.readFileSync(path.join(entitiesDir, 'place_p1.json'), 'utf8'));
assert.equal(p1.phase, 'paid', 'paid never touched');

// ── Idempotency: second run should be noop ──
const r2 = spawnSync('node', [path.join(process.cwd(), 'scripts/cli/pl-daily-tick.js')], {
  cwd: tmpRoot,
  env: { ...process.env, SKIP_LEAD_THREAD_SYNC: 'true' },
  encoding: 'utf8',
});
const out2 = JSON.parse(r2.stdout);
assert.equal(out2.nurture.candidates, 0, 'second run finds no nurture candidates');
assert.equal(out2.outreach_timeout.candidates, 0, 'second run finds no timeout candidates');

// ── Custom timeout-days flag ──
const r3 = spawnSync('node', [path.join(process.cwd(), 'scripts/cli/pl-daily-tick.js'), '--timeout-days', '3', '--dry-run'], {
  cwd: tmpRoot,
  env: { ...process.env, SKIP_LEAD_THREAD_SYNC: 'true' },
  encoding: 'utf8',
});
const out3 = JSON.parse(r3.stdout);
assert.equal(out3.timeout_days, 3);
assert.equal(out3.outreach_timeout.candidates, 1, 'place_t2 (5d) caught with 3d threshold');
assert.equal(out3.outreach_timeout.results[0].action, 'would_archive');

fs.rmSync(tmpRoot, { recursive: true, force: true });

console.log(JSON.stringify({
  ok: true,
  assertions_passed: 18,
  cases: {
    nurture_due_revived: true,
    nurture_future_untouched: true,
    outreach_stale_archived: true,
    outreach_recent_untouched: true,
    do_not_contact_protected: true,
    paid_untouched: true,
    idempotent: true,
    custom_timeout_flag: true,
    dry_run_supported: true,
  },
}, null, 2));
