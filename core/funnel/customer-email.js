import { appendLedgerEvent, DEFAULT_LEDGER_PATH } from '../finance/ledger.js';
import { resendEmailLedgerInput } from '../finance/service-costs.js';

export async function sendCustomerEmail(env, message, options = {}) {
  const { fetchImpl = fetch } = options;
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
  const data = await response.json().catch(() => ({}));
  const ledgerEvent = recordResendCost(env, message, options, data);
  return { ok: true, status: response.status, id: data?.id || '', ledgerEvent };
}

function recordResendCost(env, message, options = {}, data = {}) {
  const rawUnitCost = options.resendUnitCost ?? options['resend-unit-cost'] ?? env.RESEND_EMAIL_UNIT_COST;
  if (rawUnitCost === undefined || rawUnitCost === '') return null;
  const unitCost = Number(rawUnitCost);
  if (!Number.isFinite(unitCost)) return null;
  return appendLedgerEvent(resendEmailLedgerInput({
    clientSlug: options.clientSlug || null,
    campaignId: options.campaignId || null,
    to: message.to,
    subject: message.subject,
    providerId: data?.id || '',
    unitCost,
    metadata: options.emailMetadata || {},
  }), options.ledgerPath || options.ledger || DEFAULT_LEDGER_PATH);
}

export function buildFunnelCustomerEmail({ kind, order, entitlement, extraRevisionUrl = '' }) {
  if (!order?.email || order.email === 'N/A') return null;
  if (kind === 'paid_intake') return paidIntakeEmail(order);
  if (kind === 'sale') return saleEmail(order, entitlement);
  if (kind === 'extra_revision') return extraRevisionEmail(order, entitlement);
  if (entitlement?.ok) return revisionAcceptedEmail(order, entitlement, extraRevisionUrl);
  return revisionDeniedEmail(order, entitlement, extraRevisionUrl);
}

function paidIntakeEmail(order) {
  const intakeUrl = `https://profitslocal.com/intake?order_id=${encodeURIComponent(order.orderId || '')}&email=${encodeURIComponent(order.email || '')}&client_slug=${encodeURIComponent(order.clientSlug || '')}`;
  const lines = [
    `Order ID: ${order.orderId}`,
    `Package: ${order.tier}`,
    `Amount: ${order.currency || 'USD'} ${order.amount}`,
    `Business: ${order.company || order.clientSlug || 'N/A'}`,
    `Preferred domain/subdomain: ${order.domain || 'N/A'}`,
    `Intake form: ${intakeUrl}`,
  ];
  if (order.files?.length) {
    lines.push(`Files received: ${order.files.join(', ')}`);
  }
  return simpleEmail({
    to: order.email,
    subject: `Next step for ${order.company || 'your ProfitsLocal website'}`,
    intro: 'Thanks for your payment. Before we build the preview, please complete the structured intake so we have the right business details, assets, and launch preferences.',
    lines,
    outro: 'This package uses structured async intake so we can keep pricing fixed and turnaround fast. Please use the intake form instead of sending scattered notes.',
  });
}

