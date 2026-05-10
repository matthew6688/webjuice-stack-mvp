#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadAdminReportIndex } from '../../core/admin/report-index.js';

const root = process.cwd();
const index = loadAdminReportIndex();

assert.ok(index.comparison.ok, 'document comparison summary should be ok');
assert.ok(index.comparison.prompt.length > 1000, 'prompt should be loaded');
assert.ok(Object.keys(index.comparison.input || {}).length, 'source payload should be loaded');
assert.ok(index.comparison.providers.length >= 2, 'at least two model providers should be available');
assert.ok(index.comparison.selectedProvider, 'selected provider should be present');

const report = index.leadReports.find((item) => item.clientSlug === 'roofing-restoration-greg-sign') || index.leadReports[0];
assert.ok(report, 'at least one Chinese lead report should be indexed');
assert.ok(report.title.includes('线索调研') || report.title.includes('报告'), 'report title should be operator readable');
assert.ok(report.publicHtmlHref, 'report should have an admin-public HTML href');
assert.ok(report.publicJsonHref, 'report should have an admin-public JSON href');
assert.ok(fs.existsSync(path.join(root, 'public', report.publicHtmlHref.replace(/^\//, ''))), 'public HTML report should exist');
assert.ok(report.verifiedFacts.length, 'verified facts should be available for admin rendering');
assert.ok(report.nextSteps.length, 'next steps should be available for admin rendering');

console.log(JSON.stringify({
  ok: true,
  selectedProvider: index.comparison.selectedProvider,
  providers: index.comparison.providers.length,
  leadReports: index.leadReports.length,
  report: report.title,
  publicHtmlHref: report.publicHtmlHref,
}, null, 2));
