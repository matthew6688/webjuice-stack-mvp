import { appendLedgerEvent, DEFAULT_LEDGER_PATH } from '../finance/ledger.js';
import { resendEmailLedgerInput } from '../finance/service-costs.js';
import { renderProfitsLocalEmail } from './email-template.js';

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
      from: env.FROM_EMAIL || 'ProfitsLocal <hi@profitslocal.com>',
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
    `Project: ${order.company || order.clientSlug || 'N/A'}`,
    `Order ID: ${order.orderId}`,
    `Package: ${order.tier}`,
    `Amount received: ${order.currency || 'USD'} ${order.amount}`,
    `Preferred domain: ${order.domain || 'N/A'}`,
  ];
  if (order.files?.length) {
    lines.push(`Files received: ${order.files.join(', ')}`);
  }
  return simpleEmail({
    to: order.email,
    eyebrow: 'Payment received',
    subject: "Payment is in. Let's finish the intake.",
    intro: 'Thanks for choosing ProfitsLocal. Please complete the short intake so we can lock the business details, assets, and launch preferences before buildout.',
    lines,
    cta: { label: 'Complete intake', url: intakeUrl },
    outro: 'If you already sent those details, you can ignore this and we will keep moving.',
    footerNote: `Sent by ProfitsLocal from hi@profitslocal.com. You are receiving this because ${order.company || 'your business'} started a ProfitsLocal project.`,
  });
}

export function buildAgentReviewEmail({ caseFile, runResult, deployResult = null, extraRevisionUrl = '' }) {
  const email = caseFile?.customer?.email;
  if (!email || email === 'N/A') return null;
  const revision = caseFile.revision || {};
  const previewUrl = runResult?.previewUrl || caseFile.previewUrl || '';
  const customerLinks = buildCustomerActionLinks({
    orderId: caseFile.order?.id || '',
    email,
    clientSlug: caseFile.clientSlug || '',
    repo: caseFile.repo || '',
    previewUrl,
  });
  const revisionUrl = customerLinks.revisionUrl;
  const approvalUrl = customerLinks.approveUrl;
  const usage = revision.policy
    ? `${revision.used || 0}/${revision.policy.limit || 0}`
    : 'N/A';
  const lines = [
    `Project: ${caseFile.customer?.company || caseFile.clientSlug || 'N/A'}`,
    `Order ID: ${caseFile.order?.id || 'N/A'}`,
    `Revision usage: ${usage}`,
    `Preview status: ${deployResult?.conclusion === 'failure' ? 'Needs one more internal check' : 'Ready for review'}`,
    `Review focus: Design direction, business details, and launch readiness`,
  ];
  if (extraRevisionUrl) lines.push(`Extra revision: ${extraRevisionUrl}`);
  return simpleEmail({
    to: email,
    eyebrow: 'Preview ready',
    subject: `Your ${caseFile.customer?.company || 'site'} preview is ready`,
    intro: 'We have staged the latest version. Open the preview, then choose the action that matches where you are: approve, request a revision, or start domain setup.',
    lines,
    cta: previewUrl ? { label: 'Review dev preview', url: previewUrl } : null,
    secondaryLinks: [
      { label: 'Approve site', url: approvalUrl },
      { label: 'Request revision', url: revisionUrl },
      { label: 'Set up domain', url: customerLinks.domainSetupUrl },
    ],
    outro: 'Approving means the design direction is ready for final launch prep. Revisions are welcome if something practical is off.',
    footerNote: 'Small note from ProfitsLocal: reply to this email if you want us to check anything before publishing.',
  });
}

