#!/usr/bin/env node

import fs from 'fs';
import os from 'os';
import path from 'path';
import assert from 'assert/strict';
import { execFileSync } from 'child_process';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'profitslocal-outreach-email-brief-'));
const leadsPath = path.join(root, 'leads.json');
const outDir = path.join(root, 'email');

fs.writeFileSync(leadsPath, `${JSON.stringify([
  {
    name: 'Northside Roofing',
    email: 'owner@northside.example',
    previewUrl: 'https://northside-roofing-dev.pages.dev',
    outreachBrief: {
      diagnosis: 'Current site undersells the service area and makes the next step unclear.',
      coldMessage: 'Hey Northside, I mocked up a version that makes the quote path clearer on mobile.',
      subjectLines: ['Built something for Northside Roofing'],
      proofPoints: ['Main improvement angle: quote or call CTA'],
    },
  },
], null, 2)}\n`);

execFileSync('node', [
  'scripts/send-cold-email.js',
  '--leads', leadsPath,
  '--dry', 'true',
  '--output-dir', outDir,
], {
  cwd: process.cwd(),
  stdio: 'pipe',
});

const artifact = fs.readdirSync(outDir).find((file) => file.endsWith('.json'));
assert.ok(artifact, 'email artifact should exist');
const message = JSON.parse(fs.readFileSync(path.join(outDir, artifact), 'utf8'));

assert.equal(message.subject, 'Built something for Northside Roofing');
assert.ok(message.text.includes('quote path clearer on mobile'));
assert.ok(message.html.includes('Main improvement angle: quote or call CTA'));

console.log(JSON.stringify({
  ok: true,
  root,
  artifact: path.join(outDir, artifact),
  assertions: {
    subjectFromBrief: true,
    textFromBrief: true,
    proofPointFromBrief: true,
  },
}, null, 2));
