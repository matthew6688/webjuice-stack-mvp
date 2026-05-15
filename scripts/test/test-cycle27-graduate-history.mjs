/**
 * cycle-27 · TDD test · Replay lead-thread history when graduating to projects
 *
 * Matthew (2026-05-15): "thread 到了 website project 的时候只有 stage 9 的内容 ·
 * 之前的 stage 的信息都没有了 · 应该保留之前的 stage 的信息"
 *
 * Goal: After `openProjectThread` succeeds · copy historical bot messages from
 * lead thread to project thread so operators see the full pipeline timeline.
 *
 * Contract:
 *   1. `copyLeadHistoryToProjectThread(leadThreadId, projectThreadId, opts)`
 *      exported from lead-thread-sync.js
 *   2. Fetches lead thread messages (paginated · oldest-first)
 *   3. Filters: bot-authored only · with text content (skip embed-only profile card)
 *   4. Re-posts each as new message in project thread (throttled · 200ms)
 *   5. Returns { ok, total, posted, skipped } for caller logging
 *   6. pl-publish-demo.js calls helper at graduate · between openProjectThread
 *      and the pipeline summary
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

let passed = 0, failed = 0;
async function ta(name, fn) {
  try { await fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); failed++; }
}

console.log('cycle-27 · graduate history replay\n');

process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN = 'test-token';
const sync = await import('../../core/funnel/lead-thread-sync.js');

// ─── T1 · exported ────────────────────────────────────────────────
await ta('copyLeadHistoryToProjectThread is exported', async () => {
  assert.equal(typeof sync.copyLeadHistoryToProjectThread, 'function');
});

// ─── T2 · fetches messages + filters bot + posts in order ──────────
await ta('copyLeadHistoryToProjectThread: copy 5 bot stage messages in oldest-first order', async () => {
  const leadMessages = [
    // newest first as Discord returns
    { id: '105', author: { bot: true }, content: '## Stage 5/9 · 打分定级', timestamp: '2026-05-15T10:00:50Z' },
    { id: '104', author: { bot: true }, content: '## Stage 4/9 · 视觉审计', timestamp: '2026-05-15T10:00:40Z' },
    { id: '103', author: { bot: true }, content: '## Stage 3/9 · 网站审计', timestamp: '2026-05-15T10:00:30Z' },
    { id: '102', author: { bot: false }, content: 'operator note', timestamp: '2026-05-15T10:00:20Z' }, // filtered out
    { id: '101', author: { bot: true }, embeds: [{ title: 'profile card' }], timestamp: '2026-05-15T10:00:10Z' }, // no content · skip
    { id: '100', author: { bot: true }, content: '## Stage 2/9 · 排除筛选', timestamp: '2026-05-15T10:00:00Z' },
    { id: '99', author: { bot: true }, content: '## Stage 1/9 · 入库', timestamp: '2026-05-15T09:59:50Z' },
  ];
  const calls = [];
  const fetchImpl = async (url, opts = {}) => {
    if (url.includes('/messages?limit') && (!opts.method || opts.method === 'GET')) {
      return { ok: true, status: 200, json: async () => leadMessages };
    }
    if (opts.method === 'POST' && url.includes('/messages')) {
      calls.push({ url, body: opts.body });
      return { ok: true, status: 200, text: async () => '{}', json: async () => ({}) };
    }
    return { ok: true, status: 200, json: async () => ({ thread_metadata: { archived: false, locked: false } }) };
  };
  const r = await sync.copyLeadHistoryToProjectThread('LEAD123', 'PROJ456', {
    fetchImpl, throttleMs: 0,
  });
  assert.ok(r.ok, `expected ok · got ${JSON.stringify(r)}`);
  assert.equal(r.total, 7, 'total scanned = all lead messages');
  assert.equal(r.posted, 5, 'posted = 5 bot messages with content');
  assert.equal(r.skipped, 2, 'skipped = operator + embed-only');

  // Verify oldest-first ordering
  const stages = calls.map((c) => {
    const m = JSON.parse(c.body).content.match(/Stage (\d)/);
    return m ? m[1] : null;
  }).filter(Boolean);
  assert.deepEqual(stages, ['1', '2', '3', '4', '5'], `posted in order · got: ${stages.join(',')}`);
});

// ─── T3 · empty / error handling ───────────────────────────────────
await ta('copyLeadHistoryToProjectThread handles empty lead thread', async () => {
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => [] });
  const r = await sync.copyLeadHistoryToProjectThread('LEAD', 'PROJ', { fetchImpl, throttleMs: 0 });
  assert.ok(r.ok);
  assert.equal(r.posted, 0);
});

await ta('copyLeadHistoryToProjectThread handles 404 lead thread gracefully', async () => {
  const fetchImpl = async () => ({ ok: false, status: 404, json: async () => ({ code: 10003 }) });
  const r = await sync.copyLeadHistoryToProjectThread('DEAD', 'PROJ', { fetchImpl, throttleMs: 0 });
  assert.equal(r.ok, false);
  assert.match(r.reason || '', /404|fetch/i);
});

// ─── T4 · pl-publish-demo wires the helper at graduate ──────────────
await ta('pl-publish-demo.js calls copyLeadHistoryToProjectThread at graduate', async () => {
  const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
  const src = fs.readFileSync(path.join(ROOT, 'scripts/cli/pl-publish-demo.js'), 'utf8');
  assert.ok(src.includes('copyLeadHistoryToProjectThread'),
    'pl-publish-demo must call copyLeadHistoryToProjectThread after openProjectThread');
});

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed === 0 ? 0 : 1);
