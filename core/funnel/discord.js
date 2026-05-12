export function buildDiscordMessage({ kind, order, task = null }) {
  const isSale = kind === 'sale';
  const isPaidIntake = kind === 'paid_intake';
  const title = isSale
    ? `New website sale: ${order.company || order.clientSlug}`
    : isPaidIntake
      ? `Paid intake: ${order.company || order.clientSlug}`
    : `Revision request: ${order.company || order.clientSlug}`;
  const color = isSale ? 0x2ecc71 : isPaidIntake ? 0x3498db : 0xf1c40f;
  const fields = compactFields([
    field('Client', order.clientSlug, true),
    field('Repo', order.repo, true),
    field('Order ID', order.orderId, false),
    field('Tier', order.tier, true),
    field('Amount', order.amount ? `${order.currency || 'USD'} ${order.amount}` : '', true),
    field('Email', order.email, true),
    field('Domain', order.domain, true),
    field('Preview', order.previewUrl, false),
    field('Task', task?.taskPath || task?.id || '', false),
    field('Case', task?.case?.casePath || '', false),
    field('Feedback', order.feedback, false, 950),
    field('Reference', order.referenceUrl, false),
    field('Files', order.files?.join('\n'), false, 950),
  ]);

  return {
    username: isSale || isPaidIntake ? 'ProfitsLocal Sales' : 'ProfitsLocal Revisions',
    embeds: [{
      title,
      color,
      fields,
      timestamp: order.receivedAt || new Date().toISOString(),
    }],
  };
}

export function buildAgentReviewDiscordMessage({ caseFile, runResult, deployResult = null }) {
  const deployLabel = deployResult
    ? `${deployResult.status || 'unknown'}${deployResult.conclusion ? `/${deployResult.conclusion}` : ''}`
    : 'not checked';
  return {
    username: 'ProfitsLocal Agent',
    embeds: [{
      title: `Dev preview ready: ${caseFile.customer?.company || caseFile.clientSlug}`,
      color: runResult.ok ? 0x3498db : 0xe74c3c,
      fields: compactFields([
        field('Client', caseFile.clientSlug, true),
        field('Repo', caseFile.repo, true),
        field('Order ID', caseFile.order?.id, false),
        field('Task', runResult.taskId, false),
        field('Status', runResult.ok ? 'ready for customer review' : 'agent run failed', true),
        field('Deploy', deployLabel, true),
        field('Preview', runResult.previewUrl || caseFile.previewUrl, false),
        field('Commit', runResult.commit, false),
        field('Changed files', (runResult.changedFiles || []).join('\n'), false, 950),
      ]),
      timestamp: runResult.finishedAt || new Date().toISOString(),
    }],
  };
}

export function buildLivePublishedDiscordMessage({ caseFile, publishResult, deployResult = null, liveUrl = '' }) {
  const deployLabel = deployResult
    ? `${deployResult.status || 'unknown'}${deployResult.conclusion ? `/${deployResult.conclusion}` : ''}`
    : 'not checked';
  return {
    username: 'ProfitsLocal Publisher',
    embeds: [{
      title: `Live site published: ${caseFile.customer?.company || caseFile.clientSlug}`,
      color: publishResult.ok ? 0x2ecc71 : 0xe74c3c,
      fields: compactFields([
        field('Client', caseFile.clientSlug, true),
        field('Repo', caseFile.repo, true),
        field('Order ID', caseFile.order?.id, false),
        field('Status', publishResult.ok ? 'published to live' : 'publish failed', true),
        field('Deploy', deployLabel, true),
        field('Live URL', liveUrl || publishResult.liveUrl, false),
        field('Commit', publishResult.commit, false),
        field('Dev commit', publishResult.devCommit, false),
      ]),
      timestamp: publishResult.finishedAt || new Date().toISOString(),
    }],
  };
}

