#!/usr/bin/env node

import assert from 'assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

const repoRoot = path.resolve(new URL('../..', import.meta.url).pathname);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'template-handoff-'));
const inputPath = path.join(tmp, 'lead.json');
const outDir = path.join(tmp, 'clients', 'greg-roofing-restoration', 'lead');

try {
  fs.writeFileSync(inputPath, `${JSON.stringify({
    clientSlug: 'greg-roofing-restoration',
    sourceType: 'manual',
    businessName: 'Roofing & Restoration',
    industry: 'roofing',
    niche: 'roofing',
    phone: '0424 371 622',
    city: 'Brisbane',
    services: ['roof restoration', 'roof repairs', 'gutters', 'pressure cleaning'],
    buildMode: 'teaser',
  }, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    path.join(repoRoot, 'scripts/leads/build-template-mockup-handoff.js'),
    '--input', inputPath,
    '--out', outDir,
    '--allow-internal',
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.ok, true);
  assert.equal(summary.selectedTemplate, 'roofing/lead-capture-restoration');

  const match = readJson(path.join(outDir, 'template-match.json'));
  const copy = readJson(path.join(outDir, 'copy-brief.json'));
  const handoff = readJson(path.join(outDir, 'open-design-handoff.json'));

  assert.equal(match.selected.templateId, 'roofing/lead-capture-restoration');
  assert.equal(copy.verifiedFacts.businessName, 'Roofing & Restoration');
  assert.deepEqual(copy.verifiedFacts.phones, ['0424 371 622']);
  assert.equal(copy.factLock.mustKeepExact.businessName, 'Roofing & Restoration');
  assert.equal(copy.provenance.customerVisibleLabels, false);
  assert.match(copy.pageCopyPlan.heroHeadline, /Roof Restoration|Roof Repairs/i);
  assert.equal(handoff.json.runRequirements.nativeCleanFinishRequired, true);
  assert.match(handoff.prompt, /Do not print labels like placeholder/);
  assert.match(handoff.prompt, /0424 371 622/);

  console.log(JSON.stringify({
    ok: true,
    selectedTemplate: summary.selectedTemplate,
    artifacts: {
      templateMatch: path.relative(repoRoot, path.join(outDir, 'template-match.json')),
      copyBrief: path.relative(repoRoot, path.join(outDir, 'copy-brief.json')),
      openDesignHandoff: path.relative(repoRoot, path.join(outDir, 'open-design-handoff.json')),
    },
  }, null, 2));
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

