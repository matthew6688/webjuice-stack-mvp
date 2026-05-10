#!/usr/bin/env node

import fs from 'fs';
import os from 'os';
import path from 'path';
import assert from 'assert/strict';
import { runLeadOps, saveLeadOpsArtifacts } from '../../core/leads/lead-ops.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lead-ops-'));
const previousCwd = process.cwd();
process.chdir(tmp);

try {
  const result = runLeadOps({
    clientSlug: 'northside-roofing',
    sourceType: 'manual',
    businessName: 'Northside Roofing',
    industry: 'roofing',
    city: 'Brisbane',
    email: 'hello@northside.example',
    websiteUrl: 'https://northside.example',
    observations: ['The current site hides the quote path on mobile.'],
    services: ['roof repairs', 'roof replacement', 'storm damage'],
  });

  const saved = saveLeadOpsArtifacts(result);

  assert.equal(result.intake.strategy.familyId, 'field_service');
  assert.equal(result.redesignCheck.decision, 'redesign_preview');
  assert.equal(result.readyToBuild.status, 'ready_for_open_design');
  assert.equal(result.readyToBuild.aiConclusion.result, 'ready_for_mockup');
  assert.equal(typeof result.readyToBuild.aiConclusion.score, 'number');
  assert.ok(result.readyToBuild.websiteBuildHandoff.openDesignPayload.prompt.includes('Northside Roofing'));
  assert.equal(result.outreachBrief.channelRecommendation, 'email');
  assert.equal(fs.existsSync(saved.intake), true);
  assert.equal(fs.existsSync(saved.research), true);
  assert.equal(fs.existsSync(saved.redesignCheck), true);
  assert.equal(fs.existsSync(saved.readyToBuild), true);
  assert.equal(fs.existsSync(saved.outreachBrief), true);
  assert.equal(fs.existsSync(saved.leadOps), true);

  console.log(JSON.stringify({
    ok: true,
    assertions: {
      familyId: result.summary.familyId,
      redesignDecision: result.summary.redesignDecision,
      readyToBuildStatus: result.summary.readyToBuildStatus,
      aiConclusion: result.summary.aiConclusion,
      aiScore: result.summary.aiScore,
      websitePlanType: result.summary.websitePlanType,
      outreachChannel: result.summary.outreachChannel,
      savedLeadOps: saved.leadOps,
    },
  }, null, 2));
} finally {
  process.chdir(previousCwd);
  fs.rmSync(tmp, { recursive: true, force: true });
}
