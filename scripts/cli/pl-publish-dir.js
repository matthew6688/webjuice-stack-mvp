#!/usr/bin/env node
/**
 * pl:publish-dir · publish any HTML directory to Cloudflare Pages.
 *
 * Usage:
 *   npm run pl:publish-dir -- --dir <html-dir> --project <project-name> [--audit-report path] [--with-functions]
 *
 * Flags:
 *   --with-functions   Copy functions/api/contact.ts + core/cloudinary + core/funnel/email-template.js
 *                      + wrangler.toml into stage dir, so /api/contact endpoint works on this deploy.
 *                      Per codex R41 Q-YY-1 + landmine: WHITELIST copy only (NOT entire functions/ dir)
 *                      to avoid exposing admin/stripe/webhook endpoints publicly.
 *
 * Env: CF_API_TOKEN + CF_ACCOUNT_ID
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');

function parseArgs() {
  // Codex R41 Q-YY-7 fix: boolean flags don't consume next token
  const BOOLEAN_FLAGS = new Set(['with-functions', 'no-functions', 'dry-run']);
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
const srcDir = path.resolve(args.dir);
const projectName = String(args.project).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '').slice(0, 58);
const auditReportPath = args['audit-report'] ? path.resolve(args['audit-report']) : null;

const CF_TOKEN = process.env.CF_API_TOKEN;
const CF_ACCOUNT = process.env.CF_ACCOUNT_ID;
if (!CF_TOKEN || !CF_ACCOUNT) { console.error('CF_API_TOKEN + CF_ACCOUNT_ID required'); process.exit(1); }
if (!fs.existsSync(srcDir)) { console.error(`dir not found: ${srcDir}`); process.exit(1); }

console.log(`[publish-dir] ${path.relative(process.cwd(), srcDir)} → ${projectName}.pages.dev`);

// Stage: copy srcDir to stage. If audit-report provided + gate fails, add a top banner to index.html.
const stageDir = path.join('/tmp', `cf-stage-${projectName}-${Date.now()}`);
fs.mkdirSync(stageDir, { recursive: true });

function copyRec(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'run-events.sse') continue;
    if (e.isDirectory()) copyRec(path.join(src, e.name), path.join(dst, e.name));
    else fs.copyFileSync(path.join(src, e.name), path.join(dst, e.name));
  }
}
copyRec(srcDir, stageDir);

// Copy audit report as sibling JSON (no inline banner — banner pollutes design previews).
// If reviewers want to know gate status, link to /_audit-report.json explicitly.
if (auditReportPath && fs.existsSync(auditReportPath)) {
  fs.copyFileSync(auditReportPath, path.join(stageDir, '_audit-report.json'));
}

// Optionally copy MINIMAL client-contact handler for /api/client-contact endpoint
// (codex R42 · client-website form · 5 fields · NO Cloudinary · NO official-site contact.ts)
// Whitelist · DO NOT copy admin/ · stripe-webhook · contact.ts (those are ProfitsLocal main site only)
if (args['with-functions']) {
  const WHITELIST = [
    'functions/api/client-contact.ts',  // client-website handler · 5 fields · Resend only
    'wrangler.toml',                     // wrangler config (project-name overridden by --project-name)
  ];
  let copied = 0;
  for (const rel of WHITELIST) {
    const src = path.join(REPO, rel);
    if (!fs.existsSync(src)) {
      console.warn(`  ⚠ skip (not found): ${rel}`);
      continue;
    }
    const dst = path.join(stageDir, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
    copied++;
  }
  console.log(`  with-functions · copied ${copied}/${WHITELIST.length} files to stage`);
}

// Ensure CF Pages project exists
const url = `https://${projectName}.pages.dev`;
(async () => {
  const apiBase = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/pages/projects`;
  const getRes = await fetch(`${apiBase}/${projectName}`, { headers: { Authorization: `Bearer ${CF_TOKEN}` } });
  if (getRes.status === 404) {
    console.log(`  creating project ${projectName}...`);
    const createRes = await fetch(apiBase, {
      method: 'POST',
      headers: { Authorization: `Bearer ${CF_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: projectName, production_branch: 'main' }),
    });
    if (!createRes.ok) {
      console.error(`  ✗ project create failed: ${await createRes.text()}`);
      process.exit(1);
    }
  }

  console.log(`  deploying via wrangler...`);
  const env = { ...process.env, CLOUDFLARE_API_TOKEN: CF_TOKEN, CLOUDFLARE_ACCOUNT_ID: CF_ACCOUNT };
  const proc = spawn('wrangler', ['pages', 'deploy', stageDir, '--project-name', projectName, '--branch', 'main', '--commit-dirty=true', '--commit-message', `${projectName} ${new Date().toISOString()}`], { env, stdio: 'inherit' });
  proc.on('exit', (code) => {
    if (code !== 0) { console.error(`  ✗ wrangler exit ${code}`); process.exit(code || 1); }
    console.log(`  ✅ ${url}`);
  });
})().catch((e) => { console.error(e); process.exit(1); });
