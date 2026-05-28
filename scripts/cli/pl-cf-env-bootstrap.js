#!/usr/bin/env node
/**
 * pl:cf-env-bootstrap · Set required CF Pages env vars + secrets for a CLIENT-WEBSITE project.
 *
 * Run ONCE per <slug>-dev project after first deploy (codex R42 Q-ZZ-3).
 *
 * Usage:
 *   npm run pl:cf-env-bootstrap -- --project <project-name> --recipient <client@email>
 *
 * Examples (testing):
 *   npm run pl:cf-env-bootstrap -- --project vicwest-roofing-test --recipient matthewkiata@gmail.com
 *
 * Production (real client):
 *   npm run pl:cf-env-bootstrap -- --project vicwest-roofing --recipient sales@vicwest-roofing.com.au --client-name "Vicwest Roofing"
 *
 * Required env in .env.local:
 *   CF_API_TOKEN
 *   CF_ACCOUNT_ID
 *   RESEND_API_KEY
 *
 * Sets the following on the target project (production + preview env):
 *   - RESEND_API_KEY    (secret · ProfitsLocal shared default · from .env.local)
 *   - RECIPIENT_EMAIL   (plain · the client's lead-inbox · REQUIRED via --recipient)
 *   - FROM_EMAIL        (plain · default "Profits Local <hello@fengtalk.ai>" until profitslocal.com Resend verifies)
 *   - CLIENT_NAME       (plain · optional · shows in email subject "New enquiry · <name> · <visitor>")
 *
 * Future paid-tier (NOT set MVP · codex R42 Q-ZZ-2 d):
 *   - SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_FROM
 *
 * Uses CF API directly · NOT wrangler (cleaner · scriptable · no interactive prompts).
 */

function parseArgs() {
  const out = {};
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (a.startsWith('--')) out[a.slice(2)] = process.argv[++i];
  }
  return out;
}

const args = parseArgs();
const projectName = args.project;
if (!projectName) {
  console.error('Usage: --project <project-name> --recipient <email> [--from <email>] [--client-name <name>]');
  console.error('  --recipient is REQUIRED · the email where customer enquiries are sent');
  process.exit(1);
}

const CF_TOKEN = process.env.CF_API_TOKEN;
const CF_ACCOUNT = process.env.CF_ACCOUNT_ID;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
if (!CF_TOKEN || !CF_ACCOUNT) { console.error('CF_API_TOKEN + CF_ACCOUNT_ID required in .env.local'); process.exit(1); }
if (!RESEND_API_KEY) { console.error('RESEND_API_KEY required in .env.local'); process.exit(1); }

// Codex R42 Q-ZZ-3 · backward-compat alias `--notification` accepted but prefer `--recipient`
// Codex R42-followup Q-AAA-5 SHIP-BLOCKER: do NOT silently default to matthewkiata@gmail.com
// for production. Default ONLY when --test flag is explicit (prevents real client leads going to wrong inbox).
const RECIPIENT_FROM_ARG = args.recipient || args.notification || null;
if (!RECIPIENT_FROM_ARG && !args.test) {
  console.error('--recipient <email> is REQUIRED for production projects.');
  console.error('  For local testing only · use --test to default to matthewkiata@gmail.com');
  console.error('  Example: --project vicwest-roofing-test --recipient sales@vicwest-roofing.com.au');
  process.exit(1);
}
const RECIPIENT_EMAIL = RECIPIENT_FROM_ARG || 'matthewkiata@gmail.com';
const FROM_EMAIL = args.from || 'Profits Local <hello@fengtalk.ai>';
const CLIENT_NAME = args['client-name'] || null;

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(RECIPIENT_EMAIL)) {
  console.error(`Invalid recipient email: ${RECIPIENT_EMAIL}`);
  process.exit(1);
}

console.log(`[cf-env-bootstrap] project: ${projectName}`);
console.log(`  RECIPIENT_EMAIL = ${RECIPIENT_EMAIL}`);
console.log(`  FROM_EMAIL = ${FROM_EMAIL}`);
if (CLIENT_NAME) console.log(`  CLIENT_NAME = ${CLIENT_NAME}`);

const API_BASE = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/pages/projects/${projectName}`;

// CF Pages env vars API: PATCH project · `deployment_configs.production.env_vars`
const envVars = {
  RESEND_API_KEY: { value: RESEND_API_KEY, type: 'secret_text' },
  RECIPIENT_EMAIL: { value: RECIPIENT_EMAIL, type: 'plain_text' },
  FROM_EMAIL: { value: FROM_EMAIL, type: 'plain_text' },
};
if (CLIENT_NAME) envVars.CLIENT_NAME = { value: CLIENT_NAME, type: 'plain_text' };

const body = {
  deployment_configs: {
    production: { env_vars: envVars },
    preview: { env_vars: envVars },  // same vars in preview · simpler than divergent
  },
};

const res = await fetch(API_BASE, {
  method: 'PATCH',
  headers: {
    Authorization: `Bearer ${CF_TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(body),
});

if (!res.ok) {
  const err = await res.text();
  console.error(`✗ CF API error: ${res.status} ${err.slice(0, 300)}`);
  process.exit(1);
}

const json = await res.json();
const set = Object.keys(envVars);
console.log(`✅ ${projectName} · ${set.length} env vars set: ${set.join(', ')}`);
console.log(`   project URL: https://${projectName}.pages.dev`);
console.log(`   redeploy to pick up env: npm run pl:publish-dir -- --dir <dir> --project ${projectName} --with-functions`);
