#!/usr/bin/env node

import assert from 'assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

const repoRoot = path.resolve(new URL('../..', import.meta.url).pathname);
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'template-image-'));

try {
  const init = spawnSync(process.execPath, [
    path.join(repoRoot, 'scripts/template-lab/init-family.js'),
    '--root', tempRoot,
    '--niche', 'roofing',
    '--family', 'image-test',
  ], { encoding: 'utf8' });
  assert.equal(init.status, 0, init.stderr || init.stdout);

  const design = spawnSync(process.execPath, [
    path.join(repoRoot, 'scripts/template-lab/generate-design-md.js'),
    '--root', tempRoot,
    '--niche', 'roofing',
    '--family', 'image-test',
  ], { encoding: 'utf8' });
  assert.equal(design.status, 0, design.stderr || design.stdout);

  const result = spawnSync(process.execPath, [
    path.join(repoRoot, 'scripts/template-lab/generate-image-candidates.js'),
    '--root', tempRoot,
    '--niche', 'roofing',
    '--family', 'image-test',
    '--dry-run',
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const data = JSON.parse(result.stdout);
  assert.equal(data.ok, true);
  assert.equal(data.status, 'dry_run');
  assert.equal(fs.existsSync(data.runPath), true);

  const manifest = JSON.parse(fs.readFileSync(path.join(tempRoot, 'templates/roofing/families/image-test/template-manifest.json'), 'utf8'));
  assert.equal(manifest.imageExperiments.length, 1);
  assert.ok(manifest.imageExperiments[0].path.endsWith('image-run.json'));

  console.log(JSON.stringify({
    ok: true,
    assertions: {
      dryRun: data.status === 'dry_run',
      runWritten: fs.existsSync(data.runPath),
      manifestLinked: manifest.imageExperiments.length === 1,
    },
  }, null, 2));
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
