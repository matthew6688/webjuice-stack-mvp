#!/usr/bin/env node
/**
 * Block 9.1 + 9.2 hard evidence — variant registry + round-robin picker.
 */

import fs from 'fs';
import assert from 'assert/strict';
import { listVariants, pickVariant } from '../../core/outreach/variant-picker.js';

// 3 seed variants exist
const variants = listVariants();
assert.equal(variants.length, 3);
const ids = variants.map((v) => v.id).sort();
assert.deepEqual(ids, [
  'v_2026-05_audit-led',
  'v_2026-05_curiosity-led',
  'v_2026-05_pain-led',
]);

// Every variant has hypothesis (D11 invariant)
for (const v of variants) {
  assert.ok(v.hypothesis && v.hypothesis.length > 30, `${v.id} hypothesis missing or too short`);
  assert.ok(v.subject_template, `${v.id} subject_template missing`);
  assert.ok(v.primary_metric, `${v.id} primary_metric missing`);
}

// Wipe picker state for clean test
const STATE = 'data/outreach/variant-picker-state.json';
if (fs.existsSync(STATE)) fs.unlinkSync(STATE);

// Round-robin: 10 picks should be even distribution
const counts = {};
for (let i = 0; i < 10; i += 1) {
  const v = pickVariant();
  counts[v.id] = (counts[v.id] || 0) + 1;
}
// 10 / 3 = 3 or 4 each. With round-robin sorted: 4 audit-led, 4 curiosity-led, 2 pain-led? No, sort then mod → 4, 3, 3.
const distribution = Object.values(counts).sort((a, b) => b - a);
assert.ok(distribution[0] - distribution[2] <= 1, `imbalanced: ${JSON.stringify(counts)}`);

// State persisted
assert.ok(fs.existsSync(STATE));
const state = JSON.parse(fs.readFileSync(STATE, 'utf8'));
assert.equal(state.counter, 10);

// Cleanup test state
fs.unlinkSync(STATE);

console.log(JSON.stringify({
  ok: true,
  variants_count: variants.length,
  variant_ids: ids,
  all_have_hypothesis: true,
  round_robin_distribution: counts,
  state_persisted: true,
}, null, 2));
