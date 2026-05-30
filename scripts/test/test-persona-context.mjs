/**
 * test-persona-context.mjs · R108 step 5 (codex Round 110).
 * Verifies persona resolution + that the prompt block carries psychology only (no business facts).
 */
import assert from 'node:assert';
import { resolvePersona, buildPersonaContextBlock } from '../../core/handoff/persona-context.js';

let passed = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); passed++; };

// 1 · brief segment is honoured
const r1 = resolvePersona({}, { primary_segment: 'urgent-repair', secondary_segments: ['planned-upgrade'] });
ok(r1.primaryId === 'urgent-repair', 'brief primary_segment honoured');
ok(r1.secondaryIds.includes('planned-upgrade'), 'brief secondary honoured');
ok(r1.fallback === false, 'explicit segment is not a fallback');

// 2 · ambiguous brief → canonical default (planned-upgrade / urgent-repair)
const r2 = resolvePersona({}, {});
ok(r2.primaryId === 'planned-upgrade', 'default primary = planned-upgrade');
ok(r2.secondaryIds.includes('urgent-repair'), 'default secondary = urgent-repair');
ok(r2.fallback === true, 'missing segment flagged as fallback');

// 3 · unknown id falls back, never throws
const r3 = resolvePersona({}, { primary_segment: 'made-up-segment' });
ok(r3.primaryId === 'planned-upgrade', 'unknown segment falls back to default');
ok(r3.fallback === true, 'unknown segment flagged fallback');

// 4 · facts-level segment used when brief silent
const r4 = resolvePersona({ primary_segment: 'commercial-maintenance' }, {});
ok(r4.primaryId === 'commercial-maintenance', 'facts.primary_segment used when brief silent');

// 4b · codex R111: invalid secondary list must fall back to canonical default, not collapse to empty
const r4b = resolvePersona({}, { primary_segment: 'planned-upgrade', secondary_segments: ['made-up', 'also-fake'] });
ok(r4b.secondaryIds.length === 1 && r4b.secondaryIds[0] === 'urgent-repair', 'invalid secondaries fall back to canonical urgent-repair');
// 4c · when primary IS the default secondary, empty secondaries is correct (no self-duplication)
const r4c = resolvePersona({}, { primary_segment: 'urgent-repair', secondary_segments: ['garbage'] });
ok(r4c.secondaryIds.length === 0, 'no secondary duplicates the primary');

// 5 · block builds for each section and contains the guard + psychology, NOT business facts
for (const section of ['about', 'services', 'hero']) {
  const block = buildPersonaContextBlock({}, { brief: { primary_segment: 'planned-upgrade' }, section });
  ok(block.includes('BUYER PERSONA CONTEXT'), `${section}: block has header`);
  ok(block.includes('LOWER AUTHORITY'), `${section}: block states lower authority`);
  ok(block.includes('GUARD:'), `${section}: block has the guard`);
  ok(/Job to be done:/.test(block), `${section}: block has job-to-be-done`);
  // must NOT leak a phone/ABN/licence/address shaped business fact (it only gets {} facts here)
  ok(!/ABN|licence number|\b04\d{2}\b|QBCC \d/.test(block), `${section}: block emits no business facts`);
}

// 6 · disabled → empty
ok(buildPersonaContextBlock({}, { enabled: false }) === '', 'disabled → empty string');

console.log(`persona-context: ${passed} passed, 0 failed`);
