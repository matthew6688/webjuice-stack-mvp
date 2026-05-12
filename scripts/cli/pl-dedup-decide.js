#!/usr/bin/env node
/**
 * pl:dedup-decide — record an operator decision for a suspect pair.
 *
 * Used for "different" verdicts (so audit doesn't re-flag them) and
 * "skip" (defer; will appear next audit).
 *
 * SOP-X-Dedup §2.3.
 */

import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, tok, i, arr) => {
    if (tok.startsWith('--')) {
      const key = tok.slice(2);
      const next = arr[i + 1];
      acc.push([key, next && !next.startsWith('--') ? next : true]);
    }
    return acc;
  }, [])
);

const K1 = args.k1;
const K2 = args.k2;
const DECISION = args.decision; // 'different' | 'skip'
const OPERATOR = args.operator || process.env.USER || 'unknown';

if (!K1 || !K2 || !['different', 'skip'].includes(DECISION)) {
  console.error('Usage: pl:dedup-decide --k1 K1 --k2 K2 --decision different|skip');
  process.exit(2);
}

const STORE = path.resolve(process.cwd(), 'data/leads');
const p = path.join(STORE, 'dedup-decisions.json');
let state = { schemaVersion: 1, decisions: [] };
if (fs.existsSync(p)) {
  try { state = JSON.parse(fs.readFileSync(p, 'utf8')); } catch {}
  if (!Array.isArray(state.decisions)) state.decisions = [];
}

state.decisions.push({
  at: new Date().toISOString(),
  k1: K1,
  k2: K2,
  decision: DECISION,
  operator: OPERATOR,
});

state.decisions = state.decisions.slice(-1000); // cap
fs.writeFileSync(p, JSON.stringify(state, null, 2));

console.log(JSON.stringify({ ok: true, k1: K1, k2: K2, decision: DECISION, total_decisions: state.decisions.length }));
