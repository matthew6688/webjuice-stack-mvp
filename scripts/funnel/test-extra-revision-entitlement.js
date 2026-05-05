#!/usr/bin/env node

import fs from 'fs';
import os from 'os';
import path from 'path';
import { routeFunnelSubmission } from '../../core/funnel/submission-router.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'extra-revision-'));
const common = {
  provider: 'stripe',
  sendDiscord: false,
  sendEmail: false,
  dryRun: false,
  tasksDir: path.join(root, 'tasks'),
  submissionsDir: path.join(root, 'submissions'),
  entitlementsDir: path.join(root, 'entitlements'),
  casesDir: path.join(root, 'cases'),
  ledgerPath: path.join(root, 'ledger.jsonl'),
};
const parentSession = {
  id: 'cs_test_parent_001',
  payment_status: 'paid',
  mode: 'payment',
  amount_total: 39900,
  currency: 'usd',
  customer_details: { email: 'owner@example.com' },
  metadata: {
    repo: 'matthew6688/opa-bar-mezze-restaurant',
    client_slug: 'opa-bar-mezze-restaurant',
    tier: 'one_time',
    preview_url: 'https://opa-bar-mezze-restaurant-dev.pages.dev/',
    business_name: 'Opa Bar & Mezze',
  },
};
const extraSession = {
  id: 'cs_test_extra_001',
  payment_status: 'paid',
  mode: 'payment',
  amount_total: 10000,
  currency: 'usd',
  customer_details: { email: 'owner@example.com' },
  metadata: {
    repo: 'matthew6688/opa-bar-mezze-restaurant',
    client_slug: 'opa-bar-mezze-restaurant',
    tier: 'extra_revision',
    parent_order_id: parentSession.id,
    preview_url: 'https://opa-bar-mezze-restaurant-dev.pages.dev/',
    business_name: 'Opa Bar & Mezze',
  },
};

const sale = await routeFunnelSubmission(stripeEvent(parentSession), common);
const extra = await routeFunnelSubmission(stripeEvent(extraSession), common);
const entitlementPath = path.join(common.entitlementsDir, 'opa-bar-mezze-restaurant', `${parentSession.id}.json`);
const entitlementAfterExtra = JSON.parse(fs.readFileSync(entitlementPath, 'utf8'));
const revisions = [];
for (let index = 1; index <= 4; index += 1) {
  revisions.push(await routeFunnelSubmission({
    fields: {
      order_id: parentSession.id,
      repo: parentSession.metadata.repo,
      client_slug: parentSession.metadata.client_slug,
      email: parentSession.customer_details.email,
      requested_changes: `Revision ${index}`,
      preview_url: parentSession.metadata.preview_url,
    },
  }, {
    ...common,
    provider: 'tally',
    kind: 'revision',
  }));
}
const deniedFifth = await routeFunnelSubmission({
  fields: {
    order_id: parentSession.id,
    repo: parentSession.metadata.repo,
    client_slug: parentSession.metadata.client_slug,
    email: parentSession.customer_details.email,
    requested_changes: 'Revision 5',
    preview_url: parentSession.metadata.preview_url,
  },
}, {
  ...common,
  provider: 'tally',
  kind: 'revision',
});
const entitlementFinal = JSON.parse(fs.readFileSync(entitlementPath, 'utf8'));
const assertions = {
  saleCreatesThreeRevisionLimit: sale.entitlement?.entitlement?.revisionPolicy?.limit === 3,
  extraDoesNotCreateAgentTask: extra.kind === 'extra_revision' && extra.task === null && extra.taskPath === null,
  extraTargetsParentCase: extra.caseRecord?.caseFile?.order?.id === parentSession.id,
  extraIncreasesLimitToFour: entitlementAfterExtra.revisionPolicy?.limit === 4,
  extraEventRecorded: entitlementAfterExtra.extraRevisionEvents?.[0]?.extraOrderId === extraSession.id,
  fourRevisionsAllowed: revisions.every((result) => result.ok === true),
  fifthRevisionDenied: deniedFifth.ok === false && deniedFifth.entitlement?.reason === 'revision_limit_reached',
  finalUsageIsFourOfFour: entitlementFinal.revisionUsed === 4 && entitlementFinal.revisionPolicy?.limit === 4,
};
const failed = Object.entries(assertions)
  .filter(([, value]) => value !== true)
  .map(([key]) => key);

console.log(JSON.stringify({
  ok: failed.length === 0,
  root,
  assertions,
  failed,
  extra: {
    kind: extra.kind,
    ok: extra.ok,
    reason: extra.entitlement?.reason,
    taskPath: extra.taskPath,
  },
  entitlementFinal: {
    revisionUsed: entitlementFinal.revisionUsed,
    revisionLimit: entitlementFinal.revisionPolicy?.limit,
    extraRevisionEvents: entitlementFinal.extraRevisionEvents,
  },
}, null, 2));

if (failed.length) process.exit(1);

function stripeEvent(session) {
  return {
    type: 'checkout.session.completed',
    data: { object: session },
  };
}
