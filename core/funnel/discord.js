export function buildDiscordMessage({ kind, order, task = null }) {
  const isSale = kind === 'sale';
  const title = isSale
    ? `New website sale: ${order.company || order.clientSlug}`
    : `Revision request: ${order.company || order.clientSlug}`;
  const color = isSale ? 0x2ecc71 : 0xf1c40f;
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
    username: isSale ? 'ProfitsLocal Sales' : 'ProfitsLocal Revisions',
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

export async function sendDiscordWebhook(url, payload, {
  fetchImpl = fetch,
  threadId = '',
  threadName = '',
  botToken = '',
} = {}) {
  if (!url) throw new Error('Discord webhook URL is required');
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
