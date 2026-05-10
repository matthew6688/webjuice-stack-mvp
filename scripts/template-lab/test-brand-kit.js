#!/usr/bin/env node

import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

const repoRoot = path.resolve(new URL('../..', import.meta.url).pathname);
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'template-brand-kit-'));

try {
  runNode(path.join(repoRoot, 'scripts/template-lab/init-family.js'), [
    '--root', tempRoot,
    '--niche', 'roofing',
    '--family', 'single-logo-smoke',
  ]);
  runNode(path.join(repoRoot, 'scripts/template-lab/generate-design-md.js'), [
    '--root', tempRoot,
    '--niche', 'roofing',
    '--family', 'single-logo-smoke',
  ]);
  runNode(path.join(repoRoot, 'scripts/template-lab/generate-brand-kit.js'), [
    '--root', tempRoot,
    '--niche', 'roofing',
    '--family', 'single-logo-smoke',
    '--business', 'Greg Roofing & Restoration',
  ]);

  const familyDir = path.join(tempRoot, 'templates/roofing/families/single-logo-smoke');
  const brandKit = JSON.parse(fs.readFileSync(path.join(familyDir, 'brand-kit.json'), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(familyDir, 'template-manifest.json'), 'utf8'));

  assert.equal(brandKit.logo.policy, 'single-default-demo-logo');
  assert.equal(brandKit.logo.options.length, 1);
  assert.equal(brandKit.logo.options[0].selected, true);
  assert.equal(brandKit.businessName, 'Greg Roofing & Restoration');
  assert.equal(manifest.brandKit.logoOptionCount, 1);
  assert.equal(manifest.brandKit.status, 'ready');

  console.log(JSON.stringify({
    ok: true,
    brandKitPath: path.join(familyDir, 'brand-kit.json'),
    logoPolicy: brandKit.logo.policy,
    logoOptionCount: brandKit.logo.options.length,
  }, null, 2));
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

function runNode(script, args) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env },
  });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${script}\n${result.stdout}\n${result.stderr}`);
  }
}
