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

// V3 D34 (2026-05-14): #website-projects channel
function projectsChannelId() {
  return process.env.WEBSITE_PROJECTS_DISCORD_CHANNEL_ID || '';
}

// V3 D40 (2026-05-14): bot-log channel · fallback when no thread exists
const BOT_LOG_CHANNEL_ID = '1493926218574200942';
function botLogChannelId() {
  return process.env.BOT_LOG_DISCORD_CHANNEL_ID || BOT_LOG_CHANNEL_ID;
}

async function sendBotLogFallback(entityKey, message, fetchImpl = fetch) {
  const channelId = botLogChannelId();
  if (!channelId || !botToken()) return { ok: false, reason: 'no_botlog_channel_or_token' };
  try {
    const content = `[no thread fallback · entity \`${entityKey}\`]\n${message}`.slice(0, 2000);
    const r = await fetchImpl(`${DISCORD_API}/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${botToken()}`,
        'Content-Type': 'application/json',
        'User-Agent': 'profitslocal-bot-log-fallback',
      },
      body: JSON.stringify({ content }),
    });
    if (!r.ok) return { ok: false, reason: `discord_${r.status}` };
    return { ok: true, fallback: 'bot-log', channel: channelId };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
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
  // C 类不自动开 per-lead thread (USP design: 批量轻触 + 回复后手动晋升)。
  // 这里的 grade-c tag 服务"C lead 回复表达意向 → 操作员手动开 thread"场景，
  // 标记原始 grade 提醒销售这是 USP 三分支的反向预制路径。详见 SOP-2 §4.1。
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

// V3 D34: resolve tag IDs for #website-projects channel
async function resolveProjectsTagIds(tagNames, { fetchImpl = fetch } = {}) {
  const channelId = projectsChannelId();
  if (!channelId || !botToken()) return [];
  const blueprints = defaultDiscordForumBlueprints();
  const config = await syncDiscordForumTags({
    channelId,
    botToken: botToken(),
    tags: blueprints.projects || [],
    fetchImpl,
  });
  return tagNames.map((n) => config.tagsByName[n]).filter(Boolean);
}

// V3 D34: compute tag set for projects channel (different from leads)
function tagsForProjectsThread(entity) {
  const tags = [];
  const level = entity.grade?.investment_level || entity.scoring?.grade;
  if (level === 'A') tags.push('grade-a');
  else if (level === 'B') tags.push('grade-b');
  else if (level === 'C') tags.push('grade-c');
  // Sales stage tag · default demo-ready (just opened)
  // Operator manually swaps to outreach-sent / interested / etc as sale progresses
  const stage = entity.sales_stage || 'demo-ready';
  if (['demo-ready', 'outreach-sent', 'client-reviewing', 'interested', 'proposal-sent',
       'closed-won', 'closed-lost', 'nurture'].includes(stage)) {
    tags.push(stage);
  }
  if (entity.urgent) tags.push('urgent');
  if (entity.waiting_customer) tags.push('waiting-customer');
  return tags;
}

/**
 * Open a new forum post for a graded entity. Writes thread id + initial message id
 * back to entity. Idempotent: if entity.discord_thread_id already set, returns it.
 */
