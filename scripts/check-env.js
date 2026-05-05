#!/usr/bin/env node

import { loadLocalEnv } from '../core/env/load-local-env.js';

loadLocalEnv();

const workflows = {
  deploy: ['CF_API_TOKEN', 'CF_ACCOUNT_ID', 'GH_PAT'],
  scrape: ['GOOGLE_PLACES_API_KEY', 'FIRECRAWL_API_KEY'],
  design: ['OPENAI_API_KEY'],
  funnel: [
    'STRIPE_SECRET_KEY',
    'STRIPE_PUBLISHABLE_KEY',
    'RESEND_API_KEY',
    'FROM_EMAIL',
    'SALES_DISCORD_WEBHOOK_URL',
    'REVISE_DISCORD_WEBHOOK_URL',
    'GH_PAT',
  ],
  tally: ['TALLY_API_KEY'],
  stripe: ['STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY'],
  discord: ['SALES_DISCORD_WEBHOOK_URL', 'REVISE_DISCORD_WEBHOOK_URL'],
  websiteAgent: [
    'WEBSITE_TASKS_DISCORD_CHANNEL_ID',
    'WEBSITE_AGENT_MENTION',
    'WEBSITE_TASKS_DISCORD_BOT_TOKEN',
  ],
  outreach: ['RESEND_API_KEY'],
  emailDomainUpgrade: ['RESEND_MASTER_KEY'],
  localAudit: ['OLLAMA_MODEL', 'OLLAMA_URL'],
};

const args = process.argv.slice(2);
const requested = args.includes('--workflow')
  ? args[args.indexOf('--workflow') + 1]
  : null;

const selected = requested ? { [requested]: workflows[requested] } : workflows;

if (requested && !workflows[requested]) {
  console.error(`Unknown workflow "${requested}". Available: ${Object.keys(workflows).join(', ')}`);
  process.exit(1);
}

let missingCount = 0;

for (const [workflow, keys] of Object.entries(selected)) {
  console.log(`\n[${workflow}]`);
  for (const key of keys) {
    const isSet = Boolean(process.env[key]);
    if (!isSet) missingCount += 1;
    console.log(`${isSet ? '[ok]' : '[missing]'} ${key}${isSet ? '' : ' missing'}`);
  }
}

if (missingCount > 0) {
  console.log(`\n${missingCount} required environment variable(s) missing.`);
  process.exit(1);
}

console.log('\nAll required environment variables are set.');
