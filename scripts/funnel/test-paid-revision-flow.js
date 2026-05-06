#!/usr/bin/env node

import fs from 'fs';
import os from 'os';
import path from 'path';
import { main as recordPaidRevision } from './record-paid-revision-update.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'paid-revision-flow-'));
const clientDir = path.join(root, 'revision-client');
fs.mkdirSync(clientDir, { recursive: true });
fs.writeFileSync(path.join(clientDir, 'cs_test_revision.json'), JSON.stringify({
  schemaVersion: 1,
  status: 'intake_ready_for_review',
  clientSlug: 'revision-client',
  orderId: 'cs_test_revision',
  order: { id: 'cs_test_revision', tier: 'one_time' },
  customer: { company: 'Revision Client', email: 'owner@example.com' },
  intake: { files: ['logo.png'], assets: [] },
  firstVersionConfirmation: { confirmed: true },
  createdAt: '2026-05-06T00:00:00.000Z',
  updatedAt: '2026-05-06T00:00:00.000Z',
}), 'utf8');

const first = recordPaidRevision({
  root,
  silent: true,
  payload: {
    order_id: 'cs_test_revision',
    client_slug: 'revision-client',
    email: 'owner@example.com',
    requested_changes: 'Change the hero offer and update phone number.',
    confirm_revision_scope: 'on',
    files: ['revision-note.pdf (application/pdf, 4 KB)'],
    asset_refs: JSON.stringify([{ filename: 'revision-note.pdf', secureUrl: 'https://res.cloudinary.com/demo/raw/upload/revision-note.pdf' }]),
  },
});
recordPaidRevision({ root, silent: true, payload: payloadFor(2) });
recordPaidRevision({ root, silent: true, payload: payloadFor(3) });
const fourth = recordPaidRevision({ root, silent: true, payload: payloadFor(4) });
const updated = JSON.parse(fs.readFileSync(path.join(clientDir, 'cs_test_revision.json'), 'utf8'));
const assertions = {
  firstAccepted: first.accepted === true && first.revisionNumber === 1,
  firstStoresCloudinaryAsset: first.assets[0]?.secureUrl?.includes('cloudinary.com'),
  thirdUsesAllIncludedRevisions: updated.revisionPolicy.remainingRevisions === 0,
  fourthRejectedOverLimit: fourth.accepted === false && fourth.revisionStatus === 'revision_needs_extra_payment',
  storesFourRequests: updated.revisions.length === 4,
  acceptedCountRemainsThree: updated.revisions.filter((revision) => revision.accepted !== false).length === 3,
};
const failed = Object.entries(assertions).filter(([, ok]) => !ok).map(([name]) => name);
const result = { ok: failed.length === 0, root, assertions, failed, first, fourth, policy: updated.revisionPolicy };
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);

function payloadFor(index) {
  return {
    order_id: 'cs_test_revision',
    client_slug: 'revision-client',
    email: 'owner@example.com',
    requested_changes: `Revision request ${index}`,
    confirm_revision_scope: 'on',
  };
}
