#!/usr/bin/env node
/**
 * Visual Audit autoresearch — Block E iter 1.
 *
 * Goal: pick the cheapest vision model that produces actionable
 * (why/what-correct/how-to-fix) visual_audit output. Local Ollama
 * candidates first; if quality insufficient we add paid API in iter 2.
 *
 * Inputs: existing detailed-audit screenshots (data/v2/fixtures/
 *   detailed-audit/screenshots/<entityKey>/desktop.png + mobile.png).
 *
 * Output:
 *   data/v2/fixtures/visual-autoresearch/<ts>/<model>/<entityKey>.json
 *   docs/v2/autoresearch-results/visual-auditor.md (regenerated)
 *
 * Models tested in this run:
 *   - ollama qwen3.6:27b (T0)
 *   - ollama gemma3:27b  (T0)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { visionOllama, tryExtractJson } from '../../core/llm/vision-ollama.js';
import { buildVisualAuditPrompt } from '../../core/llm/visual-audit-prompt.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

const CANDIDATES = [
  // qwen3 family has thinking enabled by default; we pass think:false because vision-audit
  // is a structured extraction task, not a reasoning task. Thinking adds latency + noise.
  { id: 'ollama-qwen3.6-27b-nothink', model: 'qwen3.6:27b', adapter: 'ollama', tier: 'T0', think: false },
  { id: 'ollama-gemma3-27b',          model: 'gemma3:27b',  adapter: 'ollama', tier: 'T0' },
];

const SCREENSHOT_ROOT = path.join(repoRoot, 'data/v2/fixtures/detailed-audit/screenshots');
const ENTITIES_ROOT = path.join(repoRoot, 'data/leads/entities');

const fixtures = fs.readdirSync(SCREENSHOT_ROOT)
  .filter((d) => fs.existsSync(path.join(SCREENSHOT_ROOT, d, 'desktop.png')))
  .map((entityKey) => {
    const entityPath = path.join(ENTITIES_ROOT, `${entityKey}.json`);
    const entity = fs.existsSync(entityPath) ? JSON.parse(fs.readFileSync(entityPath, 'utf8')) : null;
    return {
      entityKey,
      entity,
      desktopPath: path.join(SCREENSHOT_ROOT, entityKey, 'desktop.png'),
      mobilePath: path.join(SCREENSHOT_ROOT, entityKey, 'mobile.png'),
    };
  });

console.log(`[visual-autoresearch] candidates=${CANDIDATES.length} fixtures=${fixtures.length}`);
if (!fixtures.length) {
  console.error('No screenshot fixtures found. Run scoring:test-detailed-audit first.');
  process.exit(1);
}

const startedAt = new Date();
const stamp = startedAt.toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outDir = path.join(repoRoot, 'data/v2/fixtures/visual-autoresearch', stamp);
fs.mkdirSync(outDir, { recursive: true });
const ledgerPath = path.join(outDir, 'ledger.jsonl');

const matrix = [];

for (const cand of CANDIDATES) {
  console.log(`\n══ ${cand.id} (${cand.tier}) ══`);
  const candDir = path.join(outDir, cand.id);
  fs.mkdirSync(candDir, { recursive: true });

  for (const fx of fixtures) {
    const businessName = fx.entity?.latest?.name || fx.entityKey;
    const niche = fx.entity?.latest?.niche || fx.entity?.latest?.category;
    const city = fx.entity?.latest?.city;
    const prompt = buildVisualAuditPrompt({ businessName, niche, city, hasMobile: fs.existsSync(fx.mobilePath) });

    process.stdout.write(`  ${businessName.slice(0, 40).padEnd(40)} ... `);
    const t0 = Date.now();
    let result;
    try {
      const imgs = [fx.desktopPath];
      if (fs.existsSync(fx.mobilePath)) imgs.push(fx.mobilePath);
      const r = await (cand.adapter === 'ollama'
        ? visionOllama({
            model: cand.model, prompt, imagePaths: imgs,
            think: cand.think,
            ledgerPath,
            leadId: fx.entityKey,
            clientSlug: slug(fx.entity?.latest?.name),
            stage: 'visual_autoresearch',
            purpose: `visual_audit_${cand.id}`,
          })
        : Promise.reject(new Error(`unknown adapter: ${cand.adapter}`)));
      result = r;
    } catch (err) {
      console.log(`failed: ${err.message?.slice(0, 60)}`);
      matrix.push({ candidate: cand.id, entityKey: fx.entityKey, error: err.message });
      continue;
    }

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    const parsed = result.parsedJson;
    const issueCount = parsed?.issues?.length || 0;
    const hasAllFields = parsed?.issues?.every((i) =>
      i.what_observed && i.why_problem && i.what_correct_looks_like && i.how_to_fix_in_redesign
    ) || false;
    console.log(`${elapsed}s  ${parsed ? `parsed (${issueCount} issues, all-fields=${hasAllFields})` : 'JSON parse failed'}`);

    fs.writeFileSync(path.join(candDir, `${fx.entityKey}.json`), JSON.stringify({
      candidate: cand,
      fixture: { entityKey: fx.entityKey, businessName, niche, city },
      latencyMs: result.latencyMs,
      tokensIn: result.tokensIn, tokensOut: result.tokensOut,
      costUsd: result.costUsd,
      rawText: result.rawText,
      parsedJson: parsed,
    }, null, 2) + '\n');

    matrix.push({
      candidate: cand.id,
      tier: cand.tier,
      entityKey: fx.entityKey,
      businessName,
      latencyMs: result.latencyMs,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      costUsd: result.costUsd,
      jsonParsed: Boolean(parsed),
      issueCount,
      hasAllRequiredFields: hasAllFields,
      summary: parsed?.summary,
      freshness: parsed?.freshness_score,
      trust: parsed?.trust_score,
      conversion: parsed?.conversion_score,
      designAge: parsed?.design_age_estimate,
      topIssue: parsed?.issues?.[0],
    });
  }
}

// Aggregate
const finishedAt = new Date();
const durationSec = ((finishedAt - startedAt) / 1000).toFixed(1);

const byCand = {};
for (const r of matrix) {
  if (!byCand[r.candidate]) byCand[r.candidate] = [];
  byCand[r.candidate].push(r);
}

// Markdown report
const reportPath = path.join(repoRoot, 'docs/v2/autoresearch-results/visual-auditor.md');
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
const md = renderMarkdown({ startedAt, durationSec, fixtures, candidates: CANDIDATES, matrix, byCand, outDir });
fs.writeFileSync(reportPath, md);

const summary = {
  ok: true,
  duration_seconds: Number(durationSec),
  fixtures: fixtures.length,
  candidates: CANDIDATES.map((c) => c.id),
  output_dir: path.relative(repoRoot, outDir),
  report: path.relative(repoRoot, reportPath),
  per_candidate: Object.fromEntries(Object.entries(byCand).map(([k, v]) => [k, {
    avg_latency_s: avg(v.map((r) => r.latencyMs / 1000)),
    parse_success_rate: v.filter((r) => r.jsonParsed).length / v.length,
    has_all_fields_rate: v.filter((r) => r.hasAllRequiredFields).length / v.length,
    avg_issues_per_lead: avg(v.map((r) => r.issueCount || 0)),
  }])),
};
console.log('\n' + JSON.stringify(summary, null, 2));

function renderMarkdown({ startedAt, durationSec, fixtures, candidates, matrix, byCand, outDir }) {
  const L = [];
  L.push('# Visual Auditor — Autoresearch');
  L.push('');
  L.push(`Generated: ${startedAt.toISOString()}`);
  L.push(`Duration: ${durationSec}s`);
  L.push(`Fixtures: ${fixtures.length} · Candidates: ${candidates.length}`);
  L.push('');
  L.push('## Per-candidate summary');
  L.push('');
  L.push('| Candidate | Tier | Parse rate | All-fields rate | Avg latency | Avg issues |');
  L.push('|---|---|---|---|---|---|');
  for (const cand of candidates) {
    const rows = byCand[cand.id] || [];
    if (!rows.length) {
      L.push(`| ${cand.id} | ${cand.tier} | (no runs) | | | |`);
      continue;
    }
    const parseRate = pct(rows.filter((r) => r.jsonParsed).length / rows.length);
    const fieldsRate = pct(rows.filter((r) => r.hasAllRequiredFields).length / rows.length);
    const avgLat = avg(rows.map((r) => r.latencyMs / 1000)).toFixed(1) + 's';
    const avgIssues = avg(rows.map((r) => r.issueCount || 0)).toFixed(1);
    L.push(`| **${cand.id}** | ${cand.tier} | ${parseRate} | ${fieldsRate} | ${avgLat} | ${avgIssues} |`);
  }
  L.push('');
  L.push('## Side-by-side per fixture');
  L.push('');
  for (const fx of fixtures) {
    const fxRows = matrix.filter((r) => r.entityKey === fx.entityKey);
    if (!fxRows.length) continue;
    L.push(`### ${fxRows[0].businessName || fx.entityKey}`);
    L.push('');
    L.push('| Candidate | Parsed | Issues | Fresh | Trust | Conv | Design age | Summary |');
    L.push('|---|---|---|---|---|---|---|---|');
    for (const r of fxRows) {
      L.push(`| ${r.candidate} | ${r.jsonParsed ? 'yes' : 'no'} | ${r.issueCount || 0} | ${r.freshness ?? '-'} | ${r.trust ?? '-'} | ${r.conversion ?? '-'} | ${r.designAge || '-'} | ${(r.summary || '').slice(0, 80)} |`);
    }
    L.push('');
    // Show first issue from each candidate side-by-side
    L.push('**First issue per candidate:**');
    L.push('');
    for (const r of fxRows) {
      if (!r.topIssue) continue;
      const t = r.topIssue;
      L.push(`- **${r.candidate}** — ${t.severity}: ${t.title}`);
      if (t.what_observed) L.push(`  - observed: ${t.what_observed}`);
      if (t.why_problem) L.push(`  - why problem: ${t.why_problem}`);
      if (t.what_correct_looks_like) L.push(`  - correct: ${t.what_correct_looks_like}`);
      if (t.how_to_fix_in_redesign) L.push(`  - fix: ${t.how_to_fix_in_redesign}`);
    }
    L.push('');
  }
  L.push('## Decision');
  L.push('');
  L.push('Pick the cheapest candidate that meets ALL of:');
  L.push('- parse_success_rate >= 100%');
  L.push('- has_all_fields_rate >= 80% (every issue has all 4 actionable fields)');
  L.push('- issues identified are visually grounded (judged by reading the side-by-side above)');
  L.push('');
  L.push('If T0 (ollama) candidates pass, use them — zero cost. Otherwise add paid models in iter 2.');
  L.push('');
  L.push('## Regenerate');
  L.push('');
  L.push('```');
  L.push('npm run audit:test-visual-autoresearch');
  L.push('```');
  L.push('');
  L.push(`Per-candidate raw outputs: ${path.relative(path.dirname(reportPath), outDir)}`);
  L.push('');
  return L.join('\n');
}

function avg(xs) {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
function pct(x) { return (x * 100).toFixed(0) + '%'; }
function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
