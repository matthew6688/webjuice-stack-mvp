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
      if (cur.ok) {
        const data = await cur.json();
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
      return { ok: true, threadId, title: newTitle };
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
    body: JSON.stringify({ archived: true, locked: true }),
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
