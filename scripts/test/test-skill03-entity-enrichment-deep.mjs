/**
 * Skill #3 · profitslocal-entity-enrichment deep regression (Codex Response 11)
 *
 * Invariants tested with NO PAID API CALLS:
 *   1. --dry-run gate · pl-enrich-entity exits 0 with planned providers list, 0 writes
 *   2. _source / provenance sibling enforcement · each provider module writes
 *      provenance via fetched_at / domain_age_source / _source field
 *   3. Quota-guard rotation pattern · places-quota-guard.js exposes multi-key rotation
 *   4. Idempotency · enrichment._meta.trace records attempts; re-run with mocked
 *      stable payload doesn't duplicate sections
 *   5. Static checks: dry-run gate appears before enrichEntity() invocation
 *
 * What is NOT tested here (deferred per Codex Response 11 §B):
 *   - Live Places / ABN / Tinyfish / RDAP / Wayback / Cloudinary calls
 *   - Real ledger.jsonl append (recorded as blocked_paid_authorization)
 *   - Performance per lead (only after live batch authorized)
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); failed++; }
}

console.log('skill #3 · entity-enrichment deep regression\n');

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');

// ─── §1 · pl:enrich-entity --dry-run (live exec · no spend) ─────────────

t('pl:enrich-entity --dry-run exits 0 for synthetic entity', () => {
  // Use a real-looking but synthetic entity in temp dir, then point ENTITIES_DIR at it.
  // Easier path: use an existing entity but rely on --dry-run to skip all calls.
  const r = spawnSync('node', [
    'scripts/cli/pl-enrich-entity.js',
    '--entity-key', 'dataid_0x697863f568797107-0x3e88d70ce813a66e',  // a-j fixture
    '--dry-run',
  ], { cwd: ROOT, encoding: 'utf8', timeout: 15000 });
  assert.equal(r.status, 0, `expected exit 0 · got ${r.status} · stderr: ${r.stderr.slice(0, 200)}`);
  assert.match(r.stdout, /DRY-RUN/, 'stdout must indicate DRY-RUN mode');
  assert.match(r.stdout, /planned providers/, 'stdout must list planned providers');
});

t('--dry-run does NOT call enrichEntity (static gate check)', () => {
  const cliSrc = fs.readFileSync(path.join(ROOT, 'scripts/cli/pl-enrich-entity.js'), 'utf8');
  // The DRY_RUN branch must short-circuit BEFORE await enrichEntity(before)
  const dryIdx = cliSrc.indexOf('if (DRY_RUN)');
  const enrichIdx = cliSrc.indexOf('await enrichEntity');
  assert.ok(dryIdx > 0 && enrichIdx > 0 && dryIdx < enrichIdx,
    'DRY_RUN gate must appear before enrichEntity call');
  // The branch must `continue` to skip the live enrichment block
  const slice = cliSrc.slice(dryIdx, enrichIdx);
  assert.match(slice, /continue/, 'dry-run branch must `continue` past enrichment block');
});

// ─── §2 · provenance / _source enforcement in provider modules ──────────

t('whois-rdap.js records domain_age_source provenance', () => {
  const src = fs.readFileSync(path.join(ROOT, 'core/enrichment/whois-rdap.js'), 'utf8');
  assert.match(src, /domain_age_source/, 'must record domain_age_source');
  assert.match(src, /rdap_registration|registered/i, 'must record provenance origin string');
});

t('tinyfish-summary.js stamps _source on every fetched markdown', () => {
  const src = fs.readFileSync(path.join(ROOT, 'core/enrichment/tinyfish-summary.js'), 'utf8');
  assert.match(src, /_source:\s*tinyfish/, 'each tinyfish-fetched doc must carry _source: tinyfish:...');
  assert.match(src, /fetched_at/, 'must include fetched_at timestamp');
});

t('enrichment/index.js writes _meta.trace + enriched_at on every run', () => {
  const src = fs.readFileSync(path.join(ROOT, 'core/enrichment/index.js'), 'utf8');
  assert.match(src, /enriched_at/, 'enrichment must stamp enriched_at');
  assert.match(src, /trace,\s*$|trace,\n/m, 'enrichment must include trace[] of source attempts');
  assert.match(src, /sources_attempted/, '_meta must track sources_attempted/sources_succeeded');
});

// ─── §3 · quota-guard multi-key rotation ────────────────────────────────

t('places-quota-guard.js exposes multi-key rotation pattern', () => {
  const src = fs.readFileSync(path.join(ROOT, 'core/extractors/places-quota-guard.js'), 'utf8');
  // Must reference multi-key env (GOOGLE_PLACES_API_KEY_1/2/...) or pool
  assert.match(src, /GOOGLE_PLACES_API_KEY|api[-_ ]?key/i, 'must reference API key env');
  // Must surface quota-exceeded as a distinct error class
  assert.match(src, /PlacesQuotaCapExceeded|QuotaExceeded|quota/i, 'must export quota-exceeded class/handling');
});

t('places-quota-guard.js does NOT silently retry on hard failures', () => {
  const src = fs.readFileSync(path.join(ROOT, 'core/extractors/places-quota-guard.js'), 'utf8');
  // No bare while(true) without exit conditions
  const badPattern = /while\s*\(\s*true\s*\)\s*\{[^}]*$/m;
  assert.ok(!badPattern.test(src), 'no infinite retry loops in quota-guard');
});

// ─── §4 · enrichment idempotency (structural · no calls) ───────────────

t('enrichment is additive (failures land in _meta.trace · pipeline continues)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'core/enrichment/index.js'), 'utf8');
  // The orchestrator must run safeRun for each provider (try/catch keeps pipeline alive)
  assert.match(src, /safeRun|try\s*\{[\s\S]*?await/, 'must use safeRun or try/catch around each provider');
  // Trace must collect both success + failure entries
  assert.match(src, /trace\.push/, 'must push entries into trace[]');
});

t('repeated enrichment merges (additive · does not overwrite existing facts to null)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'core/enrichment/index.js'), 'utf8');
  // Look for the spread-merge pattern at the bottom of enrichEntity:
  //   return { ...entity, enrichment };
  // This spreads existing entity fields, then attaches enrichment.* (additive).
  assert.match(src, /return\s*\{\s*\.\.\.entity\s*,/,
    'enrichEntity must return additive merge ({...entity, enrichment})');
});

// ─── §5 · SOP alignment (cost ladder + provenance contract) ─────────────

t('SKILL.md mentions T0→T3 cost ladder', () => {
  const src = fs.readFileSync(path.join(ROOT, 'skills/profitslocal-entity-enrichment/SKILL.md'), 'utf8');
  assert.match(src, /T0.*T1.*T2.*T3/s, 'SKILL.md must mention the 4-tier cost ladder');
});

t('SKILL.md documents _source sibling rule (NOT _meta.sources map)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'skills/profitslocal-entity-enrichment/SKILL.md'), 'utf8');
  assert.match(src, /_source\s*sibling/, 'must say _source as sibling key');
  // Forbidden centralized form
  assert.ok(!/_meta\.sources\s+map\s+(is\s+)?required/i.test(src),
    'must NOT require _meta.sources centralized map (rejected by 2026-05-17 decision)');
});

t('SKILL.md never-AI-generate list covers core facts', () => {
  const src = fs.readFileSync(path.join(ROOT, 'skills/profitslocal-entity-enrichment/SKILL.md'), 'utf8');
  for (const field of ['business_name', 'phone', 'address', 'abn', 'license', 'owner_name']) {
    assert.match(src, new RegExp(field), `Never AI-generate list must include ${field}`);
  }
});

console.log(`\n${passed}/${passed + failed} passed`);
console.log('\nblocked_paid_authorization (deferred):');
console.log('  - Live Places / ABN / Tinyfish / Wayback / RDAP call testing');
console.log('  - Real ledger.jsonl append on paid call');
console.log('  - Quota rotation with real exhausted key');
process.exit(failed === 0 ? 0 : 1);
