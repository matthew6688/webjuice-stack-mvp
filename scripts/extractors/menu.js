#!/usr/bin/env node

import {
  readMenuTextFromFile,
  writeMenuEvidenceFromText,
} from '../../core/extractors/menu.js';

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

if (!args.input || !args.client) {
  console.error('Usage: node scripts/extractors/menu.js --input menu.txt --client slug --source-url https://example.com/menu.pdf [--source-type pdf|official_site|image_ocr] [--evidence evidence.json] [--format txt|md|pdf]');
  process.exit(1);
}

const text = readMenuTextFromFile(args.input, { format: args.format });
const pack = writeMenuEvidenceFromText(text, {
  clientSlug: args.client,
  niche: args.niche || 'restaurant',
  businessName: args.name,
  sourceUrl: args['source-url'] || args.sourceUrl || args.input,
  sourceType: args['source-type'] || args.sourceType || inferSourceType(args.input),
  outputPath: args.evidence,
  confidence: args.confidence === undefined ? 0.78 : Number(args.confidence),
});

const menuSections = pack.resolved?.menu?.sections?.value || [];
const itemCount = menuSections.reduce((sum, section) => sum + (section.items?.length || 0), 0);

console.log(`Menu evidence written: ${args.evidence || `clients/${args.client}/evidence/evidence.json`}`);
console.log(`Sections: ${menuSections.length}`);
console.log(`Items: ${itemCount}`);

function inferSourceType(input) {
  return input.toLowerCase().endsWith('.pdf') ? 'pdf' : 'official_site';
}
