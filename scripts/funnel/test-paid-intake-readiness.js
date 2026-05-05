#!/usr/bin/env node

import fs from 'fs';
import os from 'os';
import path from 'path';
import { routeFunnelSubmission } from '../../core/funnel/submission-router.js';
import { main as recordPaidIntakeUpdate } from './record-paid-intake-update.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'paid-intake-readiness-'));

const paidRoute = await routeFunnelSubmission(stripePaidIntakePayload(), {
  provider: 'stripe',
  kind: 'paid_intake',
  dryRun: true,
  sendDiscord: false,
  sendEmail: false,
});

const incomplete = await recordPaidIntakeUpdate({
  payload: {
    order_id: 'cs_test_paid_intake_incomplete',
    email: 'owner@example.com',
    client_slug: 'paid-intake-incomplete',
  },
  outputDir: root,
  silent: true,
});

const complete = await recordPaidIntakeUpdate({
  payload: {
    order_id: 'cs_test_paid_intake_complete',
    email: 'owner@example.com',
    client_slug: 'paid-intake-complete',
    business_name: 'Complete Business',
    address: '123 Main St, Austin TX',
    services: 'Coffee, brunch, catering, and private events.',
    primary_action: 'Book online',
    references: 'https://example.com',
    files: ['logo.png (image/png, 42 KB)'],
  },
  outputDir: root,
  silent: true,
});

const assertions = {
  paidCheckoutDoesNotCreateTask: paidRoute.ok && !paidRoute.taskPath,
  paidCheckoutCreatesPaidIntake: paidRoute.paidIntake?.status === 'paid_intake_pending_preview',
  paidCheckoutListsMissingDetails: paidRoute.paidIntake?.readiness?.missing?.includes('menu, services, products, or offers'),
  incompleteNeedsMoreInfo: incomplete.readiness.status === 'needs_more_info' && incomplete.status === 'intake_needs_more_info',
  completeReadyForAgentTask: complete.readiness.status === 'ready_for_agent_task' && complete.status === 'intake_ready_for_review',
};
const failed = Object.entries(assertions).filter(([, ok]) => !ok).map(([name]) => name);

const result = {
  ok: failed.length === 0,
  root,
  assertions,
  failed,
  paidRoute: {
    kind: paidRoute.kind,
    taskPath: paidRoute.taskPath,
    readiness: paidRoute.paidIntake?.readiness,
  },
  incomplete: {
    status: incomplete.status,
    missing: incomplete.readiness.missing,
  },
  complete: {
    status: complete.status,
    missing: complete.readiness.missing,
  },
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);

function stripePaidIntakePayload() {
  return {
    id: 'evt_test_paid_intake_route',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_paid_intake_route_001',
        payment_status: 'paid',
        amount_total: 39900,
        currency: 'usd',
        customer_details: { email: 'owner@example.com' },
        metadata: {
          tier: 'one_time',
          order_kind: 'paid_intake',
          client_slug: 'test-paid-intake-route',
          business_name: 'Test Paid Intake Route',
          attachment_summary: 'logo.png (image/png, 42 KB)',
        },
      },
    },
  };
}
