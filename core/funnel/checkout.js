import fs from 'fs';
import path from 'path';

const DEFAULT_TIERS = {
  one_time: 399,
  yearly_maintenance: 799,
};

export function buildCheckoutArtifact({
  clientSlug,
  repo,
  template,
  previewUrl,
  campaignId,
  provider = 'tally',
  purchaseBaseUrl,
  feedbackBaseUrl,
  tiers = DEFAULT_TIERS,
  currency = 'USD',
}) {
  if (!clientSlug) throw new Error('clientSlug is required');
  if (!previewUrl) throw new Error('previewUrl is required');
  if (!purchaseBaseUrl) throw new Error('purchaseBaseUrl is required');

  const hiddenFields = {
    client_slug: clientSlug,
    repo: repo || clientSlug,
    template: template || 'webjuice-restaurant',
    preview_url: previewUrl,
    campaign_id: campaignId || '',
    currency,
  };

  return {
    schemaVersion: 1,
    clientSlug,
    generatedAt: new Date().toISOString(),
    provider,
    currency,
    tiers: Object.entries(tiers).map(([id, amount]) => ({
      id,
      amount: Number(amount),
      label: tierLabel(id),
      description: tierDescription(id),
      purchaseUrl: buildProviderUrl(provider, purchaseBaseUrl, {
        ...hiddenFields,
        tier: id,
        amount: Number(amount),
      }),
    })),
    feedbackUrl: feedbackBaseUrl ? buildProviderUrl(provider, feedbackBaseUrl, hiddenFields) : '',
    hiddenFields,
  };
}

function tierLabel(id) {
  if (id === 'one_time') return 'One-time website';
  if (id === 'yearly_maintenance') return 'Yearly maintenance';
  return id;
}

function tierDescription(id) {
  if (id === 'one_time') return 'One-time website build with 3 revisions.';
  if (id === 'yearly_maintenance') return 'Website build plus monthly maintenance for one year.';
  return '';
}

export function validateCheckoutArtifact(artifact) {
  const errors = [];
  if (!artifact.clientSlug) errors.push('clientSlug is required');
  if (!['tally', 'stripe'].includes(artifact.provider)) errors.push('provider must be tally or stripe');
  if (!Array.isArray(artifact.tiers) || !artifact.tiers.length) errors.push('tiers must not be empty');
  for (const tier of artifact.tiers || []) {
    if (!tier.id) errors.push('tier.id is required');
    if (!tier.amount) errors.push(`tier ${tier.id || 'unknown'} amount is required`);
    if (!tier.purchaseUrl) errors.push(`tier ${tier.id || 'unknown'} purchaseUrl is required`);
  }
  for (const field of ['client_slug', 'repo', 'template', 'preview_url', 'currency']) {
    if (!artifact.hiddenFields?.[field]) errors.push(`hiddenFields.${field} is required`);
  }
  return { ok: errors.length === 0, errors };
}

export function saveCheckoutArtifact(artifact, outputPath) {
  const validation = validateCheckoutArtifact(artifact);
  if (!validation.ok) throw new Error(`Invalid checkout artifact: ${validation.errors.join('; ')}`);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`);
  return artifact;
}

export function parseTierPrices(raw) {
  if (!raw) return DEFAULT_TIERS;
  try {
    return JSON.parse(raw);
  } catch {
    return DEFAULT_TIERS;
  }
}

function buildProviderUrl(provider, baseUrl, params) {
  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(provider === 'stripe' ? `client_reference_${key}` : key, String(value));
  }
  return url.toString();
}
