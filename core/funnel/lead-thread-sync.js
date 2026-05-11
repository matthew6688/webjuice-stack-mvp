/**
 * V2 lead thread sync — opens forum posts for graded A/B leads + maintains
 * tag state + appends event messages + edits the pinned profile card in place.
 *
 * DISCORD_OUTREACH_PRD.md §8 (profile card), §9.3 (state hook).
 *
 * All HTTP calls go through fetch. Set env `LEAD_THREAD_DRY_RUN=true` to log
 * intended requests instead of making them — used by tests + dev probing.
 */

import fs from 'fs';
import path from 'path';
import {
  defaultDiscordForumBlueprints,
  syncDiscordForumTags,
  updateDiscordThread,
} from './discord.js';
import { renderProfileCard, buildLeadThreadName } from './profile-card.js';
import { readDetailedAudit } from './lead-thread-helpers.js';

const DISCORD_API = 'https://discord.com/api/v10';
const ENTITIES_DIR = path.join('data', 'leads', 'entities');

function isDryRun() {
  return String(process.env.LEAD_THREAD_DRY_RUN || '').toLowerCase() === 'true';
}

function botToken() {
  return process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN || '';
}

function leadsChannelId() {
  return process.env.WEBSITE_LEADS_DISCORD_CHANNEL_ID || '';
}

