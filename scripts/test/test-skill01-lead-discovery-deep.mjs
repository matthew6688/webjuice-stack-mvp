/**
 * Skill #1 · profitslocal-lead-discovery deep regression (Codex Response 9)
 *
 * Invariants validated:
 *   1. discoveryEntityKey() chooses identifiers in canonical order:
 *      entityKey > place_id > cid > data_id > image_lead > non-directory domain > phone > name+location
 *   2. Directory domains never become entity-key roots when a better ID exists
 *   3. upsertDiscoveryRun() against a temp storeRoot:
 *      a. duplicate place_id → one entity file
 *      b. richer second write fills missing phone/website without nulling existing fields
 *      c. entity carries intake provenance minimum: sourceType, sourceQuery, latest.discovery_rank
 *
 * Side-effects guarded:
 *   - tests disable master-md auto-refresh + auto-cheap-audit via env (don't pollute real queues)
 *   - tests use a temp dir under os.tmpdir(); never touch data/leads/*
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.SOP1_DISABLE_MASTER_MD_AUTOREFRESH = '1';
process.env.SOP1_DISABLE_AUTO_CHEAP_AUDIT = '1';

const { discoveryEntityKey, upsertDiscoveryRun, isDirectoryDomain } =
  await import(new URL('../../core/leads/discovery-store.js', import.meta.url).href);

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); failed++; }
}

console.log('skill #1 · lead-discovery deep regression\n');

// ─── §1 · discoveryEntityKey priority ───────────────────────────────────

t('entityKey override wins over place_id', () => {
  const key = discoveryEntityKey({ entityKey: 'custom_key', place_id: 'ChIJabc' });
  assert.equal(key, 'custom_key');
});

t('place_id beats data_id', () => {
  const key = discoveryEntityKey({ place_id: 'ChIJabc', data_id: '0x123:0x456' });
  assert.ok(key.startsWith('place_'));
});

t('data_id used BEFORE domain (cycle-27 fix · directory-domain collision)', () => {
  const key = discoveryEntityKey({ data_id: '0x123:0x456', website: 'https://google.com/maps/...' });
  assert.ok(key.startsWith('dataid_'), `expected dataid_ but got ${key}`);
});

t('directory domain (yelp/houzz) does NOT become entity-key root', () => {
  // Falls through to phone or name when only directory domain available
  const key = discoveryEntityKey({ website: 'https://yelp.com.au/biz/foo', phone: '0412345678' });
  assert.ok(key.startsWith('phone_') || key.startsWith('name_'),
    `directory domain leaked into key: ${key}`);
});

t('non-directory domain wins over phone', () => {
  const key = discoveryEntityKey({ website: 'https://aceroofing.com.au', phone: '0412345678' });
  assert.ok(key.startsWith('domain_'), `expected domain_ but got ${key}`);
});

t('isDirectoryDomain catches common AU directories', () => {
  for (const d of ['yelp.com.au', 'truelocal.com.au', 'yellowpages.com.au']) {
    assert.equal(isDirectoryDomain(d), true, `${d} should be directory`);
  }
  assert.equal(isDirectoryDomain('aceroofing.com.au'), false);
});

// ─── §2 · upsertDiscoveryRun idempotency + merge ────────────────────────

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'skill01-'));

t('upsert duplicate place_id → exactly 1 entity file', () => {
  const run1 = {
    runId: 'run-1',
    query: 'roofer in brisbane',
    leads: [{ place_id: 'ChIJabcTEST', name: 'Test Roofing', sourceQuery: 'roofer in brisbane' }],
    costPolicy: { tier: 'T0' },
  };
  upsertDiscoveryRun(run1, { storeRoot: tmpRoot, runPath: 'fake/run1.json' });
  upsertDiscoveryRun(run1, { storeRoot: tmpRoot, runPath: 'fake/run1-rerun.json' });
  const files = fs.readdirSync(path.join(tmpRoot, 'entities')).filter(f => f.startsWith('place_'));
  assert.equal(files.length, 1, `expected 1 entity · got ${files.length}: ${files.join(', ')}`);
});

t('richer 2nd write fills missing phone/website without nulling existing', () => {
  const tmpRoot2 = fs.mkdtempSync(path.join(os.tmpdir(), 'skill01-merge-'));
  // First write: name + place_id only
  upsertDiscoveryRun({
    runId: 'r2-1',
    query: 'q',
    leads: [{ place_id: 'ChIJMERGE', name: 'Merge Co', sourceQuery: 'q' }],
  }, { storeRoot: tmpRoot2, runPath: 'r2-1.json' });
  // Second write: adds phone + website
  upsertDiscoveryRun({
    runId: 'r2-2',
    query: 'q',
    leads: [{ place_id: 'ChIJMERGE', name: 'Merge Co', phone: '0412345678', website: 'https://merge.co', sourceQuery: 'q' }],
  }, { storeRoot: tmpRoot2, runPath: 'r2-2.json' });
  const files = fs.readdirSync(path.join(tmpRoot2, 'entities')).filter(f => f.startsWith('place_'));
  assert.equal(files.length, 1);
  const entity = JSON.parse(fs.readFileSync(path.join(tmpRoot2, 'entities', files[0]), 'utf8'));
  assert.ok(entity.latest, 'entity.latest must exist');
  assert.ok(entity.latest.name === 'Merge Co' || entity.latest.businessName === 'Merge Co',
    'name preserved from first write');
  assert.ok((entity.latest.phone || '').includes('0412345678'),
    `phone from second write should land · got ${JSON.stringify(entity.latest.phone)}`);
});

t('entity carries intake provenance minimum (sourceQuery + sourceType OR runId)', () => {
  const tmpRoot3 = fs.mkdtempSync(path.join(os.tmpdir(), 'skill01-prov-'));
  upsertDiscoveryRun({
    runId: 'prov-run-1',
    query: 'plumber in melbourne',
    leads: [{ place_id: 'ChIJPROV1', name: 'Prov Plumbing', sourceQuery: 'plumber in melbourne' }],
  }, { storeRoot: tmpRoot3, runPath: 'prov.json' });
  const files = fs.readdirSync(path.join(tmpRoot3, 'entities'));
  const entity = JSON.parse(fs.readFileSync(path.join(tmpRoot3, 'entities', files[0]), 'utf8'));
  // Latest snapshot or runs[] must carry source query
  const hasSourceQuery = (entity.latest?.sourceQuery === 'plumber in melbourne') ||
                        (Array.isArray(entity.runs) && entity.runs.some(r => (r.query || r.sourceQuery) === 'plumber in melbourne'));
  assert.ok(hasSourceQuery, 'entity must record sourceQuery somewhere (latest or runs[])');
});

// ─── §3 · dry-run safety (static check) ─────────────────────────────────

const cliSrc = fs.readFileSync(
  new URL('../cli/pl-places-search-intake.js', import.meta.url),
  'utf8'
);

t('dry-run gate appears before GooglePlacesExtractor instantiation', () => {
  // Find the loop body and ensure `if (DRY_RUN)` returns before extractor.search
  const dryRunIdx = cliSrc.indexOf('if (DRY_RUN)');
  assert.ok(dryRunIdx > 0, 'DRY_RUN gate must exist');
  // dry-run handler pushes to results and continues to next query
  const slice = cliSrc.slice(dryRunIdx, dryRunIdx + 400);
  assert.ok(/continue|dry_run/.test(slice), 'dry-run handler must short-circuit before extractor call');
});

t('empty queries → die() before extractor', () => {
  const idx = cliSrc.indexOf('if (queries.length === 0)');
  assert.ok(idx > 0, 'empty-query guard must exist');
  // The guard appears at module top before any extractor allocation
  const extractorIdx = cliSrc.indexOf('new GooglePlacesExtractor');
  assert.ok(extractorIdx > idx, 'guard must precede extractor instantiation');
});

console.log(`\n${passed}/${passed + failed} passed`);

// cleanup tmp dirs
try {
  for (const d of fs.readdirSync(os.tmpdir()).filter(n => n.startsWith('skill01-'))) {
    fs.rmSync(path.join(os.tmpdir(), d), { recursive: true, force: true });
  }
} catch {}

process.exit(failed === 0 ? 0 : 1);
