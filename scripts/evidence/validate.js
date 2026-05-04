#!/usr/bin/env node

import {
  defaultEvidencePath,
  loadEvidencePack,
  validateEvidencePack,
} from '../../core/evidence/evidence.js';

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
const evidencePath = args.file || (args.client ? defaultEvidencePath(args.client) : null);

if (!evidencePath) {
  console.error('Usage: node scripts/evidence/validate.js --client <slug> [--niche restaurant] OR --file evidence.json');
  process.exit(1);
}

const pack = loadEvidencePack(evidencePath);
const result = validateEvidencePack(pack, { niche: args.niche });

console.log(`Evidence validation: ${evidencePath}`);
console.log(`Status: ${result.ok ? 'ok' : 'failed'}`);

if (result.errors.length) {
  console.log('\nErrors');
  for (const error of result.errors) console.log(`- ${error}`);
}

if (result.warnings.length) {
  console.log('\nWarnings');
  for (const warning of result.warnings) console.log(`- ${warning}`);
}

if (!result.errors.length && !result.warnings.length) {
  console.log('No issues found.');
}

process.exit(result.ok ? 0 : 1);
