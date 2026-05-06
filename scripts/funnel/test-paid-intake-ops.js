#!/usr/bin/env node

import { buildPaidIntakeOpsMessage, buildRevisionOpsMessage, sendOpsDiscordMessage } from '../../core/funnel/paid-intake-ops.js';

const intakePayload = buildPaidIntakeOpsMessage({
  payload: {
    client_slug: 'ops-client',
    order_id: 'cs_test_ops',
    email: 'owner@example.com',
    business_name: 'Ops Client',
    lead_recipient_email: 'leads@example.com',
  },
  summary: {
    status: 'intake_ready_for_review',
    readiness: { status: 'ready_for_agent_task', missing: [] },
    files: ['logo.png'],
    assets: [{ secureUrl: 'https://res.cloudinary.com/demo/logo.png' }],
  },
  baseUrl: 'https://profitslocal.com',
});
const revisionPayload = buildRevisionOpsMessage({
  payload: { requested_changes: 'Update offer copy.', email: 'owner@example.com' },
  summary: {
    clientSlug: 'ops-client',
    orderId: 'cs_test_ops',
    status: 'revision_requested',
    accepted: true,
    revisionNumber: 2,
    revisionLimit: 3,
    files: [],
    assets: [],
  },
});
const calls = [];
const sent = await sendOpsDiscordMessage(
  { SALES_DISCORD_WEBHOOK_URL: 'https://discord.test/webhook' },
  intakePayload,
  {
    fetchImpl: async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) });
      return new Response('{}', { status: 200 });
    },
  },
);
const skipped = await sendOpsDiscordMessage({}, intakePayload, {
  fetchImpl: async () => new Response('{}', { status: 200 }),
});

const assertions = {
  intakeHasAdminAction: JSON.stringify(intakePayload).includes('/admin/intakes'),
  intakeHasCustomerLink: JSON.stringify(intakePayload).includes('/intake?'),
  revisionShowsCounter: JSON.stringify(revisionPayload).includes('2/3'),
  sendUsesWebhook: sent.ok === true && calls[0]?.url === 'https://discord.test/webhook',
  missingWebhookSkips: skipped.skipped === true,
};
const failed = Object.entries(assertions).filter(([, ok]) => !ok).map(([name]) => name);
const result = { ok: failed.length === 0, assertions, failed, sent, skipped, callCount: calls.length, intakePayload, revisionPayload };
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
