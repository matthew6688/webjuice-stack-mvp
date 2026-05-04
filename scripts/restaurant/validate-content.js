#!/usr/bin/env node

import fs from 'fs';
import { validateRestaurantContent } from '../../niches/restaurant/adapter.js';

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

if (!args.file) {
  console.error('Usage: node scripts/restaurant/validate-content.js --file content.restaurant.json');
  process.exit(1);
}

const content = JSON.parse(fs.readFileSync(args.file, 'utf8'));
const result = validateRestaurantContent(content);

console.log(`Restaurant content validation: ${args.file}`);
console.log(`Status: ${result.ok ? 'ok' : 'failed'}`);

if (result.errors.length) {
  console.log('\nErrors');
  for (const error of result.errors) console.log(`- ${error}`);
}
if (result.warnings.length) {
  console.log('\nWarnings');
  for (const warning of result.warnings) console.log(`- ${warning}`);
}
if (!result.errors.length && !result.warnings.length) console.log('No issues found.');

process.exit(result.ok ? 0 : 1);
