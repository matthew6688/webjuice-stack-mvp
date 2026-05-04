#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { loadLocalEnv } from '../../core/env/load-local-env.js';
import { buildCheckoutArtifact, parseTierPrices, saveCheckoutArtifact } from '../../core/funnel/checkout.js';
import {
  buildTallyMcpPrompt,
  buildTallyPaymentFormPayload,
} from '../../core/funnel/tally-payment-form.js';

loadLocalEnv();

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i += 1) {
    if (!args[i].startsWith('--')) continue;
    parsed[args[i].slice(2)] = args[i + 1]?.startsWith('--') ? true : (args[i + 1] || true);
  }
  return parsed;
}

const args = parseArgs();

if (!args.client) {
  console.error('Usage: node scripts/funnel/create-tally-payment-forms.js --client slug [--dry-run]');
  process.exit(1);
}

const clientSlug = args.client;
const tiers = parseTierPrices(args.tiers || process.env.CHECKOUT_TIER_PRICES || process.env.TALLY_TIER_PRICES);
const currency = args.currency || process.env.ROI_CURRENCY || 'USD';
const title = args.title || `Launch ${clientSlug}`;
const description = args.description || 'Secure your preview site and send launch notes.';
const webhookUrl = args['webhook-url'] || args.webhookUrl || process.env.TALLY_WEBHOOK_URL || '';
const thankYouUrl = args['thank-you-url'] || args.thankYouUrl || process.env.TALLY_THANK_YOU_URL || '';
const previewUrl = args['preview-url'] || args.previewUrl || readPreviewUrl(clientSlug);
const outputPath = args.output || path.join('clients', clientSlug, 'funnel', 'checkout.json');
const apiKey = process.env.TALLY_API_KEY;

const tierResults = [];
const payloads = [];

for (const [tier, amount] of Object.entries(tiers)) {
  const payload = buildTallyPaymentFormPayload({
    title,
    description,
    tier,
    amount,
    currency,
    redirectUrl: thankYouUrl,
    status: args.publish === 'true' ? 'PUBLISHED' : 'DRAFT',
  });
  payloads.push({ tier, amount, payload });
}

if (args['mcp-prompt'] === 'true' || args.mcpPrompt === 'true') {
  console.log(buildTallyMcpPrompt({
    businessName: title,
    tiers: Object.entries(tiers).map(([id, amount]) => ({ id, amount, currency })),
    webhookUrl,
    thankYouUrl,
  }));
  process.exit(0);
}

if (args['dry-run'] === 'true' || args.dryRun === 'true' || !apiKey) {
  const dryRunPath = args['dry-run-output'] || path.join('clients', clientSlug, 'funnel', 'tally-payment-form-payloads.json');
  fs.mkdirSync(path.dirname(dryRunPath), { recursive: true });
  fs.writeFileSync(dryRunPath, `${JSON.stringify({ payloads }, null, 2)}\n`);
  console.log(`Dry-run Tally form payloads written: ${dryRunPath}`);
  if (!apiKey) console.log('TALLY_API_KEY is not set; skipped live Tally form creation.');
  process.exit(0);
}

for (const { tier, amount, payload } of payloads) {
  const form = await createTallyForm(apiKey, payload);
  if (webhookUrl) await createTallyWebhook(apiKey, form.id, webhookUrl);
  tierResults.push({
    id: tier,
    amount: Number(amount),
    purchaseBaseUrl: `https://tally.so/r/${form.id}`,
    formId: form.id,
  });
}

const artifact = buildCheckoutArtifact({
  clientSlug,
  repo: args.repo || `matthew6688/${clientSlug}`,
  template: args.template || 'webjuice-restaurant',
  previewUrl,
  campaignId: args.campaign || process.env.DEFAULT_CAMPAIGN_ID || '',
  provider: 'tally',
  purchaseBaseUrl: tierResults[0].purchaseBaseUrl,
  feedbackBaseUrl: args['feedback-url'] || args.feedbackUrl || process.env.TALLY_FEEDBACK_FORM_URL || '',
  tiers: Object.fromEntries(tierResults.map((tier) => [tier.id, tier.amount])),
  currency,
});

artifact.tiers = artifact.tiers.map((tier) => {
  const form = tierResults.find((result) => result.id === tier.id);
  return {
    ...tier,
    formId: form.formId,
    purchaseUrl: addHiddenFields(form.purchaseBaseUrl, artifact.hiddenFields, tier),
  };
});

saveCheckoutArtifact(artifact, outputPath);
console.log(`Tally payment forms created: ${outputPath}`);
for (const tier of artifact.tiers) console.log(`- ${tier.id}: ${tier.purchaseUrl}`);

async function createTallyForm(token, payload) {
  const response = await fetch('https://api.tally.so/forms', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Tally form create failed: ${response.status} ${await response.text()}`);
  return response.json();
}

async function createTallyWebhook(token, formId, url) {
  const response = await fetch('https://api.tally.so/webhooks', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      formId,
      url,
      eventTypes: ['FORM_RESPONSE'],
      externalSubscriber: 'webjuice',
    }),
  });
  if (!response.ok) throw new Error(`Tally webhook create failed: ${response.status} ${await response.text()}`);
  return response.json();
}

function readPreviewUrl(slug) {
  const outreachPath = path.join('clients', slug, 'outreach', 'outreach-pack.json');
  if (!fs.existsSync(outreachPath)) return '';
  return JSON.parse(fs.readFileSync(outreachPath, 'utf8')).previewUrl || '';
}

function addHiddenFields(baseUrl, hiddenFields, tier) {
  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries({ ...hiddenFields, tier: tier.id, amount: tier.amount })) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}
