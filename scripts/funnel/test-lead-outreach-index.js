#!/usr/bin/env node

import assert from 'assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { loadLeadOutreachIndex, matchesLeadView } from '../../core/funnel/lead-outreach-index.js';
import { runLeadOps, saveLeadOpsArtifacts } from '../../core/leads/lead-ops.js';

const index = loadLeadOutreachIndex();

assert.ok(index.records.length > 0, 'expected at least one lead/outreach record');

const opa = index.records.find((record) => record.clientSlug === 'opa-bar-mezze-restaurant');
assert.ok(opa, 'expected Opa lead record');
assert.equal(Boolean(opa.previewUrl), true, 'expected Opa preview URL');
assert.equal(opa.assetsReady, true, 'expected Opa assets ready');
assert.equal(opa.emailDraftReady, true, 'expected Opa outreach draft ready');
assert.ok(typeof opa.nextAction?.reason === 'string' && opa.nextAction.reason.length > 0, 'expected next action reason');
assert.ok('outreachChannelRecommendation' in opa, 'expected outreach channel recommendation field to exist');

const paid = index.records.find((record) => record.paymentStatus === 'paid');
assert.ok(paid, 'expected at least one paid lead/project');

const demoReadyCount = index.records.filter((record) => matchesLeadView(record, 'demo_ready')).length;
const missingEmailCount = index.records.filter((record) => matchesLeadView(record, 'missing_email')).length;
assert.ok(demoReadyCount > 0, 'expected at least one demo-ready record');

const discoveryFixture = buildDiscoveryFixture();
assert.equal(discoveryFixture.pipelineStage, 'ready_for_mockup');
assert.equal(discoveryFixture.nextAction.label, '创建 Mockup');
assert.equal(matchesLeadView(discoveryFixture, 'ready_for_mockup'), true);
assert.equal(discoveryFixture.leadFamilyId, 'field_service');
assert.ok(discoveryFixture.actionLog.some((entry) => entry.label === '运行线索流程'), 'expected visible work log');
assert.ok(discoveryFixture.workTrace.some((entry) => entry.tool === 'lead-ops skill'), 'expected tool trace');
assert.equal(discoveryFixture.aiAssessment.result, 'ready_for_mockup');
assert.ok(discoveryFixture.decisionActions.some((action) => action.action === 'skip_lead'), 'expected skip decision action');

const needsHumanFixture = buildNeedsHumanFixture();
assert.equal(needsHumanFixture.pipelineStage, 'needs_human');
assert.equal(needsHumanFixture.nextAction.label, '人工判断');
assert.equal(needsHumanFixture.blockingReason, 'AI 不确定，需要人工决定');
assert.equal(needsHumanFixture.aiAssessment.result, 'needs_human');

const autoSkipFixture = buildAutoSkipFixture();
assert.equal(autoSkipFixture.pipelineStage, 'skipped');
assert.equal(autoSkipFixture.aiAssessment.result, 'skip');
assert.match(autoSkipFixture.skipReason, /无法触达|没有邮箱/);

const skippedFixture = buildSkippedFixture();
assert.equal(skippedFixture.pipelineStage, 'skipped');
assert.match(skippedFixture.skipReason, /没有明确突破口/);
assert.ok(skippedFixture.actionLog.some((entry) => entry.label.includes('人工决定')), 'expected human decision in work log');
assert.ok(skippedFixture.decisionActions.some((action) => action.action === 'reopen_lead'), 'expected reopen action for skipped lead');

console.log(JSON.stringify({
  ok: true,
  counts: index.counts,
  assertions: {
    hasRecords: index.records.length > 0,
    hasOpa: Boolean(opa),
    opaAssetsReady: opa?.assetsReady === true,
    opaEmailDraftReady: opa?.emailDraftReady === true,
    hasPaid: Boolean(paid),
    demoReadyCount,
    missingEmailCount,
    discoveryFixtureStage: discoveryFixture.pipelineStage,
    needsHumanFixtureStage: needsHumanFixture.pipelineStage,
    autoSkipFixtureStage: autoSkipFixture.pipelineStage,
    skippedFixtureStage: skippedFixture.pipelineStage,
  },
}, null, 2));

function buildDiscoveryFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lead-outreach-discovery-'));
  const previousCwd = process.cwd();
  process.chdir(root);
  try {
    const result = runLeadOps({
      clientSlug: 'fixture-roof-restoration',
      sourceType: 'manual',
      businessName: 'Fixture Roof Restoration',
      industry: 'roof restoration',
      city: 'Brisbane',
      websiteUrl: 'https://fixture-roof.example',
      email: 'hello@fixture-roof.example',
      phone: '0415 000 000',
      observations: ['Current website could make quote intent clearer.'],
      services: ['roof restoration', 'roof repairs'],
    });
    saveLeadOpsArtifacts(result);
    const fixtureIndex = loadLeadOutreachIndex({
      clientsRoot: path.join(root, 'clients'),
      casesRoot: path.join(root, 'data', 'cases'),
      paidIntakesRoot: path.join(root, 'data', 'paid-intakes'),
    });
    return fixtureIndex.records.find((record) => record.clientSlug === 'fixture-roof-restoration');
  } finally {
    process.chdir(previousCwd);
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function buildNeedsHumanFixture() {
  return withTempLeadRoot('lead-outreach-needs-human-', (root) => {
    const clientSlug = 'fixture-needs-human-roofer';
    const leadDir = path.join(root, 'clients', clientSlug, 'lead');
    fs.mkdirSync(leadDir, { recursive: true });
    fs.writeFileSync(path.join(leadDir, 'lead-intake.json'), JSON.stringify({
      generatedAt: '2026-05-08T00:00:00.000Z',
      sourceType: 'google_maps',
      buildMode: 'redesign',
      gateStatus: 'reachable',
      project: { businessName: 'Needs Human Roofer', industry: 'roof restoration' },
      facts: { verified: { emails: ['hello@needs-human.example'] } },
    }, null, 2));
    fs.writeFileSync(path.join(leadDir, 'lead-research.json'), JSON.stringify({
      generatedAt: '2026-05-08T00:01:00.000Z',
      previewability: { status: 'ready_for_redesign_preview' },
      productionReadiness: { status: 'needs_more_research' },
    }, null, 2));
    fs.writeFileSync(path.join(leadDir, 'lead-ops.json'), JSON.stringify({
      generatedAt: '2026-05-08T00:02:00.000Z',
      summary: {
        familyId: 'field_service',
        readyToBuildStatus: 'needs_more_research',
        redesignDecision: 'redesign_preview',
      },
    }, null, 2));
    return loadFixtureRecord(root, clientSlug);
  });
}

function buildAutoSkipFixture() {
  return withTempLeadRoot('lead-outreach-auto-skip-', (root) => {
    const clientSlug = 'fixture-auto-skip-roofer';
    const leadDir = path.join(root, 'clients', clientSlug, 'lead');
    fs.mkdirSync(leadDir, { recursive: true });
    fs.writeFileSync(path.join(leadDir, 'lead-intake.json'), JSON.stringify({
      generatedAt: '2026-05-08T00:00:00.000Z',
      sourceType: 'manual',
      buildMode: 'teaser',
      gateStatus: 'blocked_unreachable',
      project: { businessName: 'Auto Skip Roofer', industry: 'roofing' },
      facts: { verified: {} },
    }, null, 2));
    fs.writeFileSync(path.join(leadDir, 'lead-research.json'), JSON.stringify({
      generatedAt: '2026-05-08T00:01:00.000Z',
      previewability: { status: 'blocked_unreachable' },
      productionReadiness: { status: 'blocked' },
    }, null, 2));
    return loadFixtureRecord(root, clientSlug);
  });
}

function buildSkippedFixture() {
  return withTempLeadRoot('lead-outreach-skipped-', (root) => {
    const clientSlug = 'fixture-skipped-roofer';
    const leadDir = path.join(root, 'clients', clientSlug, 'lead');
    const outreachDir = path.join(root, 'clients', clientSlug, 'outreach');
    fs.mkdirSync(leadDir, { recursive: true });
    fs.mkdirSync(outreachDir, { recursive: true });
    fs.writeFileSync(path.join(leadDir, 'lead-intake.json'), JSON.stringify({
      generatedAt: '2026-05-08T00:00:00.000Z',
      sourceType: 'manual',
      buildMode: 'teaser',
      gateStatus: 'reachable',
      project: { businessName: 'Skipped Roofer', industry: 'roofing' },
      facts: { verified: { emails: ['skip@example.com'] } },
    }, null, 2));
    fs.writeFileSync(path.join(outreachDir, 'lead-notes.jsonl'), `${JSON.stringify({
      id: 'lead_note_skip_fixture',
      type: 'lead_decision',
      action: 'skip_lead',
      actor: 'profitslocal-admin',
      note: '没有明确突破口，继续研究也不值得投入。',
      createdAt: '2026-05-08T00:05:00.000Z',
    })}\n`);
    return loadFixtureRecord(root, clientSlug);
  });
}

function withTempLeadRoot(prefix, callback) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  try {
    return callback(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function loadFixtureRecord(root, clientSlug) {
  const fixtureIndex = loadLeadOutreachIndex({
    clientsRoot: path.join(root, 'clients'),
    casesRoot: path.join(root, 'data', 'cases'),
    paidIntakesRoot: path.join(root, 'data', 'paid-intakes'),
  });
  return fixtureIndex.records.find((record) => record.clientSlug === clientSlug);
}
