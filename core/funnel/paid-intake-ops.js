export function buildPaidIntakeOpsMessage({ eventType = 'intake_submitted', payload = {}, summary = {}, baseUrl = 'https://profitslocal.com' } = {}) {
  const clientSlug = clean(payload.client_slug || payload.clientSlug || summary.clientSlug);
  const orderId = clean(payload.order_id || payload.orderId || summary.orderId);
  const adminUrl = `${baseUrl}/admin/intakes`;
  const intakeUrl = `${baseUrl}/intake?order_id=${encodeURIComponent(orderId)}&email=${encodeURIComponent(clean(payload.email))}&client_slug=${encodeURIComponent(clientSlug)}`;
  const missing = summary.readiness?.missing || summary.missing || [];
  const title = eventType === 'intake_ready_for_review'
    ? `Paid intake ready: ${clean(payload.business_name || payload.company || clientSlug)}`
    : `Paid intake update: ${clean(payload.business_name || payload.company || clientSlug)}`;

  return {
    username: 'ProfitsLocal Ops',
    embeds: [{
      title,
      color: missing.length ? 0xf1c40f : 0x2ecc71,
      fields: compactFields([
        field('Status', summary.status || eventType, true),
        field('Readiness', summary.readiness?.status || summary.readinessStatus || '', true),
        field('Client', clientSlug, true),
        field('Order ID', orderId, false),
        field('Email', payload.email, true),
        field('Lead recipient', payload.lead_recipient_email || payload.leadRecipientEmail, true),
        field('Missing', missing.join('\n'), false, 900),
        field('Files', Array.isArray(summary.files) ? String(summary.files.length) : payload.attachment_summary, true, 900),
        field('Assets', Array.isArray(summary.assets) ? String(summary.assets.length) : '', true),
        field('Admin', adminUrl, false),
        field('Customer intake link', intakeUrl, false),
      ]),
      timestamp: new Date().toISOString(),
    }],
  };
}

export function buildRevisionOpsMessage({ summary = {}, payload = {}, baseUrl = 'https://profitslocal.com' } = {}) {
  const clientSlug = clean(summary.clientSlug || payload.client_slug || payload.clientSlug);
  const orderId = clean(summary.orderId || payload.order_id || payload.orderId);
  const adminUrl = `${baseUrl}/admin/intakes`;
  const title = summary.accepted === false
    ? `Revision over limit: ${clientSlug}`
    : `Revision ${summary.revisionNumber || ''} received: ${clientSlug}`;
  return {
    username: 'ProfitsLocal Revisions',
    embeds: [{
      title,
      color: summary.accepted === false ? 0xe74c3c : 0x3498db,
      fields: compactFields([
        field('Status', summary.status, true),
        field('Revision', summary.revisionNumber ? `${summary.revisionNumber}/${summary.revisionLimit}` : '', true),
        field('Client', clientSlug, true),
        field('Order ID', orderId, false),
        field('Email', payload.email, true),
        field('Requested changes', payload.requested_changes || payload.requestedChanges, false, 1000),
        field('Files', Array.isArray(summary.files) ? String(summary.files.length) : '', true),
        field('Assets', Array.isArray(summary.assets) ? String(summary.assets.length) : '', true),
        field('Admin', adminUrl, false),
      ]),
      timestamp: new Date().toISOString(),
    }],
  };
}

export async function sendOpsDiscordMessage(env = {}, payload, { fetchImpl = fetch } = {}) {
  const webhookUrl = env.PAID_INTAKE_DISCORD_WEBHOOK_URL || env.SALES_DISCORD_WEBHOOK_URL || '';
  if (!webhookUrl) return { ok: false, skipped: true, reason: 'missing_discord_webhook' };
  try {
    const response = await fetchImpl(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) return { ok: false, status: response.status, error: await response.text() };
    return { ok: true, status: response.status };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function field(name, value, inline = false, max = 1024) {
  const cleaned = clean(value);
  if (!cleaned) return null;
  return { name, value: cleaned.slice(0, max), inline };
}

function compactFields(fields) {
  return fields.filter(Boolean);
}

function clean(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join('\n');
  return String(value || '').trim();
}