export async function openLeadThread(entityKey, { fetchImpl = fetch } = {}) {
  const entity = readEntity(entityKey);
  if (!entity) return { ok: false, reason: 'entity_not_found', entityKey };
  // V3 D43 cycle-4 · 防御：predict-D 不开 thread (#website-leads 不污染)
  // V3 D43 cycle-19 (Matthew 2026-05-15): REMOVED phase=archived check ·
  // operator 手动 re-audit archived entity 时这条会挡 openLeadThread · 导致
  // run-audit-pipeline 的 stage messages 全 fall back 到 bot-log。
  // 现状 · 只 predict-D (从未 audit · 明确不该有 thread) 才挡。
  if (entity.predict_grade?.grade === 'D') {
    return { ok: false, reason: 'predict_d_skip', entityKey };
  }
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
  // V3 D43 · Discord 限 50 threads/10min per guild · 429 时 honor Retry-After
  let response, text;
  for (let attempt = 0; attempt < 4; attempt++) {
    response = await fetchImpl(`${DISCORD_API}/channels/${channelId}/threads`, {
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
    text = await response.text();
    if (response.status !== 429) break;
    const m = text.match(/"retry_after":\s*([0-9.]+)/);
    const retrySec = m ? Math.min(parseFloat(m[1]), 200) : 30;
    await new Promise((r) => setTimeout(r, (retrySec + 1) * 1000));
  }
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
/**
 * cycle-27 (Matthew 2026-05-15 "保留之前的 stage 信息"):
 * Replay bot-posted history from a lead thread into a newly-opened project
 * thread. Called at graduate · so #website-projects thread becomes self-
 * contained · operator sees full 9-stage timeline · not just Stage 9.
 *
 * - Paginates Discord GET /messages (oldest-first via sort + before-cursor)
 * - Filters: bot-authored + content present (skip embed-only / operator msgs)
 * - Posts each in original order · throttled to avoid 429
 *
 * @returns { ok, total, posted, skipped, reason? }
 */
export async function copyLeadHistoryToProjectThread(leadThreadId, projectThreadId, {
  fetchImpl = fetch, throttleMs = 200, maxMessages = 200,
} = {}) {
  if (!leadThreadId || !projectThreadId) return { ok: false, reason: 'missing_thread_id' };
  if (isDryRun()) return { ok: true, dry_run: true, total: 0, posted: 0, skipped: 0 };

  // Fetch all (paginated)
  const all = [];
  let beforeId = null;
  for (let page = 0; page < 4 && all.length < maxMessages; page++) {
    const url = `${DISCORD_API}/channels/${leadThreadId}/messages?limit=100${beforeId ? `&before=${beforeId}` : ''}`;
    let resp;
    try {
      resp = await fetchImpl(url, { headers: { Authorization: `Bot ${botToken()}` } });
    } catch (err) {
      return { ok: false, reason: `fetch_threw: ${err.message}` };
    }
    if (!resp.ok) return { ok: false, reason: `fetch_${resp.status}` };
    const batch = await resp.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    all.push(...batch);
    if (batch.length < 100) break;
    beforeId = batch[batch.length - 1].id;
  }

  // Discord returns newest-first · sort by id ascending = oldest-first
  all.sort((a, b) => {
    try { return BigInt(a.id) < BigInt(b.id) ? -1 : 1; }
    catch { return String(a.id).localeCompare(String(b.id)); }
  });

  let posted = 0;
  let skipped = 0;
  for (const m of all) {
    // Filter: bot-authored + has text content
    if (!m.author?.bot || !m.content) { skipped++; continue; }
    try {
      const postResp = await fetchImpl(`${DISCORD_API}/channels/${projectThreadId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bot ${botToken()}`,
          'Content-Type': 'application/json',
          'User-Agent': 'profitslocal-lead-thread-sync',
        },
        body: JSON.stringify({ content: String(m.content).slice(0, 2000) }),
      });
      if (postResp.ok) posted++;
      else skipped++;
    } catch {
      skipped++;
    }
    if (throttleMs > 0) await new Promise((r) => setTimeout(r, throttleMs));
  }
  return { ok: true, total: all.length, posted, skipped };
}

/**
 * cycle-27 Phase 5 (Matthew 2026-05-15): edit an existing message in a thread.
 * Used for retro-edit at Stage 9 publish · adds live URLs into the
 * previously-posted Stage 6 + Stage 8 messages.
 *
 * Uses Discord PATCH /channels/<channelId>/messages/<messageId>.
 *
 * @param {string} threadId · numeric thread id (where the message lives)
 * @param {string} messageId · numeric message id to edit
 * @param {string} content · new message body
 */
export async function editThreadMessage(threadId, messageId, content, { fetchImpl = fetch } = {}) {
  if (!threadId || !messageId) return { ok: false, reason: 'missing_threadId_or_messageId' };
  if (isDryRun()) {
    return { ok: true, dry_run: true, intended: {
      endpoint: `PATCH ${DISCORD_API}/channels/${threadId}/messages/${messageId}`,
      content: String(content).slice(0, 200),
    } };
  }
  const r = await fetchImpl(`${DISCORD_API}/channels/${threadId}/messages/${messageId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bot ${botToken()}`,
      'Content-Type': 'application/json',
      'User-Agent': 'profitslocal-lead-thread-sync',
    },
    body: JSON.stringify({ content: String(content).slice(0, 2000) }),
  });
  const text = await r.text();
  if (!r.ok) {
    if (r.status === 404) return { ok: false, reason: 'discord_404_message_not_found', threadId, messageId };
    if (r.status === 403) return { ok: false, reason: 'discord_403_forbidden', threadId, messageId };
    return { ok: false, reason: `discord_${r.status}`, threadId, messageId, body: text };
  }
  return { ok: true, threadId, messageId };
}

