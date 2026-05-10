#!/usr/bin/env node

import assert from 'assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

const repoRoot = path.resolve(new URL('../..', import.meta.url).pathname);
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'template-design-'));

try {
  const init = spawnSync(process.execPath, [
    path.join(repoRoot, 'scripts/template-lab/init-family.js'),
    '--root', tempRoot,
    '--niche', 'roofing',
    '--family', 'reference-test',
  ], { encoding: 'utf8' });
  assert.equal(init.status, 0, init.stderr || init.stdout);

  const familyDir = path.join(tempRoot, 'templates/roofing/families/reference-test');
  const imagePath = path.join(familyDir, 'references', 'tiny.png');
  fs.writeFileSync(imagePath, Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lXW9WQAAAABJRU5ErkJggg==',
    'base64'
  ));

  const signals = spawnSync(process.execPath, [
    path.join(repoRoot, 'scripts/template-lab/extract-design-signals.js'),
    '--root', tempRoot,
    '--niche', 'roofing',
    '--family', 'reference-test',
    '--image', imagePath,
    '--dry-run',
  ], { encoding: 'utf8' });
  assert.equal(signals.status, 0, signals.stderr || signals.stdout);
  const signalsData = JSON.parse(signals.stdout);
  assert.equal(signalsData.ok, true);
  assert.equal(signalsData.images, 1);

  const design = spawnSync(process.execPath, [
    path.join(repoRoot, 'scripts/template-lab/generate-design-md.js'),
    '--root', tempRoot,
    '--niche', 'roofing',
    '--family', 'reference-test',
  ], { encoding: 'utf8' });
  assert.equal(design.status, 0, design.stderr || design.stdout);
  const designData = JSON.parse(design.stdout);
  assert.equal(designData.ok, true);

  const manifest = JSON.parse(fs.readFileSync(path.join(familyDir, 'template-manifest.json'), 'utf8'));
  assert.equal(fs.existsSync(path.join(familyDir, 'DESIGN.md')), true);
  assert.equal(fs.existsSync(path.join(familyDir, 'design-signals.json')), true);
  assert.ok(manifest.designSignals.path.endsWith('design-signals.json'));
  assert.ok(manifest.designContract.path.endsWith('DESIGN.md'));
  assert.equal(manifest.sourceInputs.screenshots.length, 1);

  console.log(JSON.stringify({
    ok: true,
    assertions: {
      dryRunSignals: signalsData.ok,
      designMd: designData.ok,
      manifestLinked: Boolean(manifest.designSignals && manifest.designContract),
      screenshotBound: manifest.sourceInputs.screenshots.length === 1,
    },
  }, null, 2));
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
