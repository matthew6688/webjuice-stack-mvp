/**
 * validate-identity-gold.mjs · gold-set precision/recall gate for identity resolution (codex R122/R125).
 *
 * Reads a hand-labeled gold set (entity ↔ candidate ↔ expected same|different) and runs verifyCandidate.
 * RED LINE (hard gate · codex): false_same_count === 0 — never predict 'same' for a labeled 'different'.
 * recall_same is reported separately (the tunable the LLM tiers raise). Metrics broken down by reason/tier
 * so `name_exact+state` etc. can be watched independently before anything becomes canonical.
 *
 * Usage: node scripts/test/validate-identity-gold.mjs [--gold <file>]
 * Exit: 1 if false_same_count > 0 (gate fail), else 0.
 */
import fs from 'node:fs';
import path from 'node:path';
import { verifyCandidate } from '../../core/enrichment/identity-match.js';

const args = process.argv.slice(2);
const goldPath = (() => { const i = args.indexOf('--gold'); return i >= 0 ? args[i + 1] : 'data/leads/identity-gold-set.json'; })();
const gold = JSON.parse(fs.readFileSync(path.resolve(goldPath), 'utf8'));
const pairs = gold.pairs || [];

// codex R128/R129: only deterministic/human-confirmed labels count as benchmark TRUTH. ANY LLM-confirmed
// source ('llm_only', 'opus-confirmed', or anything matching /llm|gpt|opus|claude|codex|qwen/i) must NOT be
// benchmark ground truth (circularity / naming-drift) — excluded from the gate until a human confirms it.
const LLM_LABEL = /llm|gpt|opus|claude|codex|qwen|ollama/i;
const BENCHMARK_OK = (p) => !LLM_LABEL.test(p.label_source || 'crafted');
const benchPairs = pairs.filter(BENCHMARK_OK);
const excluded = pairs.length - benchPairs.length;

let sameTotal = 0, diffTotal = 0, truePos = 0, falseSame = 0;
const falseSameRows = [], recallMissRows = [];
const byReason = {};
const bySlice = {}; // slice → { same, diff, tp, falseSame }

for (const p of benchPairs) {
  const r = verifyCandidate(p.entity, p.candidate);
  const predictedSame = r.status === 'verified';
  const key = `${r.status}:${r.reason}`;
  byReason[key] = (byReason[key] || 0) + 1;
  const slice = p.slice || (p.expected === 'same' ? 'same:other' : 'diff:other');
  bySlice[slice] = bySlice[slice] || { same: 0, diff: 0, tp: 0, falseSame: 0 };
  if (p.expected === 'same') {
    sameTotal++; bySlice[slice].same++;
    if (predictedSame) { truePos++; bySlice[slice].tp++; } else recallMissRows.push(`${p.label} · ${r.status}:${r.reason}`);
  } else if (p.expected === 'different') {
    diffTotal++; bySlice[slice].diff++;
    if (predictedSame) { falseSame++; bySlice[slice].falseSame++; falseSameRows.push(`${p.label} · VERIFIED as same! reason=${r.reason}`); }
  }
}

const recall = sameTotal ? (truePos / sameTotal) : 0;
console.log(`\n=== identity gold-set validation · ${pairs.length} pairs (${sameTotal} same · ${diffTotal} different) ===`);
console.log(`  false_same_count : ${falseSame}   ${falseSame === 0 ? '✅ (red line held)' : '❌ RED-LINE BREACH'}`);
console.log(`  precision(same)  : ${truePos + falseSame ? (truePos / (truePos + falseSame)).toFixed(3) : 'n/a'}`);
console.log(`  recall(same)     : ${recall.toFixed(3)}  (${truePos}/${sameTotal} · tunable · LLM tiers raise this)`);
console.log(`\n  by status:reason:`);
for (const [k, v] of Object.entries(byReason).sort((a, b) => b[1] - a[1])) console.log(`    ${String(v).padStart(3)}  ${k}`);
console.log(`\n  by slice (codex R128 · don't let aggregate hide a slice failure):`);
for (const [s, v] of Object.entries(bySlice).sort()) {
  const rc = v.same ? (v.tp / v.same).toFixed(2) : '—';
  console.log(`    ${s.padEnd(26)} same:${v.same} (recall ${rc}) · diff:${v.diff}${v.falseSame ? ` · ❌ FALSE-SAME ${v.falseSame}` : ''}`);
}
if (excluded) console.log(`\n  (${excluded} pair(s) excluded from truth: label_source=llm_only)`);
if (falseSameRows.length) { console.log(`\n  ❌ FALSE-SAME (must be empty):`); falseSameRows.forEach((r) => console.log(`    ${r}`)); }
if (recallMissRows.length) { console.log(`\n  recall misses (true 'same' not yet verified · for LLM tier / expansion):`); recallMissRows.forEach((r) => console.log(`    ${r}`)); }

console.log(`\n  NOTE: SEED gold set (${pairs.length} pairs). codex R122: expand to 300-500, overweight hard negatives.`);
process.exit(falseSame > 0 ? 1 : 0);
