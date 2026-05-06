#!/usr/bin/env node

import { FirecrawlExtractor } from '../../core/extractors/firecrawl.js';
import { isCriticalContentPage, TinyFishExtractor } from '../../core/extractors/tinyfish.js';
import { loadLocalEnv } from '../../core/env/load-local-env.js';

loadLocalEnv();

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
const dryRun = Boolean(args.dryRun || args['dry-run']);

if (!args.url) {
  console.error('Usage: node scripts/extractors/content-page.js --url https://example.com/menu [--niche restaurant] [--page-type menu] [--provider auto|tinyfish|firecrawl] [--raw artifact.json] [--text artifact.txt] [--dry-run]');
  process.exit(1);
}

const provider = args.provider || 'auto';
const chosenProvider = provider === 'auto'
  ? (isCriticalContentPage({ url: args.url, niche: args.niche, pageType: args['page-type'] }) ? 'tinyfish' : 'firecrawl')
  : provider;

if (!['tinyfish', 'firecrawl'].includes(chosenProvider)) {
  throw new Error(`Unsupported provider "${chosenProvider}". Use auto, tinyfish, or firecrawl.`);
}

if (chosenProvider === 'tinyfish') {
  const extractor = new TinyFishExtractor({
    campaignId: args.campaign,
    ledgerPath: args.ledger,
    dryRun,
  });
  const payload = await extractor.fetchPages({ urls: [args.url] });
  if (args.raw) extractor.writeRawArtifact(payload, args.raw);
  if (args.text) extractor.writeTextArtifact(payload, args.text);
  console.log(JSON.stringify({
    provider: 'tinyfish',
    url: args.url,
    textChars: payload.results?.[0]?.text?.length || 0,
    raw: args.raw || '',
    text: args.text || '',
  }, null, 2));
} else {
  const extractor = new FirecrawlExtractor({
    campaignId: args.campaign,
    ledgerPath: args.ledger,
    dryRun,
  });
  const scrape = await extractor.scrape({ url: args.url });
  if (args.raw) extractor.writeRawArtifact(scrape, args.raw);
  if (args.text) {
    await import('fs').then((fs) => {
      fs.mkdirSync(args.text.split('/').slice(0, -1).join('/') || '.', { recursive: true });
      fs.writeFileSync(args.text, scrape.markdown || '');
    });
  }
  console.log(JSON.stringify({
    provider: 'firecrawl',
    url: args.url,
    textChars: scrape.markdown?.length || 0,
    raw: args.raw || '',
    text: args.text || '',
  }, null, 2));
}
