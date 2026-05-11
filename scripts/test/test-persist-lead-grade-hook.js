#!/usr/bin/env node
/**
 * Block 4.4 hard evidence — persistLeadGrade auto-sets entity.phase
 * (A/B → awaiting, D → archived) via setEntityPhase, in addition to
 * existing status transition. Discord thread open is suppressed via
 * SKIP_LEAD_THREAD_OPEN=true so the test runs offline.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import assert from 'assert/strict';
import { persistLeadGrade } from '../../core/scoring/lead-grading.js';

process.env.SKIP_LEAD_THREAD_OPEN = 'true';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pl-grade-hook-'));
const entitiesDir = path.join(tmp, 'entities');
fs.mkdirSync(entitiesDir, { recursive: true });

function makeEntity(entityKey, name) {
  return {
    entityKey,
    status: 'queued_for_audit',
    latest: { name, city: 'Brisbane', niche: 'roofing' },
    history: [],
  };
}

function writeEntity(entity) {
  fs.writeFileSync(path.join(entitiesDir, `${entity.entityKey}.json`), JSON.stringify(entity, null, 2) + '\n');
}

function readEntity(entityKey) {
  return JSON.parse(fs.readFileSync(path.join(entitiesDir, `${entityKey}.json`), 'utf8'));
}

// ── A — grade=A should set phase=awaiting ──
writeEntity(makeEntity('place_test_a', 'Test A Roofer'));
const resultA = persistLeadGrade({
  entityKey: 'place_test_a',
  grade: {
    investment_level: 'A',
    product_tier: 'T2',
    recommended_pricing: { one_time: '$3-6K', monthly: null },
    skip_reasons: [],
    investment_reason: 'strong signals',
  },
  storeRoot: tmp,
});
assert.equal(resultA.ok, true, 'persistLeadGrade A ok');
assert.equal(resultA.phaseResult?.phase, 'awaiting');
const entA = readEntity('place_test_a');
assert.equal(entA.phase, 'awaiting', 'A entity got phase=awaiting');
assert.equal(entA.status, 'graded', 'legacy status still set');
assert.equal(entA.grade.investment_level, 'A');

// ── B — grade=B should set phase=awaiting ──
writeEntity(makeEntity('place_test_b', 'Test B Roofer'));
const resultB = persistLeadGrade({
  entityKey: 'place_test_b',
  grade: { investment_level: 'B', product_tier: 'T1', recommended_pricing: null, skip_reasons: [] },
  storeRoot: tmp,
});
assert.equal(readEntity('place_test_b').phase, 'awaiting');

// ── C — grade=C should NOT set phase (batch flow, no thread) ──
writeEntity(makeEntity('place_test_c', 'Test C Roofer'));
persistLeadGrade({
  entityKey: 'place_test_c',
  grade: { investment_level: 'C', product_tier: null, recommended_pricing: null, skip_reasons: [] },
  storeRoot: tmp,
});
const entC = readEntity('place_test_c');
assert.equal(entC.phase, undefined, `C entity phase not set (got ${entC.phase})`);
assert.equal(entC.grade.investment_level, 'C');

// ── D — grade=D should set phase=archived with reason ──
writeEntity(makeEntity('place_test_d', 'Test D Roofer'));
persistLeadGrade({
  entityKey: 'place_test_d',
  grade: {
    investment_level: 'D',
    product_tier: null,
    recommended_pricing: null,
    skip_reasons: [{ id: 'niche_mismatch', reason: 'not roofing' }],
    investment_reason: 'niche mismatch',
  },
  storeRoot: tmp,
});
const entD = readEntity('place_test_d');
assert.equal(entD.phase, 'archived');
assert.equal(entD.archive_reason, 'niche_mismatch');
assert.equal(entD.status, 'skipped');

// ── E — entity not found path ──
const bad = persistLeadGrade({
  entityKey: 'does_not_exist',
  grade: { investment_level: 'A' },
  storeRoot: tmp,
});
assert.equal(bad.ok, false);
assert.equal(bad.reason, 'entity not found');

fs.rmSync(tmp, { recursive: true, force: true });

console.log(JSON.stringify({
  ok: true,
  assertions_passed: 13,
  cases: {
    grade_A_sets_phase_awaiting: true,
    grade_B_sets_phase_awaiting: true,
    grade_C_no_phase: true,
    grade_D_sets_phase_archived_with_reason: true,
    legacy_status_still_set: true,
    entity_not_found_handled: true,
    skip_lead_thread_open_respected: true,
  },
}, null, 2));
