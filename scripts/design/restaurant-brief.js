#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import {
  buildRestaurantDesignBrief,
  saveRestaurantDesignBrief,
  validateRestaurantDesignBrief,
  writeBrandSpecMarkdown,
} from '../../core/design/restaurant-brief.js';

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
  console.error('Usage: node scripts/design/restaurant-brief.js --content content.restaurant.json [--output design.restaurant.json] [--brand-spec brand-spec.md]');
  process.exit(1);
}

const content = JSON.parse(fs.readFileSync(args.content, 'utf8'));
const outputPath = args.output || path.join(path.dirname(args.content), 'design.restaurant.json');
const brandSpecPath = args['brand-spec'] || args.brandSpec || path.join(path.dirname(outputPath), 'brand-spec.md');
const brief = buildRestaurantDesignBrief(content, { sourceContentPath: args.content });
const validation = validateRestaurantDesignBrief(brief);

saveRestaurantDesignBrief(brief, outputPath);
writeBrandSpecMarkdown(brief, brandSpecPath);

console.log(`Design brief written: ${outputPath}`);
console.log(`Brand spec written: ${brandSpecPath}`);
console.log(`Validation: ${validation.ok ? 'ok' : 'failed'}`);

if (validation.errors.length) {
  console.log('\nErrors');
  for (const error of validation.errors) console.log(`- ${error}`);
}
if (validation.warnings.length) {
  console.log('\nWarnings');
  for (const warning of validation.warnings) console.log(`- ${warning}`);
}

process.exit(validation.ok ? 0 : 1);
