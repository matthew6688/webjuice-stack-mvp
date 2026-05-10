#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { recordLeadNote } from '../../core/funnel/lead-notes.js';
import { loadLeadOutreachIndex } from '../../core/funnel/lead-outreach-index.js';

const args = parseArgs(process.argv.slice(2));
const clientSlug = clean(args['client-slug'] || args.clientSlug || args.client_slug);
const clientsRoot = args['clients-root'] || args.clientsRoot || 'clients';
const casesRoot = args['cases-root'] || args.casesRoot || 'data/cases';
const paidIntakesRoot = args['paid-intakes-root'] || args.paidIntakesRoot || 'data/paid-intakes';
const discoveryRoot = args['discovery-root'] || args.discoveryRoot || 'data/leads';
const actor = clean(args.actor) || 'profitslocal-admin';
const dryRun = args['dry-run'] === true || args['dry-run'] === 'true' || args.dryRun === true || args.dryRun === 'true';

if (!clientSlug) {
  console.error(JSON.stringify({ ok: false, error: 'client_slug is required' }, null, 2));
  process.exit(1);
}

const index = loadLeadOutreachIndex({ clientsRoot, casesRoot, paidIntakesRoot, discoveryRoot });
const record = index.records.find((item) => item.clientSlug === clientSlug);
if (!record) {
  console.error(JSON.stringify({ ok: false, error: `Lead not found: ${clientSlug}` }, null, 2));
  process.exit(1);
}

if (!['ready_for_mockup', 'needs_human'].includes(record.pipelineStage)) {
  console.error(JSON.stringify({
    ok: false,
    error: `Lead is not ready for mockup approval: ${record.pipelineStage}`,
    clientSlug,
    pipelineStage: record.pipelineStage,
  }, null, 2));
  process.exit(1);
}

const conceptDir = path.join(clientsRoot, clientSlug, 'concept', 'open-design');
const requestPath = path.join(conceptDir, 'mockup-request.json');
const request = buildMockupRequest(record, { actor });

let noteResult = { ok: true, dryRun: true, skipped: true, reason: 'dry_run' };
if (!dryRun) {
  fs.mkdirSync(conceptDir, { recursive: true });
  fs.writeFileSync(requestPath, `${JSON.stringify(request, null, 2)}\n`, 'utf8');
  noteResult = await recordLeadNote({
    client_slug: clientSlug,
    company: record.company || clientSlug,
    actor,
    action: 'approve_mockup',
    note: `Approved mockup and created Open Design request: ${requestPath}`,
  }, {
    clientsRoot,
    casesDir: casesRoot,
    sendDiscord: false,
  });
}

console.log(JSON.stringify({
  ok: true,
  dryRun,
  clientSlug,
  previousStage: record.pipelineStage,
  nextExpectedStage: 'mockup_building',
  requestPath,
  request: dryRun ? request : undefined,
  note: noteResult,
}, null, 2));

function buildMockupRequest(record, { actor }) {
  return {
    schemaVersion: 1,
    kind: 'lead_mockup_request',
    createdAt: new Date().toISOString(),
    actor,
    clientSlug: record.clientSlug,
    businessName: record.company || record.businessName || record.clientSlug,
    stageBeforeApproval: record.pipelineStage,
    source: {
      leadIntakePath: record.leadIntakePath || '',
      readyToBuildPath: record.websiteBuildHandoffPath || '',
      currentSiteAuditPath: record.currentSiteAuditPath || '',
      outreachBriefPath: record.outreachBriefPath || '',
    },
    gates: {
      hasContactPath: Boolean(record.email || record.customerEmail || record.leadRecipientEmail || record.phone || record.contactPageUrl),
      hasCurrentSiteAudit: Boolean(record.currentSiteAuditPath),
      hasOpenDesignPrompt: Boolean(record.openDesignPrompt),
      salesDecision: record.currentSiteSalesDecision || '',
    },
    openDesign: {
      mode: record.leadBuildMode === 'redesign' ? 'redesign_preview' : 'lead_mockup',
      prompt: record.openDesignPrompt || record.currentSiteOpenDesignDirection || record.customerOpportunitySummary || '',
      direction: record.currentSiteOpenDesignDirection || record.openDesignBrief?.heroAngle || '',
    },
    outreach: {
      hook: record.currentSiteOutreachHook || record.outreachPrimaryProofPoint || '',
      channelRecommendation: record.outreachChannelRecommendation || '',
    },
    nextAutomation: {
      recommendedAction: 'run_open_design_or_template_mockup',
      note: 'This request is created after the human approval gate. The next runner should generate or bind the mockup, then write preview/proof artifacts.',
    },
  };
}

function clean(value) {
  return String(value || '').trim();
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    parsed[key] = next && !next.startsWith('--') ? next : true;
    if (next && !next.startsWith('--')) i += 1;
  }
  return parsed;
}
