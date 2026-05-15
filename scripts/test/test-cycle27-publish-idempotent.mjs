/**
 * cycle-27 · TDD test · publish idempotency + history replay completeness
 *
 * Matthew (2026-05-15 thread 1504878995743707156 VIP Roofing Brisbane):
 *   "前面的 stage 的信息都丢失了 · 只有 stage 9 的信息 · 而且还是重复的"
 *
 * Root causes:
 *   1. `copyLeadHistoryToProjectThread` only fires when `!r.reused` ·
 *      republishes / re-graduate find `reused=true` · skip replay · history gone
 *   2. Stage 9 + Pipeline summary use `appendThreadMessage` · re-publish posts
 *      duplicate Stage 9 / Pipeline summary → thread fills with dupes
 *
 * Contracts:
 *   1. `projectThreadHasLeadHistory(projectThreadId, opts)` returns bool ·
 *      true iff project thread already has any "## Stage [1-8]" content
 *   2. pl-publish-demo.js calls history replay if project thread missing history
 *      (NOT just on !reused)
 *   3. Stage 9 message persists message_id (discord_stage_message_ids[9]) ·
 *      republish editThreadMessage instead of append
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

let passed = 0, failed = 0;
async function ta(name, fn) {
  try { await fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); failed++; }
}

console.log('cycle-27 · publish idempotency + history-replay completeness\n');

process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN = 'test-token';
const sync = await import('../../core/funnel/lead-thread-sync.js');

// ─── T1 · projectThreadHasLeadHistory exported ────────────────────────
await ta('projectThreadHasLeadHistory is exported', async () => {
  assert.equal(typeof sync.projectThreadHasLeadHistory, 'function');
});

// ─── T2 · returns false when no Stage 1-8 content ────────────────────
await ta('projectThreadHasLeadHistory · false when only Stage 9 + summary present', async () => {
  const messages = [
    { id: '1', author: { bot: true }, content: '## Stage 9/9 · 发布上线' },
    { id: '2', author: { bot: true }, content: '🏁 Pipeline 完成' },
  ];
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => messages });
  const has = await sync.projectThreadHasLeadHistory('PROJ123', { fetchImpl });
  assert.equal(has, false, 'no Stage 1-8 in thread · should report false');
});

await ta('projectThreadHasLeadHistory · true when Stage 3 + 5 + 8 present', async () => {
  const messages = [
    { id: '1', author: { bot: true }, content: '## Stage 3/9 · 网站审计' },
    { id: '2', author: { bot: true }, content: '## Stage 5/9 · 打分定级' },
    { id: '3', author: { bot: true }, content: '## Stage 8/9 · 建 demo' },
    { id: '4', author: { bot: true }, content: '## Stage 9/9 · 发布上线' },
  ];
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => messages });
  const has = await sync.projectThreadHasLeadHistory('PROJ123', { fetchImpl });
  assert.equal(has, true);
});

// ─── T3 · pl-publish-demo replays when history missing (not just on !reused) ─
await ta('pl-publish-demo · replay history when project thread missing Stage 1-8', async () => {
  const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
  const src = fs.readFileSync(path.join(ROOT, 'scripts/cli/pl-publish-demo.js'), 'utf8');
  assert.ok(src.includes('projectThreadHasLeadHistory'),
    'pl-publish-demo must check projectThreadHasLeadHistory before deciding to replay');
});

// ─── T4 · Stage 9 idempotent · edit existing instead of duplicate ─────
await ta('pl-publish-demo · Stage 9 idempotent (edit if message_id known)', async () => {
  const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
  const src = fs.readFileSync(path.join(ROOT, 'scripts/cli/pl-publish-demo.js'), 'utf8');
  // Look for editThreadMessage call near Stage 9 path · or discord_stage_message_ids[9]
  const hasEdit9 = /discord_stage_message_ids.*9|stage_message_ids\[9\]|editThreadMessage.*stage7Message|stage9Message/.test(src);
  assert.ok(hasEdit9,
    'pl-publish-demo must track Stage 9 message_id and edit on republish · prevent duplicates');
});

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed === 0 ? 0 : 1);
