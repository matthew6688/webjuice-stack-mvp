export function normalizeTallySubmission(payload, env = {}) {
  const fields = payload?.data?.fields || payload?.fields || {};
  const answers = payload?.data?.answers || payload?.answers || {};
  const combined = { ...fields, ...answers };

  const orderId = extractField(combined, 'tally_order_id') || payload?.id || payload?.data?.submissionId || 'unknown';
  const repo = extractField(combined, 'repo') || 'unknown';
  const previewUrl = extractField(combined, 'preview_url') || extractField(combined, 'preview') || '';
  const clientSlug = extractField(combined, 'client_slug') || slugFromRepo(repo);
  const campaignId = extractField(combined, 'campaign_id') || env.DEFAULT_CAMPAIGN_ID || null;
  const tier = extractField(combined, 'tier') || extractField(combined, 'package') || 'unknown';
  const amount = extractAmount(combined, tier, env);

  return {
    orderId,
    repo,
    template: extractField(combined, 'template') || 'unknown',
    previewUrl,
    clientSlug,
    campaignId,
    company: extractField(combined, 'company_name') || extractField(combined, 'company') || 'N/A',
    email: extractField(combined, 'email') || 'N/A',
    tier,
    amount,
    currency: extractField(combined, 'currency') || env.ROI_CURRENCY || 'USD',
    brandColor: extractField(combined, 'brand_color') || '',
    feedback: extractField(combined, 'feedback') || extractField(combined, 'modifications') || '',
    referenceUrl: extractField(combined, 'reference_url') || '',
    domain: extractField(combined, 'domain') || extractField(combined, 'custom_domain') || '',
    files: extractFiles(combined),
    rawSubmissionId: payload?.id || payload?.data?.submissionId || null,
    receivedAt: new Date().toISOString(),
  };
}

export function tallyRevenueLedgerInput(order) {
  return {
    clientSlug: order.clientSlug || null,
    campaignId: order.campaignId || null,
    type: 'revenue',
    category: 'sale',
    amount: Number(order.amount || 0),
    units: 1,
    unitCost: Number(order.amount || 0),
    currency: order.currency || 'USD',
    provider: 'tally',
    metadata: {
      orderId: order.orderId,
      repo: order.repo,
      previewUrl: order.previewUrl,
      tier: order.tier,
      email: order.email,
      domain: order.domain,
    },
  };
}

export function extractField(answers, fieldId) {
  if (!answers) return '';
  const needle = fieldId.toLowerCase();
  for (const key of Object.keys(answers)) {
    if (!key.toLowerCase().includes(needle)) continue;
    const val = answers[key];
    if (typeof val === 'string' || typeof val === 'number') return String(val);
    if (val?.value !== undefined) return String(val.value);
    if (val?.text !== undefined) return String(val.text);
    if (val?.label !== undefined) return String(val.label);
  }
  return '';
}

export function extractFiles(answers) {
  const files = [];
  if (!answers) return files;

  for (const key of Object.keys(answers)) {
    const val = answers[key];
    if (val && typeof val === 'object') {
      if (val.url) files.push(val.url);
      if (val.value?.url) files.push(val.value.url);
      if (Array.isArray(val)) {
        val.forEach((file) => {
          if (file?.url) files.push(file.url);
        });
      }
    }
  }
  return files;
}

function extractAmount(answers, tier, env) {
  const explicit = extractField(answers, 'amount')
    || extractField(answers, 'payment_amount')
    || extractField(answers, 'price')
    || extractField(answers, 'total');
  if (explicit) return numberFromMoney(explicit);

  const tierPrices = parseTierPrices(env.TALLY_TIER_PRICES);
  return tierPrices[tier] ?? tierPrices[tier.toLowerCase?.()] ?? 0;
}

function parseTierPrices(raw) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function numberFromMoney(value) {
  const normalized = String(value).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return normalized ? Number(normalized[0]) : 0;
}

function slugFromRepo(repo) {
  if (!repo || repo === 'unknown') return null;
  return repo.split('/').pop() || repo;
}
