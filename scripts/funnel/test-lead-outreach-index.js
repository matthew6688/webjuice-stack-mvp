#!/usr/bin/env node

import assert from 'assert/strict';
import { loadLeadOutreachIndex, matchesLeadView } from '../../core/funnel/lead-outreach-index.js';

const index = loadLeadOutreachIndex();

assert.ok(index.records.length > 0, 'expected at least one lead/outreach record');

const opa = index.records.find((record) => record.clientSlug === 'opa-bar-mezze-restaurant');
assert.ok(opa, 'expected Opa lead record');
assert.equal(Boolean(opa.previewUrl), true, 'expected Opa preview URL');
assert.equal(opa.assetsReady, true, 'expected Opa assets ready');
assert.equal(opa.emailDraftReady, true, 'expected Opa outreach draft ready');

const paid = index.records.find((record) => record.paymentStatus === 'paid');
assert.ok(paid, 'expected at least one paid lead/project');

const demoReadyCount = index.records.filter((record) => matchesLeadView(record, 'demo_ready')).length;
const missingEmailCount = index.records.filter((record) => matchesLeadView(record, 'missing_email')).length;
assert.ok(demoReadyCount > 0, 'expected at least one demo-ready record');

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
  },
}, null, 2));
