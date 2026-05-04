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

export async function sendDiscordWebhook(url, payload, { fetchImpl = fetch, threadId = '', threadName = '' } = {}) {
  if (!url) throw new Error('Discord webhook URL is required');
  const response = await fetchDiscordWebhook(url, payload, { fetchImpl, wait: true, threadId, threadName });
  if (!response.ok && threadName) {
    return sendDiscordWebhook(url, { ...payload, threadName: '' }, { fetchImpl });
  }
  if (!response.ok) {
    const body = response.bodyText || '';
    throw new Error(`Discord webhook failed: ${response.status} ${body}`.trim());
  }
  return normalizeDiscordResponse(response);
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
