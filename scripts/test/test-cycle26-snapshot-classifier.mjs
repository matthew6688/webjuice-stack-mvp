/**
 * cycle-26 · TDD test 4/5 · Snapshot classifier (new states).
 *
 * Verifies scripts/cli/pl-discord-snapshot.js exports classifyByThread()
 * that maps thread title (+ optional metadata) to the new state machine:
 *   auditing | auditing_graded | ready_to_build | qa_pending |
 *   pending_publish | published | rejected_d | archived
 *
 * Pre-Phase-C: FAILS (snapshot returns 'predict_C', 'audited_C', etc).
 * Post-Phase-C: PASSES.
 */
import assert from 'node:assert/strict';
import { STATE_TAGS, GRADE_TAGS } from '../../core/contracts/discord-messages.js';

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); failed++; }
}

console.log('cycle-26 · test 4/5 · snapshot classifier\n');

let mod;
try { mod = await import('../../scripts/cli/pl-discord-snapshot.js'); }
catch (e) { mod = { __err: e.message }; }

t('snapshot module loads', () => {
  assert.ok(!mod.__err, `import failed: ${mod.__err}`);
});
t('classifyByThread exported', () => {
  assert.equal(typeof mod.classifyByThread, 'function');
});

if (typeof mod.classifyByThread !== 'function') {
  console.log(`\n${passed}/${passed + failed} passed`);
  process.exit(1);
}

// ─── Fixtures · 8 thread states ────────────────────────────────────────────
const FIXTURES = [
  {
    name: 'auditing (Stage 0-3 · no grade)',
    title: '[水管] [审中] 未审 Test Plumbing',
    metadata: { archived: false },
    expect: 'auditing',
  },
  {
    name: 'auditing_graded (Stage 4 done · grade=C · still working)',
    title: '[水管] [审中] [C] Test Plumbing',
    metadata: { archived: false },
    expect: 'auditing_graded',
  },
  {
    name: 'ready_to_build (Stage 6 pass)',
    title: '[水管] [待建] [C] Test Plumbing',
    metadata: { archived: false },
    expect: 'ready_to_build',
  },
  {
    name: 'qa_pending (Stage 6 fail · scorecard < 60)',
    title: '[水管] [待补] [C] Test Plumbing',
    metadata: { archived: false },
    expect: 'qa_pending',
  },
  {
    name: 'pending_publish (Stage 7 done · in projects channel)',
    title: '[水管] [待发] [C] Test Plumbing',
    metadata: { archived: false },
    expect: 'pending_publish',
  },
  {
    name: 'published (operator advanced sales_stage)',
    title: '[水管] [已发] [C] Test Plumbing',
    metadata: { archived: false },
    expect: 'published',
  },
  {
    name: 'rejected_d (Stage 1 排除 or Stage 4 D)',
    title: '[水管] [D] Test Plumbing',
    metadata: { archived: true },
    expect: 'rejected_d',
  },
  {
    name: 'archived (legacy thread · any tag · metadata.archived=true)',
    title: '[水管] [审中] Some Old Thread',
    metadata: { archived: true },
    expect: 'archived',
  },
];

for (const f of FIXTURES) {
  t(f.name, () => {
    const got = mod.classifyByThread(f.title, [], null, f.metadata);
    assert.equal(got, f.expect, `title="${f.title}" · metadata=${JSON.stringify(f.metadata)} · expected ${f.expect}, got ${got}`);
  });
}

// ─── Contract: STATE_TAGS values are the only allowed STATE prefixes ────────
t('all fixture titles use STATE_TAGS values', () => {
  const allowed = [...Object.values(STATE_TAGS), '[D]'];
  for (const f of FIXTURES) {
    const has = allowed.some((tag) => f.title.includes(tag));
    assert.ok(has, `fixture title "${f.title}" doesn't contain any STATE_TAG`);
  }
});

t('no fixture title uses banned [预A] [预B] [预C]', () => {
  for (const f of FIXTURES) {
    for (const banned of ['[预A]', '[预B]', '[预C]']) {
      assert.ok(!f.title.includes(banned), `fixture has banned tag ${banned}: ${f.title}`);
    }
  }
});

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed === 0 ? 0 : 1);