export function buildWebsiteAgentHandoffMessage({
  kind,
  order,
  task,
  caseRecord,
  mention = '',
  action = '',
}) {
  const casePath = caseRecord?.ref?.casePath || task?.case?.casePath || '';
  const contextPath = caseRecord?.ref?.contextPath || task?.case?.contextPath || '';
  const buildPacketPath = caseRecord?.ref?.buildPacketPath || task?.case?.buildPacketPath || task?.buildPacketPath || '';
  const taskPath = task?.taskPath || '';
  const openDesign = task?.openDesign || {};
  const executionMode = task?.executionMode || (kind === 'revision' ? 'local_open_design' : 'remote_artifact_runner');
  const defaultAction = executionMode === 'local_open_design'
    ? '这是一条 revision 设计任务：先在本地 Open Design 里继续同一个 project，确认 concept 文件更新，再 sync/build production handoff，port 到 Webjuice/Astro repo 的 dev，最后 build、QA、发新的 review。不要让 GitHub Actions 假装自动完成设计修改。'
    : '先阅读 build packet、website survey、case/context/task 文件，再决定如何开工。涉及视觉方案时，必须复用上面这个本地 Open Design project/dataDir，不要擅自新开一个项目。Open Design 有更新后，先 sync/build production handoff，再 port 到 Webjuice/Astro repo 的 dev。保持 website 和 menu 分离，只使用已验证的 evidence/design/brand 文件，所有面向客户的改动都只推到 dev。';
  const lines = [
    `${mention} ProfitsLocal 网站任务交接`,
    `kind: ${kind || task?.kind || ''}`,
    `client: ${order?.clientSlug || task?.clientSlug || ''}`,
    `repo: ${order?.repo || task?.repo || ''}`,
    `order: ${order?.orderId || task?.order?.id || ''}`,
    `preview: ${order?.previewUrl || task?.previewUrl || ''}`,
    `case: ${casePath}`,
    `context: ${contextPath}`,
    `buildPacket: ${buildPacketPath}`,
    `task: ${taskPath}`,
    `websiteSurvey: ${task?.requiredContext?.websiteSurvey || task?.websiteSurveyPath || ''}`,
    `evidence: ${task?.requiredContext?.evidence || task?.evidencePath || ''}`,
    `content: ${task?.requiredContext?.content || task?.contentPath || ''}`,
    `design: ${task?.requiredContext?.design || task?.designPath || ''}`,
    `brand: ${task?.requiredContext?.brandSpec || task?.brandSpecPath || ''}`,
    `openDesignStatus: ${openDesign.status || (openDesign.projectId ? 'bound' : 'not_created')}`,
    `openDesignProject: ${openDesign.projectId || ''}`,
    `openDesignDataDir: ${openDesign.dataDir || ''}`,
    `openDesignConcept: ${openDesign.conceptPath || ''}`,
    `openDesignManifest: ${openDesign.manifestPath || ''}`,
    `productionHandoff: ${task?.productionHandoffPath || openDesign.productionHandoffPath || ''}`,
    `openDesignContinue: ${openDesign.continueCommand || openDesign.createCommand || ''}`,
    `openDesignSync: ${openDesign.syncCommand || ''}`,
    `executionMode: ${executionMode}`,
    `repoBootstrap: ${task?.repoBootstrap?.command || ''}`,
    '',
    `Action: ${action || defaultAction}`,
  ].filter((line) => line !== null && line !== undefined);

  return {
    content: lines.join('\n').slice(0, 1900),
    allowed_mentions: mentionUserIds(mention).length
      ? { users: mentionUserIds(mention) }
      : { parse: [] },
  };
}

export function buildForumThreadName({ workspace = 'projects', kind = '', order = {}, caseFile = null, revision = null } = {}) {
  const company = order.company || order.businessName || caseFile?.customer?.company || order.clientSlug || caseFile?.clientSlug || 'Project';
  const prefix = workspace === 'leads'
    ? forumLeadPrefix(kind, order)
    : forumProjectPrefix(kind, revision, caseFile);
  return `${prefix} ${company}`.slice(0, 100);
}

