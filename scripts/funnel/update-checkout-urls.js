#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import {
  applyCheckoutFormUrls,
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

if (!args.client && !args.all) {
  console.error('Usage: node scripts/funnel/update-checkout-urls.js --client slug --one-time-url https://tally.so/r/... --yearly-url https://tally.so/r/... [--feedback-url https://tally.so/r/...] [--provider tally|stripe|self_stripe]');
  console.error('   or: node scripts/funnel/update-checkout-urls.js --all clients --one-time-url ... --yearly-url ...');
  process.exit(1);
}

const tierUrls = {
  one_time: args['one-time-url'] || args.oneTimeUrl || '',
  yearly_maintenance: args['yearly-url'] || args.yearlyUrl || '',
};

const clientSlugs = args.all
  ? fs.readdirSync(args.all === true ? 'clients' : args.all)
    .filter((name) => fs.existsSync(path.join('clients', name, 'funnel', 'checkout.json')))
  : [args.client];

for (const clientSlug of clientSlugs) {
  const checkoutPath = path.join('clients', clientSlug, 'funnel', 'checkout.json');
  const artifact = JSON.parse(fs.readFileSync(checkoutPath, 'utf8'));
  if (args.provider) artifact.provider = args.provider;
  const updated = applyCheckoutFormUrls(artifact, {
    tierUrls,
    feedbackUrl: args['feedback-url'] || args.feedbackUrl || '',
  });
  saveCheckoutArtifact(updated, checkoutPath);
  const validation = validateCheckoutArtifact(updated);
  console.log(`${clientSlug}: ${validation.ok ? 'ok' : 'failed'}`);
  for (const tier of updated.tiers) console.log(`- ${tier.id}: ${tier.purchaseUrl}`);
  if (updated.feedbackUrl) console.log(`- feedback: ${updated.feedbackUrl}`);
}