export function buildAgentReviewEmail({ caseFile, runResult, deployResult = null, extraRevisionUrl = '' }) {
  const email = caseFile?.customer?.email;
  if (!email || email === 'N/A') return null;
  const revision = caseFile.revision || {};
  const previewUrl = runResult?.previewUrl || caseFile.previewUrl || '';
  const revisionUrl = previewUrl && caseFile.order?.id
    ? `${trimTrailingSlash(previewUrl)}/revise?order_id=${encodeURIComponent(caseFile.order.id)}&email=${encodeURIComponent(email)}`
    : '';
  const approvalUrl = previewUrl && caseFile.order?.id
    ? `${trimTrailingSlash(previewUrl)}/approve?order_id=${encodeURIComponent(caseFile.order.id)}&email=${encodeURIComponent(email)}`
    : '';
  const changedFiles = (runResult?.changedFiles || []).slice(0, 8);
  const usage = revision.policy
    ? `${revision.used || 0}/${revision.policy.limit || 0}`
    : 'N/A';
  const lines = [
    `Order ID: ${caseFile.order?.id || 'N/A'}`,
    `Review preview: ${previewUrl || 'N/A'}`,
    `Approve for live publishing: ${approvalUrl || 'N/A'}`,
    `Revision usage: ${usage}`,
    `Revision form: ${revisionUrl || 'N/A'}`,
    `Domain setup guide: ${previewUrl ? `${trimTrailingSlash(previewUrl)}/domain-help` : 'N/A'}`,
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

export function buildLivePublishedEmail({ caseFile, publishResult, deployResult = null, liveUrl = '' }) {
  const email = caseFile?.customer?.email;
  if (!email || email === 'N/A') return null;
  const resolvedLiveUrl = liveUrl || publishResult?.liveUrl || caseFile.customer?.domain || caseFile.previewUrl || '';
  const lines = [
    `Order ID: ${caseFile.order?.id || 'N/A'}`,
    `Live site: ${resolvedLiveUrl || 'N/A'}`,
    `Published commit: ${publishResult?.commit || 'N/A'}`,
    `Deploy check: ${deployResult ? `${deployResult.status}${deployResult.conclusion ? `/${deployResult.conclusion}` : ''}` : 'Not checked'}`,
    `Preview utility page: ${caseFile.previewUrl || 'N/A'}`,
    `Domain/subdomain support: keep using the preview utility page for revisions, or send DNS questions by replying to this email.`,
  ];
  return simpleEmail({
    to: email,
    subject: `${caseFile.customer?.company || 'Your website'} is live`,
    intro: 'Your approved website has been published to the live site.',
    lines,
    outro: 'You can keep using the preview utility page for future revision requests and order support.',
  });
}

export function buildDomainStatusEmail({ domainRequest }) {
  const email = domainRequest?.email;
  if (!email || email === 'N/A') return null;
  const status = domainRequest.status || 'created';
  const subjectStatus = domainStatusLabel(status);
  const instructions = domainRequest.dns?.instructions || {};
  const lines = [
    `Order ID: ${domainRequest.orderId || 'N/A'}`,
    `Requested domain: ${domainRequest.domain || domainRequest.requestedDomain || 'N/A'}`,
    `Launch type: ${domainRequest.route?.route || 'N/A'}`,
    `Status: ${subjectStatus}`,
    `Pages target: ${domainRequest.target || instructions.target || 'N/A'}`,
    `Next step: ${domainNextStep(domainRequest)}`,
  ];
  if (status === 'waiting_for_customer_dns') {
    lines.push(`DNS record: CNAME ${domainRequest.domain} -> ${domainRequest.target}`);
  }
  if (status === 'needs_root_domain_review') {
    lines.push('Root domain note: do not change root DNS until we confirm the existing website and email setup.');
  }
  return simpleEmail({
    to: email,
    subject: `Domain setup update: ${subjectStatus}`,
    intro: 'Here is the latest status for your website domain setup.',
    lines,
    outro: domainOutro(domainRequest),
  });
}

function domainStatusLabel(status) {
  return {
    active: 'active',
    pages_pending: 'waiting for Cloudflare Pages certificate',
    waiting_for_customer_dns: 'waiting for your DNS record',
    needs_root_domain_review: 'root domain needs manual review',
    needs_router: 'ProfitsLocal subpage router pending',
    dry_run_ready: 'ready to configure',
  }[status] || status;
}

function domainNextStep(domainRequest) {
  const status = domainRequest?.status || '';
  if (status === 'active') return 'Your domain is connected. Open the live URL and check the site.';
  if (status === 'waiting_for_customer_dns') return `Add the CNAME record at your DNS provider, then refresh the domain status page.`;
  if (status === 'needs_root_domain_review') return 'Reply with your DNS provider and whether email currently runs on this root domain.';
  if (status === 'pages_pending') return 'No customer action is needed yet; Cloudflare is validating the custom domain.';
  if (status === 'needs_router') return 'Use the free subdomain route until the ProfitsLocal root-site router is ready.';
  return domainRequest?.route?.nextStep || 'We will continue checking the domain setup.';
}

function domainOutro(domainRequest) {
  if (domainRequest?.status === 'active') {
    return 'Your utility pages for revisions and support remain available from the preview/review links.';
  }
  return 'You can reply to this email with DNS screenshots if you want us to verify the setup before changing anything live.';
}

function saleEmail(order, entitlement) {
  const revisionUrl = order.previewUrl
    ? `${trimTrailingSlash(order.previewUrl)}/revise?order_id=${encodeURIComponent(order.orderId)}&email=${encodeURIComponent(order.email)}`
    : '';
  const policy = entitlement?.entitlement?.revisionPolicy;
  const lines = [
    `Order ID: ${order.orderId}`,
    `Package: ${order.tier}`,
    `Amount: ${order.currency || 'USD'} ${order.amount}`,
    `Preview: ${order.previewUrl || 'N/A'}`,
    `Preferred domain/subdomain: ${order.domain || 'N/A'}`,
    `Domain setup guide: ${order.previewUrl ? `${trimTrailingSlash(order.previewUrl)}/domain-help` : 'N/A'}`,
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

function extraRevisionEmail(order, entitlement) {
  const limit = entitlement?.entitlement?.revisionPolicy?.limit ?? 'N/A';
  const used = entitlement?.entitlement?.revisionUsed ?? 'N/A';
  return simpleEmail({
    to: order.email,
    subject: 'Extra revision added',
    intro: entitlement?.ok
      ? 'Your extra revision purchase was matched to your original order.'
      : entitlement?.message || 'Your extra revision purchase could not be matched automatically.',
    lines: [
      `Original Order ID: ${order.parentOrderId || 'N/A'}`,
      `Extra revision payment ID: ${order.orderId || 'N/A'}`,
      `Revision usage: ${used}/${limit}`,
      `Preview: ${order.previewUrl || 'N/A'}`,
    ],
    outro: entitlement?.ok
      ? 'Use your original Order ID and checkout email when submitting the next revision request.'
      : 'Reply with your Stripe receipt and original Order ID so we can attach the extra revision manually.',
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

function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
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
