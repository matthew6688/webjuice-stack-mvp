#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import {
  buildRedesignPreservationPacket,
  saveRedesignPreservationPacket,
} from '../../core/redesign/preservation.js';

const args = parseArgs();

if (!args.client) {
  console.error('Usage: node scripts/redesign/build-preservation-packet.js --client slug [--niche restaurant] [--website https://example.com] [--google-search data/dokobot/search.md] [--content clients/slug/content.restaurant.json]');
  process.exit(1);
}

const niche = args.niche || 'generic';
const contentPath = args.content || defaultContentPath(args.client, niche);
const designPath = args.design || defaultDesignPath(args.client, niche);
const googleSearchPath = args['google-search'] || args.googleSearch || '';
const pagesPath = args.pages || '';

const packet = buildRedesignPreservationPacket({
  clientSlug: args.client,
  niche,
  websiteUrl: args.website || '',
  googleSearchText: googleSearchPath && fs.existsSync(googleSearchPath) ? fs.readFileSync(googleSearchPath, 'utf8') : '',
  content: readJsonIfExists(contentPath),
  design: readJsonIfExists(designPath),
  pages: readJsonIfExists(pagesPath, []),
});

const paths = saveRedesignPreservationPacket(packet, {
  outDir: args['out-dir'] || args.outDir || path.join('clients', args.client, 'redesign'),
});

console.log(JSON.stringify({
  ok: packet.readiness.status !== 'blocked',
  status: packet.readiness.status,
  blockers: packet.readiness.blockers,
  warnings: packet.readiness.warnings,
  currentPages: packet.currentSitemap.length,
  proposedPages: packet.proposedSitemap.length,
  redirects301: packet.urlPreservation.redirects301.length,
  paths,
}, null, 2));

process.exit(packet.readiness.status === 'blocked' ? 1 : 0);

function defaultContentPath(client, niche) {
  return path.join('clients', client, `content.${niche}.json`);
}

function defaultDesignPath(client, niche) {
  return path.join('clients', client, `design.${niche}.json`);
}

function readJsonIfExists(filePath, fallback = {}) {
  if (!filePath || !fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    parsed[argv[i].slice(2)] = argv[i + 1]?.startsWith('--') ? true : (argv[i + 1] || true);
  }
  return parsed;
}
