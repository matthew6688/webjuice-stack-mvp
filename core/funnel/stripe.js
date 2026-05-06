export function normalizeStripeCheckoutEvent(payload, env = {}) {
  const event = payload?.type ? payload : { type: 'checkout.session.completed', data: { object: payload } };
  const session = event?.data?.object || {};
  const metadata = session.metadata || {};
  const repo = metadata.repo || 'unknown';
  const clientSlug = metadata.client_slug || slugFromRepo(repo);
  const tier = metadata.tier || tierFromMode(session.mode);
  const amount = Number(session.amount_total || 0) / 100 || Number(metadata.amount || 0);

  return {
    orderId: session.id || payload?.id || 'unknown',
    paymentStatus: session.payment_status || '',
    repo,
    template: metadata.template || 'webjuice-restaurant',
    previewUrl: metadata.preview_url || '',
    clientSlug,
    campaignId: metadata.campaign_id || env.DEFAULT_CAMPAIGN_ID || null,
    company: metadata.business_name || metadata.company || clientSlug || 'N/A',
    email: session.customer_details?.email || session.customer_email || metadata.email || 'N/A',
    tier,
    amount,
    currency: String(session.currency || metadata.currency || env.ROI_CURRENCY || 'USD').toUpperCase(),
    feedback: metadata.launch_notes || metadata.feedback || '',
    referenceUrl: metadata.reference_url || '',
    domain: metadata.preferred_domain || metadata.domain || '',
    parentOrderId: metadata.parent_order_id || metadata.parentOrderId || '',
    orderKind: metadata.order_kind || '',
    assetManifestUrl: metadata.asset_manifest_url || '',
    assetManifestPublicId: metadata.asset_manifest_public_id || '',
    files: metadata.attachment_summary
      ? String(metadata.attachment_summary).split(/\n+/).map((value) => value.trim()).filter(Boolean)
      : [],
    provider: 'stripe',
    rawSubmissionId: event.id || session.id || null,
    receivedAt: new Date().toISOString(),
  };
}

export function stripeRevenueLedgerInput(order) {
  return {
    clientSlug: order.clientSlug || null,
    campaignId: order.campaignId || null,
    type: 'revenue',
    category: 'sale',
    amount: Number(order.amount || 0),
    units: 1,
    unitCost: Number(order.amount || 0),
    currency: order.currency || 'USD',
    provider: 'stripe',
    metadata: {
      orderId: order.orderId,
      repo: order.repo,
      previewUrl: order.previewUrl,
      tier: order.tier,
      email: order.email,
      domain: order.domain,
      paymentStatus: order.paymentStatus,
    },
  };
}

function tierFromMode(mode) {
  if (mode === 'subscription') return 'yearly_maintenance';
  if (mode === 'payment') return 'one_time';
  return 'unknown';
}

function slugFromRepo(repo) {
  if (!repo || repo === 'unknown') return null;
  return repo.split('/').pop() || repo;
}
