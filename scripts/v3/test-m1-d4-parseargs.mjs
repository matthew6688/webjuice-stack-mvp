#!/usr/bin/env node
// M1-D4 · pl:ingest-image parseArgs --key=value
import fs from 'fs';
import path from 'path';
import { makeRunner, tryImport, resolveRepo } from './_test-helpers.mjs';

const r = makeRunner('m1-d4-parseargs');

const m = await tryImport('scripts/cli/_pl-shared.js');
if (!m || m.__error || typeof m.parseArgs !== 'function') {
  r.skip('module-exists', `scripts/cli/_pl-shared.js#parseArgs missing (${m?.__error || 'not found'})`);
  const s = r.summary({ implementation_present: false });
  process.exit(1);
}

// Contract: parseArgs preserves keys as written (kebab-case from CLI).
// Matthew's prior fix (commit e8bc42ad) added --key=value support alongside --key value.
const CASES = [
  ['space-syntax',    ['--business-name', 'Joe Plumbing'],         { 'business-name': 'Joe Plumbing' }],
  ['equals-syntax',   ['--business-name=Joe Plumbing'],            { 'business-name': 'Joe Plumbing' }],
  ['multi-equals',    ['--phone=0412345678', '--niche=plumber'],   { phone: '0412345678', niche: 'plumber' }],
  ['bool-flag',       ['--dry-run'],                               { 'dry-run': true }],
  ['last-wins',       ['--phone', '0412', '--phone=0413'],         { phone: '0413' }],
  ['quoted-apostrophe', ["--business-name=Joe's plumbing"],        { 'business-name': "Joe's plumbing" }],
  ['positional-separated', ['cmd', '--niche=plumber', 'arg2'],     { niche: 'plumber', _: ['cmd', 'arg2'] }],
];

for (const [name, argv, expected] of CASES) {
  await r.assert(`case-${name}`, () => {
    const out = m.parseArgs(argv);
    for (const [k, v] of Object.entries(expected)) {
      if (k === '_') {
        if (JSON.stringify(out._) !== JSON.stringify(v)) {
          throw new Error(`positional _=${JSON.stringify(out._)} expected=${JSON.stringify(v)}`);
        }
        continue;
      }
      if (out[k] !== v) throw new Error(`${k}=${JSON.stringify(out[k])} expected=${JSON.stringify(v)}`);
    }
    return true;
  });
}

await r.assert('pl-ingest-image-uses-shared-parseArgs', () => {
  const abs = resolveRepo('scripts/cli/pl-ingest-image.js');
  if (!abs) throw new Error('scripts/cli/pl-ingest-image.js missing');
  const body = fs.readFileSync(abs, 'utf8');
  // Must import parseArgs from _pl-shared (not have its own copy)
  if (!body.match(/from\s+['"]\.\/_pl-shared/)) {
    throw new Error('pl-ingest-image.js must import from ./_pl-shared');
  }
  if (!body.includes('parseArgs')) {
    throw new Error('pl-ingest-image.js must use parseArgs');
  }
  return true;
});

const s = r.summary();
process.exit(s.exitCode);
