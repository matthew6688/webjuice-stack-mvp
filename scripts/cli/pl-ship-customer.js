#!/usr/bin/env node
/**
 * pl:ship-customer · One-liner to deploy a client site with form-to-email.
 *
 * Wraps the full 3-step deploy recipe into a single command:
 *   1. publish-dir  (first deploy · creates CF Pages project)
 *   2. cf-env-bootstrap  (set RECIPIENT_EMAIL + Resend key + optional CLIENT_NAME)
 *   3. publish-dir  (second deploy · functions now see env vars)
 *
 * Usage:
 *   npm run pl:ship-customer -- --slug vicwest-roofing --recipient sales@vicwest.com --client-name "Vicwest Roofing"
 *
 * Required:
 *   --slug <slug>           Client slug (reads clients/<slug>/v2/editorial-output/)
 *   --recipient <email>     Where form submissions go for THIS client
 *
 * Optional:
 *   --project <name>        CF Pages project name (default: <slug>-dev)
 *   --client-name <name>    Appears in email subject line
 *   --from <email>          Override FROM_EMAIL (default: Profits Local <leads@profitslocal.com>)
 *   --dry-run               Print commands without running them
 *
 * Env required (in .env.local):
 *   CF_API_TOKEN · CF_ACCOUNT_ID · RESEND_API_KEY
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');

// ── arg parsing ────────────────────────────────────────────────────────────
const BOOLEAN_FLAGS = new Set(['dry-run']);
function parseArgs() {
  const out = {};
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    if (BOOLEAN_FLAGS.has(key)) { out[key] = true; continue; }
    out[key] = process.argv[++i];
  }
  return out;
}

const args = parseArgs();
const DRY_RUN = !!args['dry-run'];

// ── validate ──────────────────────────────────────────────────────────────
const slug = args.slug;
const recipient = args.recipient;

if (!slug) {
  console.error('Usage: --slug <slug> --recipient <email> [--client-name "Name"] [--project <name>]');
  console.error('  --slug is the client folder name under clients/');
  process.exit(1);
}
if (!recipient) {
  console.error('--recipient <email> is REQUIRED · the email where form submissions go');
  process.exit(1);
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
  console.error(`Invalid recipient email: ${recipient}`);
  process.exit(1);
}

const outputDir = path.join(REPO, 'clients', slug, 'v2', 'editorial-output');
if (!fs.existsSync(path.join(outputDir, 'index.html'))) {
  console.error(`✗ No editorial output found at: ${outputDir}`);
  console.error(`  Run first: npm run pl:compose-editorial -- --slug ${slug}`);
  process.exit(1);
}

const projectName = (args.project || `${slug}-dev`).toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 58);
const clientName = args['client-name'] || null;
const fromEmail = args.from || null;

console.log(`\n[ship-customer] ${slug} → ${projectName}.pages.dev`);
console.log(`  recipient: ${recipient}`);
if (clientName) console.log(`  client-name: ${clientName}`);
if (DRY_RUN) console.log('  [DRY RUN — commands printed, not executed]\n');

// ── helpers ───────────────────────────────────────────────────────────────
function run(cmd, args, label) {
  const full = `${cmd} ${args.join(' ')}`;
  if (DRY_RUN) { console.log(`  [dry] ${full}`); return Promise.resolve(0); }

  console.log(`\n── ${label} ─────────────────────────────`);
  console.log(`  $ ${full}\n`);

  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', shell: false });
    child.on('close', code => {
      if (code === 0) resolve(code);
      else reject(new Error(`${label} failed (exit ${code})`));
    });
    child.on('error', reject);
  });
}

function npmRun(script, extraArgs) {
  return run('node', [
    '--env-file-if-exists=.env.local',
    `scripts/cli/${script}`,
    ...extraArgs,
  ], script);
}

// ── pipeline ─────────────────────────────────────────────────────────────
async function main() {
  try {
    // Step 1 · first deploy (creates project)
    await npmRun('pl-publish-dir.js', [
      '--dir', outputDir,
      '--project', projectName,
      '--with-functions',
    ]);

    // Step 2 · set env vars (Resend key + recipient + optional client name)
    const bootstrapArgs = [
      '--project', projectName,
      '--recipient', recipient,
    ];
    if (clientName) bootstrapArgs.push('--client-name', clientName);
    if (fromEmail) bootstrapArgs.push('--from', fromEmail);
    await npmRun('pl-cf-env-bootstrap.js', bootstrapArgs);

    // Step 3 · redeploy so functions pick up env vars
    console.log('\n── redeploy (env vars now live) ──────────────────────────');
    await npmRun('pl-publish-dir.js', [
      '--dir', outputDir,
      '--project', projectName,
      '--with-functions',
    ]);

    // ── done ───────────────────────────────────────────────────────────────
    console.log('\n✅  Ship complete!');
    console.log(`   Site:  https://${projectName}.pages.dev`);
    console.log(`   Form submissions → ${recipient}`);
    console.log('\nNext steps:');
    console.log('  1. Open the site and submit a test form → confirm email arrives');
    console.log('  2. When client pays / goes live: re-run with real domain project name');
    console.log(`     npm run pl:ship-customer -- --slug ${slug} --recipient ${recipient} --project <live-name>${clientName ? ` --client-name "${clientName}"` : ''}`);
  } catch (err) {
    console.error(`\n✗ ${err.message}`);
    process.exit(1);
  }
}

main();
