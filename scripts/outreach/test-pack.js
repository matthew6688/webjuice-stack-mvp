#!/usr/bin/env node

import fs from 'fs';
import os from 'os';
import path from 'path';
import assert from 'assert/strict';
import { execFileSync } from 'child_process';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'profitslocal-outreach-pack-'));
const outDir = path.join(root, 'outreach');

execFileSync('node', [
  'scripts/outreach/build-pack.js',
  '--client', 'opa-bar-mezze-restaurant',
  '--preview-url', 'https://opa-bar-mezze-restaurant-dev.pages.dev/',
  '--out-dir', outDir,
], {
  cwd: process.cwd(),
  stdio: 'pipe',
});

const packPath = path.join(outDir, 'outreach-pack.json');
const markdownPath = path.join(outDir, 'outreach-pack.md');

execFileSync('node', [
  'scripts/outreach/validate-pack.js',
  '--file', packPath,
  '--require-assets', 'false',
], {
  cwd: process.cwd(),
  stdio: 'pipe',
});

const pack = JSON.parse(fs.readFileSync(packPath, 'utf8'));
const markdown = fs.readFileSync(markdownPath, 'utf8');

assert.equal(pack.clientSlug, 'opa-bar-mezze-restaurant');
assert.equal(pack.audit?.verdict, 'pass');
assert.ok(pack.emailBrief?.proofPoints?.length >= 2);
assert.ok(markdown.includes('## Local AI Audit'));
assert.ok(markdown.includes('Opa Bar & Mezze'));

console.log(JSON.stringify({
  ok: true,
  root,
  packPath,
  markdownPath,
  assertions: {
    packWritten: true,
    markdownWritten: true,
    auditIncluded: true,
    proofPointsPresent: true,
  },
}, null, 2));
