#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import {
  buildCheckoutArtifact,
  parseTierPrices,
  saveCheckoutArtifact,
  validateCheckoutArtifact,
} from '../../core/funnel/checkout.js';

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
  console.error('Usage: node scripts/funnel/build-checkout.js --client slug --purchase-url https://tally.so/r/form [--preview-url url]');
  process.exit(1);
}

const clientSlug = args.client;
const outreachPath = path.join('clients', clientSlug, 'outreach', 'outreach-pack.json');
const outreach = fs.existsSync(outreachPath) ? JSON.parse(fs.readFileSync(outreachPath, 'utf8')) : {};
const previewUrl = args['preview-url'] || args.previewUrl || outreach.previewUrl || '';
const provider = args.provider || process.env.CHECKOUT_PROVIDER || 'tally';
const purchaseBaseUrl = args['purchase-url'] || args.purchaseUrl || process.env.TALLY_PURCHASE_FORM_URL || process.env.STRIPE_PAYMENT_LINK_URL;
const feedbackBaseUrl = args['feedback-url'] || args.feedbackUrl || process.env.TALLY_FEEDBACK_FORM_URL || '';
const outputPath = args.output || path.join('clients', clientSlug, 'funnel', 'checkout.json');

const artifact = buildCheckoutArtifact({
  clientSlug,
  repo: args.repo || `matthew6688/${clientSlug}`,
  template: args.template || 'webjuice-restaurant',
  previewUrl,
  campaignId: args.campaign || process.env.DEFAULT_CAMPAIGN_ID || '',
  provider,
  purchaseBaseUrl,
  feedbackBaseUrl,
  tiers: parseTierPrices(args.tiers || process.env.CHECKOUT_TIER_PRICES || process.env.TALLY_TIER_PRICES),
  currency: args.currency || process.env.ROI_CURRENCY || 'USD',
});

saveCheckoutArtifact(artifact, outputPath);
const validation = validateCheckoutArtifact(artifact);

console.log(`Checkout artifact written: ${outputPath}`);
console.log(`Status: ${validation.ok ? 'ok' : 'failed'}`);
console.log(`Provider: ${artifact.provider}`);
console.log(`Tiers: ${artifact.tiers.map((tier) => `${tier.id}:${artifact.currency} ${tier.amount}`).join(', ')}`);
console.log(`Feedback URL: ${artifact.feedbackUrl || 'none'}`);

if (validation.errors.length) {
  console.log('\nErrors');
  for (const error of validation.errors) console.log(`- ${error}`);
}

process.exit(validation.ok ? 0 : 1);
