#!/usr/bin/env node

import assert from 'assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

const repoRoot = path.resolve(new URL('../..', import.meta.url).pathname);
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'template-lab-'));

try {
  const script = path.join(repoRoot, 'scripts', 'template-lab', 'init-family.js');
  const result = spawnSync(process.execPath, [
    script,
    '--root', tempRoot,
    '--niche', 'Roofing',
    '--family', 'Classic Premium Roftix',
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const familyDir = path.join(tempRoot, 'templates', 'roofing', 'families', 'classic-premium-roftix');
  for (const file of [
    'template-manifest.json',
    'design-language.md',
    'section-patterns.json',
    'open-design-prompt.md',
    'qa-rubric.json',
  ]) {
    assert.equal(fs.existsSync(path.join(familyDir, file)), true, `${file} missing`);
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(familyDir, 'template-manifest.json'), 'utf8'));
  assert.equal(manifest.templateId, 'roofing/classic-premium-roftix');
  assert.equal(manifest.status, 'draft');
  assert.deepEqual(manifest.factsPolicy.requiredVerifiedFacts, ['businessName', 'phone', 'services']);
  assert.ok(manifest.visualAssetPlan.forbidden.includes('text-only hero'));

  const duplicate = spawnSync(process.execPath, [
    script,
    '--root', tempRoot,
    '--niche', 'roofing',
    '--family', 'classic-premium-roftix',
  ], { encoding: 'utf8' });
  assert.notEqual(duplicate.status, 0);
  assert.ok(duplicate.stderr.includes('already exists'));

  const forced = spawnSync(process.execPath, [
    script,
    '--root', tempRoot,
    '--niche', 'roofing',
    '--family', 'classic-premium-roftix',
    '--force', 'true',
  ], { encoding: 'utf8' });
  assert.equal(forced.status, 0, forced.stderr || forced.stdout);

  const shared = path.join(tempRoot, 'templates', 'roofing', 'shared');
  assert.equal(fs.existsSync(path.join(shared, 'image-keywords.json')), true);
  assert.equal(fs.existsSync(path.join(shared, 'service-taxonomy.json')), true);
  assert.equal(fs.existsSync(path.join(shared, 'trust-signals.json')), true);

  console.log(JSON.stringify({
    ok: true,
    familyDir,
    duplicateGuard: true,
    forceOverwrite: true,
    sharedFiles: true,
  }, null, 2));
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
