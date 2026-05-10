#!/usr/bin/env node

import assert from 'assert/strict';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'open-design-template-handoff-'));
try {
  const handoffPath = path.join(root, 'open-design-handoff.json');
  const requestPath = path.join(root, 'open-design-run-request.json');
  const outDir = path.join(root, 'concept');
  fs.writeFileSync(handoffPath, `${JSON.stringify({
    schemaVersion: 1,
    generatedAt: '2026-05-10T00:00:00.000Z',
    type: 'template_open_design_handoff',
    clientSlug: 'fixture-template-run',
    selectedTemplate: {
      templateId: 'roofing/lead-capture-restoration',
      family: 'lead-capture-restoration',
      displayName: 'Lead Capture Restoration',
    },
    prompt: [
      'Build a local-business website mockup using the approved niche template workflow.',
      'Verified facts to preserve exactly:',
      '- Business name: Fixture Roofing',
      '- Phone: 0412 000 000',
      '- Email: hello@fixture-roof.example',
      '- Address: Brisbane, QLD',
      'Requirements:',
      '- Make mobile first-class.',
      '- Include clear CTA/contact path.',
    ].join('\n'),
    json: {
      copyBrief: {
        verifiedFacts: {
          businessName: 'Fixture Roofing',
          industry: 'roofing',
          city: 'Brisbane',
          phones: ['0412 000 000'],
          emails: ['hello@fixture-roof.example'],
          address: 'Brisbane, QLD',
        },
        inferredContent: {
          buildType: 'one_page',
        },
      },
      runRequirements: {
        nativeCleanFinishRequired: true,
      },
    },
  }, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    'scripts/open-design/run-template-handoff.js',
    '--client', 'fixture-template-run',
    '--handoff', handoffPath,
    '--request-out', requestPath,
    '--out', outDir,
    '--dry-run',
  ], {
    cwd: path.resolve('.'),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const stdout = JSON.parse(result.stdout);
  assert.equal(stdout.ok, true);
  assert.equal(stdout.dryRun, true);
  assert.equal(stdout.mode, 'app-visible');
  assert.equal(stdout.timeoutMs, 30 * 60 * 1000);
  assert.equal(stdout.allowArtifactFallback, false);
  assert.equal(stdout.selectedTemplate, 'roofing/lead-capture-restoration');

  const request = JSON.parse(fs.readFileSync(requestPath, 'utf8'));
  assert.equal(request.status, 'dry_run');
  assert.equal(request.timeoutPolicy.checkpointNotHardEnd, true);
  assert.equal(request.timeoutPolicy.nativeCleanFinishRequired, true);
  assert.ok(request.publicOutDir.endsWith(path.join('fixture-template-run', 'open-design')));
  assert.ok(request.commandPreview.includes('--mode'));
  assert.ok(request.commandPreview.includes('app-visible'));
  assert.ok(!request.commandPreview.includes('--allow-artifact-fallback'), 'fallback must remain opt-in');
  assert.ok(request.promptChars > 300, 'wrapper should add run discipline to prompt');

  console.log(JSON.stringify({
    ok: true,
    assertions: {
      dryRun: stdout.dryRun,
      mode: stdout.mode,
      timeoutMs: stdout.timeoutMs,
      noFallbackByDefault: !request.commandPreview.includes('--allow-artifact-fallback'),
      nativeFinishRequired: request.timeoutPolicy.nativeCleanFinishRequired,
    },
  }, null, 2));
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
