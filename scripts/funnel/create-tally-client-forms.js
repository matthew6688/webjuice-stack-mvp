#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { loadLocalEnv } from '../../core/env/load-local-env.js';
import { artifactTimestamp } from '../../core/time.js';
import { buildCheckoutArtifact, parseTierPrices, saveCheckoutArtifact } from '../../core/funnel/checkout.js';
import { buildTallyWebhookPayload, TallyApiClient } from '../../core/funnel/tally-api.js';
import { buildTallyFeedbackFormPayload } from '../../core/funnel/tally-feedback-form.js';
import { buildTallyPaymentFormPayload } from '../../core/funnel/tally-payment-form.js';
import { validateTallyFormPayload } from '../../core/funnel/tally-validation.js';

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

if (!args.client && !args.all) {
  console.error('Usage: node scripts/funnel/create-tally-client-forms.js --client slug [--publish true] [--dry-run]');
  console.error('   or: node scripts/funnel/create-tally-client-forms.js --all clients [--publish true] [--dry-run]');
  process.exit(1);
}

const apiKey = process.env.TALLY_API_KEY;
const dryRun = Boolean(args.dryRun || args['dry-run'] || !apiKey);
const client = dryRun ? null : new TallyApiClient({ apiKey });
const clientSlugs = args.all
  ? fs.readdirSync(args.all === true ? 'clients' : args.all)
    .filter((name) => fs.existsSync(path.join('clients', name, 'funnel', 'checkout.json')))
    .sort()
  : [args.client];

const results = [];
for (const clientSlug of clientSlugs) {
  const result = await createFormsForClient(clientSlug);
  results.push(result);
  console.log(`\n[${clientSlug}] ${result.status}`);
  for (const form of result.forms) console.log(`- ${form.kind}: ${form.url || form.payloadPath}`);
}

if (dryRun && !apiKey) console.log('\nTALLY_API_KEY is not set; live Tally form creation was skipped.');
process.exit(results.every((result) => result.ok) ? 0 : 1);

