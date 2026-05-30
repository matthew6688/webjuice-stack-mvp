/**
 * validate-page-identity.mjs · tier2 judgePageIdentity fixture validator (codex R127 step 3).
 *
 * Runs judgePageIdentity over labeled page fixtures. RED LINE: false_same_count===0 (a labeled
 * 'different'/'ambiguous' predicted 'same' is a precision breach). recall(same) reported separately.
 * Uses the LLM cascade (codex→claude→ollama) — needs a model available. Non-deterministic; this is the
 * manual-validation/comparison step, not a unit test.
 *
 * Usage: node scripts/test/validate-page-identity.mjs [--fixtures <file>]
 * Exit: 1 if false_same>0 (or all judge calls failed), else 0.
 */
import fs from 'node:fs';
import path from 'node:path';
import { judgePageIdentity } from '../../core/llm/match-judge.js';

const args = process.argv.slice(2);
const fxPath = (() => { const i = args.indexOf('--fixtures'); return i >= 0 ? args[i + 1] : 'data/leads/page-identity-fixtures.json'; })();
const ollamaModel = (() => { const i = args.indexOf('--ollama'); return i >= 0 ? args[i + 1] : null; })();
const fx = JSON.parse(fs.readFileSync(path.resolve(fxPath), 'utf8'));
const cases = fx.cases || [];

// codex R127 step4 model comparison: force a specific LOCAL model via opts.runner (else default cascade).
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const ollamaRunner = ollamaModel ? async (prompt) => {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: ollamaModel, prompt, stream: false, think: false, options: { temperature: 0.1 }, format: 'json' }),
  });
  if (!res.ok) throw new Error(`ollama HTTP ${res.status}`);
  return { text: (await res.json()).response || '', provider: 'ollama', model: ollamaModel };
} : null;
if (ollamaModel) console.log(`(forcing local model: ${ollamaModel} · PAGE_JUDGE_REDLINE_MODELS=${process.env.PAGE_JUDGE_REDLINE_MODELS || '(none)'})`);

// RED LINE = a non-'same' case PROMOTED as same (that's what actually writes canonical / mis-attributes).
// status-level 'same' on weak evidence (promotable:false) is a prompt-quality signal, reported separately.
let sameTotal = 0, truePos = 0, falseSame = 0, statusFalseSame = 0, errored = 0;
const rows = [];
for (const c of cases) {
  let r;
  try { r = await judgePageIdentity({ entity: c.entity, page: c.page }, ollamaRunner ? { runner: ollamaRunner } : {}); } catch (e) { r = { status: 'ERROR', reason: e.message }; }
  if (r.status === 'ERROR') errored++;
  const predSame = r.status === 'same';
  if (c.expected === 'same') { sameTotal++; if (predSame && r.promotable) truePos++; }
  else { if (predSame && r.promotable) falseSame++; if (predSame) statusFalseSame++; }
  rows.push({ label: c.label, expected: c.expected, got: r.status, promotable: r.promotable, provider: r.provider, model: r.model, ev: (r.evidence || []).map((e) => e.type).join(','), conf: r.confidence, reason: r.reason });
}

console.log(`\n=== page-identity fixture validation · ${cases.length} cases ===`);
console.log(`  false_same (PROMOTABLE · operational red line) : ${falseSame}   ${falseSame === 0 ? '✅ held' : '❌ BREACH'}`);
console.log(`  status-level false 'same' (prompt quality · not promoted): ${statusFalseSame}`);
console.log(`  recall(same·promotable): ${sameTotal ? (truePos / sameTotal).toFixed(2) : '—'} (${truePos}/${sameTotal})`);
console.log(`  provider: ${[...new Set(rows.map((r) => r.provider).filter(Boolean))].join(',') || '(none — model unavailable?)'}\n`);
for (const r of rows) {
  const flag = (r.expected !== 'same' && r.got === 'same') ? ' ❌FALSE-SAME' : (r.expected === 'same' && r.got === 'same' && r.promotable) ? ' ✅' : '';
  console.log(`  ${r.label.padEnd(26)} exp:${r.expected.padEnd(9)} got:${String(r.got).padEnd(10)} promotable:${r.promotable} ev:[${r.ev}]${flag}${r.reason ? ' · ' + r.reason : ''}`);
}
if (errored === cases.length) { console.log('\n  ⚠️ ALL judge calls failed (no LLM available) — run with codex/claude/ollama up.'); process.exit(1); }

// codex R131 #3: operational red line = promotable false_same=0 (always). CLEARANCE mode (for adding a model
// to PAGE_JUDGE_REDLINE_MODELS) is STRICTER: also status false_same=0 AND recall ≥ floor, ideally on a big set.
const clearance = args.includes('--clearance');
const recallFloor = (() => { const i = args.indexOf('--recall-floor'); return i >= 0 ? Number(args[i + 1]) : 0.9; })();
const recall = sameTotal ? truePos / sameTotal : 0;
if (clearance) {
  const pass = falseSame === 0 && statusFalseSame === 0 && recall >= recallFloor;
  console.log(`\n  CLEARANCE: ${pass ? '✅ PASS' : '❌ FAIL'} (need promotable=0 [${falseSame}] · status=0 [${statusFalseSame}] · recall≥${recallFloor} [${recall.toFixed(2)}])`);
  console.log('  NOTE: 8 fixtures = smoke only · real clearance needs the expanded hard page gold set.');
  process.exit(pass ? 0 : 1);
}
process.exit(falseSame > 0 ? 1 : 0);
