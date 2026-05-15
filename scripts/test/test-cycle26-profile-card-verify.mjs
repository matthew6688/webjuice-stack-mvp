/**
 * cycle-26 · TDD test 20/?? · upsertProfileCard verify-after-PATCH.
 *
 * P2.1: PATCH 完不能信 · 必须 fetch 回来比对 hash · 不一致重试 · 二次 fail alert.
 *
 * Tests (mock fetch · simulate):
 *   - PATCH succeeds + GET-back hash matches → ok=true · verified=true
 *   - PATCH 200 but GET-back stale (cached) → retries 1x → reports drift
 *   - PATCH 429 rate-limit → respects Retry-After (use shorter for test)
 *   - PATCH 5xx → exponential backoff 3 attempts
 *   - All fetches captured in spy array for assertions
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { setCardRefreshScheduler } from '../../core/leads/discovery-store.js';
import { upsertProfileCard } from '../../core/funnel/lead-thread-sync.js';

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); failed++; }
}
async function ta(name, fn) {
  try { await fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); failed++; }
}

console.log('cycle-26 · test 20/?? · profile-card verify-after-PATCH\n');

// Disable auto-scheduler in test
setCardRefreshScheduler(null);
process.env.WEBSITE_LEADS_DISCORD_CHANNEL_ID = '1000';
process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN = 'test-token';

// Setup fixture entity (chdir to TMP · copy support files needed by profile-card)
const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cycle26-verify-'));
process.chdir(TMP);
fs.mkdirSync(path.join(TMP, 'data/leads/entities'), { recursive: true });
fs.mkdirSync(path.join(TMP, 'data/geo'), { recursive: true });
// Copy support files: locale tables (au-city-tz.json etc) required by profile-card
for (const f of fs.readdirSync(path.join(REPO, 'data/geo'))) {
  fs.copyFileSync(path.join(REPO, 'data/geo', f), path.join(TMP, 'data/geo', f));
}

const ENT = {
  schemaVersion: 1,
  entityKey: 'fx_verify_1',
  latest: { name: 'Verify Co', niche: 'roofer', city: 'sydney' },
  phase: 'audit-ready',
  grade: { investment_level: 'C' },
  discord_thread_id: '2000',
  discord_profile_message_id: '3000',
};
fs.writeFileSync(path.join(TMP, 'data/leads/entities/fx_verify_1.json'), JSON.stringify(ENT, null, 2));

// ─── T1 · happy path: PATCH + GET match → verified=true ───────────────────
await ta('PATCH 200 + GET-back matches → ok=true verified=true', async () => {
  const calls = [];
  let patchedEmbed = null;
  const fetchImpl = async (url, opts = {}) => {
    calls.push({ url, method: opts.method || 'GET' });
    if (opts.method === 'PATCH') {
      patchedEmbed = JSON.parse(opts.body).embeds[0];
      return { ok: true, status: 200, text: async () => '{}', json: async () => ({ id: '3000', embeds: [patchedEmbed] }) };
    }
    // GET (verify)
    return { ok: true, status: 200, text: async () => '{}', json: async () => ({ id: '3000', embeds: [patchedEmbed] }) };
  };
  const r = await upsertProfileCard('fx_verify_1', { fetchImpl });
  assert.ok(r.ok, `expected ok · got: ${JSON.stringify(r)}`);
  assert.equal(r.verified, true, 'must set verified=true after GET match');
  // 1 PATCH + 1 GET = 2 fetches
  assert.equal(calls.filter((c) => c.method === 'PATCH').length, 1);
  assert.equal(calls.filter((c) => c.method === 'GET').length, 1);
});

// ─── T2 · PATCH then GET-back stale (mismatch) → retry → drift reported ──
await ta('PATCH 200 + GET-back mismatch → retries 1x · reports drift if still bad', async () => {
  let patches = 0;
  const fetchImpl = async (url, opts = {}) => {
    if (opts.method === 'PATCH') {
      patches++;
      return { ok: true, status: 200, text: async () => '{}', json: async () => ({}) };
    }
    // GET returns a DIFFERENT embed (stale cache scenario)
    return { ok: true, status: 200, json: async () => ({ id: '3000', embeds: [{ title: 'STALE_OLD_TITLE', description: 'old' }] }) };
  };
  const r = await upsertProfileCard('fx_verify_1', { fetchImpl });
  // Either: retried once (patches == 2) · or drift reported in result
  assert.ok(patches >= 1, 'must PATCH at least once');
  // If drift detected · result should signal it
  assert.ok(r.drift === true || patches >= 2,
    `expected drift signal or retry · got patches=${patches} r=${JSON.stringify(r).slice(0, 200)}`);
});

// ─── T3 · PATCH 429 → respects Retry-After + retries ──────────────────────
await ta('PATCH 429 → reads Retry-After + retries · success on retry', async () => {
  let patchAttempts = 0;
  let lastPatchedEmbed = null;
  const fetchImpl = async (url, opts = {}) => {
    if (opts.method === 'PATCH') {
      patchAttempts++;
      if (patchAttempts === 1) {
        return {
          ok: false,
          status: 429,
          headers: { get: (h) => h.toLowerCase() === 'retry-after' ? '0.05' : null },
          text: async () => 'rate limited',
        };
      }
      lastPatchedEmbed = JSON.parse(opts.body).embeds[0];
      return { ok: true, status: 200, text: async () => '{}', json: async () => ({}) };
    }
    // GET (verify) returns matching embed → no drift
    return { ok: true, status: 200, json: async () => ({ id: '3000', embeds: [lastPatchedEmbed] }) };
  };
  const r = await upsertProfileCard('fx_verify_1', { fetchImpl });
  // 1 PATCH 429 + 1 PATCH 200 retry = 2 attempts (verify GET doesn't count as PATCH)
  assert.equal(patchAttempts, 2, `expected 2 PATCH attempts (429 + retry) · got ${patchAttempts}`);
  assert.ok(r.ok && r.retried_429, `must succeed after retry + signal retried · got: ${JSON.stringify(r)}`);
});

// ─── T4 · PATCH 5xx → exponential backoff · 3 attempts max ────────────────
await ta('PATCH 500 (persistent) → 3 retry attempts then fail', async () => {
  let attempts = 0;
  const fetchImpl = async (url, opts = {}) => {
    if (opts.method === 'PATCH') {
      attempts++;
      return { ok: false, status: 500, text: async () => 'Internal Server Error' };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  };
  const r = await upsertProfileCard('fx_verify_1', { fetchImpl });
  assert.ok(attempts >= 3, `expected ≥3 attempts on 5xx · got ${attempts}`);
  assert.ok(!r.ok, 'must report failure after retries exhausted');
});

// ─── Cleanup ───────────────────────────────────────────────────────────────
process.chdir(path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..'));
try { fs.rmSync(TMP, { recursive: true, force: true }); } catch {}

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed === 0 ? 0 : 1);