async function createFormsForClient(clientSlug) {
  const clientDir = path.join('clients', clientSlug);
  const funnelDir = path.join(clientDir, 'funnel');
  const checkoutPath = path.join(funnelDir, 'checkout.json');
  const checkout = readJson(checkoutPath);
  const previewUrl = args['preview-url'] || args.previewUrl || checkout?.hiddenFields?.preview_url || readPreviewUrl(clientSlug);
  const tiers = parseTierPrices(args.tiers || process.env.CHECKOUT_TIER_PRICES || process.env.TALLY_TIER_PRICES);
  const currency = args.currency || process.env.ROI_CURRENCY || checkout?.currency || 'USD';
  const webhookUrl = args['webhook-url'] || args.webhookUrl || process.env.TALLY_WEBHOOK_URL || '';
  const thankYouBaseUrl = args['thank-you-url'] || args.thankYouUrl || process.env.TALLY_THANK_YOU_URL || buildClientThankYouUrl(previewUrl);
  const publish = args.publish === 'true';
  const forms = [];
  const hiddenFields = {
    client_slug: clientSlug,
    repo: checkout?.hiddenFields?.repo || args.repo || `matthew6688/${clientSlug}`,
    template: checkout?.hiddenFields?.template || args.template || 'webjuice-restaurant',
    preview_url: previewUrl,
    campaign_id: checkout?.hiddenFields?.campaign_id || args.campaign || process.env.DEFAULT_CAMPAIGN_ID || '',
    currency,
  };
  const paymentPayloads = Object.entries(tiers).map(([tier, amount]) => {
    const payload = buildTallyPaymentFormPayload({
      title: args.title || `Launch ${clientSlug}`,
      description: args.description || 'Secure your preview site and send launch notes.',
      tier,
      amount,
      currency,
      redirectUrl: buildThankYouRedirect(thankYouBaseUrl, { ...hiddenFields, tier, amount }),
      status: publish ? 'PUBLISHED' : 'DRAFT',
    });
    assertPayload(payload, { requirePayment: true });
    return { tier, amount: Number(amount), payload };
  });
  const feedbackPayload = buildTallyFeedbackFormPayload({
    title: args.feedbackTitle || `Feedback for ${clientSlug}`,
    description: args.feedbackDescription || 'Tell us what to revise before launch.',
    redirectUrl: buildThankYouRedirect(thankYouBaseUrl, { ...hiddenFields, mode: 'revision' }),
    status: publish ? 'PUBLISHED' : 'DRAFT',
  });
  assertPayload(feedbackPayload);

  fs.mkdirSync(funnelDir, { recursive: true });

  if (dryRun) {
    const paymentPath = path.join(funnelDir, 'tally-payment-form-payloads.json');
    const feedbackPath = path.join(funnelDir, 'tally-feedback-form-payload.json');
    fs.writeFileSync(paymentPath, `${JSON.stringify({ payloads: paymentPayloads }, null, 2)}\n`);
    fs.writeFileSync(feedbackPath, `${JSON.stringify({ payload: feedbackPayload }, null, 2)}\n`);
    forms.push({ kind: 'payment_payloads', payloadPath: paymentPath });
    forms.push({ kind: 'feedback_payload', payloadPath: feedbackPath });
    writeManifest(clientSlug, { status: 'dry_run', forms, webhookUrl, thankYouUrl: thankYouBaseUrl, previewUrl });
    return { clientSlug, ok: true, status: 'dry_run', forms };
  }

  const tierResults = [];
  for (const { tier, amount, payload } of paymentPayloads) {
    const form = await client.createForm(payload);
    if (webhookUrl) await client.createWebhook(buildTallyWebhookPayload({
      formId: form.id,
      url: webhookUrl,
      signingSecret: process.env.TALLY_WEBHOOK_SIGNING_SECRET || '',
    }));
    const url = `https://tally.so/r/${form.id}`;
    tierResults.push({ id: tier, amount, formId: form.id, purchaseBaseUrl: url });
    forms.push({ kind: `payment:${tier}`, formId: form.id, url });
  }

  const feedbackForm = await client.createForm(feedbackPayload);
  if (webhookUrl) await client.createWebhook(buildTallyWebhookPayload({
    formId: feedbackForm.id,
    url: webhookUrl,
    signingSecret: process.env.TALLY_WEBHOOK_SIGNING_SECRET || '',
  }));
  const feedbackBaseUrl = `https://tally.so/r/${feedbackForm.id}`;
  forms.push({ kind: 'feedback', formId: feedbackForm.id, url: feedbackBaseUrl });

  const artifact = buildCheckoutArtifact({
    clientSlug,
    repo: hiddenFields.repo,
    template: hiddenFields.template,
    previewUrl,
    campaignId: hiddenFields.campaign_id,
    provider: 'tally',
    purchaseBaseUrl: tierResults[0].purchaseBaseUrl,
    feedbackBaseUrl,
    tiers: Object.fromEntries(tierResults.map((tier) => [tier.id, tier.amount])),
    currency,
  });
  artifact.tiers = artifact.tiers.map((tier) => {
    const form = tierResults.find((result) => result.id === tier.id);
    return { ...tier, formId: form.formId, purchaseUrl: addHiddenFields(form.purchaseBaseUrl, artifact.hiddenFields, tier) };
  });
  saveCheckoutArtifact(artifact, checkoutPath);
  writeManifest(clientSlug, { status: 'live', forms, webhookUrl, thankYouUrl: thankYouBaseUrl, previewUrl, checkoutPath });
  return { clientSlug, ok: true, status: 'live', forms };
}

function writeManifest(clientSlug, manifest) {
  const manifestPath = path.join('clients', clientSlug, 'funnel', 'tally-forms-manifest.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify({
    schemaVersion: 1,
    clientSlug,
    generatedAt: artifactTimestamp(),
    ...manifest,
  }, null, 2)}\n`);
}

function assertPayload(payload, options = {}) {
  const validation = validateTallyFormPayload(payload, options);
  if (!validation.ok) throw new Error(`Invalid Tally payload: ${validation.errors.join('; ')}`);
}

function readJson(file) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
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

function buildClientThankYouUrl(previewUrl) {
  if (!previewUrl) return '';
  return new URL('/thank-you', previewUrl).toString();
}

function buildThankYouRedirect(baseUrl, params) {
  if (!baseUrl) return '';
  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}
