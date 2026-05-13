#!/usr/bin/env node
/**
 * pl:publish-demo · M3 publish · push reference-adapter HTML to Cloudflare Pages
 *
 * Source:  clients/<slug>/v2/concept/reference-adapter/index.html + assets/
 * Target:  <slug>-dev.pages.dev (auto-created if not exists)
 *
 * Also includes ../customer-facing-audit.html in deploy (so the "Read full report"
 * banner link works on the live URL).
 *
 * Cost: $0 · Cloudflare Pages free tier (1 deploy unit each).
 *
 * Usage:
 *   npm run pl:publish-demo -- --slug <customer-slug>
 *
 * Env required:
 *   CF_API_TOKEN     - Cloudflare API token (Pages:Edit scope)
 *   CF_ACCOUNT_ID    - Cloudflare account ID
 */
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');

const args = parseArgs(process.argv.slice(2));
const slug = args.slug;
if (!slug) {
  console.error('Usage: pl:publish-demo -- --slug <customer-slug>');
  process.exit(1);
}

const CF_TOKEN = process.env.CF_API_TOKEN;
const CF_ACCOUNT = process.env.CF_ACCOUNT_ID;
if (!CF_TOKEN || !CF_ACCOUNT) {
  console.error('CF_API_TOKEN and CF_ACCOUNT_ID must be set in env');
  process.exit(1);
}

const adapterDir = path.join(REPO, 'clients', slug, 'v2', 'concept', 'reference-adapter');
const adapterHtml = path.join(adapterDir, 'index.html');
if (!fs.existsSync(adapterHtml)) {
  console.error(`reference-adapter HTML not found: ${adapterHtml}`);
  console.error(`  run: npm run pl:build-from-reference -- --slug ${slug}`);
  process.exit(1);
}

// Project name: <slug>-dev. CF Pages requires lowercase, hyphens, ≤58 chars.
const projectName = `${slug}-dev`.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '').slice(0, 58);

// Stage deploy dir: copy adapter HTML + assets + customer-facing-audit.html
const stageDir = path.join(REPO, 'data', 'qa', `cf-pages-stage-${slug}-${Date.now()}`);
fs.mkdirSync(stageDir, { recursive: true });

console.log(`[pl:publish-demo] slug:    ${slug}`);
console.log(`[pl:publish-demo] project: ${projectName}`);
console.log(`[pl:publish-demo] stage:   ${stageDir}`);

// 1. Copy adapter HTML (renamed to index.html at project root)
fs.copyFileSync(adapterHtml, path.join(stageDir, 'index.html'));

// 2. Copy assets dir
const adapterAssets = path.join(adapterDir, 'assets');
if (fs.existsSync(adapterAssets)) {
  const dest = path.join(stageDir, 'assets');
  fs.mkdirSync(dest, { recursive: true });
  for (const f of fs.readdirSync(adapterAssets)) {
    fs.copyFileSync(path.join(adapterAssets, f), path.join(dest, f));
  }
  console.log(`[pl:publish-demo] copied ${fs.readdirSync(adapterAssets).length} asset files`);
}

// 3. Copy customer-facing-audit.html (banner link target ../customer-facing-audit.html)
const customerAudit = path.join(REPO, 'clients', slug, 'v2', 'customer-facing-audit.html');
if (fs.existsSync(customerAudit)) {
  // adapter HTML uses href="../customer-facing-audit.html" — at the deployed root
  // we need both index.html (the demo) AND a customer-facing-audit.html accessible.
  // Strategy: put adapter HTML at /index.html and customer-audit at /audit/index.html,
  // then the banner link "../customer-facing-audit.html" resolves to root /customer-facing-audit.html.
  // Simpler: put customer-audit at /customer-facing-audit.html at root.
  fs.copyFileSync(customerAudit, path.join(stageDir, 'customer-facing-audit.html'));
  // Rewrite adapter HTML to use ./customer-facing-audit.html (sibling) instead of ../
  const html = fs.readFileSync(path.join(stageDir, 'index.html'), 'utf8');
  fs.writeFileSync(path.join(stageDir, 'index.html'),
    html.replace(/\.\.\/customer-facing-audit\.html/g, './customer-facing-audit.html'));
  console.log(`[pl:publish-demo] included customer-facing-audit.html`);
}

