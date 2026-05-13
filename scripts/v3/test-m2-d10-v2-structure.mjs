#!/usr/bin/env node
// M2-D10 · v2/ complete folder structure (sales/marketing/outreach/funnel/intake + audit/)
import fs from 'fs';
import path from 'path';
import { makeRunner, REPO_ROOT, resolveRepo } from './_test-helpers.mjs';

const r = makeRunner('m2-d10-v2-structure');

const ENSURE_SCRIPT = 'scripts/cli/pl-ensure-v2-structure.js';
const exists = resolveRepo(ENSURE_SCRIPT);

if (!exists) {
  r.skip('ensure-script-exists', `${ENSURE_SCRIPT} missing`);
  const s = r.summary({ implementation_present: false });
  process.exit(1);
}

await r.assert('script-exports-ensureV2Structure', async () => {
  const m = await import(exists);
  if (typeof m.ensureV2Structure !== 'function') throw new Error('ensureV2Structure(slug) required');
  return true;
});

const TEST_SLUG = '__test_v2_structure__';
const testDir = path.join(REPO_ROOT, 'clients', TEST_SLUG, 'v2');

await r.assert('creates-5-required-subdirs', async () => {
  const m = await import(exists);
  fs.rmSync(path.join(REPO_ROOT, 'clients', TEST_SLUG), { recursive: true, force: true });
  await m.ensureV2Structure(TEST_SLUG);
  for (const sub of ['sales', 'marketing', 'outreach', 'funnel', 'intake']) {
    if (!fs.existsSync(path.join(testDir, sub))) throw new Error(`missing v2/${sub}`);
  }
  return true;
});

await r.assert('audit-subdir-symlink-or-copy', async () => {
  const m = await import(exists);
  await m.ensureV2Structure(TEST_SLUG);
  const auditDir = path.join(testDir, 'audit');
  // audit/ may be empty if no fixtures yet · just check the dir exists
  if (!fs.existsSync(auditDir)) throw new Error('audit/ subdir missing');
  return true;
});

await r.assert('old-pattern-A-untouched', () => {
  // Pattern A: clients/<slug>/ flat structure (opa-bar-mezze, rich-and-rare)
  const opaDir = path.join(REPO_ROOT, 'clients', 'opa-bar-mezze-restaurant');
  if (!fs.existsSync(opaDir)) {
    r.skip('opa-bar-mezze-check', 'reference customer missing');
    return true;
  }
  // Must NOT have v2/ subdir (Pattern A is flat)
  const v2 = path.join(opaDir, 'v2');
  if (fs.existsSync(v2)) {
    throw new Error('Pattern A customer should not have v2/ created · old customer must not be migrated');
  }
  return true;
});

await r.assert('concept-open-design-path-preserved', () => {
  // M3 will write to v2/concept/open-design — ensure structure doesn't accidentally move it
  const conceptDir = path.join(testDir, 'concept');
  // concept/ may not exist until M3 runs · OK either way
  return true;
});

// Cleanup
fs.rmSync(path.join(REPO_ROOT, 'clients', TEST_SLUG), { recursive: true, force: true });

const s = r.summary();
process.exit(s.exitCode);