export function buildLivePublishedEmail({ caseFile, publishResult, deployResult = null, liveUrl = '' }) {
  const email = caseFile?.customer?.email;
  if (!email || email === 'N/A') return null;
  const resolvedLiveUrl = liveUrl || publishResult?.liveUrl || caseFile.customer?.domain || caseFile.previewUrl || '';
  const lines = [
    `Project: ${caseFile.customer?.company || caseFile.clientSlug || 'N/A'}`,
    `Order ID: ${caseFile.order?.id || 'N/A'}`,
    `Live site: ${resolvedLiveUrl || 'N/A'}`,
    `Published status: ${deployResult ? `${deployResult.status}${deployResult.conclusion ? `/${deployResult.conclusion}` : ''}` : 'Live'}`,
  ];
  const revisionUrl = buildCustomerActionLinks({
    orderId: caseFile.order?.id || '',
    email,
    clientSlug: caseFile.clientSlug || '',
    repo: caseFile.repo || '',
    previewUrl: caseFile.previewUrl || '',
  }).revisionUrl;
  return simpleEmail({
    to: email,
    eyebrow: 'Published',
    subject: 'Your new site is live.',
    intro: 'Your approved website has been published and connected to the live destination.',
    lines,
    cta: resolvedLiveUrl ? { label: 'Open live site', url: resolvedLiveUrl } : null,
    secondaryLinks: [{ label: 'Request support', url: revisionUrl }],
    outro: 'Open the site and give the important pages one last pass. Reply here if anything practical needs attention.',
    footerNote: 'Built by ProfitsLocal. Research first, design with taste, preview before payment.',
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
    `Domain: ${domainRequest.domain || domainRequest.requestedDomain || 'N/A'}`,
    `Current step: ${subjectStatus}`,
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
    eyebrow: 'Domain status',
    subject: 'Domain setup is moving through the checks.',
    intro: 'Here is the current status in plain English. DNS changes can take time to settle, but we will keep checking until the live site is ready.',
    lines,
    outro: domainOutro(domainRequest),
    footerNote: 'No action is needed unless we ask for a specific change from your domain provider.',
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
    return 'Your official ProfitsLocal revision and support links remain available from the review email.';
  }
  return 'You can reply to this email with DNS screenshots if you want us to verify the setup before changing anything live.';
}

function saleEmail(order, entitlement) {
  const customerLinks = buildCustomerActionLinks({
    orderId: order.orderId,
    email: order.email,
    clientSlug: order.clientSlug,
    repo: order.repo,
    previewUrl: order.previewUrl,
  });
  const policy = entitlement?.entitlement?.revisionPolicy;
  const lines = [
    `Project: ${order.company || order.clientSlug || 'N/A'}`,
    `Order ID: ${order.orderId}`,
    `Package: ${order.tier}`,
    `Amount received: ${order.currency || 'USD'} ${order.amount}`,
    `Preview: ${order.previewUrl || 'N/A'}`,
    `Preferred domain: ${order.domain || 'N/A'}`,
    `Revision quota: ${policy ? `0/${policy.limit} (${policy.description})` : 'N/A'}`,
  ];
  return simpleEmail({
    to: order.email,
    eyebrow: 'Payment received',
    subject: `Payment received for ${order.company || order.clientSlug}`,
    intro: 'Your website order is active. Review the preview when you are ready, then use the action links for revisions or domain setup.',
    lines,
    cta: order.previewUrl ? { label: 'Review preview', url: order.previewUrl } : null,
    secondaryLinks: [
      { label: 'Request revision', url: customerLinks.revisionUrl },
      { label: 'Set up domain', url: customerLinks.domainSetupUrl },
    ],
    outro: 'Keep your Order ID. Future revision requests must match this Order ID and the checkout email.',
    footerNote: `Sent by ProfitsLocal from hi@profitslocal.com. You are receiving this because ${order.company || 'your business'} started a ProfitsLocal project.`,
  });
}

function revisionAcceptedEmail(order, entitlement, extraRevisionUrl) {
  const current = entitlement.entitlement?.revisionUsed ?? 0;
  const limit = entitlement.entitlement?.revisionPolicy?.limit ?? 0;
  return simpleEmail({
    to: order.email,
    eyebrow: 'Revision accepted',
    subject: `Revision accepted (${current}/${limit})`,
    intro: 'Your revision request matched your order and has been accepted.',
    lines: [
      `Order ID: ${entitlement.entitlement?.orderId || order.orderId}`,
      `Revision usage: ${current}/${limit}`,
      `Preview: ${order.previewUrl || 'N/A'}`,
      `Requested changes: ${order.feedback || 'N/A'}`,
    ],
    cta: order.previewUrl ? { label: 'Open preview', url: order.previewUrl } : null,
    secondaryLinks: extraRevisionUrl ? [{ label: 'Buy extra revision', url: extraRevisionUrl }] : [],
    outro: 'We will update the dev preview first and send a review link before anything goes live.',
    footerNote: 'Reply to this email if the request summary looks wrong.',
  });
}

function revisionDeniedEmail(order, entitlement, extraRevisionUrl) {
  return simpleEmail({
    to: order.email,
    eyebrow: 'Revision issue',
    subject: 'Revision request could not be created',
    intro: entitlement?.message || 'Your revision request could not be matched to an active order.',
    lines: [
      `Order ID submitted: ${order.orderId || 'N/A'}`,
      `Email submitted: ${order.email || 'N/A'}`,
    ],
    cta: extraRevisionUrl ? { label: 'Buy extra revision', url: extraRevisionUrl } : null,
    outro: 'If this looks wrong, reply with your Stripe receipt and checkout email.',
    footerNote: 'We only attach revisions to the matching checkout email and Order ID.',
  });
}

function extraRevisionEmail(order, entitlement) {
  const limit = entitlement?.entitlement?.revisionPolicy?.limit ?? 'N/A';
  const used = entitlement?.entitlement?.revisionUsed ?? 'N/A';
  return simpleEmail({
    to: order.email,
    eyebrow: 'Extra revision',
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
    cta: order.previewUrl ? { label: 'Open preview', url: order.previewUrl } : null,
    outro: entitlement?.ok
      ? 'Use your original Order ID and checkout email when submitting the next revision request.'
      : 'Reply with your Stripe receipt and original Order ID so we can attach the extra revision manually.',
    footerNote: 'Thanks for keeping the revision request tied to the original project.',
  });
}

function simpleEmail({ to, subject, intro, lines, outro, cta = null, secondaryLinks = [], eyebrow = 'Project update', footerNote = 'ProfitsLocal transactional email. Reply to this email if anything looks wrong.' }) {
  const cleanLinks = secondaryLinks.filter((link) => link?.url);
  return {
    to,
    subject,
    text: [intro, '', ...lines, '', outro].join('\n'),
    html: renderProfitsLocalEmail({
      eyebrow,
      subject,
      intro,
      details: lines.map((line) => {
        const [label, ...rest] = String(line).split(':');
        return { label: label || 'Detail', value: rest.join(':').trim() || line };
      }),
      closing: outro,
      cta,
      secondaryLinks: cleanLinks,
      footerNote,
      preheader: intro,
    }),
  };
}

function buildCustomerActionLinks({ orderId = '', email = '', clientSlug = '', repo = '', previewUrl = '' }) {
  const params = {
    order_id: orderId,
    email,
    client_slug: clientSlug,
    repo,
    preview_url: previewUrl,
  };
  return {
    approveUrl: officialFunnelUrl('/approve', params),
    revisionUrl: officialFunnelUrl('/revision', params),
    domainSetupUrl: officialFunnelUrl('/domain-setup', params),
    extraRevisionUrl: officialFunnelUrl('/checkout', { ...params, tier: 'extra_revision' }),
  };
}

function officialFunnelUrl(path, params = {}) {
  const url = new URL(path, 'https://profitslocal.com');
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value) !== '') {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}
