#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { validateOutreachPack } from '../../core/outreach/pack.js';

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
  console.error('Usage: node scripts/outreach/validate-pack.js --client slug');
  console.error('   or: node scripts/outreach/validate-pack.js --file clients/slug/outreach/outreach-pack.json');
  process.exit(1);
}

const pack = JSON.parse(fs.readFileSync(packPath, 'utf8'));
const result = validateOutreachPack(pack);

console.log(`Outreach pack validation: ${packPath}`);
console.log(`Status: ${result.ok ? 'ok' : 'failed'}`);
console.log(`Proof points: ${pack.emailBrief?.proofPoints?.length || 0}`);
console.log(`Desktop screenshot target: ${pack.assets?.screenshots?.desktop || 'missing'}`);
console.log(`Mobile screenshot target: ${pack.assets?.screenshots?.mobile || 'missing'}`);
console.log(`Demo video target: ${pack.assets?.video || 'missing'}`);

if (result.errors.length) {
  console.log('\nErrors');
  for (const error of result.errors) console.log(`- ${error}`);
}
if (result.warnings.length) {
  console.log('\nWarnings');
  for (const warning of result.warnings) console.log(`- ${warning}`);
}

process.exit(result.ok ? 0 : 1);
