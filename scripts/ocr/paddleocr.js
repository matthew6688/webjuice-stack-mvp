#!/usr/bin/env node

import {
  checkPaddleOcrAvailability,
  readOcrTextOutput,
  runPaddleOcr,
} from '../../core/ocr/paddleocr.js';

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
  console.log(JSON.stringify(checkPaddleOcrAvailability(), null, 2));
  process.exit(0);
}

if (!args.input || !args.output) {
  console.error('Usage: node scripts/ocr/paddleocr.js --check');
  console.error('   or: node scripts/ocr/paddleocr.js --input menu.pdf --output /tmp/ocr-output --command "paddleocr ocr -i {input} --save_path {output}"');
  process.exit(1);
}

const outputPath = runPaddleOcr({
  inputPath: args.input,
  outputPath: args.output,
  commandTemplate: args.command || process.env.PADDLEOCR_COMMAND,
});

console.log(`PaddleOCR output: ${outputPath}`);
if (args.print) console.log(readOcrTextOutput(outputPath));