export function desiredForumTagNames({ workspace = 'projects', kind = '', order = {}, caseFile = null, revision = null } = {}) {
  const niche = String(order.template || caseFile?.template || '').includes('roof')
    ? 'roofing'
    : 'restaurant';
  if (workspace === 'leads') {
    // V2 lead tag model: lifecycle phase + grade + modifier; niche moved to thread title prefix.
    // Per DISCORD_OUTREACH_PRD.md §7. Old kind=sale/paid_intake callers map to new vocabulary
    // here so the legacy paid-intake-ops flow keeps tagging existing threads correctly.
    const tags = [];
    if (kind === 'paid_intake' || order.paymentStatus === 'paid') tags.push('paid');
    else if (order.replyState === 'replied') tags.push('replied');
    else if (order.bounceState === 'bounced') tags.push('archived');
    else if (kind === 'sale') tags.push('awaiting');
    else tags.push('outreach-active');
    if (order.grade === 'A' || order.investmentLevel === 'A') tags.push('grade-a');
    else if (order.grade === 'B' || order.investmentLevel === 'B') tags.push('grade-b');
    else if (order.grade === 'C' || order.investmentLevel === 'C') tags.push('grade-c');
    return tags;
  }

  const tags = [niche];
  if (kind === 'sale') tags.push('review');
  else if (kind === 'revision') tags.push('revision');
  else if (kind === 'approved') tags.push('approved');
  else if (kind === 'live') tags.push('live');
  else tags.push('dev-preview');

  const waitingTag = caseFile?.status === 'waiting_for_customer_dns'
    ? 'domain-blocked'
    : '';
  if (waitingTag) tags.push(waitingTag);
  if (kind === 'revision') tags.push('waiting-us');
  if (kind === 'sale') tags.push('waiting-customer');
  return [...new Set(tags)];
}

export function defaultDiscordForumBlueprints() {
  return {
    // SOP-0 Task System — docs/SOP_0_TASK_SYSTEM.md
    // Kind (7) + Status (5) = 12 tags. Kind = locked at create. Status = state-machine swap.
    websiteTasks: [
      // kind (mutually exclusive — locked at task creation)
      { name: 'intake' },
      { name: 'enrich' },
      { name: 'audit' },
      { name: 'dedup' },
      { name: 'photos' },
      { name: 'image-extract' },
      { name: 'ops' },
      // status (mutually exclusive — swapped by dispatcher state machine)
      { name: 'pending' },
      { name: 'running' },
      { name: 'done' },
      { name: 'failed' },
      { name: 'human' },
    ],
    // V2 leads tag model — DISCORD_OUTREACH_PRD.md §7.3
    // Grade (3) + Lifecycle (8) + Modifier (3) = 14 tags; niche moved to thread title prefix.
    leads: [
      { name: 'grade-a' },
      { name: 'grade-b' },
      { name: 'grade-c' },
      { name: 'awaiting' },
      { name: 'outreach-active' },
      { name: 'replied' },
      { name: 'proposal-sent' },
      { name: 'nurture' },
      { name: 'paid' },
      { name: 'archived' },
      { name: 'needs-human' },
      { name: 'urgent' },
      { name: 'do-not-contact' },
      { name: 'nurture-due' },
    ],
    projects: [
      { name: 'restaurant' },
      { name: 'roofing' },
      { name: 'open-design' },
      { name: 'dev-preview' },
      { name: 'review' },
      { name: 'revision' },
      { name: 'approved' },
      { name: 'live' },
      { name: 'domain-blocked' },
      { name: 'waiting-customer' },
      { name: 'waiting-us' },
    ],
  };
}

