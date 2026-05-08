#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { createLeadIntake, createLeadIntakeFromLeadRecord, saveLeadIntake } from '../../core/leads/intake.js';

const args = parseArgs(process.argv.slice(2));

if (!args.input && !args.lead && !args['business-name'] && !args.businessName && !args.name) {
  console.error('Usage: npm run leads:intake -- --input lead.json [--output lead-intake.json]');
  console.error('   or: npm run leads:intake -- --lead google-places.json [--index 0] [--website-scan firecrawl.json] [--output lead-intake.json]');
  process.exit(1);
}

try {
  const result = args.lead
    ? createLeadIntakeFromLeadRecord({
        lead: readLeadFile(path.resolve(args.lead), Number(args.index || 0)),
        clientSlug: args.client,
        industry: args.industry || args.niche,
        city: args.city,
        country: args.country,
        websiteScan: args['website-scan'] ? JSON.parse(fs.readFileSync(path.resolve(args['website-scan']), 'utf8')) : null,
      })
    : createLeadIntake(args.input
      ? JSON.parse(fs.readFileSync(path.resolve(args.input), 'utf8'))
      : payloadFromArgs(args));

  if (args.output) saveLeadIntake(result, path.resolve(args.output));
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    parsed[key] = next && !next.startsWith('--') ? next : true;
    if (next && !next.startsWith('--')) index += 1;
  }
  return parsed;
}

function payloadFromArgs(args) {
  return {
    sourceType: args.source || args.sourceType,
    businessName: args['business-name'] || args.businessName || args.name,
    industry: args.industry || args.niche || args.scope,
    city: args.city,
    country: args.country,
    websiteUrl: args.website || args['website-url'],
    googleMapsUrl: args['google-maps-url'] || args.map,
    contactPageUrl: args['contact-page-url'] || args.contact,
    email: args.email,
    phone: args.phone,
    observations: splitList(args.observations),
    services: splitList(args.services),
    notes: splitList(args.notes),
  };
}

function readLeadFile(filePath, index) {
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (Array.isArray(parsed)) return parsed[index] || {};
  if (Array.isArray(parsed.leads)) return parsed.leads[index] || {};
  return parsed;
}

function splitList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}