export async function appendThreadMessage(entityKeyOrThreadId, content, { fetchImpl = fetch, force = false } = {}) {
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
  // cycle-26 P5 · guard: skip POST to archived thread (Discord auto-unarchives on POST · breaks "1 entity = 1 visible thread")
  if (!force) {
    try {
      const cr = await fetchImpl(`${DISCORD_API}/channels/${threadId}`, {
        headers: { Authorization: `Bot ${botToken()}` },
      });
      if (cr.status === 404) return { ok: false, skipped: 'thread_not_found', threadId };
      if (cr.ok) {
        const cd = await cr.json();
        if (cd.thread_metadata?.archived) {
          return { ok: true, skipped: 'archived', threadId };
        }
      }
    } catch { /* check best-effort · fall through to POST */ }
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
// cycle-26: retry + verify-after-PATCH defense for profile-card invariant
// "card 永远实时 + 跟 entity 状态一致".
async function sleep(ms) { return new Promise((r) => setTimeout(r, Math.max(0, ms))); }

function getRetryAfterMs(response) {
  try {
    const v = response?.headers?.get?.('retry-after');
    if (!v) return 1000;
    const n = parseFloat(v);
    return isNaN(n) ? 1000 : Math.max(50, n * 1000);
  } catch { return 1000; }
}

function hashEmbed(embed) {
  // Lightweight content hash for drift detection (title + description prefix)
  if (!embed) return null;
  const desc = String(embed.description || '');
  return `${embed.title || ''}|${desc.length}|${desc.slice(0, 200)}`;
}

export async function upsertProfileCard(entityKey, { fetchImpl = fetch, _attempt = 0 } = {}) {
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
        embed_field_count: embed.fields?.length || 0,
        embed_title: embed.title,
      },
    };
  }

  const url = `${DISCORD_API}/channels/${entity.discord_thread_id}/messages/${entity.discord_profile_message_id}`;
  const body = JSON.stringify({ embeds: [embed] });
  const headers = {
    Authorization: `Bot ${botToken()}`,
    'Content-Type': 'application/json',
    'User-Agent': 'profitslocal-lead-thread-sync',
  };

  // ── Retry loop · 429 (Retry-After) + 5xx (exponential backoff) · max 3 attempts
  let response = null;
  let retried_429 = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    response = await fetchImpl(url, { method: 'PATCH', headers, body });
    if (response.ok) break;
    const status = response.status;
    if (status === 429) {
      retried_429 = true;
      await sleep(getRetryAfterMs(response));
      continue;
    }
    if (status >= 500 && status < 600) {
      // Exponential backoff: 100ms · 400ms · 1.6s
      await sleep(100 * (4 ** attempt));
      continue;
    }
    // Other 4xx (404 dead thread · 403 perm) · no retry
    break;
  }
  const text = response?.text ? await response.text() : '';
  if (!response.ok) {
    return { ok: false, reason: `discord_${response.status}`, body: text, retried_429 };
  }

  // ── Verify-after-PATCH: fetch back, compare hash
  let verified = false;
  let drift = false;
  try {
    const verifyRes = await fetchImpl(url, { headers, method: 'GET' });
    if (verifyRes?.ok) {
      const data = await verifyRes.json();
      const actualEmbed = data?.embeds?.[0];
      if (hashEmbed(actualEmbed) === hashEmbed(embed)) {
        verified = true;
      } else {
        drift = true;
        // Retry once (avoid infinite recursion via _attempt)
        if (_attempt < 1) {
          return upsertProfileCard(entityKey, { fetchImpl, _attempt: _attempt + 1 });
        }
      }
    }
  } catch { /* verify is best-effort */ }

  return {
    ok: true,
    threadId: entity.discord_thread_id,
    messageId: entity.discord_profile_message_id,
    verified,
    drift,
    retried_429,
  };
}

/**
 * V3 D34 (2026-05-14): Open a new forum post in #website-projects for an entity
 * that has a live demo URL. Idempotent: if entity.project_thread_id already set, returns it.
 *
 * This is called by pl:publish-demo hook + pl:migrate-to-projects-channel script.
 */
