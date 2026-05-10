#!/usr/bin/env node
/**
 * Block G — End-to-end audit pipeline for one or more leads.
 *
 * Runs in sequence:
 *   1. Block D: detailed audit (Playwright full fetch + 6-dim 39-rule scoring)
 *   2. Block E: visual audit (Ollama vision on desktop screenshot)
 *   3. (optional, --with-reviews) Block D iter 6: Google Places + Ollama review analysis
 *   4. Block F: build internal HTML audit report
 *
 * Each stage caches its fixture so re-runs are cheap. Use --refetch to
 * force a fresh Playwright run; by default existing fixtures are reused.
 *
 * Usage:
 *   npm run leads:run-pipeline -- --entity-key place_xxx
 *   npm run leads:run-pipeline -- --entity-key place_xxx --with-reviews --refetch
 *   npm run leads:run-pipeline -- --all-audit-candidates
 *
 * Cost: T0 (Playwright + Ollama) by default; --with-reviews adds T2
 * Google Places (~$0.017 per lead).
 */

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { detailedAudit, reloadConfig } from '../../core/scoring/detailed-audit.js';
import { siteFetchFull } from '../../core/audit/site-fetch-full.js';
import { visionOllama } from '../../core/llm/vision-ollama.js';
import { buildVisualAuditPrompt } from '../../core/llm/visual-audit-prompt.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
loadDotEnvLocal(path.join(repoRoot, '.env.local'));
reloadConfig();

const args = parseArgs(process.argv.slice(2));
const entitiesDir = path.join(repoRoot, 'data/leads/entities');
const detailedDir = path.join(repoRoot, 'data/v2/fixtures/detailed-audit');
const visualDir = path.join(repoRoot, 'data/v2/fixtures/visual-autoresearch');
const screenshotsRoot = path.join(detailedDir, 'screenshots');
fs.mkdirSync(detailedDir, { recursive: true });

const VISION_MODEL = process.env.VISION_OLLAMA_MODEL || 'qwen3.6:27b';
const VISION_CAND_ID = 'ollama-qwen3.6-27b-nothink';
const refetch = args.refetch === true;
const withReviews = args['with-reviews'] === true;

let targets = [];
if (args.all || args['all-audit-candidates']) {
  targets = listAuditCandidateEntityKeys();
} else if (args['entity-key']) {
  targets = [args['entity-key']];
} else {
  console.error('Usage: --entity-key <key> | --all-audit-candidates  [--with-reviews] [--refetch]');
  process.exit(1);
}

console.log(`[run-pipeline] targets=${targets.length}  refetch=${refetch}  reviews=${withReviews}`);

