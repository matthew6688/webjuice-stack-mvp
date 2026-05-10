#!/usr/bin/env node

import fs from 'fs';
import os from 'os';
import path from 'path';
import assert from 'assert/strict';
import { execFileSync } from 'child_process';
import { readDeliveryQaReport, validateDeliveryQaReport } from '../../core/qa/delivery-qa.js';

const sample = JSON.parse(fs.readFileSync('docs/samples/delivery-qa.sample.json', 'utf8'));
const passing = validateDeliveryQaReport(sample, { path: 'docs/samples/delivery-qa.sample.json' });
assert.equal(passing.ok, true);

const blocker = structuredClone(sample);
blocker.readyForCustomerReview = false;
blocker.checks.businessData.status = 'fail';
blocker.checks.businessData.blockers = ['phone mismatch'];
blocker.blockingIssues = ['businessData.phone'];
const failing = validateDeliveryQaReport(blocker, { path: 'tmp/blocker.json' });
assert.equal(failing.ok, false);
assert.ok(failing.errors.some((error) => error.includes('readyForCustomerReview')));
assert.ok(failing.errors.some((error) => error.includes('businessData')));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'delivery-qa-'));
const missing = readDeliveryQaReport(path.join(tmp, 'missing.json'));
assert.equal(missing.ok, false);
assert.ok(missing.missing.includes('deliveryQaReport'));

const generatedPath = path.join(tmp, 'generated.json');
execFileSync('node', [
  'scripts/qa/write-delivery-qa.js',
  '--client', 'opa-bar-mezze-restaurant',
  '--order', 'cs_test_generated_001',
  '--preview-url', 'https://opa-bar-mezze-restaurant-dev.pages.dev/',
  '--email', 'owner@example.com',
  '--repo', 'matthew6688/opa-bar-mezze-restaurant',
  '--output', generatedPath,
], {
  cwd: process.cwd(),
  stdio: 'pipe',
});
const generated = readDeliveryQaReport(generatedPath);
assert.equal(generated.ok, true);
assert.ok(generated.report.checks.customerCommunication.requiredLinks.approveUrl.startsWith('https://profitslocal.com/approve?'));
assert.ok(generated.report.checks.customerCommunication.requiredLinks.reviseUrl.startsWith('https://profitslocal.com/revision?'));

console.log(JSON.stringify({
  ok: true,
  passing: {
    ok: passing.ok,
    path: passing.path,
  },
  blocker: {
    ok: failing.ok,
    errors: failing.errors,
  },
  missing: {
    ok: missing.ok,
    missing: missing.missing,
  },
  generated: {
    ok: generated.ok,
    path: generated.path,
  },
}, null, 2));