export async function sendDiscordChannelMessage({
  channelId,
  botToken,
  payload,
  fetchImpl = fetch,
  waitForThread = false,
  threadName = '',
  requireThread = false,
  threadWaitAttempts = 12,
  threadWaitMs = 2500,
}) {
  if (!channelId) throw new Error('Discord channel ID is required');
  if (!botToken) throw new Error('Discord bot token is required');
  const response = await fetchImpl(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${botToken}`,
      'Content-Type': 'application/json',
      'User-Agent': 'profitslocal-discord-handoff',
    },
    body: JSON.stringify(payload),
  });
  const bodyText = await response.text().catch(() => '');
  let data = null;
  if (bodyText) {
    try {
      data = JSON.parse(bodyText);
    } catch {
      data = null;
    }
  }
  if (!response.ok) throw new Error(`Discord channel message failed: ${response.status} ${bodyText}`.trim());
  const guildId = data?.guild_id || '';
  const channel = data?.channel_id || channelId;
  const messageId = data?.id || '';
  let threadId = data?.thread?.id || '';
  let threadUrl = threadId && guildId ? `https://discord.com/channels/${guildId}/${threadId}` : '';
  let threadCreatedByBot = false;
  let threadCreateError = '';
  if (!threadId && threadName && messageId) {
    const thread = await createThreadFromMessage({
      fetchImpl,
      botToken,
      channelId: channel,
      messageId,
      threadName,
    });
    if (thread.ok) {
      threadId = thread.threadId || '';
      threadUrl = thread.threadUrl || '';
      threadCreatedByBot = true;
    } else {
      threadCreateError = thread.error || 'thread_create_failed';
      if (requireThread) {
        throw new Error(`Discord thread creation failed: ${thread.status || ''} ${threadCreateError}`.trim());
      }
    }
  }
  if (!threadId && waitForThread && messageId) {
    const thread = await waitForDiscordMessageThread({
      channelId: channel,
      messageId,
      botToken,
      fetchImpl,
      attempts: threadWaitAttempts,
      intervalMs: threadWaitMs,
    });
    threadId = thread.threadId || '';
    threadUrl = thread.threadUrl || '';
  }
  if (!threadId && requireThread) {
    throw new Error(`Discord thread was required but not created for message ${messageId || '(unknown)'}`);
  }
  return {
    ok: true,
    status: response.status,
    channelId: channel,
    messageId,
    messageUrl: guildId && channel && messageId
      ? `https://discord.com/channels/${guildId}/${channel}/${messageId}`
      : '',
    threadId,
    threadUrl,
    threadName,
    threadCreatedByBot,
    threadCreateError,
  };
}

export async function sendDiscordThreadedMessage({
  channelId,
  botToken,
  payload,
  threadName,
  forumTagIds = [],
  parentPayload = null,
  fetchImpl = fetch,
}) {
  if (!threadName) throw new Error('Discord thread name is required');
  const channel = await getDiscordChannel({ channelId, botToken, fetchImpl });
  if (channel?.type === 15 || channel?.type === 16) {
    return createForumThread({
      fetchImpl,
      botToken,
      channelId,
      threadName,
      payload,
      forumTagIds,
    });
  }
  const autoThread = await sendDiscordChannelMessage({
    channelId,
    botToken,
    payload,
    fetchImpl,
    waitForThread: true,
    threadWaitAttempts: 20,
    threadWaitMs: 1500,
  });
  if (autoThread.threadId) {
    return {
      ...autoThread,
      threadName,
      threadStyle: 'hermes_auto_thread',
      threadMessageId: autoThread.messageId,
      threadMessageUrl: autoThread.messageUrl,
    };
  }
  const anchorPayload = parentPayload || {
    content: `Website task: ${threadName}`,
    allowed_mentions: { parse: [] },
  };
  const anchor = await sendDiscordChannelMessage({
    channelId,
    botToken,
    payload: anchorPayload,
    fetchImpl,
  });
  const thread = await createThreadFromMessage({
    fetchImpl,
    botToken,
    channelId: anchor.channelId,
    messageId: anchor.messageId,
    threadName,
  });
  if (!thread.ok) {
    throw new Error(`Discord thread creation failed: ${thread.status || ''} ${thread.error || 'thread_create_failed'}`.trim());
  }
  const threadMessage = await sendDiscordChannelMessage({
    channelId: thread.threadId,
    botToken,
    payload,
    fetchImpl,
  });
  return {
    ok: true,
    status: anchor.status,
    channelId: anchor.channelId,
    messageId: anchor.messageId,
    messageUrl: anchor.messageUrl,
    threadId: thread.threadId,
    threadUrl: thread.threadUrl,
    threadName,
    threadCreatedByBot: true,
    threadMessageId: threadMessage.messageId,
    threadMessageUrl: threadMessage.messageUrl,
  };
}

async function getDiscordChannel({ channelId, botToken, fetchImpl }) {
  const response = await fetchImpl(`https://discord.com/api/v10/channels/${channelId}`, {
    headers: {
      Authorization: `Bot ${botToken}`,
      'User-Agent': 'profitslocal-discord-handoff',
    },
  });
  if (!response.ok) return null;
  const text = await response.text().catch(() => '');
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function createForumThread({ fetchImpl, botToken, channelId, threadName, payload, forumTagIds = [] }) {
  const response = await fetchImpl(`https://discord.com/api/v10/channels/${channelId}/threads`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${botToken}`,
      'Content-Type': 'application/json',
      'User-Agent': 'profitslocal-discord-handoff',
    },
    body: JSON.stringify({
      name: threadName,
      auto_archive_duration: 10080,
      applied_tags: forumTagIds,
      message: payload,
    }),
  });
  const text = await response.text().catch(() => '');
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!response.ok) {
    throw new Error(`Discord forum thread creation failed: ${response.status} ${text}`.trim());
  }
  const guildId = data?.guild_id || '';
  const threadId = data?.id || '';
  const messageId = data?.last_message_id || '';
  return {
    ok: true,
    status: response.status,
    channelId,
    messageId,
    messageUrl: guildId && threadId && messageId
      ? `https://discord.com/channels/${guildId}/${threadId}/${messageId}`
      : '',
    threadId,
    threadUrl: guildId && threadId ? `https://discord.com/channels/${guildId}/${threadId}` : '',
    threadName,
    threadCreatedByBot: true,
    threadStyle: 'forum_post',
    appliedTagIds: forumTagIds,
    threadMessageId: messageId,
    threadMessageUrl: guildId && threadId && messageId
      ? `https://discord.com/channels/${guildId}/${threadId}/${messageId}`
      : '',
  };
}

export async function updateDiscordThread({
  threadId,
  botToken,
  name = '',
  appliedTagIds = null,
  fetchImpl = fetch,
  retryOnRateLimit = true,
}) {
  if (!threadId) throw new Error('Discord thread ID is required');
  if (!botToken) throw new Error('Discord bot token is required');
  const body = {};
  if (name) body.name = name;
  if (Array.isArray(appliedTagIds)) body.applied_tags = appliedTagIds;
  const response = await fetchImpl(`https://discord.com/api/v10/channels/${threadId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bot ${botToken}`,
      'Content-Type': 'application/json',
      'User-Agent': 'profitslocal-discord-handoff',
    },
    body: JSON.stringify(body),
  });
  const text = await response.text().catch(() => '');
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!response.ok) {
    if (response.status === 429 && retryOnRateLimit) {
      const retryAfter = Number(data?.retry_after || 3);
      await sleep(Math.ceil(retryAfter * 1000));
      return updateDiscordThread({
        threadId,
        botToken,
        name,
        appliedTagIds,
        fetchImpl,
        retryOnRateLimit: false,
      });
    }
    throw new Error(`Discord thread update failed: ${response.status} ${text}`.trim());
  }
  return { ok: true, status: response.status, data };
}

