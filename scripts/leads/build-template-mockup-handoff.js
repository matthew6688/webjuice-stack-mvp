#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { createLeadResearch } from '../../core/leads/research.js';
import { createBuildReadyDecision } from '../../core/leads/build-ready.js';
import { matchTemplateFamily } from '../../core/leads/template-match.js';
import { createLeadCopyBrief } from '../../core/leads/copy-brief.js';
import { createTemplateOpenDesignHandoff } from '../../core/leads/open-design-handoff.js';

const args = parseArgs(process.argv.slice(2));
const clientSlug = args.client || args['client-slug'] || '';
if (!clientSlug && !args.input) {
  console.error('Usage: node scripts/leads/build-template-mockup-handoff.js --client <slug> [--allow-internal]');
  process.exit(1);
}

const input = args.input ? JSON.parse(fs.readFileSync(args.input, 'utf8')) : {
  clientSlug,
  businessName: args.business || args.name || '',
  industry: args.industry || args.niche || 'roofing',
  niche: args.niche || args.industry || 'roofing',
  phone: args.phone || '',
  email: args.email || '',
  address: args.address || '',
  websiteUrl: args.website || args['website-url'] || '',
  city: args.city || '',
  services: toArray(args.service || args.services),
  buildMode: args['build-mode'] || args.mode || 'teaser',
  sourceType: args.source || 'manual',
};

const outDir = args.out ? path.resolve(args.out) : path.join('clients', input.clientSlug || clientSlug, 'lead');
fs.mkdirSync(outDir, { recursive: true });

const research = createLeadResearch(input);
const readyDecision = createBuildReadyDecision({ ...input, research });
const templateMatch = matchTemplateFamily({
  ...input,
  research,
  readyDecision,
  allowInternal: boolArg(args, 'allow-internal', false),
});
const templateMatchPath = path.join(outDir, 'template-match.json');
writeJson(templateMatchPath, templateMatch);

const copyBrief = createLeadCopyBrief({
  ...input,
  research,
  readyDecision,
  templateMatch,
  templateMatchPath,
});
const copyBriefPath = path.join(outDir, 'copy-brief.json');
writeJson(copyBriefPath, copyBrief);

const openDesignHandoff = createTemplateOpenDesignHandoff({
  ...input,
  research,
  readyDecision,
  templateMatch,
  copyBrief,
  templateMatchPath,
  copyBriefPath,
});
const handoffPath = path.join(outDir, 'open-design-handoff.json');
writeJson(handoffPath, openDesignHandoff);

console.log(JSON.stringify({
  ok: true,
  clientSlug: input.clientSlug || clientSlug,
  templateMatchPath,
  copyBriefPath,
  handoffPath,
  selectedTemplate: templateMatch.selected?.templateId || null,
  confidence: templateMatch.confidence,
  copyHero: copyBrief.pageCopyPlan.heroHeadline,
}, null, 2));

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function toArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return String(value).split(',').map((item) => item.trim()).filter(Boolean);
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) parsed[key] = true;
    else {
      parsed[key] = next;
      i += 1;
    }
  }
  return parsed;
}

function boolArg(values, key, defaultValue = false) {
  if (values[key] === undefined) return defaultValue;
  return values[key] === true || String(values[key]).toLowerCase() === 'true';
}

