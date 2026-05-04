#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import {
  buildTallyFeedbackFormPayload,
  buildTallyFeedbackMcpPrompt,
} from '../../core/funnel/tally-feedback-form.js';

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

if (args['dry-run'] === 'true' || args.dryRun === 'true' || !apiKey) {
  const outputPath = args.output || path.join('clients', clientSlug, 'funnel', 'tally-feedback-form-payload.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify({ payload }, null, 2)}\n`);
  console.log(`Dry-run Tally feedback form payload written: ${outputPath}`);
  if (!apiKey) console.log('TALLY_API_KEY is not set; skipped live Tally form creation.');
  process.exit(0);
}

const form = await createTallyForm(apiKey, payload);
if (webhookUrl) await createTallyWebhook(apiKey, form.id, webhookUrl);

console.log(`Tally feedback form created: https://tally.so/r/${form.id}`);

async function createTallyForm(token, formPayload) {
  const response = await fetch('https://api.tally.so/forms', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(formPayload),
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