// V3 D28 (2026-05-13) · 把 master.md (internal source-of-truth) + master.report.html
// 也部署到 CF Pages · 操作员/Matthew 能远程查任意 entity 完整 audit (含 Chinese version)
const masterMd = path.join(REPO, 'clients', slug, 'v2', 'master.md');
const masterReportHtml = path.join(REPO, 'clients', slug, 'v2', 'master.report.html');
const internalAuditHtml = path.join(REPO, 'clients', slug, 'v2', 'internal-audit-report.html');
if (fs.existsSync(masterMd)) {
  fs.copyFileSync(masterMd, path.join(stageDir, 'master.md'));
  console.log(`[pl:publish-demo] included master.md`);
}
if (fs.existsSync(masterReportHtml)) {
  fs.copyFileSync(masterReportHtml, path.join(stageDir, 'master.report.html'));
  console.log(`[pl:publish-demo] included master.report.html`);
}
if (fs.existsSync(internalAuditHtml)) {
  fs.copyFileSync(internalAuditHtml, path.join(stageDir, 'internal-audit-report.html'));
  console.log(`[pl:publish-demo] included internal-audit-report.html`);
}
// Also copy screenshots/evidence/video dirs so they render inline
for (const sub of ['screenshots', 'evidence', 'video']) {
  const srcDir = path.join(REPO, 'clients', slug, 'v2', sub);
  if (!fs.existsSync(srcDir)) continue;
  const destDir = path.join(stageDir, sub);
  fs.mkdirSync(destDir, { recursive: true });
  for (const f of fs.readdirSync(srcDir)) {
    fs.copyFileSync(path.join(srcDir, f), path.join(destDir, f));
  }
}

// 4. Try to create project (idempotent · ignore if exists)
console.log(`\n[pl:publish-demo] ensuring project exists...`);
const createRes = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/pages/projects`,
  {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${CF_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: projectName,
      production_branch: 'main',
    }),
  }
);
const createBody = await createRes.json();
if (createRes.ok) {
  console.log(`[pl:publish-demo] ✓ project created`);
} else if (createBody?.errors?.[0]?.message?.includes('already exists')) {
  console.log(`[pl:publish-demo] ✓ project already exists · reusing`);
} else {
  console.error(`[pl:publish-demo] ✗ project create failed: ${JSON.stringify(createBody?.errors || createBody).slice(0, 500)}`);
  process.exit(1);
}

// 5. Deploy via wrangler CLI
console.log(`\n[pl:publish-demo] deploying ${stageDir} → ${projectName}.pages.dev\n`);
const env = {
  ...process.env,
  CLOUDFLARE_API_TOKEN: CF_TOKEN,
  CLOUDFLARE_ACCOUNT_ID: CF_ACCOUNT,
};
const proc = spawn('wrangler', [
  'pages', 'deploy', stageDir,
  '--project-name', projectName,
  '--branch', 'main',
  '--commit-dirty=true',
], { env, stdio: 'inherit' });

proc.on('exit', async (code) => {
  if (code !== 0) {
    console.error(`\n[pl:publish-demo] ✗ wrangler exit ${code}`);
    process.exit(code || 1);
  }
  const url = `https://${projectName}.pages.dev`;
  console.log(`\n[pl:publish-demo] ✅ DONE`);
  console.log(`  Demo URL:           ${url}`);
  console.log(`  Customer audit URL: ${url}/customer-facing-audit.html`);
  console.log(`  master.md URL:      ${url}/master.md`);
  console.log(`  Internal HTML URL:  ${url}/internal-audit-report.html`);
  // Persist deploy record
  const record = {
    slug, projectName,
    deployed_at: new Date().toISOString(),
    demo_url: url,
    audit_url: `${url}/customer-facing-audit.html`,
    master_md_url: `${url}/master.md`,
    internal_audit_url: `${url}/internal-audit-report.html`,
    master_report_url: `${url}/master.report.html`,
    stage_dir: stageDir,
  };
  const recordDir = path.join(REPO, 'clients', slug, 'v2', 'concept', 'reference-adapter');
  fs.writeFileSync(path.join(recordDir, 'cf-pages-deploy.json'), JSON.stringify(record, null, 2));
  console.log(`  Record:             ${path.join(recordDir, 'cf-pages-deploy.json')}`);
});

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq > 2) { out[a.slice(2, eq)] = a.slice(eq + 1); continue; }
    const k = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) { out[k] = true; continue; }
    out[k] = next; i++;
  }
  return out;
}
