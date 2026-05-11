#!/usr/bin/env node
/**
 * Build the master MD document for one or more leads, optionally followed
 * by huashu-md-html → polished standalone HTML in the chosen theme.
 *
 * The MD file is the source of truth — everything else (sales report,
 * client proposal, hyperframes video) derives from it.
 *
 * Usage:
 *   npm run leads:build-master-md -- --entity-key place_xxx
 *   npm run leads:build-master-md -- --all-with-detailed --theme report
 *   npm run leads:build-master-md -- --entity-key place_xxx --theme article --html
 *
 * Themes: article (default) / report / reading / interactive / wechat
 * --html: also invoke huashu-md-html md_to_html.py to produce
 *         clients/<slug>/v2/master.<theme>.html
 */

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { writeMasterMd } from '../../core/reports/master-md-builder.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

const args = parseArgs(process.argv.slice(2));
const entitiesDir = path.join(repoRoot, 'data/leads/entities');
const detailedDir = path.join(repoRoot, 'data/v2/fixtures/detailed-audit');
const visualRoot = path.join(repoRoot, 'data/v2/fixtures/visual-autoresearch');
const reviewsDir = path.join(repoRoot, 'data/v2/fixtures/reviews');
const renderHtml = args.html === true;
const theme = args.theme || 'article';

const HUASHU_SCRIPT = path.join(process.env.HOME || '/Users/matthew', '.claude/skills/.agents/skills/huashu-md-html/scripts/md_to_html.py');

let targets = [];
if (args.all || args['all-with-detailed']) {
  targets = fs.readdirSync(detailedDir)
    .filter((f) => f.endsWith('.json') && !f.startsWith('ledger-'))
    .map((f) => f.replace(/\.json$/, ''));
} else if (args['entity-key']) {
  targets = [args['entity-key']];
} else {
  console.error('Usage: --entity-key <key> | --all-with-detailed  [--theme article|report|reading|interactive|wechat] [--html]');
  process.exit(1);
}

console.log(`[build-master-md] targets=${targets.length} theme=${theme} html=${renderHtml}`);

const results = [];
for (const entityKey of targets) {
  const entityPath = path.join(entitiesDir, `${entityKey}.json`);
  if (!fs.existsSync(entityPath)) {
    console.warn(`  ✗ no entity: ${entityKey}`);
    continue;
  }
  const entity = JSON.parse(fs.readFileSync(entityPath, 'utf8'));
  const slugRoot = slug(entity.latest?.name || entityKey);
  const clientV2Dir = path.join(repoRoot, 'clients', slugRoot, 'v2');

  const detailedPath = path.join(detailedDir, `${entityKey}.json`);
  const detailed = fs.existsSync(detailedPath) ? JSON.parse(fs.readFileSync(detailedPath, 'utf8')) : null;
  const detailedAudit = detailed?.detailed_audit || null;

  const visualAudit = findLatestVisualAudit(entityKey, visualRoot);

  const reviewPath = path.join(reviewsDir, `${entityKey}.json`);
  const reviewBundle = fs.existsSync(reviewPath) ? JSON.parse(fs.readFileSync(reviewPath, 'utf8')) : null;
  const reviewAnalysis = reviewBundle?.analysis || null;
  const reviewSample = reviewBundle?.fetched?.reviews || null;

  const techStack = detailed?.tech_stack || null;
  const sitemapAnalysis = detailed?.sitemap_analysis || null;
  const activity = detailed?.activity || null;
  const aiGeo = detailed?.ai_geo || null;
  const pagespeed = detailed?.pagespeed || null;
  const formAudit = detailed?.form_audit || null;
  const domainHistory = detailed?.domain_history || null;
  const imageOptimization = detailed?.image_optimization || null;
  const trustSignals = detailed?.trust_signals || null;
  const thirdPartyWeight = detailed?.third_party_weight || null;

  const manifestPath = path.join(clientV2Dir, 'cloudinary-manifest.json');
  const cloudinaryManifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : null;

  const outputMd = path.join(clientV2Dir, 'master.md');
  const built = writeMasterMd({
    outputPath: outputMd,
    entity, detailedAudit, visualAudit, reviewAnalysis, reviewSample,
    reviewBundle: reviewBundle?.fetched || null,
    techStack,
    sitemapAnalysis,
    activity,
    aiGeo,
    pagespeed,
    formAudit,
    domainHistory,
    imageOptimization,
    trustSignals,
    thirdPartyWeight,
    cloudinaryManifest,
    screenshotDir: './screenshots',
  });

  console.log(`  ✓ ${(entity.latest?.name || entityKey).slice(0, 50)} → ${path.relative(repoRoot, outputMd)}  (${(built.byteLength / 1024).toFixed(1)}KB · ${built.sectionCount} sections)`);

  let htmlPath = null;
  if (renderHtml) {
    htmlPath = path.join(clientV2Dir, `master.${theme}.html`);
    const docTitle = `${entity.latest?.name || entityKey} · 现状审计与重构提议`;
    const r = spawnSync(HUASHU_SCRIPT, [outputMd, '-o', htmlPath, '--theme', theme, '--standalone', '--title', docTitle, '--quiet'], { encoding: 'utf8' });
    if (r.status !== 0) {
      console.warn(`     ⚠ huashu-md-html failed: ${r.stderr?.slice(0, 200)}`);
      htmlPath = null;
    } else {
      // Mirror to public/ so Astro serves at /audit-reports/<key>/master.<theme>.html
      const publicDir = path.join(repoRoot, 'public/audit-reports', entityKey);
      if (fs.existsSync(publicDir)) {
        fs.copyFileSync(htmlPath, path.join(publicDir, `master.${theme}.html`));
      }
      console.log(`     → ${path.relative(repoRoot, htmlPath)}  (theme=${theme})`);
    }
  }

  results.push({ entityKey, slug: slugRoot, mdPath: outputMd, htmlPath, frontmatter: built.frontmatter });
}

console.log('\n' + JSON.stringify({ ok: true, count: results.length, results: results.map((r) => ({ entityKey: r.entityKey, slug: r.slug, md: path.relative(repoRoot, r.mdPath), html: r.htmlPath ? path.relative(repoRoot, r.htmlPath) : null })) }, null, 2));

function findLatestVisualAudit(entityKey, root) {
  if (!fs.existsSync(root)) return null;
  const runs = fs.readdirSync(root).sort().reverse();
  for (const run of runs) {
    const runDir = path.join(root, run);
    if (!fs.statSync(runDir).isDirectory()) continue;
    const candDirs = fs.readdirSync(runDir).filter((d) => fs.statSync(path.join(runDir, d)).isDirectory());
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