export async function openProjectThread(entityKey, { fetchImpl = fetch } = {}) {
  const entity = readEntity(entityKey);
  if (!entity) return { ok: false, reason: 'entity_not_found', entityKey };
  if (entity.project_thread_id) {
    return { ok: true, reused: true, threadId: entity.project_thread_id, messageId: entity.project_profile_message_id || null };
  }
  const channelId = projectsChannelId();
  if (!channelId) return { ok: false, reason: 'WEBSITE_PROJECTS_DISCORD_CHANNEL_ID not set' };

  const audit = readDetailedAudit(entityKey)?.detailed_audit || null;
  const embed = renderProfileCard(entity, { audit, channel: 'projects' });
  // V3 D43 cycle-21 (Matthew 2026-05-15): pass channel='projects' so default
  // stage label is 'demo-ready' (待发) · 不是 'build-pending' (待建)。
  // Bug 表现: #website-projects 4/5 thread 标题用了 leads 默认 [待建].
  const threadName = buildLeadThreadName(entity, 'projects');
  const tags = tagsForProjectsThread(entity);

  if (isDryRun()) {
    return {
      ok: true,
      dry_run: true,
      intended: {
        endpoint: `POST ${DISCORD_API}/channels/${channelId}/threads`,
        threadName,
        tags,
        channel: 'projects',
        embed_field_count: embed.fields.length,
        embed_title: embed.title,
      },
    };
  }

  const tagIds = await resolveProjectsTagIds(tags, { fetchImpl });
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

  const fresh = readEntity(entityKey);
  fresh.project_thread_id = threadId;
  fresh.project_profile_message_id = messageId;
  fresh.project_thread_opened_at = new Date().toISOString();
  writeEntity(fresh);

  // V3 D35 (2026-05-14): PIN the profile card · 钉到 thread pin 栏方便快速跳转
  // Forum starter message is always at top (chronological) · but PIN adds it
  // to Discord's pin bar (📌) for one-click access from anywhere in thread.
  try {
    await fetchImpl(`${DISCORD_API}/channels/${threadId}/pins/${messageId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bot ${botToken()}`,
        'User-Agent': 'profitslocal-lead-thread-sync',
        'X-Audit-Log-Reason': 'pin profile card · V3 D35',
      },
    });
  } catch {
    // Pin failed · not blocking · profile card still visible as starter
  }

  return { ok: true, threadId, messageId, threadName, tags };
}

/**
 * V3 D43 cycle-5 (2026-05-14 · Matthew): Rename the entity's Discord thread title
 * to the current entity state. Used after grade lands to replace [?] with [A/B/C/D].
 *
 * Idempotent: skip if title already matches.
 */
export async function renameThreadToCurrentTitle(entityKey, { fetchImpl = fetch } = {}) {
  async function tryRename(threadId, channel) {
    const entity = readEntity(entityKey);
    if (!entity) return { ok: false, reason: 'entity_not_found' };
    const newTitle = buildLeadThreadName(entity, channel);
    if (isDryRun()) {
      return { ok: true, dry_run: true, intended: { endpoint: `PATCH ${DISCORD_API}/channels/${threadId}`, name: newTitle } };
    }
    try {
      const cur = await fetchImpl(`${DISCORD_API}/channels/${threadId}`, {
        headers: { Authorization: `Bot ${botToken()}`, 'User-Agent': 'profitslocal-lead-thread-sync' },
      });
      if (cur.status === 404) return { ok: false, dead: true };
      let oldTitle = null;
      if (cur.ok) {
        const data = await cur.json();
        oldTitle = data.name;
        if (data.name === newTitle) return { ok: true, unchanged: true, threadId, title: newTitle };
      }
      const r = await fetchImpl(`${DISCORD_API}/channels/${threadId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bot ${botToken()}`,
          'Content-Type': 'application/json',
          'User-Agent': 'profitslocal-lead-thread-sync',
        },
        body: JSON.stringify({ name: newTitle }),
      });
      if (r.status === 404) return { ok: false, dead: true };
      if (!r.ok) {
        const t = await r.text();
        return { ok: false, reason: `discord_${r.status}`, body: t };
      }
      // cycle-26: post title change record into thread (so history is in-thread, not just in Discord system events).
      if (oldTitle && oldTitle !== newTitle) {
        try {
          await fetchImpl(`${DISCORD_API}/channels/${threadId}/messages`, {
            method: 'POST',
            headers: {
              Authorization: `Bot ${botToken()}`,
              'Content-Type': 'application/json',
              'User-Agent': 'profitslocal-lead-thread-sync',
            },
            body: JSON.stringify({ content: `🔖 标题更改\n旧: \`${oldTitle}\`\n新: \`${newTitle}\`` }),
          });
        } catch { /* non-blocking */ }
      }
      return { ok: true, threadId, title: newTitle, oldTitle };
    } catch (err) {
      return { ok: false, reason: err.message };
    }
  }

  // V3 D43 cycle-5: try projects first; if dead, clear + try leads
  const e0 = readEntity(entityKey);
  if (!e0) return { ok: false, reason: 'entity_not_found' };

  if (e0.project_thread_id) {
    const r = await tryRename(e0.project_thread_id, 'projects');
    if (r.ok || r.unchanged) return r;
    if (r.dead) {
      try {
        const p = path.join(ENTITIES_DIR, `${entityKey}.json`);
        const fresh = JSON.parse(fs.readFileSync(p, 'utf8'));
        fresh.project_thread_id = null;
        fresh.project_thread_id_cleared_at = new Date().toISOString();
        fs.writeFileSync(p, JSON.stringify(fresh, null, 2) + '\n');
        console.error(`[lead-thread-sync] rename: cleared dead project_thread_id from ${entityKey}`);
      } catch { /* best-effort */ }
    }
  }

  const e1 = readEntity(entityKey);
  if (e1.discord_thread_id) {
    return await tryRename(e1.discord_thread_id, 'leads');
  }
  return { ok: false, reason: 'no_thread_id' };
}

