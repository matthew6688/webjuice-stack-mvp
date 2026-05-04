#!/usr/bin/env node

import {
  checkOcrmypdfAvailability,
  runOcrmypdf,
} from '../../core/ocr/ocrmypdf.js';

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

if (args.check || (!args.input && !args.output)) {
  console.log(JSON.stringify(checkOcrmypdfAvailability(), null, 2));
  process.exit(0);
}

if (!args.input || !args.output) {
  console.error('Usage: node scripts/ocr/ocrmypdf.js --check');
  console.error('   or: node scripts/ocr/ocrmypdf.js --input scanned.pdf --output searchable.pdf [--lang eng]');
  process.exit(1);
}

const outputPath = runOcrmypdf({
  inputPath: args.input,
  outputPath: args.output,
  language: args.lang || process.env.OCRMYPDF_LANG || 'eng',
  deskew: args.deskew !== 'false',
  rotatePages: args.rotatePages !== 'false' && args['rotate-pages'] !== 'false',
});

console.log(`OCRmyPDF output: ${outputPath}`);
