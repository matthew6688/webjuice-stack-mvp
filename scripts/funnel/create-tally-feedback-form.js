#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { loadLocalEnv } from '../../core/env/load-local-env.js';
import { buildTallyWebhookPayload, TallyApiClient } from '../../core/funnel/tally-api.js';
import {
  buildTallyFeedbackFormPayload,
  buildTallyFeedbackMcpPrompt,
} from '../../core/funnel/tally-feedback-form.js';
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

if (!args.client) {
  console.error('Usage: node scripts/funnel/create-tally-feedback-form.js --client slug [--dry-run]');
  process.exit(1);
}

const clientSlug = args.client;
const title = args.title || `Feedback for ${clientSlug}`;
const description = args.description || 'Tell us what to revise before launch.';
const webhookUrl = args['webhook-url'] || args.webhookUrl || process.env.TALLY_WEBHOOK_URL || '';
const thankYouUrl = args['thank-you-url'] || args.thankYouUrl || process.env.TALLY_THANK_YOU_URL || '';
const apiKey = process.env.TALLY_API_KEY;

if (args['mcp-prompt'] === 'true' || args.mcpPrompt === 'true') {
  console.log(buildTallyFeedbackMcpPrompt({
    businessName: title,
    webhookUrl,
    thankYouUrl,
  }));
  process.exit(0);
}

const payload = buildTallyFeedbackFormPayload({
  title,
  description,
  redirectUrl: thankYouUrl,
  status: args.publish === 'true' ? 'PUBLISHED' : 'DRAFT',
});
const validation = validateTallyFormPayload(payload);
if (!validation.ok) throw new Error(`Invalid Tally feedback payload: ${validation.errors.join('; ')}`);

if (args['dry-run'] === 'true' || args.dryRun === 'true' || !apiKey) {
  const outputPath = args.output || path.join('clients', clientSlug, 'funnel', 'tally-feedback-form-payload.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify({ payload }, null, 2)}\n`);
  console.log(`Dry-run Tally feedback form payload written: ${outputPath}`);
  if (!apiKey) console.log('TALLY_API_KEY is not set; skipped live Tally form creation.');
  process.exit(0);
}

const client = new TallyApiClient({ apiKey });
const form = await client.createForm(payload);
if (webhookUrl) await client.createWebhook(buildTallyWebhookPayload({
  formId: form.id,
  url: webhookUrl,
  signingSecret: process.env.TALLY_WEBHOOK_SIGNING_SECRET || '',
}));

console.log(`Tally feedback form created: https://tally.so/r/${form.id}`);
