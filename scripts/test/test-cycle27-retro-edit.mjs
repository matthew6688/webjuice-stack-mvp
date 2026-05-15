/**
 * cycle-27 Phase 5 · TDD test · Stage 6 + Stage 8 retro-edit
 *
 * Goal: After Stage 9 publish · the previously-posted Stage 6 (内部审计报告)
 * and Stage 8 (建 demo) messages get PATCHed via Discord editMessage API ·
 * appending live URLs. Lead/projects thread becomes self-contained: each
 * stage message includes the live URLs the moment they exist.
 *
 * Contract:
 *   1. `editThreadMessage(threadId, messageId, content, opts)` exported from
 *      lead-thread-sync.js · uses Discord PATCH /channels/<>/messages/<>
 *   2. Entity tracks `discord_stage_message_ids = { 6: '...', 8: '...' }`
 *      after Stage 6 + Stage 8 messages are posted (persisted by callers).
 *   3. pl-publish-demo.js · at Stage 9 done · re-builds stage4Message +
 *      stage6Message with `deploy` set · calls editThreadMessage on each.
 *   4. Stage 6 + Stage 8 messages with `deploy` set show live URLs section.
 *      (verified in test-cycle27-build-summary.mjs T3)
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

let passed = 0, failed = 0;
async function ta(name, fn) {
  try { await fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); failed++; }
}

console.log('cycle-27 Phase 5 · retro-edit\n');

process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN = 'test-token';

const sync = await import('../../core/funnel/lead-thread-sync.js');

// ─── T1 · editThreadMessage exported ───────────────────────────────
await ta('editThreadMessage exported from lead-thread-sync.js', async () => {
  assert.equal(typeof sync.editThreadMessage, 'function');
});

// ─── T2 · editThreadMessage sends PATCH with content ──────────────
await ta('editThreadMessage sends PATCH /channels/<>/messages/<> with new content', async () => {
  const calls = [];
  const fetchImpl = async (url, opts = {}) => {
    calls.push({ url, method: opts.method, body: opts.body });
    return { ok: true, status: 200, text: async () => '{}' };
  };
  const r = await sync.editThreadMessage('12345', '67890', '## updated content', { fetchImpl });
  assert.ok(r.ok, `expected ok · got ${JSON.stringify(r)}`);
  const patch = calls.find((c) => c.method === 'PATCH');
  assert.ok(patch, 'no PATCH call');
  assert.match(patch.url, /\/channels\/12345\/messages\/67890$/);
  const body = JSON.parse(patch.body);
  assert.match(body.content, /updated content/);
});

// ─── T3 · editThreadMessage error handling (404 / 403) ────────────
await ta('editThreadMessage handles 404 (message deleted) gracefully', async () => {
  const fetchImpl = async () => ({ ok: false, status: 404, text: async () => '{"code":10008}' });
  const r = await sync.editThreadMessage('12345', '67890', 'x', { fetchImpl });
  assert.equal(r.ok, false);
  assert.match(r.reason || '', /404|not.?found/i);
});

// ─── T4 · pl-publish-demo.js calls editThreadMessage for Stage 6 + 8 ─
await ta('pl-publish-demo.js triggers retro-edit for Stage 6 + Stage 8', async () => {
  const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
  const src = fs.readFileSync(path.join(ROOT, 'scripts/cli/pl-publish-demo.js'), 'utf8');
  assert.ok(src.includes('editThreadMessage'),
    'pl-publish-demo must call editThreadMessage');
  assert.ok(src.match(/discord_stage_message_ids/),
    'pl-publish-demo must read entity.discord_stage_message_ids');
});

// ─── T5 · Stage 6 message post path persists message_id ─────────────
await ta('run-audit-pipeline.js persists Stage 6 message_id to entity', async () => {
  const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
  const src = fs.readFileSync(path.join(ROOT, 'scripts/leads/run-audit-pipeline.js'), 'utf8');
  // After stage4Message post · code should capture and persist message_id
  assert.ok(src.match(/discord_stage_message_ids/),
    'run-audit-pipeline must persist Stage 6 message_id under discord_stage_message_ids');
});

await ta('pl-build-from-reference.js persists Stage 8 message_id to entity', async () => {
  const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
  const src = fs.readFileSync(path.join(ROOT, 'scripts/cli/pl-build-from-reference.js'), 'utf8');
  assert.ok(src.match(/discord_stage_message_ids/),
    'pl-build-from-reference must persist Stage 8 message_id');
});

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed === 0 ? 0 : 1);