export async function syncDiscordForumTags({
  channelId,
  botToken,
  tags = [],
  fetchImpl = fetch,
}) {
  const channel = await getDiscordChannel({ channelId, botToken, fetchImpl });
  if (!channel) throw new Error(`Unable to read Discord channel ${channelId}`);
  if (channel.type !== 15 && channel.type !== 16) {
    throw new Error(`Channel ${channelId} is not a forum/media channel`);
  }
  const existing = Array.isArray(channel.available_tags) ? channel.available_tags : [];
  const merged = tags.map((desired) => {
    const found = existing.find((tag) => tag.name === desired.name);
    if (found) {
      return {
        id: found.id,
        name: found.name,
        moderated: Boolean(found.moderated),
        emoji_id: found.emoji_id || null,
        emoji_name: found.emoji_name || null,
      };
    }
    return {
      name: desired.name,
      moderated: Boolean(desired.moderated),
      emoji_id: desired.emoji_id || null,
      emoji_name: desired.emoji_name || null,
    };
  });
  const response = await fetchImpl(`https://discord.com/api/v10/channels/${channelId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bot ${botToken}`,
      'Content-Type': 'application/json',
      'User-Agent': 'profitslocal-discord-handoff',
    },
    body: JSON.stringify({ available_tags: merged }),
  });
  const text = await response.text().catch(() => '');
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!response.ok) {
    throw new Error(`Discord forum tag sync failed: ${response.status} ${text}`.trim());
  }
  const tagsByName = Object.fromEntries((data?.available_tags || []).map((tag) => [tag.name, tag.id]));
  return {
    ok: true,
    channelId,
    availableTags: data?.available_tags || [],
    tagsByName,
  };
}

