export function buildDiscordMessage({ kind, order, task = null }) {
  const isSale = kind === 'sale';
  const title = isSale
    ? `New website sale: ${order.company || order.clientSlug}`
    : `Revision request: ${order.company || order.clientSlug}`;
  const color = isSale ? 0x2ecc71 : 0xf1c40f;
  const fields = compactFields([
    field('Client', order.clientSlug, true),
    field('Repo', order.repo, true),
    field('Tier', order.tier, true),
    field('Amount', order.amount ? `${order.currency || 'USD'} ${order.amount}` : '', true),
    field('Email', order.email, true),
    field('Domain', order.domain, true),
    field('Preview', order.previewUrl, false),
    field('Task', task?.taskPath || task?.id || '', false),
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

export async function sendDiscordWebhook(url, payload, { fetchImpl = fetch } = {}) {
  if (!url) throw new Error('Discord webhook URL is required');
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Discord webhook failed: ${response.status} ${body}`.trim());
  }
  return { ok: true, status: response.status };
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
