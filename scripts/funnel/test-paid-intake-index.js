#!/usr/bin/env node

import fs from 'fs';
import os from 'os';
import path from 'path';
import { loadPaidIntakeIndex } from '../../core/funnel/paid-intake-index.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'paid-intake-index-'));
const clientDir = path.join(root, 'alpha-bakery');
const previousCwd = process.cwd();
process.chdir(root);

try {
  fs.mkdirSync(clientDir, { recursive: true });
  fs.mkdirSync(path.join('clients', 'alpha-bakery', 'outreach'), { recursive: true });
  fs.mkdirSync(path.join('data', 'cases', 'alpha-bakery', 'cs_test_alpha'), { recursive: true });
  fs.mkdirSync(path.join('data', 'finance'), { recursive: true });
  fs.mkdirSync(path.join('data', 'domain', 'requests', 'alpha-bakery'), { recursive: true });
  fs.mkdirSync(path.join('data', 'ops-smoke', 'alpha-smoke'), { recursive: true });
  fs.writeFileSync(path.join(clientDir, 'cs_test_alpha.json'), JSON.stringify({
    clientSlug: 'alpha-bakery',
    orderId: 'cs_test_alpha',
    status: 'intake_ready_for_review',
    order: { tier: 'one_time', amount: 399, currency: 'USD' },
    customer: { company: 'Alpha Bakery', email: 'owner@alpha.test', domain: 'alpha.test' },
    leadDelivery: { recipientEmail: 'leads@alpha.test' },
    intake: { files: ['logo.png'], assets: [{ secureUrl: 'https://res.cloudinary.com/demo/logo.png' }] },
    firstVersionConfirmation: { confirmed: true },
    revisions: [{ accepted: true, status: 'revision_submitted' }],
    case: { casePath: 'data/cases/alpha-bakery/cs_test_alpha/case.json' },
    updatedAt: '2026-05-06T01:00:00.000Z',
  }), 'utf8');
  fs.writeFileSync(path.join('clients', 'alpha-bakery', 'outreach', 'outreach-pack.json'), JSON.stringify({
    previewUrl: 'https://alpha-bakery-dev.pages.dev/',
    emailBrief: { proofPoints: ['one', 'two'] },
    assets: { screenshots: { desktop: 'a.png', mobile: 'b.png' }, video: 'c.mp4' },
  }), 'utf8');
  fs.writeFileSync(path.join('clients', 'alpha-bakery', 'outreach', 'outreach-pack.md'), '# Alpha outreach\n', 'utf8');
  fs.writeFileSync(path.join('data', 'cases', 'alpha-bakery', 'cs_test_alpha', 'delivery-qa.json'), JSON.stringify({
    readyForCustomerReview: true,
  }), 'utf8');
  fs.writeFileSync(path.join('data', 'cases', 'alpha-bakery', 'cs_test_alpha', 'case.json'), JSON.stringify({
    status: 'agent_completed',
    latestTask: { id: 'task_alpha_001', kind: 'sale', status: 'completed' },
  }), 'utf8');
  fs.writeFileSync(path.join('data', 'finance', 'alpha-bakery-summary.json'), JSON.stringify({
    summary: { revenue: 399, cost: 25, profit: 374, roi: 14.96, eventCount: 2, revenueEventCount: 1, costEventCount: 1 },
  }), 'utf8');
  fs.writeFileSync(path.join('data', 'ops-smoke', 'alpha-smoke', 'summary.json'), JSON.stringify({
    approval: {
      orderId: 'cs_test_alpha',
      requestedAt: '2026-05-06T04:00:00.000Z',
      workflowRunId: 12345,
      workflowUrl: 'https://github.com/example/actions/runs/12345',
    },
    revision: {
      orderId: 'cs_test_alpha',
      requestedAt: '2026-05-06T05:00:00.000Z',
      workflowRunId: 12346,
      workflowUrl: 'https://github.com/example/actions/runs/12346',
    },
    assertions: { revisionWorkflowSucceeded: true },
    failed: [],
  }), 'utf8');
  fs.writeFileSync(path.join('data', 'domain', 'requests', 'alpha-bakery', 'request.json'), JSON.stringify({
    status: 'waiting_for_customer_dns',
    domain: 'menu.alpha.test',
    updatedAt: '2026-05-06T03:00:00.000Z',
  }), 'utf8');
  fs.writeFileSync(path.join(root, 'alpha-bakery', 'cs_test_alpha-timeline.jsonl'), `${JSON.stringify({
    type: 'admin_marked_v1_delivered',
    createdAt: '2026-05-06T02:00:00.000Z',
  })}\n`, 'utf8');

  const index = loadPaidIntakeIndex({ root });
  const record = index.records[0];
  const assertions = {
    hasOneRecord: index.records.length === 1,
    countsReady: index.counts.intake_ready_for_review === 1,
    summarizesLeadRecipient: record.leadRecipientEmail === 'leads@alpha.test',
    summarizesAssetCount: record.assetCount === 1,
    summarizesRevisionLimit: record.revisionLimit === 3,
    summarizesRevisionCount: record.revisionCount === 1,
    includesOutreachSummary: record.artifactSummary.outreachProofPoints === 2,
    includesDeliveryQaSummary: record.artifactSummary.deliveryQaReady === true,
    includesFinanceSummary: record.artifactSummary.financeSummary.profit === 374,
    includesStageSummary: record.stageSummary.label === 'Review Ready',
    includesMilestoneSummary: record.milestoneSummary.currentKey === 'domain_waiting_customer',
    includesMilestoneCount: record.milestoneSummary.completedCount >= 3,
    includesBlockerSummary: record.blockerSummary.primary === '还没有绑定 Open Design project',
    includesNextActionSummary: record.nextActionSummary.label === '创建/绑定 Open Design',
    includesWorkflowSummary: record.artifactSummary.latestTask?.id === 'task_alpha_001',
    includesWorkflowRunSummary: record.workflowSummary.latestWorkflowRunId === 12346,
  };
  const failed = Object.entries(assertions).filter(([, ok]) => !ok).map(([name]) => name);
  const result = { ok: failed.length === 0, root, assertions, failed, record, counts: index.counts };
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
} finally {
  process.chdir(previousCwd);
}
