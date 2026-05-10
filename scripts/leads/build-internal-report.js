#!/usr/bin/env node
/**
 * Build internal audit report HTML for one or more leads.
 *
 * Loads cheap-audit-v2 + detailed-audit (from fixtures dir) and writes
 * a self-contained HTML report to clients/<slug>/v2/internal-audit-report.html.
 *
 * Usage:
 *   npm run leads:build-internal-report -- --entity-key place_xxx
 *   npm run leads:build-internal-report -- --all
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { cheapAuditV2 } from '../../core/scoring/cheap-audit-v2.js';
import { renderInternalAuditHtml } from '../../core/reports/internal-audit-html.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

const args = parseArgs(process.argv.slice(2));
const entitiesDir = path.join(repoRoot, 'data/leads/entities');
const detailedDir = path.join(repoRoot, 'data/v2/fixtures/detailed-audit');
const screenshotsRoot = path.join(detailedDir, 'screenshots');
const visualResultsRoot = path.join(repoRoot, 'data/v2/fixtures/visual-autoresearch');

let targets = [];
if (args.all) {
  targets = fs.readdirSync(detailedDir)
    .filter((f) => f.endsWith('.json') && !f.startsWith('ledger-'))
    .map((f) => f.replace(/\.json$/, ''));
} else if (args['entity-key']) {
  targets = [args['entity-key']];
} else {
  console.error('Usage: --entity-key <key> OR --all');
  process.exit(1);
}

console.log(`[build-internal-report] targets=${targets.length}`);

const written = [];
for (const entityKey of targets) {
  const entityPath = path.join(entitiesDir, `${entityKey}.json`);
  if (!fs.existsSync(entityPath)) {
    console.warn(`[skip] no entity: ${entityKey}`);
    continue;
  }
  const entity = JSON.parse(fs.readFileSync(entityPath, 'utf8'));
  const slugRoot = slug(entity.latest?.name || entityKey);
  const clientV2Dir = path.join(repoRoot, 'clients', slugRoot, 'v2');
  fs.mkdirSync(clientV2Dir, { recursive: true });

  const cheapAudit = cheapAuditV2({ entity, sourceQuery: entity.latest?.sourceQuery });

  let detailedAudit = null;
  const detailedPath = path.join(detailedDir, `${entityKey}.json`);
  if (fs.existsSync(detailedPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(detailedPath, 'utf8'));
      detailedAudit = raw.detailed_audit || null;
    } catch {}
  }

  // Try to find visual_audit fixture (Block E output, may not yet exist)
  const visualAudit = findLatestVisualAudit(entityKey, visualResultsRoot);

  // Copy screenshots into client v2 dir for self-contained HTML
  const srcShotDir = path.join(screenshotsRoot, entityKey);
  const dstShotDir = path.join(clientV2Dir, 'screenshots');
  if (fs.existsSync(srcShotDir)) {
    fs.mkdirSync(dstShotDir, { recursive: true });
    for (const f of fs.readdirSync(srcShotDir)) {
      fs.copyFileSync(path.join(srcShotDir, f), path.join(dstShotDir, f));
    }
  }

  const html = renderInternalAuditHtml({
    entity, cheapAudit, detailedAudit, visualAudit,
    screenshotDir: 'screenshots',
  });
  const outPath = path.join(clientV2Dir, 'internal-audit-report.html');
  fs.writeFileSync(outPath, html);

  // Also publish under public/ so Astro serves it at /audit-reports/<entityKey>/...
  const publicDir = path.join(repoRoot, 'public/audit-reports', entityKey);
  fs.mkdirSync(path.join(publicDir, 'screenshots'), { recursive: true });
  fs.writeFileSync(path.join(publicDir, 'internal-audit-report.html'), html);
  if (fs.existsSync(srcShotDir)) {
    for (const f of fs.readdirSync(srcShotDir)) {
      fs.copyFileSync(path.join(srcShotDir, f), path.join(publicDir, 'screenshots', f));
    }
  }

  written.push({ entityKey, slug: slugRoot, path: outPath, public_url: `/audit-reports/${entityKey}/internal-audit-report.html`, hasDetailed: Boolean(detailedAudit), hasVisual: Boolean(visualAudit) });
  console.log(`  ✓ ${entity.latest?.name?.slice(0, 50)} → ${path.relative(repoRoot, outPath)}${detailedAudit ? '' : ' [cheap-only]'}${visualAudit ? ' +visual' : ''}`);
}

console.log('\n' + JSON.stringify({ ok: true, count: written.length, written }, null, 2));

function findLatestVisualAudit(entityKey, root) {
  if (!fs.existsSync(root)) return null;
  const runs = fs.readdirSync(root).sort().reverse();
  for (const run of runs) {
    const runDir = path.join(root, run);
    if (!fs.statSync(runDir).isDirectory()) continue;
    // Each run has subdirs per candidate; we want the consensus / preferred candidate
    // For now take qwen3.6 if present, else first non-error
    const candDirs = fs.readdirSync(runDir).filter((d) => fs.statSync(path.join(runDir, d)).isDirectory());
    // Prefer qwen-nothink over gemma3: qwen honestly admits blank/insufficient inputs;
    // gemma3 was observed hallucinating 4 issues on a blank screenshot. See
    // docs/v2/autoresearch-results/visual-auditor.md for the comparison.
    const preferOrder = ['ollama-qwen3.6-27b-nothink', 'ollama-qwen3.6-27b', 'ollama-gemma3-27b'];
    const ordered = [...preferOrder.filter((p) => candDirs.includes(p)), ...candDirs.filter((d) => !preferOrder.includes(d))];
    for (const cand of ordered) {
      const candFile = path.join(runDir, cand, `${entityKey}.json`);
      if (fs.existsSync(candFile)) {
        try {
          const r = JSON.parse(fs.readFileSync(candFile, 'utf8'));
          if (r.parsedJson) return r.parsedJson;
        } catch {}
      }
    }
  }
  return null;
}

function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    const k = argv[i].slice(2);
    const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true;
    out[k] = v;
  }
  return out;
}
