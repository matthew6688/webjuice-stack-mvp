#!/usr/bin/env node

import assert from 'assert/strict';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const repoRoot = path.resolve(new URL('../..', import.meta.url).pathname);
const runId = `test-${Date.now()}`;
const script = path.join(repoRoot, 'scripts/template-lab/run-template-autoresearch.js');
const scriptSource = fs.readFileSync(script, 'utf8');
assert.match(scriptSource, /maxBuffer: 128 \* 1024 \* 1024/);
assert.match(scriptSource, /--mode/);

const result = spawnSync(process.execPath, [
  script,
  '--root',
  repoRoot,
  '--niche',
  'roofing',
  '--families',
  'editorial-bold-commercial,productized-modern-roofing',
  '--run-id',
  runId,
  '--variant',
  'medium-framework-no-llm',
  '--target-score',
  '95',
], {
  cwd: repoRoot,
  encoding: 'utf8',
});

assert.equal(result.status, 0, result.stderr || result.stdout);
const summary = JSON.parse(result.stdout);
assert.equal(summary.schemaVersion, 1);
assert.equal(summary.execute, false);
assert.equal(summary.openDesignMode, null);
assert.equal(summary.targetScore, 95);
assert.deepEqual(summary.variants, ['medium-framework-no-llm']);
assert.equal(summary.families.length, 2);
assert.deepEqual(summary.accepted.sort(), ['editorial-bold-commercial', 'productized-modern-roofing']);
assert.deepEqual(summary.pending, []);

for (const family of summary.families) {
  assert.equal(family.accepted, true);
  assert.equal(family.best.variant, 'medium-framework-no-llm');
  assert.equal(family.best.execute, false);
  assert.equal(family.best.status, 0);
  assert.match(family.best.experimentRoot, new RegExp(`data/template-experiments/roofing/${family.family}/home-${runId}`));
  assert.equal(fs.existsSync(path.join(repoRoot, family.best.scorePath)), true);
}

const summaryPath = path.join(repoRoot, 'data/template-experiments/roofing', `autoresearch-${runId}`, 'summary.json');
assert.equal(fs.existsSync(summaryPath), true);

console.log(JSON.stringify({
  ok: true,
  families: summary.families.map((item) => item.family),
  summaryPath: path.relative(repoRoot, summaryPath),
}, null, 2));
