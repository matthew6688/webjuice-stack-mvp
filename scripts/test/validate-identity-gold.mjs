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

let sameTotal = 0, diffTotal = 0, truePos = 0, falseSame = 0;
const falseSameRows = [], recallMissRows = [];
const byReason = {};

for (const p of pairs) {
  const r = verifyCandidate(p.entity, p.candidate);
  const predictedSame = r.status === 'verified';
  const key = `${r.status}:${r.reason}`;
  byReason[key] = (byReason[key] || 0) + 1;
  if (p.expected === 'same') {
    sameTotal++;
    if (predictedSame) truePos++; else recallMissRows.push(`${p.label} · ${r.status}:${r.reason}`);
  } else if (p.expected === 'different') {
    diffTotal++;
    if (predictedSame) { falseSame++; falseSameRows.push(`${p.label} · VERIFIED as same! reason=${r.reason}`); }
  }
}

const recall = sameTotal ? (truePos / sameTotal) : 0;
console.log(`\n=== identity gold-set validation · ${pairs.length} pairs (${sameTotal} same · ${diffTotal} different) ===`);
console.log(`  false_same_count : ${falseSame}   ${falseSame === 0 ? '✅ (red line held)' : '❌ RED-LINE BREACH'}`);
console.log(`  precision(same)  : ${truePos + falseSame ? (truePos / (truePos + falseSame)).toFixed(3) : 'n/a'}`);
console.log(`  recall(same)     : ${recall.toFixed(3)}  (${truePos}/${sameTotal} · tunable · LLM tiers raise this)`);
console.log(`\n  by status:reason:`);
for (const [k, v] of Object.entries(byReason).sort((a, b) => b[1] - a[1])) console.log(`    ${String(v).padStart(3)}  ${k}`);
if (falseSameRows.length) { console.log(`\n  ❌ FALSE-SAME (must be empty):`); falseSameRows.forEach((r) => console.log(`    ${r}`)); }
if (recallMissRows.length) { console.log(`\n  recall misses (true 'same' not yet verified · for LLM tier / expansion):`); recallMissRows.forEach((r) => console.log(`    ${r}`)); }

console.log(`\n  NOTE: SEED gold set (${pairs.length} pairs). codex R122: expand to 300-500, overweight hard negatives.`);
process.exit(falseSame > 0 ? 1 : 0);
