#!/usr/bin/env node

import path from 'path';
import { defaultEvidencePath } from '../../core/evidence/evidence.js';
import { buildRestaurantContentFile } from '../../niches/restaurant/adapter.js';

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
const evidencePath = args.evidence || (args.client ? defaultEvidencePath(args.client) : null);

if (!evidencePath) {
  console.error('Usage: node scripts/restaurant/build-content.js --client <slug> [--evidence evidence.json] [--output content.restaurant.json]');
  process.exit(1);
}

const outputPath = args.output || path.join(path.dirname(path.dirname(evidencePath)), 'content.restaurant.json');
const result = buildRestaurantContentFile({ evidencePath, outputPath });

console.log(`Restaurant content written: ${outputPath}`);
console.log(`Fallback level: ${result.content.fallbackLevel}`);
console.log(`Evidence validation: ${result.evidenceValidation.ok ? 'ok' : 'failed'}`);
console.log(`Content validation: ${result.contentValidation.ok ? 'ok' : 'failed'}`);

if (result.evidenceValidation.errors.length) {
  console.log('\nEvidence errors');
  for (const error of result.evidenceValidation.errors) console.log(`- ${error}`);
}
if (result.contentValidation.errors.length) {
  console.log('\nContent errors');
  for (const error of result.contentValidation.errors) console.log(`- ${error}`);
}

process.exit(result.evidenceValidation.ok && result.contentValidation.ok ? 0 : 1);
