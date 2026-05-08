#!/usr/bin/env node

import { buildApprovalWorkflowDispatch, buildRevisionWorkflowDispatch } from '../../core/ops/workflow-dispatch.js';

const approval = buildApprovalWorkflowDispatch({
  order_id: 'cs_test_approval_001',
  email: 'OWNER@EXAMPLE.COM',
  client_slug: 'opa-bar-mezze-restaurant',
  repo: 'matthew6688/opa-bar-mezze-restaurant',
  task_path: 'data/agent-tasks/opa-bar-mezze-restaurant/sale-cs_test_approval_001.json',
  dry_run: 'true',
}, {
  APPROVAL_ALLOW_DRY_RUN: 'true',
});

const revision = buildRevisionWorkflowDispatch({
  order_id: 'cs_test_revision_001',
  email: 'owner@example.com',
  client_slug: 'opa-bar-mezze-restaurant',
  repo: 'matthew6688/opa-bar-mezze-restaurant',
  requested_changes: 'Please update the hero and swap the gallery image.',
  files: ['menu-update.pdf'],
  asset_refs: '[{"filename":"menu-update.pdf","secureUrl":"https://res.cloudinary.com/demo/raw/upload/menu-update.pdf"}]',
  submitted_at: '2026-05-07T18:00:00.000Z',
});

const assertions = {
  approvalOk: approval.ok === true,
  approvalWorkflowCorrect: approval.workflow === 'publish-approved.yml',
  approvalNormalizesEmail: approval.inputs.email === 'owner@example.com',
  approvalDryRunEnabled: approval.inputs.dry_run === 'true',
  approvalCarriesTaskPath: approval.inputs.task_path.includes('sale-cs_test_approval_001.json'),
  revisionOk: revision.ok === true,
  revisionWorkflowCorrect: revision.workflow === 'route-funnel-event.yml',
  revisionKindCorrect: revision.inputs.kind === 'revision',
  revisionProviderCorrect: revision.inputs.provider === 'tally',
  revisionAutoRunAgentDisabled: revision.inputs.auto_run_agent === 'false',
  revisionPayloadPreserved: JSON.parse(revision.inputs.payload).requested_changes.includes('hero'),
  revisionDedupeKeyIncludesOrder: revision.inputs.dedupe_key.startsWith('cs_test_revision_001-'),
};

const failed = Object.entries(assertions).filter(([, value]) => value !== true).map(([key]) => key);

console.log(JSON.stringify({
  ok: failed.length === 0,
  assertions,
  failed,
  approval,
  revision,
}, null, 2));

if (failed.length) process.exit(1);
