#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { createOutreachBrief } from '../../core/leads/outreach-brief.js';

const args = parseArgs(process.argv.slice(2));
const clientSlug = args.client || args.clientSlug;

if (!clientSlug) {
  console.error('Usage: node scripts/leads/outreach-brief.js --client slug [--research clients/slug/lead/lead-research.json] [--redesign clients/slug/lead/redesign-check.json] [--out clients/slug/outreach/outreach-brief.json]');
  process.exit(1);
}

const researchPath = args.research || path.join('clients', clientSlug, 'lead', 'lead-research.json');
const redesignPath = args.redesign || path.join('clients', clientSlug, 'lead', 'redesign-check.json');
const outputPath = args.out || path.join('clients', clientSlug, 'outreach', 'outreach-brief.json');

const brief = createOutreachBrief({
  clientSlug,
  research: readJsonIfExists(researchPath),
  redesignCheck: readJsonIfExists(redesignPath),
  researchPath,
});

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(brief, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, outputPath, channel: brief.channelRecommendation }, null, 2));

function readJsonIfExists(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true;
    parsed[key] = value;
    if (value !== true) i += 1;
  }
  return parsed;
}
