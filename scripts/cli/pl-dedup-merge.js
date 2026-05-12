#!/usr/bin/env node
/**
 * pl:dedup-merge — merge two entities (winner keeps, loser archived).
 *
 * SOP-X-Dedup §2.2. Requires --confirm flag (else dry-run).
 *
 * Side effects:
 *   - winner.runs[] += loser.runs[]   (max 20)
 *   - winner.batches[] += loser.batches[]  (max 20, dedup)
 *   - winner.history[] += loser.history[]  (max 100)
 *   - winner.lastSeenAt = max(both)
 *   - winner.merged_from = [...prev, loser.entityKey]
 *   - loser.merged_into = winner.entityKey
 *   - loser.status = 'merged'; loser.archivedAt = now
 *   - data/leads/dedup-backups/<loser>-<ts>.json (pre-merge snapshot)
 *   - data/leads/dedup-events.jsonl append
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

const WINNER = args.winner;
const LOSER = args.loser;
const CONFIRM = !!args.confirm;
const OPERATOR = args.operator || process.env.USER || 'unknown';

if (!WINNER || !LOSER) {
  console.error('Usage: pl:dedup-merge --winner K1 --loser K2 [--confirm] [--operator NAME]');
  process.exit(2);
}
if (WINNER === LOSER) {
  console.error('winner === loser, refuse');
  process.exit(2);
}

const STORE = path.resolve(process.cwd(), 'data/leads');
const winnerPath = path.join(STORE, 'entities', `${WINNER}.json`);
const loserPath = path.join(STORE, 'entities', `${LOSER}.json`);

if (!fs.existsSync(winnerPath)) {
  console.error(`winner not found: ${winnerPath}`);
  process.exit(2);
}
if (!fs.existsSync(loserPath)) {
  console.error(`loser not found: ${loserPath}`);
  process.exit(2);
}

const winner = JSON.parse(fs.readFileSync(winnerPath, 'utf8'));
const loser = JSON.parse(fs.readFileSync(loserPath, 'utf8'));

if (loser.status === 'merged' || loser.merged_into) {
  console.error(`loser already merged into ${loser.merged_into}`);
  process.exit(2);
}

// Sanity: if winner has no place_id but loser does, swap recommendation
const winnerHasPlaceId = !!winner.identifiers?.place_id;
const loserHasPlaceId = !!loser.identifiers?.place_id;
if (loserHasPlaceId && !winnerHasPlaceId) {
  console.warn(`⚠ loser has place_id but winner does not. Recommend swap.`);
  console.warn(`  Run: pl:dedup-merge --winner ${LOSER} --loser ${WINNER}`);
  if (!args.force) process.exit(2);
}

const plan = {
  winner: WINNER,
  loser: LOSER,
  operator: OPERATOR,
  winner_has_place_id: winnerHasPlaceId,
  loser_has_place_id: loserHasPlaceId,
  runs_to_merge: (loser.runs || []).length,
  batches_to_merge: (loser.batches || []).length,
  history_to_merge: (loser.history || []).length,
};

if (!CONFIRM) {
  console.log('--- DRY RUN (pass --confirm to execute) ---');
  console.log(JSON.stringify(plan, null, 2));
  process.exit(0);
}

// 1. Backup loser
const backupDir = path.join(STORE, 'dedup-backups');
fs.mkdirSync(backupDir, { recursive: true });
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(backupDir, `${LOSER}-${ts}.json`);
fs.writeFileSync(backupPath, JSON.stringify(loser, null, 2));

// 2. Merge into winner
const dedupArray = (arr, getKey = (x) => JSON.stringify(x)) => {
  const seen = new Set();
  const out = [];
  for (const x of arr) {
    const k = getKey(x);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out;
};

winner.runs = dedupArray(
  [...(winner.runs || []), ...(loser.runs || [])],
  (r) => `${r.runId || ''}::${r.query || ''}`
).slice(-20);

winner.batches = Array.from(new Set([
  ...(winner.batches || []),
  ...(loser.batches || []),
])).slice(-20);

winner.history = [
  ...(winner.history || []),
  ...(loser.history || []),
  { at: new Date().toISOString(), event: 'merged_with', loser: LOSER, operator: OPERATOR },
].slice(-100);

if (loser.lastSeenAt && (!winner.lastSeenAt || loser.lastSeenAt > winner.lastSeenAt)) {
  winner.lastSeenAt = loser.lastSeenAt;
}
winner.merged_from = [...(winner.merged_from || []), LOSER];

// 3. Mark loser
loser.status = 'merged';
loser.merged_into = WINNER;
loser.archivedAt = new Date().toISOString();
loser.history = [
  ...(loser.history || []),
  { at: loser.archivedAt, event: 'merged_into', winner: WINNER, operator: OPERATOR },
].slice(-100);

// 4. Write
fs.writeFileSync(winnerPath, JSON.stringify(winner, null, 2));
fs.writeFileSync(loserPath, JSON.stringify(loser, null, 2));

// 5. Event log
const eventLog = path.join(STORE, 'dedup-events.jsonl');
const eventLine = JSON.stringify({
  at: new Date().toISOString(),
  action: 'merged',
  winner: WINNER,
  loser: LOSER,
  operator: OPERATOR,
  backup: path.relative(STORE, backupPath),
});
fs.appendFileSync(eventLog, eventLine + '\n');

console.log(JSON.stringify({
  ok: true,
  ...plan,
  backup_path: backupPath,
  winner_path: winnerPath,
  loser_path: loserPath,
}, null, 2));
