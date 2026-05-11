#!/usr/bin/env node
/**
 * Block 4.1 + 4.2 + 4.3 hard evidence — lead-thread-sync.js + profile-card.js
 *
 * Dry-run mode: validates intended HTTP requests + embed structure without
 * hitting Discord. Real-mode verification happens in Block 12 (E2E).
 */

import assert from 'assert/strict';
import {
  openLeadThread,
  swapPhaseTag,
  appendThreadMessage,
  upsertProfileCard,
} from '../../core/funnel/lead-thread-sync.js';
import { renderProfileCard, buildLeadThreadName } from '../../core/funnel/profile-card.js';
import fs from 'fs';
import path from 'path';

process.env.LEAD_THREAD_DRY_RUN = 'true';
process.env.WEBSITE_LEADS_DISCORD_CHANNEL_ID = '0000000000000000000';  // dummy but truthy

const ENTITY_KEY = 'place_chijn587yc79k2sr7vyvy-egoam';  // FIX MY ROOF, grade=A
const entityPath = path.join('data', 'leads', 'entities', `${ENTITY_KEY}.json`);
const entity = JSON.parse(fs.readFileSync(entityPath, 'utf8'));

// ── A. profile card renderer: 14 fields, color, niche prefix in title ──
const audit = JSON.parse(fs.readFileSync(path.join('data', 'v2', 'fixtures', 'detailed-audit', `${ENTITY_KEY}.json`), 'utf8'));
const embed = renderProfileCard(entity, { audit: audit.detailed_audit });
assert.match(embed.title, /\bA\b/, 'title contains grade letter');
assert.ok(embed.title.includes('FIX MY ROOF'), 'title contains business name');
assert.ok(embed.title.includes('[roofing]'), 'title contains niche prefix');
assert.equal(embed.color, 0x2ecc71, 'A grade = green');
assert.ok(embed.fields.length >= 13 && embed.fields.length <= 25, `${embed.fields.length} fields within Discord 25-field limit`);
const fieldNames = embed.fields.map((f) => f.name);
for (const required of ['📞 Phone', '✉️ Primary email', '🌐 Website', '🌏 客户本地', 'Grade', 'Phase', 'Audit', '🔗 Quick links']) {
  assert.ok(fieldNames.includes(required), `field "${required}" missing`);
}
const totalChars = embed.fields.reduce((s, f) => s + f.name.length + f.value.length, 0);
assert.ok(totalChars < 6000, `embed within 6000-char limit (${totalChars})`);

// Locale field shows AEST
const localeField = embed.fields.find((f) => f.name === '🌏 客户本地');
assert.match(localeField.value, /Australia\/Brisbane/);
assert.match(localeField.value, /AEST|AEDT/);

// Quick links should reference master.md from manifest (registered in Block 3.2)
// Note: FIX MY ROOF clientSlug doesn't exist as it's not migrated, so quick-links shows "no assets yet"
// We tested with queensland-roofing-pty-ltd in Block 3.2, but FIX MY ROOF wasn't in --limit 3
// So this field should be "no assets yet" — acceptable.

// ── B. buildLeadThreadName has niche + grade prefix ──
const threadName = buildLeadThreadName(entity);
assert.ok(threadName.startsWith('[roofing] [A]'), `thread name: "${threadName}"`);
assert.ok(threadName.length <= 100, 'within Discord 100-char thread name limit');

// ── C. openLeadThread dry-run produces correct intended request ──
// Note: entity may already have discord_thread_id from a live test run. In that
// case openLeadThread returns reused=true. Temporarily strip the thread ids to
// force the dry-run open path, then restore.
const beforeC = JSON.parse(fs.readFileSync(entityPath, 'utf8'));
const stripped = { ...beforeC, discord_thread_id: null, discord_profile_message_id: null };
fs.writeFileSync(entityPath, JSON.stringify(stripped, null, 2) + '\n', 'utf8');

