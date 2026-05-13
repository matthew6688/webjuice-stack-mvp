#!/usr/bin/env node
// M2-D7 · pl:od-invoke-prep · 从 master.md 自派生
import fs from 'fs';
import path from 'path';
import { makeRunner, tryImport, REPO_ROOT, resolveRepo } from './_test-helpers.mjs';

const r = makeRunner('m2-d7-od-prep');

const SCRIPT = 'scripts/cli/pl-od-invoke-prep.js';
const exists = resolveRepo(SCRIPT);

if (!exists) {
  r.skip('script-exists', `${SCRIPT} missing`);
  const s = r.summary({ implementation_present: false });
  process.exit(1);
}

const m = await tryImport(SCRIPT);

await r.assert('module-exposes-derive-fn', () => {
  if (typeof m?.deriveOdPrep !== 'function') throw new Error('deriveOdPrep(entityKey) required');
  return true;
});

await r.assert('source-url-from-master-md', async () => {
  const out = await m.deriveOdPrep({ entityKey: 'rich-and-rare-restaurant', __dryRun: true });
  if (!out?.sourceUrl || !out.sourceUrl.includes('richandrare')) throw new Error(`sourceUrl wrong: ${out?.sourceUrl}`);
  return true;
});

await r.assert('business-type-includes-niche', async () => {
  const out = await m.deriveOdPrep({ entityKey: 'rich-and-rare-restaurant', __dryRun: true });
  if (!out?.businessType?.toLowerCase().includes('restaurant')) throw new Error('businessType missing niche');
  return true;
});

await r.assert('tone-default-when-no-existing-site', async () => {
  const out = await m.deriveOdPrep({ entityKey: '__test_image_lead__', __mockSourceType: 'image_lead', __dryRun: true });
  if (!out?.tone?.match(/refined.?professional/i)) throw new Error('image_lead must fallback to refined-professional default tone');
  return true;
});

await r.assert('scope-format', async () => {
  const out = await m.deriveOdPrep({ entityKey: 'rich-and-rare-restaurant', __dryRun: true });
  if (!out?.scope || !out.scope.match(/concept|key\s*page/i)) throw new Error('scope must describe page count');
  return true;
});

await r.assert('no-hardcoded-customer-names-in-output', () => {
  const body = fs.readFileSync(exists, 'utf8');
  const realNames = ['rich and rare', 'brisbane roof', 'opa bar'];
  for (const n of realNames) {
    if (body.toLowerCase().includes(n) && !body.toLowerCase().includes(`// example.*${n}`)) {
      throw new Error(`hardcoded customer name in script: ${n}`);
    }
  }
  return true;
});

const s = r.summary();
process.exit(s.exitCode);
