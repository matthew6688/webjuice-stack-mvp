#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { captureOutreachAssets, validateCapturedAssets } from '../../core/outreach/capture.js';

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i += 1) {
    if (!args[i].startsWith('--')) continue;
    parsed[args[i].slice(2)] = args[i + 1]?.startsWith('--') ? true : (args[i + 1] || true);
  }
  return parsed;
}

const args = parseArgs();
const packPath = args.file || (args.client ? path.join('clients', args.client, 'outreach', 'outreach-pack.json') : '');

if (!packPath) {
  console.error('Usage: node scripts/outreach/capture-assets.js --client slug [--url https://preview]');
  console.error('   or: node scripts/outreach/capture-assets.js --file clients/slug/outreach/outreach-pack.json [--url https://preview]');
  process.exit(1);
}

const pack = JSON.parse(fs.readFileSync(packPath, 'utf8'));
const result = await captureOutreachAssets({
  pack,
  url: args.url,
  outputRoot: process.cwd(),
  timeoutMs: Number(args.timeout || 45000),
});
const validation = validateCapturedAssets(result);

console.log(`Outreach assets captured: ${packPath}`);
console.log(`URL: ${result.url}`);
console.log(`Desktop screenshot: ${result.screenshots.desktop}`);
console.log(`Mobile screenshot: ${result.screenshots.mobile}`);
console.log(`Demo video: ${result.video}`);
console.log(`Status: ${validation.ok ? 'ok' : 'failed'}`);

if (validation.errors.length) {
  console.log('\nErrors');
  for (const error of validation.errors) console.log(`- ${error}`);
}

process.exit(validation.ok ? 0 : 1);
