#!/usr/bin/env node
// M2-D9 · customer-audience report via autoresearch loop
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { makeRunner, tryImport, REPO_ROOT } from './_test-helpers.mjs';

const r = makeRunner('m2-d9-customer-audience');

const m = await tryImport('core/reports/autoresearch-loop.js');
if (!m || m.__error) {
  r.skip('autoresearch-loop-exists', `core/reports/autoresearch-loop.js missing`);
  const s = r.summary({ implementation_present: false });
  process.exit(1);
}

const gen = await tryImport('core/reports/generator.js');
if (!gen || gen.__error) {
  r.skip('generator-exists', `core/reports/generator.js missing`);
  const s = r.summary({ implementation_present: false });
  process.exit(1);
}

await r.assert('customer-audience-defined-in-generator', () => {
  const body = fs.readFileSync(path.join(REPO_ROOT, 'core', 'reports', 'generator.js'), 'utf8');
  if (!body.match(/customer.*audience|audience.*customer/i)) {
    throw new Error('customer audience preamble must be defined in generator.js');
  }
  return true;
});

await r.assert('SYSTEM_PREAMBLES-has-both-audiences', () => {
  const body = fs.readFileSync(path.join(REPO_ROOT, 'core', 'reports', 'generator.js'), 'utf8');
  if (!body.includes('SYSTEM_PREAMBLES')) throw new Error('SYSTEM_PREAMBLES export required');
  if (!body.match(/internal[\s\S]{0,80}customer|customer[\s\S]{0,80}internal/)) {
    throw new Error('both internal and customer audience prompts required');
  }
  return true;
});

const LIVE = process.env.V3_LIVE_TEST === '1';
if (!LIVE) {
  r.skip('live-1-customer-end-to-end', 'V3_LIVE_TEST=1 required ($1.50 autoresearch run)');
} else {
  await r.assert('live-1-customer-end-to-end', () => {
    const out = spawnSync('npm', ['run', 'pl:report-optimize', '--',
      '--entity-key', 'rich-and-rare-restaurant',
      '--audience', 'customer',
      '--generator-model', 'claude_cli:sonnet',
      '--critic-model', 'claude_cli:haiku',
    ], { cwd: REPO_ROOT, encoding: 'utf8', timeout: 15 * 60 * 1000 });
    if (out.status !== 0) throw new Error(`exit ${out.status}`);
    const outPath = path.join(REPO_ROOT, 'clients', 'rich-and-rare-restaurant', 'v2', 'customer-facing-audit.html');
    if (!fs.existsSync(outPath)) throw new Error(`output missing: ${outPath}`);
    return true;
  });
}

await r.assert('integration-into-stage-4b', () => {
  const stage4 = path.join(REPO_ROOT, 'scripts', 'leads', 'build-internal-report.js');
  if (!fs.existsSync(stage4)) {
    r.skip('integration-stage-4b-detail', 'build-internal-report.js missing');
    return true;
  }
  const body = fs.readFileSync(stage4, 'utf8');
  if (!body.match(/customer.?facing|stage.?4b|--audience/i)) {
    throw new Error('Stage 4b customer-facing report integration missing in build-internal-report.js');
  }
  return true;
});

const s = r.summary({ live_mode: LIVE });
process.exit(s.exitCode);
