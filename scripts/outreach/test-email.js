#!/usr/bin/env node

import fs from 'fs';
import os from 'os';
import path from 'path';
import assert from 'assert/strict';
import { execFileSync } from 'child_process';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'profitslocal-outreach-email-'));

execFileSync('node', [
  'scripts/send-cold-email.js',
  '--client', 'opa-bar-mezze-restaurant',
  '--to', 'owner@example.com',
  '--dry', 'true',
  '--output-dir', root,
], {
  cwd: process.cwd(),
  stdio: 'pipe',
});

const artifact = fs.readdirSync(root).find((file) => file.endsWith('.json'));
assert.ok(artifact, 'email artifact should exist');
const message = JSON.parse(fs.readFileSync(path.join(root, artifact), 'utf8'));

assert.equal(message.provider, 'resend');
assert.ok(message.html.includes('Open live preview'));
assert.ok(message.html.includes('Local AI audit'));
assert.ok(message.text.includes('Desktop screenshot:'));
assert.ok(message.subject.includes('Opa Bar & Mezze'));

console.log(JSON.stringify({
  ok: true,
  root,
  artifact: path.join(root, artifact),
  assertions: {
    htmlExists: true,
    usesBrandTemplate: true,
    includesAudit: true,
    includesProofAssets: true,
  },
}, null, 2));