const summary = [];
for (const entityKey of targets) {
  console.log(`\n══════════ ${entityKey} ══════════`);
  const entityPath = path.join(entitiesDir, `${entityKey}.json`);
  if (!fs.existsSync(entityPath)) {
    console.warn(`  ✗ no entity file`);
    summary.push({ entityKey, ok: false, reason: 'no entity' });
    continue;
  }
  const entity = JSON.parse(fs.readFileSync(entityPath, 'utf8'));
  const url = entity.latest?.website;
  const slug = slugifyName(entity.latest?.name || entityKey);

  // ── Stage 1: detailed audit (Playwright fetch + scoring) ─────────────
  const detailedPath = path.join(detailedDir, `${entityKey}.json`);
  let detailedFixture = null;
  if (!refetch && fs.existsSync(detailedPath)) {
    console.log(`  [stage 1/4] detailed audit — reuse cached fixture`);
    try { detailedFixture = JSON.parse(fs.readFileSync(detailedPath, 'utf8')); } catch {}
  }
  if (!detailedFixture && url) {
    console.log(`  [stage 1/4] detailed audit — fetching ${url}`);
    const screenshotDir = path.join(screenshotsRoot, entityKey);
    const ledgerPath = path.join(detailedDir, `ledger-${stamp()}.jsonl`);
    let fetchPayload = null;
    try {
      fetchPayload = await siteFetchFull({
        url, screenshotDir,
        ledgerPath, leadId: entityKey, clientSlug: slug,
        stage: 'detailed_audit', purpose: 'pipeline_full_fetch',
      });
    } catch (err) {
      console.warn(`     ⚠ fetch failed: ${err.message}`);
    }
    const audit = detailedAudit({ entity, fetchPayload, businessProfile: null });
    detailedFixture = {
      generatedAt: new Date().toISOString(),
      entity_input: { entityKey, latest: entity.latest, identifiers: entity.identifiers },
      fetch_summary: fetchPayload ? { url: fetchPayload.finalUrl || url, markdown_length: fetchPayload.markdown?.length || 0 } : null,
      detailed_audit: audit,
    };
    fs.writeFileSync(detailedPath, JSON.stringify(detailedFixture, null, 2) + '\n');
    console.log(`     → audit_score=${audit.audit_score}/100 decision=${audit.decision}`);
  } else if (!detailedFixture) {
    console.warn(`  ✗ no website URL on entity, can't run detailed audit`);
    summary.push({ entityKey, ok: false, reason: 'no website' });
    continue;
  }

  // ── Stage 2: visual audit (Ollama vision on desktop screenshot) ──────
  const desktopShot = path.join(screenshotsRoot, entityKey, 'desktop.png');
  const visualRunDir = path.join(visualDir, 'pipeline', VISION_CAND_ID);
  const visualPath = path.join(visualRunDir, `${entityKey}.json`);
  let visualFixture = null;
  if (!refetch && fs.existsSync(visualPath)) {
    console.log(`  [stage 2/4] visual audit — reuse cached fixture`);
    try { visualFixture = JSON.parse(fs.readFileSync(visualPath, 'utf8')); } catch {}
  }
  if (!visualFixture && fs.existsSync(desktopShot)) {
    console.log(`  [stage 2/4] visual audit — qwen3.6:27b nothink`);
    fs.mkdirSync(visualRunDir, { recursive: true });
    const prompt = buildVisualAuditPrompt({
      businessName: entity.latest?.name,
      niche: entity.latest?.niche,
      city: entity.latest?.city,
    });
    try {
      const out = await visionOllama({
        model: VISION_MODEL,
        prompt,
        imagePaths: [desktopShot],
        think: false,
        leadId: entityKey,
        clientSlug: slug,
        stage: 'visual_audit',
        purpose: 'pipeline_visual_audit',
      });
      visualFixture = { model: VISION_MODEL, candidateId: VISION_CAND_ID, latencyMs: out.latencyMs, parsedJson: out.parsedJson, rawText: out.parsedJson ? null : out.rawText?.slice(0, 2000) };
      fs.writeFileSync(visualPath, JSON.stringify(visualFixture, null, 2));
      const issues = out.parsedJson?.issues?.length || 0;
      console.log(`     → ${issues} visual issues, latency=${(out.latencyMs / 1000).toFixed(1)}s`);
    } catch (err) {
      console.warn(`     ⚠ vision failed: ${err.message}`);
    }
  } else if (!visualFixture) {
    console.warn(`  ! visual audit skipped (no desktop.png)`);
  }

  // ── Stage 3 (optional): review mining ────────────────────────────────
  // Just delegate to build-internal-report --with-reviews; it caches its
  // own fixture, so we don't duplicate that orchestration here.

  // ── Stage 4: HTML report build (delegates to existing CLI) ───────────
  console.log(`  [stage ${withReviews ? '3-4' : '4'}/4] build HTML report${withReviews ? ' (+ reviews)' : ''}`);
  const buildArgs = ['scripts/leads/build-internal-report.js', '--entity-key', entityKey];
  if (withReviews) buildArgs.push('--with-reviews');
  const r = spawnSync('node', ['--env-file=.env.local', ...buildArgs], {
    cwd: repoRoot, stdio: 'inherit',
  });
  if (r.status !== 0) {
    summary.push({ entityKey, ok: false, reason: `build-report exit ${r.status}` });
    continue;
  }

  summary.push({
    entityKey,
    name: entity.latest?.name,
    ok: true,
    audit_score: detailedFixture.detailed_audit?.audit_score,
    decision: detailedFixture.detailed_audit?.decision,
    visual_issues: visualFixture?.parsedJson?.issues?.length || 0,
    report_url: `/audit-reports/${entityKey}/internal-audit-report.html`,
  });
}

console.log('\n══════════ Pipeline summary ══════════');
console.table(summary);
console.log(JSON.stringify({ ok: summary.every((s) => s.ok), targets: summary.length, summary }, null, 2));

function listAuditCandidateEntityKeys() {
  const rescoreDir = path.join(repoRoot, 'data/v2/fixtures/rescore');
  if (!fs.existsSync(rescoreDir)) return [];
  const latest = fs.readdirSync(rescoreDir).filter((f) => f.endsWith('.json')).sort().reverse()[0];
  if (!latest) return [];
  const r = JSON.parse(fs.readFileSync(path.join(rescoreDir, latest), 'utf8'));
  return (r.rows || [])
    .filter((row) => row.v2?.action === 'audit_candidate' && row.website)
    .map((row) => row.entityKey);
}

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

function stamp() { return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19); }
function slugifyName(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
function loadDotEnvLocal(p) {
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