async function waitForDiscordMessageThread({
  channelId,
  messageId,
  botToken,
  fetchImpl,
  attempts,
  intervalMs,
}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (attempt > 0) await sleep(intervalMs);
    const response = await fetchImpl(`https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`, {
      headers: {
        Authorization: `Bot ${botToken}`,
        'User-Agent': 'profitslocal-discord-handoff',
      },
    });
    const bodyText = await response.text().catch(() => '');
    if (!response.ok) continue;
    let message = null;
    if (bodyText) {
      try {
        message = JSON.parse(bodyText);
      } catch {
        message = null;
      }
    }
    const threadId = message?.thread?.id || '';
    const guildId = message?.guild_id || '';
    if (threadId) {
      return {
        threadId,
        threadUrl: guildId ? `https://discord.com/channels/${guildId}/${threadId}` : '',
      };
    }
  }
  return { threadId: '', threadUrl: '' };
}

export async function sendDiscordWebhook(url, payload, {
  fetchImpl = fetch,
  threadId = '',
  threadName = '',
  botToken = '',
} = {}) {
  if (!url) throw new Error('Discord webhook URL is required');
  if (threadName && botToken && !threadId) {
    const message = await fetchDiscordWebhook(url, payload, { fetchImpl, wait: true, threadId: '', threadName: '' });
    if (message.ok) {
      const normalized = normalizeDiscordResponse(message);
      if (normalized.channelId && normalized.messageId) {
        const thread = await createThreadFromMessage({
          fetchImpl,
          botToken,
          channelId: normalized.channelId,
          messageId: normalized.messageId,
          threadName,
        });
        if (thread.ok) {
          return {
            ...normalized,
            threadId: thread.threadId,
            threadName,
            threadCreatedByBot: true,
            threadUrl: thread.threadUrl,
          };
        }
        return { ...normalized, threadCreateError: thread.error || 'thread_create_failed' };
      }
      return normalized;
    }
  }

  const response = await fetchDiscordWebhook(url, payload, { fetchImpl, wait: true, threadId, threadName });
  if (response.ok) return normalizeDiscordResponse(response);

  if (threadName) {
    const fallback = await fetchDiscordWebhook(url, payload, { fetchImpl, wait: true, threadId: '', threadName: '' });
    if (!fallback.ok) {
      const body = fallback.bodyText || response.bodyText || '';
      throw new Error(`Discord webhook failed: ${fallback.status} ${body}`.trim());
    }
    const normalized = normalizeDiscordResponse(fallback);
    if (botToken && normalized.channelId && normalized.messageId) {
      const thread = await createThreadFromMessage({
        fetchImpl,
        botToken,
        channelId: normalized.channelId,
        messageId: normalized.messageId,
        threadName,
      });
      if (thread.ok) {
        return {
          ...normalized,
          threadId: thread.threadId,
          threadName,
          threadCreatedByBot: true,
          threadUrl: thread.threadUrl,
        };
      }
      return { ...normalized, threadCreateError: thread.error || 'thread_create_failed' };
    }
    return normalized;
  }

  const body = response.bodyText || '';
  throw new Error(`Discord webhook failed: ${response.status} ${body}`.trim());
}

