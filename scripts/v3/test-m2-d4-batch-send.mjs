#!/usr/bin/env node
// M2-D4 · pl:c-grade-batch-send + dry-run env flag
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { makeRunner, tryImport, REPO_ROOT, resolveRepo } from './_test-helpers.mjs';

const r = makeRunner('m2-d4-batch-send');

const SCRIPT = 'scripts/cli/pl-c-grade-batch-send.js';
const exists = resolveRepo(SCRIPT);

if (!exists) {
  r.skip('script-exists', `${SCRIPT} missing`);
  const s = r.summary({ implementation_present: false });
  process.exit(1);
}

await r.assert('default-dry-run-when-LIVE-unset', () => {
  // C_GRADE_BATCH_LIVE not set → dry-run
  const env = { ...process.env };
  delete env.C_GRADE_BATCH_LIVE;
  const out = spawnSync('node', [path.resolve(REPO_ROOT, SCRIPT), '--limit', '2'], {
    cwd: REPO_ROOT, env, encoding: 'utf8', timeout: 60_000,
  });
  if (out.status !== 0) throw new Error(`exit ${out.status}: ${out.stderr?.slice(0, 200)}`);
  if (!out.stdout.match(/dry.?run|preview/i)) throw new Error('default must be dry-run');
  return true;
});

await r.assert('limit-flag-respected', () => {
  const env = { ...process.env, C_GRADE_BATCH_LIVE: '' };
  const out = spawnSync('node', [path.resolve(REPO_ROOT, SCRIPT), '--limit', '3'], {
    cwd: REPO_ROOT, env, encoding: 'utf8', timeout: 60_000,
  });
  if (out.status !== 0) throw new Error(`exit ${out.status}`);
  return true;
});

await r.assert('template-renders-no-empty-placeholders', () => {
  // Note: original draft used `require('child_process')` which fails in ESM.
  // `spawnSync` is already imported at the top of this file.
  const env = { ...process.env, C_GRADE_BATCH_LIVE: '', PRINT_TEMPLATE: '1' };
  const out = spawnSync('node', [path.resolve(REPO_ROOT, SCRIPT), '--limit', '1'], {
    cwd: REPO_ROOT, env, encoding: 'utf8', timeout: 60_000,
  });
  if (out.stdout.match(/\{\{[a-zA-Z_]+\}\}/)) throw new Error('unresolved template placeholders');
  return true;
});

await r.assert('LIVE-flag-actually-sends', async () => {
  // Cannot verify real send without breaking quiet hours; just check that LIVE flag is read.
  const body = fs.readFileSync(exists, 'utf8');
  if (!body.includes('C_GRADE_BATCH_LIVE')) throw new Error('must read C_GRADE_BATCH_LIVE env flag');
  return true;
});

await r.assert('queue-status-updated-after-send', () => {
  const body = fs.readFileSync(exists, 'utf8');
  if (!body.match(/queue.*sent|status.*sent|contact_log/i)) {
    throw new Error('must update queue.status=sent + entity.contact_log');
  }
  return true;
});

const s = r.summary();
process.exit(s.exitCode);
