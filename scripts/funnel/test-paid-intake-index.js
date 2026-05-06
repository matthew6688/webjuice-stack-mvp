#!/usr/bin/env node

import fs from 'fs';
import os from 'os';
import path from 'path';
import { loadPaidIntakeIndex } from '../../core/funnel/paid-intake-index.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'paid-intake-index-'));
const clientDir = path.join(root, 'alpha-bakery');
fs.mkdirSync(clientDir, { recursive: true });
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
  updatedAt: '2026-05-06T01:00:00.000Z',
}), 'utf8');

const index = loadPaidIntakeIndex({ root });
const record = index.records[0];
const assertions = {
  hasOneRecord: index.records.length === 1,
  countsReady: index.counts.intake_ready_for_review === 1,
  summarizesLeadRecipient: record.leadRecipientEmail === 'leads@alpha.test',
  summarizesAssetCount: record.assetCount === 1,
  summarizesRevisionLimit: record.revisionLimit === 3,
  summarizesRevisionCount: record.revisionCount === 1,
};
const failed = Object.entries(assertions).filter(([, ok]) => !ok).map(([name]) => name);
const result = { ok: failed.length === 0, root, assertions, failed, record, counts: index.counts };
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
