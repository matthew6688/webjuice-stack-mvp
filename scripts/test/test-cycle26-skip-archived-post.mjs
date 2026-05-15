/**
 * cycle-26 · TDD test 22/?? · skip-post-on-archived-thread invariant.
 *
 * Discord behavior: POST to archived forum thread → auto-unarchives.
 * Operator complaint: "lead 已 graduate 到 projects · 老 leads thread 还可见 ·
 * 想让 archive 后真消失". Root cause: subsequent posts (pipeline summary ·
 * dispatcher 完成 msg) auto-unarchive the leads thread.
 *
 * Fix: all post helpers check thread.thread_metadata.archived BEFORE POST ·
 * archived → skip (no Discord call) · returns { ok, skipped: 'archived' }.
 *
 * Test strategy: mock fetch that returns archived=true on GET /channels/<id>.
 * appendThreadMessage / refreshThreadAndPost / upsertProfileCard must NOT
 * issue POST/PATCH on that thread.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { setCardRefreshScheduler } from '../../core/leads/discovery-store.js';
import { appendThreadMessage, refreshThreadAndPost } from '../../core/funnel/lead-thread-sync.js';

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); failed++; }
}
async function ta(name, fn) {
  try { await fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); failed++; }
}

console.log('cycle-26 · test 22/?? · skip-post-on-archived\n');

setCardRefreshScheduler(null);
process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN = 'test-token';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cycle26-archive-'));
process.chdir(TMP);
fs.mkdirSync(path.join(TMP, 'data/leads/entities'), { recursive: true });
fs.mkdirSync(path.join(TMP, 'data/geo'), { recursive: true });
for (const f of fs.readdirSync(path.join(REPO, 'data/geo'))) {
  fs.copyFileSync(path.join(REPO, 'data/geo', f), path.join(TMP, 'data/geo', f));
}

const ENT = {
  schemaVersion: 1,
  entityKey: 'fx_archived',
  latest: { name: 'Archived Co', niche: 'roofer', city: 'sydney' },
  phase: 'archived',
  grade: { grade: 'D' },
  discord_thread_id: '9000',
  discord_profile_message_id: '9001',
};
fs.writeFileSync(path.join(TMP, 'data/leads/entities/fx_archived.json'), JSON.stringify(ENT, null, 2));

// ─── T1 · appendThreadMessage to archived thread → skip ───────────────────
await ta('appendThreadMessage to archived thread → skip · returns { ok, skipped }',
  async () => {
    const calls = [];
    const fetchImpl = async (url, opts = {}) => {
      calls.push({ url, method: opts?.method || 'GET' });
      if (opts?.method === 'POST') {
        // Should never reach here
        return { ok: true, status: 200, text: async () => '{"id":"x"}', json: async () => ({ id: 'x' }) };
      }
      // GET /channels/<id> · return archived=true
      return {
        ok: true, status: 200,
        json: async () => ({ id: '9000', name: '[D] X', thread_metadata: { archived: true, locked: true } }),
      };
    };
    const r = await appendThreadMessage('9000', 'should not appear', { fetchImpl });
    assert.ok(r.skipped === 'archived' || (r.ok && r.skipped),
      `expected skipped=archived · got: ${JSON.stringify(r)}`);
    // Must have made 1 GET (check archived) · ZERO POST
    const posts = calls.filter((c) => c.method === 'POST');
    assert.equal(posts.length, 0, `expected 0 POSTs to archived thread · got ${posts.length}`);
  });

// ─── T2 · appendThreadMessage to active thread → POSTs normally ───────────
await ta('appendThreadMessage to UNARCHIVED thread → POST happens',
  async () => {
    const calls = [];
    const fetchImpl = async (url, opts = {}) => {
      calls.push({ url, method: opts?.method || 'GET' });
      if (opts?.method === 'POST') {
        return { ok: true, status: 200, text: async () => '{"id":"new1"}', json: async () => ({ id: 'new1' }) };
      }
      return {
        ok: true,
        json: async () => ({ id: '9000', thread_metadata: { archived: false, locked: false } }),
      };
    };
    const r = await appendThreadMessage('9000', 'should appear', { fetchImpl });
    assert.ok(r.ok && !r.skipped, `expected normal post · got: ${JSON.stringify(r)}`);
    const posts = calls.filter((c) => c.method === 'POST');
    assert.equal(posts.length, 1, `expected 1 POST · got ${posts.length}`);
  });

// ─── T3 · refreshThreadAndPost · same skip behavior ───────────────────────
await ta('refreshThreadAndPost to archived → skip (no POST · no PATCH)',
  async () => {
    const calls = [];
    const fetchImpl = async (url, opts = {}) => {
      calls.push({ url, method: opts?.method || 'GET' });
      if (opts?.method === 'POST' || opts?.method === 'PATCH') {
        return { ok: true, status: 200, text: async () => '{}', json: async () => ({}) };
      }
      // archived
      return { ok: true, json: async () => ({ id: '9000', thread_metadata: { archived: true } }) };
    };
    const r = await refreshThreadAndPost('fx_archived', 'should not appear', { fetchImpl });
    const writes = calls.filter((c) => c.method === 'POST' || c.method === 'PATCH');
    assert.equal(writes.length, 0,
      `expected 0 writes (no POST/PATCH) to archived thread · got ${writes.length}`);
  });

// ─── T4 · POST to thread that returns 404 (deleted) → skip gracefully ─────
await ta('POST to deleted/404 thread → skip gracefully · no exception',
  async () => {
    const fetchImpl = async (url, opts = {}) => {
      if (opts?.method === 'POST') return { ok: false, status: 404, text: async () => 'Unknown Channel' };
      return { ok: false, status: 404, text: async () => 'Unknown Channel' };
    };
    const r = await appendThreadMessage('9999', 'msg', { fetchImpl });
    assert.ok(!r.ok && (r.skipped || r.reason),
      `expected skip/reason · got: ${JSON.stringify(r)}`);
  });

// ─── Cleanup ───────────────────────────────────────────────────────────────
process.chdir(REPO);
try { fs.rmSync(TMP, { recursive: true, force: true }); } catch {}

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed === 0 ? 0 : 1);
