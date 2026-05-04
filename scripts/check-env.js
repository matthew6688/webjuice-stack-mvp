#!/usr/bin/env node

const workflows = {
  deploy: ['CF_API_TOKEN', 'CF_ACCOUNT_ID', 'GH_PAT'],
  scrape: ['GOOGLE_PLACES_API_KEY', 'FIRECRAWL_API_KEY'],
  design: ['OPENAI_API_KEY'],
  funnel: ['TALLY_API_KEY'],
  outreach: ['RESEND_API_KEY'],
  emailDomainUpgrade: ['RESEND_MASTER_KEY'],
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
