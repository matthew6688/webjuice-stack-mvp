#!/usr/bin/env node

import fs from 'fs';
import {
  createEvidencePack,
  defaultEvidencePath,
  evidenceItemsFromLead,
  saveEvidencePack,
} from '../../core/evidence/evidence.js';

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i += 1) {
    if (!args[i].startsWith('--')) continue;
    parsed[args[i].slice(2)] = args[i + 1]?.startsWith('--') ? true : (args[i + 1] || true);
  }
  return parsed;
}

function readLead(args) {
  if (!args.input && !args.leads) return null;
  const raw = JSON.parse(fs.readFileSync(args.input || args.leads, 'utf8'));
  if (!Array.isArray(raw)) return raw;
  if (args.placeId) return raw.find((lead) => lead.place_id === args.placeId);
  if (args.name) return raw.find((lead) => lead.name?.toLowerCase() === args.name.toLowerCase());
  return raw[0];
}

const args = parseArgs();

if (!args.client) {
  console.error('Usage: node scripts/evidence/build.js --client <slug> [--niche restaurant] [--input lead.json | --leads leads.json --placeId id]');
  process.exit(1);
}

const lead = readLead(args);
const pack = lead
  ? evidenceItemsFromLead(lead, { clientSlug: args.client, niche: args.niche || lead.niche })
  : createEvidencePack({ clientSlug: args.client, niche: args.niche || 'restaurant', businessName: args.name });

const outputPath = args.output || defaultEvidencePath(args.client);
const saved = saveEvidencePack(pack, outputPath);

console.log(`Evidence written: ${outputPath}`);
console.log(`Items: ${saved.items.length}`);
if (!lead) console.log('Created empty evidence pack. Add extractor output before validating for rendering.');
