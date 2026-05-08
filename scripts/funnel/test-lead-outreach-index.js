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
const overdueCount = index.records.filter((record) => matchesLeadView(record, 'follow_up_overdue')).length;
const repliedNeedsReviewCount = index.records.filter((record) => matchesLeadView(record, 'replied_unprocessed')).length;
assert.ok(demoReadyCount > 0, 'expected at least one demo-ready record');
assert.equal(matchesLeadView({ stageKey: 'follow_up_overdue' }, 'follow_up_overdue'), true, 'expected overdue view matcher to work');
assert.equal(matchesLeadView({ stageKey: 'replied', websiteTaskThreadId: '', paymentStatus: '' }, 'replied_unprocessed'), true, 'expected replied-unprocessed view matcher to work');
assert.equal(matchesLeadView({ stageKey: 'replied', websiteTaskThreadId: 'thread-1', paymentStatus: '' }, 'replied_unprocessed'), false, 'expected replied-unprocessed to exclude already-routed workspaces');

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
    overdueCount,
    repliedNeedsReviewCount,
  },
}, null, 2));
