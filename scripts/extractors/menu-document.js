#!/usr/bin/env node

import { extractMenuDocument } from '../../core/extractors/menu-document.js';

const args = parseArgs();
if (!args.input || !args.client) {
  console.error('Usage: node scripts/extractors/menu-document.js --input menu.pdf --client slug [--source-url url] [--evidence evidence.json] [--output-dir dir] [--dry-run true]');
  process.exit(1);
}

const result = await extractMenuDocument({
  inputPath: args.input,
  clientSlug: args.client,
  sourceUrl: args['source-url'] || args.sourceUrl || args.input,
  sourceType: args['source-type'] || args.sourceType || '',
  outputDir: args['output-dir'] || args.outputDir || '',
  evidencePath: args.evidence || '',
  businessName: args.name || '',
  dryRun: args['dry-run'] === 'true' || args.dryRun === 'true',
});

console.log(JSON.stringify({
  ok: Boolean(result.selectedAttempt),
  selectedAttempt: result.selectedAttempt,
  manifestPath: result.manifestPath,
  evidencePath: result.evidencePath,
  evidenceSummary: result.evidenceSummary || null,
  attempts: result.attempts,
}, null, 2));

function parseArgs() {
  const argv = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    parsed[argv[i].slice(2)] = argv[i + 1]?.startsWith('--') ? true : (argv[i + 1] || true);
  }
  return parsed;
}