function readEntity(entityKey) {
  const p = path.join(ENTITIES_DIR, `${entityKey}.json`);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeEntity(entity) {
  const p = path.join(ENTITIES_DIR, `${entity.entityKey}.json`);
  fs.writeFileSync(p, JSON.stringify(entity, null, 2) + '\n', 'utf8');
}

// Phase tag is mutually-exclusive within {awaiting, outreach-active, replied,
// proposal-sent, nurture, paid, archived, needs-human}. Grade and modifier tags
// are layered on top.
const PHASE_TAGS = new Set([
  'awaiting', 'outreach-active', 'replied', 'proposal-sent',
  'nurture', 'paid', 'archived', 'needs-human',
]);

function tagsForEntity(entity) {
  const tags = [];
  const phase = entity.phase || 'awaiting';
  if (PHASE_TAGS.has(phase)) tags.push(phase);
  const level = entity.grade?.investment_level;
  if (level === 'A') tags.push('grade-a');
  else if (level === 'B') tags.push('grade-b');
  else if (level === 'C') tags.push('grade-c');
  if (entity.do_not_contact) tags.push('do-not-contact');
  if (entity.nurture_due_at && new Date(entity.nurture_due_at) <= new Date()) tags.push('nurture-due');
  if (entity.urgent) tags.push('urgent');
  return tags;
}

async function resolveTagIds(tagNames, { fetchImpl = fetch } = {}) {
  const channelId = leadsChannelId();
  if (!channelId || !botToken()) return [];
  const blueprints = defaultDiscordForumBlueprints();
  const config = await syncDiscordForumTags({
    channelId,
    botToken: botToken(),
    tags: blueprints.leads || [],
    fetchImpl,
  });
  return tagNames.map((n) => config.tagsByName[n]).filter(Boolean);
}

/**
 * Open a new forum post for a graded entity. Writes thread id + initial message id
 * back to entity. Idempotent: if entity.discord_thread_id already set, returns it.
 */
export async function openLeadThread(entityKey, { fetchImpl = fetch } = {}) {
  const entity = readEntity(entityKey);
  if (!entity) return { ok: false, reason: 'entity_not_found', entityKey };
  if (entity.discord_thread_id) {
    return { ok: true, reused: true, threadId: entity.discord_thread_id, messageId: entity.discord_profile_message_id || null };
  }
  const channelId = leadsChannelId();
  if (!channelId) return { ok: false, reason: 'WEBSITE_LEADS_DISCORD_CHANNEL_ID not set' };

  const audit = readDetailedAudit(entityKey)?.detailed_audit || null;
  const embed = renderProfileCard(entity, { audit });
  const threadName = buildLeadThreadName(entity);
  const tags = tagsForEntity(entity);

  if (isDryRun()) {
    return {
      ok: true,
      dry_run: true,
      intended: {
        endpoint: `POST ${DISCORD_API}/channels/${channelId}/threads`,
        threadName,
        tags,
        embed_field_count: embed.fields.length,
        embed_title: embed.title,
      },
    };
  }

  const tagIds = await resolveTagIds(tags, { fetchImpl });
  const response = await fetchImpl(`${DISCORD_API}/channels/${channelId}/threads`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${botToken()}`,
      'Content-Type': 'application/json',
      'User-Agent': 'profitslocal-lead-thread-sync',
    },
    body: JSON.stringify({
      name: threadName,
      auto_archive_duration: 10080,
      applied_tags: tagIds,
      message: { embeds: [embed] },
    }),
  });
  const text = await response.text();
  if (!response.ok) return { ok: false, reason: `discord_${response.status}`, body: text };
  const data = JSON.parse(text);
  const threadId = String(data.id || '');
  const messageId = String(data.last_message_id || '');

  // Write back to entity (read-merge-write to preserve other writers' fields)
  const fresh = readEntity(entityKey);
  fresh.discord_thread_id = threadId;
  fresh.discord_profile_message_id = messageId;
  fresh.discord_thread_opened_at = new Date().toISOString();
  writeEntity(fresh);

  return { ok: true, threadId, messageId, threadName, tags };
}

/**
 * Recompute tag set from current entity state, send PATCH /channels/{thread}
 * to swap applied_tags. Called by setEntityPhase hook.
 */
export async function swapPhaseTag(entityKey, { fetchImpl = fetch } = {}) {
  const entity = readEntity(entityKey);
  if (!entity) return { ok: false, reason: 'entity_not_found' };
  if (!entity.discord_thread_id) return { ok: true, skipped: true, reason: 'no_thread' };
  const tags = tagsForEntity(entity);
  if (isDryRun()) {
    return {
      ok: true,
      dry_run: true,
      intended: {
        endpoint: `PATCH ${DISCORD_API}/channels/${entity.discord_thread_id}`,
        tags,
      },
    };
  }
  const tagIds = await resolveTagIds(tags, { fetchImpl });
  const result = await updateDiscordThread({
    threadId: entity.discord_thread_id,
    botToken: botToken(),
    appliedTagIds: tagIds,
    fetchImpl,
  });
  return { ok: result.ok !== false, tags, threadId: entity.discord_thread_id };
}

/**
 * Append a text message to a lead thread.
 */
export async function appendThreadMessage(entityKeyOrThreadId, content, { fetchImpl = fetch } = {}) {
  let threadId = entityKeyOrThreadId;
  if (entityKeyOrThreadId && !/^\d+$/.test(entityKeyOrThreadId)) {
    const entity = readEntity(entityKeyOrThreadId);
    if (!entity?.discord_thread_id) return { ok: false, reason: 'no_thread' };
    threadId = entity.discord_thread_id;
  }
  if (isDryRun()) {
    return {
      ok: true,
      dry_run: true,
      intended: {
        endpoint: `POST ${DISCORD_API}/channels/${threadId}/messages`,
        content: String(content).slice(0, 200),
      },
    };
  }
  const response = await fetchImpl(`${DISCORD_API}/channels/${threadId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${botToken()}`,
      'Content-Type': 'application/json',
      'User-Agent': 'profitslocal-lead-thread-sync',
    },
    body: JSON.stringify({ content: String(content).slice(0, 2000) }),
  });
  const text = await response.text();
  if (!response.ok) return { ok: false, reason: `discord_${response.status}`, body: text };
  const data = JSON.parse(text);
  return { ok: true, messageId: String(data.id || ''), threadId };
}

/**
 * Edit the pinned profile card in place. Uses Discord PATCH on the message.
 */
export async function upsertProfileCard(entityKey, { fetchImpl = fetch } = {}) {
  const entity = readEntity(entityKey);
  if (!entity) return { ok: false, reason: 'entity_not_found' };
  if (!entity.discord_thread_id || !entity.discord_profile_message_id) {
    return { ok: false, reason: 'no_thread_or_no_message' };
  }
  const audit = readDetailedAudit(entityKey)?.detailed_audit || null;
  const embed = renderProfileCard(entity, { audit });

  if (isDryRun()) {
    return {
      ok: true,
      dry_run: true,
      intended: {
        endpoint: `PATCH ${DISCORD_API}/channels/${entity.discord_thread_id}/messages/${entity.discord_profile_message_id}`,
        method: 'PATCH',
        embed_field_count: embed.fields.length,
        embed_title: embed.title,
      },
    };
  }

  const response = await fetchImpl(`${DISCORD_API}/channels/${entity.discord_thread_id}/messages/${entity.discord_profile_message_id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bot ${botToken()}`,
      'Content-Type': 'application/json',
      'User-Agent': 'profitslocal-lead-thread-sync',
    },
    body: JSON.stringify({ embeds: [embed] }),
  });
  const text = await response.text();
  if (!response.ok) return { ok: false, reason: `discord_${response.status}`, body: text };
  return { ok: true, threadId: entity.discord_thread_id, messageId: entity.discord_profile_message_id };
}