/**
 * V3 D34 (2026-05-14): Archive + lock a thread.
 * Posts a final "closed" message, then PATCHes archived=true + locked=true.
 * Idempotent.
 */
export async function archiveAndLockThread(threadId, { reason = '', fetchImpl = fetch } = {}) {
  if (!threadId) return { ok: false, reason: 'no_thread_id' };
  if (isDryRun()) {
    return {
      ok: true,
      dry_run: true,
      intended: {
        endpoint: `PATCH ${DISCORD_API}/channels/${threadId}`,
        body: { archived: true, locked: true, reason },
      },
    };
  }
  // Optional: post closing message before archive
  if (reason) {
    try {
      await fetchImpl(`${DISCORD_API}/channels/${threadId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bot ${botToken()}`,
          'Content-Type': 'application/json',
          'User-Agent': 'profitslocal-lead-thread-sync',
        },
        body: JSON.stringify({ content: `🗄 Thread archived · ${reason}` }),
      });
    } catch { /* non-blocking */ }
  }
  // PATCH archived + locked (Discord API · same endpoint as updateDiscordThread)
  const response = await fetchImpl(`${DISCORD_API}/channels/${threadId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bot ${botToken()}`,
      'Content-Type': 'application/json',
      'User-Agent': 'profitslocal-lead-thread-sync',
    },
    // cycle-26 P9: add auto_archive_duration so Discord respects archive flag for forum threads
    // (without this · POST to thread after archive auto-unarchives · zombie thread)
    body: JSON.stringify({ archived: true, locked: true, auto_archive_duration: 60 }),
  });
  const text = await response.text();
  if (!response.ok) return { ok: false, reason: `discord_${response.status}`, body: text };
  return { ok: true, threadId, archived: true, locked: true };
}

/**
 * V3 D35 · refreshThreadAndPost · 5 hook 用的统一接口.
 *
 * Auto-detects which channel an entity is in (project_thread_id 或 discord_thread_id),
 * refreshes the profile card (upsert), and appends an update message.
 *
 * Fire-and-forget · try/catch · errors 返回 ok:false 不 throw · 不阻塞主链.
 *
 * @param {string} entityKey
 * @param {string} message — Discord thread message content (markdown OK · max 2000 chars)
 * @param {object} [opts]
 * @param {boolean} [opts.skipCard=false] — 跳过 profile card 刷新 (transient ack)
 * @param {boolean} [opts.skipMessage=false] — 只刷新 card · 不发消息
 */