async function fetchDiscordWebhook(url, payload, { fetchImpl, wait, threadId = '', threadName = '' }) {
  const target = new URL(url);
  if (wait) target.searchParams.set('wait', 'true');
  if (threadId) target.searchParams.set('thread_id', threadId);
  if (threadName) target.searchParams.set('thread_name', threadName);

  const response = await fetchImpl(target.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const bodyText = await response.text().catch(() => '');
  let data = null;
  if (bodyText) {
    try {
      data = JSON.parse(bodyText);
    } catch {
      data = null;
    }
  }
  return { ok: response.ok, status: response.status, bodyText, data, usedThreadName: Boolean(threadName), usedThreadId: threadId || '' };
}

function normalizeDiscordResponse(response) {
  const data = response.data || {};
  const channelId = data.channel_id || '';
  const messageId = data.id || '';
  const guildId = data.guild_id || '';
  const threadId = response.usedThreadId || (response.usedThreadName ? channelId : '');
  const messageUrl = guildId && channelId && messageId
    ? `https://discord.com/channels/${guildId}/${channelId}/${messageId}`
    : '';
  return {
    ok: true,
    status: response.status,
    channelId,
    threadId,
    messageId,
    messageUrl,
    usedThreadName: response.usedThreadName,
  };
}

async function createThreadFromMessage({ fetchImpl, botToken, channelId, messageId, threadName }) {
  const response = await fetchImpl(`https://discord.com/api/v10/channels/${channelId}/messages/${messageId}/threads`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${botToken}`,
      'Content-Type': 'application/json',
      'User-Agent': 'profitslocal-discord-workspace',
    },
    body: JSON.stringify({
      name: threadName,
      auto_archive_duration: 10080,
    }),
  });
  const text = await response.text().catch(() => '');
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!response.ok) return { ok: false, status: response.status, error: text };
  const guildId = data?.guild_id || '';
  const threadId = data?.id || '';
  return {
    ok: true,
    status: response.status,
    threadId,
    threadUrl: guildId && threadId ? `https://discord.com/channels/${guildId}/${threadId}` : '',
  };
}

export async function createDiscordThreadFromMessage({
  fetchImpl = fetch,
  botToken,
  channelId,
  messageId,
  threadName,
}) {
  return createThreadFromMessage({ fetchImpl, botToken, channelId, messageId, threadName });
}

function field(name, value, inline = false, limit = 250) {
  const normalized = String(value || '').trim();
  if (!normalized || normalized === 'N/A' || normalized === 'unknown') return null;
  return {
    name,
    value: normalized.length > limit ? `${normalized.slice(0, limit - 1)}…` : normalized,
    inline,
  };
}

function compactFields(fields) {
  return fields.filter(Boolean).slice(0, 25);
}

function mentionUserIds(mention) {
  return [...String(mention || '').matchAll(/<@!?(\d+)>/g)].map((match) => match[1]);
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function forumLeadPrefix(kind, order) {
  if (kind === 'paid_intake') return '[Paid]';
  if (kind === 'sale') return '[Qualified]';
  if (order.paymentStatus === 'paid') return '[Paid]';
  if (order.replyState === 'replied') return '[Replied]';
  if (order.bounceState === 'bounced') return '[Bounced]';
  if (order.nextFollowUpDue) return '[Follow-up]';
  return '[Lead]';
}

function forumProjectPrefix(kind, revision, caseFile) {
  if (kind === 'revision') {
    const used = revision?.used ?? caseFile?.revision?.used;
    const limit = revision?.limit ?? caseFile?.revision?.policy?.limit;
    if (Number.isFinite(used) && Number.isFinite(limit)) return `[Revision ${used}/${limit}]`;
    return '[Revision]';
  }
  if (kind === 'approved') return '[Approved]';
  if (kind === 'live') return '[Live]';
  if (kind === 'sale') return '[Review]';
  return '[Build]';
}
