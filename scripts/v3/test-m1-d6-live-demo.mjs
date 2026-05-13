#!/usr/bin/env node
// M1-D6 · sop1-live-demo --validate-m1 (5 entry case)
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { makeRunner, resolveRepo, REPO_ROOT } from './_test-helpers.mjs';

const r = makeRunner('m1-d6-live-demo');

const DEMO = 'scripts/qa/sop1-live-demo.mjs';
const exists = resolveRepo(DEMO);

if (!exists) {
  r.skip('demo-exists', `${DEMO} missing`);
  const s = r.summary({ implementation_present: false });
  process.exit(1);
}

// Heavy live test gated by env flag — local runs only.
const LIVE = process.env.V3_LIVE_TEST === '1';

await r.assert('--validate-m1-flag-recognized', () => {
  const body = fs.readFileSync(exists, 'utf8');
  if (!body.includes('--validate-m1') && !body.includes('validateM1')) {
    throw new Error('sop1-live-demo.mjs must accept --validate-m1 mode');
  }
  return true;
});

if (!LIVE) {
  for (const c of ['batch-maps', 'places-api', 'single-enrich', 'image', 'dedup']) {
    r.skip(`case-${c}`, 'V3_LIVE_TEST=1 required for live run');
  }
} else {
  await r.assert('live-validate-m1-runs', () => {
    const out = spawnSync('node', [path.resolve(REPO_ROOT, DEMO), '--validate-m1'], {
      cwd: REPO_ROOT, encoding: 'utf8', timeout: 15 * 60 * 1000,
    });
    if (out.status !== 0) throw new Error(`exit ${out.status} · stderr: ${out.stderr?.slice(0, 200)}`);
    return true;
  });
  // Reports verified inside live demo itself; this test only checks that it returns 0.
  for (const c of ['batch-maps', 'places-api', 'single-enrich', 'image', 'dedup']) {
    r.skip(`case-${c}-detail`, 'verified inside sop1-live-demo itself · see data/qa/m1-d6-live-demo-*.md');
  }
}

const s = r.summary({ live_mode: LIVE });
process.exit(s.exitCode);
