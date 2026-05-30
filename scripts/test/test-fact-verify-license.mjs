#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { identityFindings } from '../../core/audit/fact-verify.js';

const brief = {
  business_name: 'A & J Roofing Solutions',
  phone_display: '0740 356 187',
  phone_tel: '+61740356187',
  address: '98 Buchan St Portsmith QLD 4870',
  abn: '34 134 811 831',
  license_authority: 'QBCC',
  license_number: '1161095',
};

function hardFails(html, facts = brief) {
  return identityFindings(html, facts).findings.filter(f => f.hardFail);
}

assert.equal(
  hardFails('<p>QBCC 1161095</p><p>QBCC-Licensed roofing team</p><p>QBCC licensed in Queensland</p>').length,
  0,
  'authority + correct number and status phrases must pass',
);

assert.equal(
  hardFails('<p>QBCC Licensed</p><p>QBCC-Registered</p>').length,
  0,
  'authority status phrases are not licence-number claims',
);

assert.equal(
  hardFails('<p>QBCC 999999</p>').some(f => f.hardFail === 'fabricated_license_or_identity'),
  true,
  'wrong QBCC number must hard-fail',
);

assert.equal(
  hardFails('<p>QBCC 1161095</p><p>QBCC 999999</p>').some(f => f.hardFail === 'fabricated_license_or_identity'),
  true,
  'a correct number elsewhere must not forgive a second wrong licence number',
);

assert.equal(
  hardFails('<p>QBCC 1161095</p>', { ...brief, license_number: null }).some(f => f.hardFail === 'fabricated_license_or_identity'),
  true,
  'licence number absent from locked brief must fail closed',
);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pl-audit-v4-allowlist-'));
fs.writeFileSync(path.join(tmp, 'index.html'), '<!doctype html><title>Real page</title><main><h1>A real page</h1></main>');
fs.writeFileSync(path.join(tmp, 'launch-scorecard.html'), '<!doctype html><title>Report should not be audited</title>');
fs.writeFileSync(path.join(tmp, 'audit-v4-report.html'), '<!doctype html><title>Report should not be audited</title>');
fs.writeFileSync(path.join(tmp, 'preview-old.html'), '<!doctype html><title>Preview should not be audited</title>');

execFileSync('node', ['scripts/cli/pl-audit-v4.js', '--slug', 'allowlist-smoke', '--output-dir', tmp, '--tier', 'T1'], {
  cwd: path.resolve(import.meta.dirname, '../..'),
  stdio: 'pipe',
});
const audit = JSON.parse(fs.readFileSync(path.join(tmp, 'audit-v4-full.json'), 'utf8'));
assert.equal(audit.pages_audited, 1, 'audit-v4 slug mode should audit only allowlisted published pages');

console.log('test-fact-verify-license: ok');
