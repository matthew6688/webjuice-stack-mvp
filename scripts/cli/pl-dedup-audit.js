#!/usr/bin/env node
/**
 * pl:dedup-audit — scan entity store, output suspect dedup queue.
 *
 * Read-only. Safe to run anytime. Writes dedup-review-queue.json.
 *
 * SOP-X-Dedup §4.1.
 */

import { detectDuplicates, writeReviewQueue } from '../../core/leads/dedup-detector.js';
import { pushAlert } from '../../core/ops/alert-pusher.js';

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

const PUSH = !!args.push;

const t0 = Date.now();
const result = detectDuplicates({});
const dt = Date.now() - t0;
const queuePath = writeReviewQueue(result, {});

const out = {
  ok: true,
  scanned: result.scanned,
  total_suspects: result.suspectGroups.length,
  summary: result.summary,
  ms: dt,
  queue_path: queuePath,
};

console.log(JSON.stringify(out, null, 2));

if (result.suspectGroups.length > 0) {
  console.log('\nSuspect groups:');
  for (const g of result.suspectGroups.slice(0, 10)) {
    console.log(`  [${g.matchKey}=${g.matchValue}] ${g.entityKeys.length} entities`);
    for (const p of g.previews) {
      console.log(`    - ${p.entityKey}  "${p.name}"  ${p.city || '-'} / ${p.niche || '-'}`);
    }
  }
}

if (PUSH && result.suspectGroups.length > 20) {
  await pushAlert({
    title: `Dedup review queue: ${result.suspectGroups.length} suspect groups`,
    detail: `pl:dedup-audit found ${result.suspectGroups.length} groups (place_id=${result.summary.place_id} / phone=${result.summary.phone} / domain=${result.summary.domain}) across ${result.scanned} entities.\n\nReview at /admin/v2-leads/dedup-review`,
    severity: result.suspectGroups.length > 100 ? 'error' : 'warn',
    source: 'pl:dedup-audit',
    fields: [
      { name: 'scanned', value: String(result.scanned), inline: true },
      { name: 'suspects', value: String(result.suspectGroups.length), inline: true },
      { name: 'ms', value: String(dt), inline: true },
    ],
    url: 'https://profitslocal.com/admin/v2-leads/dedup-review',
  });
}