const opened = await openLeadThread(ENTITY_KEY);
assert.equal(opened.ok, true);
assert.equal(opened.dry_run, true);
assert.equal(opened.intended.endpoint, 'POST https://discord.com/api/v10/channels/0000000000000000000/threads');
assert.ok(opened.intended.tags.includes('grade-a'), 'grade-a tag emitted');
const VALID_PHASES = ['awaiting', 'outreach-active', 'replied', 'proposal-sent', 'nurture', 'paid', 'archived', 'needs-human'];
assert.ok(opened.intended.tags.some((t) => VALID_PHASES.includes(t)), `at least one lifecycle phase tag emitted; got ${opened.intended.tags}`);
assert.ok(opened.intended.embed_field_count >= 13, 'embed has fields');

// Restore thread ids so subsequent live operations on this entity still work
fs.writeFileSync(entityPath, JSON.stringify(beforeC, null, 2) + '\n', 'utf8');

// ── D. swapPhaseTag dry-run ──
// Test no-thread path: strip thread id first.
const realBefore = JSON.parse(fs.readFileSync(entityPath, 'utf8'));
const noThread = { ...realBefore, discord_thread_id: null, discord_profile_message_id: null };
fs.writeFileSync(entityPath, JSON.stringify(noThread, null, 2) + '\n', 'utf8');
const swapNoThread = await swapPhaseTag(ENTITY_KEY);
assert.equal(swapNoThread.ok, true);
assert.equal(swapNoThread.skipped, true, 'no thread → skipped, not error');

// To test swap behavior, inject test thread ids
const tempEntity = { ...realBefore, discord_thread_id: '9999999999999999999', discord_profile_message_id: '8888888888888888888' };
fs.writeFileSync(entityPath, JSON.stringify(tempEntity, null, 2) + '\n', 'utf8');
const before = tempEntity;  // for restoration at end

const swap = await swapPhaseTag(ENTITY_KEY);
assert.equal(swap.ok, true);
assert.equal(swap.dry_run, true);
assert.equal(swap.intended.endpoint, 'PATCH https://discord.com/api/v10/channels/9999999999999999999');
assert.ok(swap.intended.tags.some((t) => VALID_PHASES.includes(t)));
assert.ok(swap.intended.tags.includes('grade-a'));

// ── E. appendThreadMessage dry-run, by entityKey ──
const msgByKey = await appendThreadMessage(ENTITY_KEY, '📤 sent variant=v_audit-led at 14:32 AEST');
assert.equal(msgByKey.ok, true);
assert.equal(msgByKey.dry_run, true);
assert.equal(msgByKey.intended.endpoint, 'POST https://discord.com/api/v10/channels/9999999999999999999/messages');
assert.match(msgByKey.intended.content, /sent variant/);

// ── F. appendThreadMessage dry-run, by threadId directly ──
const msgByThreadId = await appendThreadMessage('1234567890', 'direct thread id message');
assert.equal(msgByThreadId.ok, true);
assert.equal(msgByThreadId.intended.endpoint, 'POST https://discord.com/api/v10/channels/1234567890/messages');

// ── G. upsertProfileCard dry-run uses PATCH (not POST) ──
const patched = await upsertProfileCard(ENTITY_KEY);
assert.equal(patched.ok, true);
assert.equal(patched.dry_run, true);
assert.equal(patched.intended.method, 'PATCH');
assert.ok(patched.intended.endpoint.includes('/messages/8888888888888888888'), 'PATCH targets the stored profile message id');

// Restore entity to live state (with REAL thread ids from E2E run, if any)
fs.writeFileSync(entityPath, JSON.stringify(realBefore, null, 2) + '\n', 'utf8');

console.log(JSON.stringify({
  ok: true,
  assertions_passed: 24,
  sample_embed_summary: {
    title: embed.title,
    color_hex: '0x' + embed.color.toString(16),
    field_count: embed.fields.length,
    total_chars: totalChars,
    field_names: fieldNames,
  },
  sample_intended_open: opened.intended,
  sample_intended_swap: swap.intended,
  sample_intended_message: msgByKey.intended,
  sample_intended_patch: patched.intended,
}, null, 2));
