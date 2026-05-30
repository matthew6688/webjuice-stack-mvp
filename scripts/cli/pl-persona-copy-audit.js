#!/usr/bin/env node
/**
 * pl-persona-copy-audit · COPY-QUALITY audit from the TARGET BUYER's perspective (Matthew 2026-05-30).
 *
 * Complements the deterministic gates (pl-copy-audit honesty/density + pl-audit-v4 voice/structure):
 * those verify the copy is HONEST and well-formed; this judges whether it actually PERSUADES the
 * client's primary buyer persona (core/audit/personas/<segment>.js). Subjective → N-run averaged
 * (vision-noise lesson) · ADVISORY (a score + concrete copy gaps), not a hard batch gate.
 *
 * Usage:
 *   npm run pl:persona-copy-audit -- --slug vicwest-roofing [--runs 3] [--segment planned-upgrade] [--json out.json]
 *   npm run pl:persona-copy-audit -- --html <file> --segment planned-upgrade
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import { runPersonaCopyJudge } from '../../core/audit/persona-copy-judge.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === '--slug') args.slug = process.argv[++i];
  else if (a === '--html') args.html = process.argv[++i];
  else if (a === '--segment') args.segment = process.argv[++i];
  else if (a === '--runs') args.runs = parseInt(process.argv[++i], 10);
  else if (a === '--json') args.json = process.argv[++i];
}
const RUNS = Math.max(1, Math.min(args.runs || 3, 5));

function loadBriefCtx(slug) {
  const briefPath = path.join(REPO, 'clients', slug, 'v2', 'single-page-brief.yaml');
  let brief = {};
  try { brief = yaml.load(fs.readFileSync(briefPath, 'utf8')) || {}; } catch {}
  const facts = {
    business_name: brief.business_name,
    licence: brief.license ? `${brief.license.authority || ''} ${brief.license.number || ''}`.trim() : null,
    phone: brief.phone?.display, abn: brief.abn,
    service_area: brief.service_area_primary_suburb, suburbs_covered: (brief.suburbs_covered || []).length,
    services: (brief.services || []).map((s) => s.name), state: brief.state,
  };
  return { primary_segment: args.segment || brief.primary_segment || 'planned-upgrade', facts, brief };
}

const CRITERIA = ['job_fit', 'decision_enablement', 'objection_handling', 'trust_levers', 'bounce_avoidance', 'information_level', 'voice_fit', 'clarity_next_step'];

(async () => {
  let htmlFiles, ctx;
  if (args.slug) {
    htmlFiles = [path.join(REPO, 'clients', args.slug, 'v2/editorial-output/index.html')];
    ctx = loadBriefCtx(args.slug);
  } else if (args.html) {
    htmlFiles = [args.html];
    ctx = { primary_segment: args.segment || 'planned-upgrade', facts: {} };
  } else { console.error('Usage: --slug <slug> | --html <file> [--segment <id>] [--runs N]'); process.exit(2); }

  if (!fs.existsSync(htmlFiles[0])) { console.error(`not found: ${htmlFiles[0]}`); process.exit(2); }

  console.log(`[persona-copy-audit] ${args.slug || path.basename(htmlFiles[0])} · persona=${ctx.primary_segment} · ${RUNS} run(s)\n`);
  const runs = [];
  for (let i = 0; i < RUNS; i++) {
    const r = await runPersonaCopyJudge(htmlFiles, ctx);
    if (r.status !== 'wired') { console.log(`  run ${i + 1}: SKIPPED (${r.reason})`); continue; }
    runs.push(r);
    console.log(`  run ${i + 1}: score=${r.score} (${r.model || r.tier_used})`);
  }
  if (!runs.length) { console.error('\nAll runs failed (LLM unavailable). Try again when providers recover.'); process.exit(1); }

  // average per-criterion + score; union gaps (dedup by first 40 chars); take the modal would_contact
  const avg = (k) => Math.round(runs.reduce((a, r) => a + (r.scores?.[k] || 0), 0) / runs.length * 10) / 10;
  const meanScore = Math.round(runs.reduce((a, r) => a + r.score, 0) / runs.length);
  const variance = runs.length > 1 ? Math.max(...runs.map(r => r.score)) - Math.min(...runs.map(r => r.score)) : 0;
  const gapSeen = new Set(); const gaps = [];
  for (const r of runs) for (const g of (r.gaps || [])) { const k = g.slice(0, 40).toLowerCase(); if (!gapSeen.has(k)) { gapSeen.add(k); gaps.push(g); } }
  const strengths = runs[0].strengths || [];
  const wouldContact = runs.filter(r => r.would_contact).length >= runs.length / 2;

  console.log(`\n[persona-copy-audit] PERSONA-FIT (copy quality from buyer's view): ${meanScore}/100${variance ? ` (±${variance} across ${runs.length} runs)` : ''}`);
  console.log(`  buyer = ${runs[0].persona_name || ctx.primary_segment} · would-contact: ${wouldContact ? 'YES' : 'NO'}`);
  console.log(`  criteria (0-10): ${CRITERIA.map(k => `${k}=${avg(k)}`).join(' · ')}`);
  console.log(`\n  TOP COPY IMPROVEMENTS (from this buyer's perspective):`);
  gaps.slice(0, 6).forEach((g, i) => console.log(`   ${i + 1}. ${g}`));
  if (strengths.length) { console.log(`\n  WHAT'S WORKING:`); strengths.slice(0, 4).forEach((s) => console.log(`   + ${s}`)); }

  if (args.json) {
    fs.writeFileSync(args.json, JSON.stringify({
      slug: args.slug || null, persona: ctx.primary_segment, runs: runs.length,
      persona_fit_mean: meanScore, variance, would_contact: wouldContact,
      criteria_mean: Object.fromEntries(CRITERIA.map(k => [k, avg(k)])), gaps, strengths,
    }, null, 2));
    console.log(`\n  → ${args.json}`);
  }
  process.exit(0);
})();
