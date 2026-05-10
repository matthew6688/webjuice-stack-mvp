#!/usr/bin/env node

import assert from 'assert/strict';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'queue-action-'));
const operationLog = path.join(root, 'queue-operations.jsonl');

const audit = run(['--action', 'run_cheap_audit', '--entity-key', 'place_test', '--dry-run', 'true', '--operation-log', operationLog]);
assert.equal(audit.ok, true);
assert.equal(audit.action, 'run_cheap_audit');
assert.match(audit.command, /leads:audit-discovery-sites/);
assert.match(audit.command, /--entity-key place_test/);
assert.match(audit.command, /--dry-run/);
assert.equal(audit.operationLogPath, operationLog);

const enrichment = run(['--action', 'plan_enrichment', '--dry-run', 'true', '--operation-log', operationLog]);
assert.equal(enrichment.ok, true);
assert.equal(enrichment.action, 'plan_enrichment');
assert.match(enrichment.command, /leads:plan-discovery-enrichment/);

const enrichmentApproval = run(['--action', 'approve_enrichment_spend', '--entity-key', 'place_test', '--dry-run', 'true', '--operation-log', operationLog]);
assert.equal(enrichmentApproval.ok, true);
assert.equal(enrichmentApproval.action, 'approve_enrichment_spend');
assert.match(enrichmentApproval.command, /leads:update-enrichment-gate/);
assert.match(enrichmentApproval.command, /--entity-key place_test/);
assert.match(enrichmentApproval.command, /--status approved/);

const promote = run(['--action', 'promote_discovery', '--entity-key', 'place_test', '--dry-run', 'true', '--operation-log', operationLog]);
assert.equal(promote.ok, true);
assert.equal(promote.action, 'promote_discovery');
assert.match(promote.command, /leads:promote-discovery-store/);
assert.match(promote.command, /--entity-key place_test/);

const outreachBrief = run(['--action', 'build_outreach_brief', '--dry-run', 'true', '--operation-log', operationLog]);
assert.equal(outreachBrief.ok, true);
assert.equal(outreachBrief.action, 'build_outreach_brief');
assert.match(outreachBrief.command, /leads:build-discovery-outreach-briefs/);

const approveMockup = run(['--action', 'approve_mockup', '--client-slug', 'stage-place', '--dry-run', 'true', '--operation-log', operationLog]);
assert.equal(approveMockup.ok, true);
assert.equal(approveMockup.action, 'approve_mockup');
assert.match(approveMockup.command, /leads:approve-mockup/);
assert.match(approveMockup.command, /--client-slug stage-place/);

const mockupArtifacts = run(['--action', 'build_mockup_artifacts', '--client-slug', 'stage-place', '--dry-run', 'true', '--operation-log', operationLog]);
assert.equal(mockupArtifacts.ok, true);
assert.equal(mockupArtifacts.action, 'build_mockup_artifacts');
assert.match(mockupArtifacts.command, /leads:build-mockup-artifacts/);
assert.match(mockupArtifacts.command, /--client-slug stage-place/);

const emailDraft = run(['--action', 'build_outreach_email_draft', '--client-slug', 'stage-place', '--dry-run', 'true', '--operation-log', operationLog]);
assert.equal(emailDraft.ok, true);
assert.equal(emailDraft.action, 'build_outreach_email_draft');
assert.match(emailDraft.command, /leads:build-outreach-email-draft/);
assert.match(emailDraft.command, /--client-slug stage-place/);

const operations = fs.readFileSync(operationLog, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
assert.equal(operations.length, 8);
assert.deepEqual(operations.map((entry) => entry.status), ['succeeded', 'succeeded', 'succeeded', 'succeeded', 'succeeded', 'succeeded', 'succeeded', 'succeeded']);
assert.equal(operations[0].costPolicy.reviews, 'not_scraped_by_default');
assert.equal(operations[0].costPolicy.googlePlacesApi, 'not_used_by_default');

let failed = false;
try {
  run(['--action', 'run_cheap_audit', '--dry-run', 'true', '--operation-log', operationLog]);
} catch {
  failed = true;
}
assert.equal(failed, true, 'expected missing entity key to fail');

console.log(JSON.stringify({
  ok: true,
  auditCommand: audit.command,
  enrichmentCommand: enrichment.command,
  enrichmentApprovalCommand: enrichmentApproval.command,
  promoteCommand: promote.command,
  outreachBriefCommand: outreachBrief.command,
  approveMockupCommand: approveMockup.command,
  mockupArtifactsCommand: mockupArtifacts.command,
  emailDraftCommand: emailDraft.command,
  operationLog,
  operationCount: operations.length,
}, null, 2));

function run(args) {
  return JSON.parse(execFileSync('node', ['scripts/leads/run-queue-action.js', ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }));
}
