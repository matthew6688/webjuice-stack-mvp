#!/usr/bin/env node

import fs from 'fs';
import os from 'os';
import path from 'path';
import assert from 'assert/strict';
import { runLeadOps, saveLeadOpsArtifacts } from '../../core/leads/lead-ops.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lead-ops-audit-'));
const previousCwd = process.cwd();
process.chdir(tmp);

try {
  const socialOnly = runLeadOps({
    clientSlug: 'soft-signal-salon',
    sourceType: 'manual',
    businessName: 'Soft Signal Salon',
    industry: 'salon',
    instagramUrl: 'https://instagram.com/softsignal',
    observations: ['Only a thin profile and Instagram are visible.'],
    services: ['colour', 'cut'],
  });
  assert.equal(socialOnly.intake.contactability.status, 'reachable');
  assert.equal(socialOnly.research.contactability.status, 'reachable');
  assert.equal(socialOnly.outreachBrief.channelRecommendation, 'instagram_dm');

  const unreachable = runLeadOps({
    clientSlug: 'ghost-prospect',
    sourceType: 'manual',
    businessName: 'Ghost Prospect',
    industry: 'law firm',
    observations: ['No public contact path at all.'],
  });
  assert.equal(unreachable.intake.gateStatus, 'blocked_unreachable');
  assert.equal(unreachable.research.previewability.status, 'blocked_unreachable');
  assert.equal(unreachable.readyToBuild.status, 'blocked_unreachable');
  assert.equal(unreachable.redesignCheck.decision, 'blocked_unreachable');

  const customPathsRun = runLeadOps({
    clientSlug: 'northside-roofing-custom',
    sourceType: 'manual',
    businessName: 'Northside Roofing',
    industry: 'roofing',
    email: 'hello@northside.example',
    websiteUrl: 'https://northside.example',
    observations: ['The current site hides the quote path on mobile.'],
    services: ['roof repairs', 'roof replacement'],
  });
  const customPaths = saveLeadOpsArtifacts(customPathsRun, {
    intake: 'qa/intake.json',
    research: 'qa/research.json',
    redesignCheck: 'qa/redesign.json',
    readyToBuild: 'qa/ready.json',
    outreachBrief: 'qa/brief.json',
    leadOps: 'qa/summary.json',
  });

  const savedSummary = JSON.parse(fs.readFileSync(customPaths.leadOps, 'utf8'));
  assert.equal(savedSummary.paths.intake, 'qa/intake.json');
  assert.equal(savedSummary.paths.readyToBuild, 'qa/ready.json');
  assert.equal(savedSummary.paths.outreachBrief, 'qa/brief.json');

  console.log(JSON.stringify({
    ok: true,
    assertions: {
      socialOnlyChannel: socialOnly.outreachBrief.channelRecommendation,
      unreachableStatus: unreachable.readyToBuild.status,
      customSummaryPath: savedSummary.paths.leadOps,
      customReadyPath: savedSummary.paths.readyToBuild,
    },
  }, null, 2));
} finally {
  process.chdir(previousCwd);
  fs.rmSync(tmp, { recursive: true, force: true });
}