export async function refreshThreadAndPost(entityKey, message, { skipCard = false, skipMessage = false } = {}) {
  try {
    const entity = readEntity(entityKey);
    if (!entity) return { ok: false, reason: 'entity_not_found' };

    const results = { card: null, msg: null, channel: null };

    // V3 D43 cycle-5 (Matthew 2026-05-14): try projects first; if 404 (thread
    // deleted upstream), CLEAR stale id + retry in leads. Stale project_thread_id
    // was silently swallowing all 5 stage messages.
    async function tryPost(threadId, channelLabel) {
      const r = await appendThreadMessage(threadId, message);
      if (r.ok) return { ok: true, msg: r, channel: channelLabel };
      // Discord channel-not-found → return signal so caller can fall back
      if (r.reason === 'discord_404') return { ok: false, dead: true, msg: r, channel: channelLabel };
      return { ok: false, msg: r, channel: channelLabel };
    }

    function clearStaleId(key) {
      try {
        const p = path.join(ENTITIES_DIR, `${entityKey}.json`);
        const fresh = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (fresh[key]) {
          fresh[key] = null;
          fresh[`${key}_cleared_at`] = new Date().toISOString();
          fs.writeFileSync(p, JSON.stringify(fresh, null, 2) + '\n');
          console.error(`[lead-thread-sync] cleared stale ${key} from ${entityKey} (was 404)`);
        }
      } catch { /* best-effort */ }
    }

    if (entity.project_thread_id) {
      if (!skipCard) results.card = await upsertProjectProfileCard(entityKey);
      if (!skipMessage && message) {
        const r = await tryPost(entity.project_thread_id, 'projects');
        if (r.ok) { results.msg = r.msg; results.channel = 'projects'; }
        else if (r.dead) {
          clearStaleId('project_thread_id');
          // Fall through to leads if available
          if (entity.discord_thread_id) {
            const r2 = await tryPost(entity.discord_thread_id, 'leads');
            if (r2.ok) { results.msg = r2.msg; results.channel = 'leads_after_projects_dead'; }
            else if (r2.dead) { clearStaleId('discord_thread_id'); results.msg = await sendBotLogFallback(entityKey, message); results.channel = 'bot-log-fallback-after-both-dead'; }
            else { results.msg = r2.msg; results.channel = 'leads_error_after_projects_dead'; }
          } else {
            results.msg = await sendBotLogFallback(entityKey, message);
            results.channel = 'bot-log-fallback-after-projects-dead';
          }
        } else { results.msg = r.msg; results.channel = 'projects_error'; }
      } else if (!skipCard) {
        results.channel = 'projects';
      }
    } else if (entity.discord_thread_id) {
      if (!skipCard) results.card = await upsertProfileCard(entityKey);
      if (!skipMessage && message) {
        const r = await tryPost(entity.discord_thread_id, 'leads');
        if (r.ok) { results.msg = r.msg; results.channel = 'leads'; }
        else if (r.dead) { clearStaleId('discord_thread_id'); results.msg = await sendBotLogFallback(entityKey, message); results.channel = 'bot-log-fallback-after-leads-dead'; }
        else { results.msg = r.msg; results.channel = 'leads_error'; }
      } else if (!skipCard) {
        results.channel = 'leads';
      }
    } else {
      // V3 D40 · 没 thread · fallback 发 bot-log channel
      results.channel = 'bot-log-fallback';
      if (!skipMessage && message) {
        results.msg = await sendBotLogFallback(entityKey, message);
      }
    }
    return { ok: true, ...results };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

/**
 * V3 D34: Edit projects thread's pinned profile card in place.
 * Like upsertProfileCard but for project_thread_id + channel='projects'.
 */
export async function upsertProjectProfileCard(entityKey, { fetchImpl = fetch } = {}) {
  const entity = readEntity(entityKey);
  if (!entity) return { ok: false, reason: 'entity_not_found' };
  if (!entity.project_thread_id || !entity.project_profile_message_id) {
    return { ok: false, reason: 'no_project_thread_or_message' };
  }
  const audit = readDetailedAudit(entityKey)?.detailed_audit || null;
  const embed = renderProfileCard(entity, { audit, channel: 'projects' });

  if (isDryRun()) {
    return {
      ok: true,
      dry_run: true,
      intended: {
        endpoint: `PATCH ${DISCORD_API}/channels/${entity.project_thread_id}/messages/${entity.project_profile_message_id}`,
        embed_field_count: embed.fields.length,
      },
    };
  }

  const response = await fetchImpl(`${DISCORD_API}/channels/${entity.project_thread_id}/messages/${entity.project_profile_message_id}`, {
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
  return { ok: true, threadId: entity.project_thread_id, messageId: entity.project_profile_message_id };
}
