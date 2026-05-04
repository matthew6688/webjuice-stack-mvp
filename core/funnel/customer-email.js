export async function sendCustomerEmail(env, message, { fetchImpl = fetch } = {}) {
  if (!env?.RESEND_API_KEY || !message?.to) return { ok: false, skipped: true };
  const response = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.FROM_EMAIL || 'ProfitsLocal <hello@profitslocal.com>',
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Resend email failed: ${response.status} ${body}`.trim());
  }
  return { ok: true, status: response.status };
}

export function buildFunnelCustomerEmail({ kind, order, entitlement, extraRevisionUrl = '' }) {
  if (!order?.email || order.email === 'N/A') return null;
  if (kind === 'sale') return saleEmail(order, entitlement);
  if (entitlement?.ok) return revisionAcceptedEmail(order, entitlement, extraRevisionUrl);
  return revisionDeniedEmail(order, entitlement, extraRevisionUrl);
}

export function buildAgentReviewEmail({ caseFile, runResult, deployResult = null, extraRevisionUrl = '' }) {
  const email = caseFile?.customer?.email;
  if (!email || email === 'N/A') return null;
  const revision = caseFile.revision || {};
  const previewUrl = runResult?.previewUrl || caseFile.previewUrl || '';
  const revisionUrl = previewUrl && caseFile.order?.id
    ? `${previewUrl}/revise?order_id=${encodeURIComponent(caseFile.order.id)}&email=${encodeURIComponent(email)}`
    : '';
  const changedFiles = (runResult?.changedFiles || []).slice(0, 8);
  const usage = revision.policy
    ? `${revision.used || 0}/${revision.policy.limit || 0}`
    : 'N/A';
  const lines = [
    `Order ID: ${caseFile.order?.id || 'N/A'}`,
    `Review preview: ${previewUrl || 'N/A'}`,
    `Revision usage: ${usage}`,
    `Revision form: ${revisionUrl || 'N/A'}`,
    `Deploy check: ${deployResult ? `${deployResult.status}${deployResult.conclusion ? `/${deployResult.conclusion}` : ''}` : 'Not checked'}`,
    `Changed files: ${changedFiles.length ? changedFiles.join(', ') : 'No code diff; build/QA completed'}`,
    `Buy extra revision: ${extraRevisionUrl || 'N/A'}`,
  ];
  return simpleEmail({
    to: email,
    subject: `Your ${caseFile.customer?.company || 'website'} dev preview is ready`,
    intro: 'Your dev preview is ready for review.',
    lines,
    outro: 'Please review the preview link. If it looks good, reply with approval; if you need changes, use the revision form with your Order ID and checkout email.',
  });
}

function saleEmail(order, entitlement) {
  const revisionUrl = order.previewUrl
    ? `${order.previewUrl}/revise?order_id=${encodeURIComponent(order.orderId)}&email=${encodeURIComponent(order.email)}`
    : '';
  const policy = entitlement?.entitlement?.revisionPolicy;
  const lines = [
    `Order ID: ${order.orderId}`,
    `Package: ${order.tier}`,
    `Amount: ${order.currency || 'USD'} ${order.amount}`,
    `Preview: ${order.previewUrl || 'N/A'}`,
    `Revision quota: ${policy ? `0/${policy.limit} (${policy.description})` : 'N/A'}`,
    `Revision form: ${revisionUrl || 'N/A'}`,
  ];
  return simpleEmail({
    to: order.email,
    subject: `Payment received for ${order.company || order.clientSlug}`,
    intro: 'Thanks for your payment. Your website order is active.',
    lines,
    outro: 'Keep your Order ID. Future revision requests must match this Order ID and the checkout email.',
  });
}

function revisionAcceptedEmail(order, entitlement, extraRevisionUrl) {
  const current = entitlement.entitlement?.revisionUsed ?? 0;
  const limit = entitlement.entitlement?.revisionPolicy?.limit ?? 0;
  return simpleEmail({
    to: order.email,
    subject: `Revision accepted (${current}/${limit})`,
    intro: 'Your revision request matched your order and has been accepted.',
    lines: [
      `Order ID: ${entitlement.entitlement?.orderId || order.orderId}`,
      `Revision usage: ${current}/${limit}`,
      `Preview: ${order.previewUrl || 'N/A'}`,
      `Requested changes: ${order.feedback || 'N/A'}`,
      `Buy extra revision: ${extraRevisionUrl || 'N/A'}`,
    ],
    outro: 'We will work on the dev preview first and send the review link before anything goes live.',
  });
}

function revisionDeniedEmail(order, entitlement, extraRevisionUrl) {
  return simpleEmail({
    to: order.email,
    subject: 'Revision request could not be created',
    intro: entitlement?.message || 'Your revision request could not be matched to an active order.',
    lines: [
      `Order ID submitted: ${order.orderId || 'N/A'}`,
      `Email submitted: ${order.email || 'N/A'}`,
      `Buy extra revision: ${extraRevisionUrl || 'N/A'}`,
    ],
    outro: 'If this looks wrong, reply with your Stripe receipt and checkout email.',
  });
}

function simpleEmail({ to, subject, intro, lines, outro }) {
  return {
    to,
    subject,
    text: [intro, '', ...lines, '', outro].join('\n'),
    html: `<p>${escapeHtml(intro)}</p><ul>${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul><p>${escapeHtml(outro)}</p>`,
  };
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char] || char));
}
