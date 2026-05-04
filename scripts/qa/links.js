#!/usr/bin/env node

import fs from 'fs';
import { validateRestaurantLinks } from '../../core/qa/links.js';

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

if (!args.content) {
  console.error('Usage: node scripts/qa/links.js --content content.restaurant.json');
  process.exit(1);
}

const content = JSON.parse(fs.readFileSync(args.content, 'utf8'));
const result = validateRestaurantLinks(content);

console.log(`Restaurant link QA: ${args.content}`);
console.log(`Status: ${result.ok ? 'ok' : 'failed'}`);
console.log(`Checked: ${result.checked.length}`);
for (const link of result.checked) {
  console.log(`- ${link.label}: ${link.value}`);
}

if (result.errors.length) {
  console.log('\nErrors');
  for (const error of result.errors) console.log(`- ${error}`);
}
if (result.warnings.length) {
  console.log('\nWarnings');
  for (const warning of result.warnings) console.log(`- ${warning}`);
}

process.exit(result.ok ? 0 : 1);
