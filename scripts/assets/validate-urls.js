#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { auditAssetUrls, normalizeAssetUrls } from '../../core/assets/url-policy.js';

const args = parseArgs();

if (!args.file) {
  console.error('Usage: node scripts/assets/validate-urls.js --file clients/slug/content.restaurant.json [--fix true]');
  process.exit(1);
}

const inputPath = path.resolve(args.file);
const value = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const audit = auditAssetUrls(value);

if (args.fix === 'true') {
  const normalized = normalizeAssetUrls(value);
  fs.writeFileSync(inputPath, `${JSON.stringify(normalized, null, 2)}\n`);
}

console.log(JSON.stringify({
  ok: audit.ok,
  file: args.file,
  fixed: args.fix === 'true',
  issueCount: audit.issues.length,
  errors: audit.errors,
  warnings: audit.warnings,
}, null, 2));

process.exit(audit.ok ? 0 : 1);

function parseArgs() {
  const argv = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    parsed[argv[i].slice(2)] = argv[i + 1]?.startsWith('--') ? true : (argv[i + 1] || true);
  }
  return parsed;
}
