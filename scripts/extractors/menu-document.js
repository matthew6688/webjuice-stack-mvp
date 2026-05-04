#!/usr/bin/env node

import { extractMenuDocument } from '../../core/extractors/menu-document.js';
import { FirecrawlParseExtractor } from '../../core/extractors/firecrawl-parse.js';
import fs from 'fs';
import path from 'path';

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
  useFirecrawlFallback: args.firecrawl === 'true' || args['firecrawl-fallback'] === 'true',
  firecrawlParse: buildFirecrawlFallback(args),
});

console.log(JSON.stringify({
  ok: args['dry-run'] === 'true' || args.dryRun === 'true'
    ? Boolean(result.selectedAttempt)
    : Boolean(result.evidenceSummary),
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

function buildFirecrawlFallback(args) {
  if (args.firecrawl !== 'true' && args['firecrawl-fallback'] !== 'true') return null;
  const extractor = new FirecrawlParseExtractor({
    campaignId: args.campaign || null,
    ledgerPath: args.ledger || null,
    dryRun: args['dry-run'] === 'true' || args.dryRun === 'true',
  });
  return async (inputPath, { outputPath }) => {
    const parseData = await extractor.parseFile({
      inputPath,
      formats: ['markdown'],
      parsers: String(args.parsers || inferParser(inputPath)).split(',').map((item) => item.trim()).filter(Boolean),
      zeroDataRetention: args['zero-data-retention'] === 'true' || args.zeroDataRetention === 'true',
    });
    const text = [parseData.markdown, parseData.summary, parseData.html].filter(Boolean).join('\n');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, text);
    return {
      ok: Boolean(text.trim()),
      textPath: outputPath,
      textLength: text.trim().length,
      itemCount: text.split('\n').filter((line) => /\d{1,3}(?:\.\d{1,2})?\s*$/.test(line.trim())).length,
      sourceType: 'firecrawl',
    };
  };
}

function inferParser(inputPath) {
  const lower = String(inputPath || '').toLowerCase();
  if (lower.endsWith('.pdf')) return 'pdf';
  if (/\.(png|jpg|jpeg|webp|tif|tiff)$/.test(lower)) return 'image';
  return 'document';
}
