#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { checkDeployedPreview } from '../core/qa/deployed-links.js';

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
const targets = resolveTargets(args);
const results = [];

for (const target of targets) {
  try {
    const result = await checkDeployedPreview(target.url, {
      timeoutMs: Number(args.timeout || 10000),
      checkInternalLinks: args['internal-links'] !== 'false',
    });
    results.push({ clientSlug: target.clientSlug, ...result });
  } catch (error) {
    results.push({
      clientSlug: target.clientSlug,
      url: target.url,
      ok: false,
      errors: [error.message],
      warnings: [],
      checked: [],
    });
  }
}

if (args.output) {
  fs.mkdirSync(path.dirname(args.output), { recursive: true });
  fs.writeFileSync(args.output, `${JSON.stringify({ results }, null, 2)}\n`);
}

for (const result of results) {
  console.log(`\n[${result.clientSlug || 'url'}] ${result.url}`);
  console.log(`Status: ${result.ok ? 'ok' : 'failed'}${result.status ? ` HTTP ${result.status}` : ''}`);
  if (result.title) console.log(`Title: ${result.title}`);
  for (const warning of result.warnings || []) console.log(`Warning: ${warning}`);
  for (const error of result.errors || []) console.log(`Error: ${error}`);
}

process.exit(results.every((result) => result.ok) ? 0 : 1);

function resolveTargets(args) {
  if (args.url) return [{ clientSlug: '', url: args.url }];
  if (args.client) return [targetFromClient(args.client)];
  if (args.all) return listClientSlugs(args.all === true ? 'clients' : args.all).map(targetFromClient);

  console.error('Usage: node scripts/check-links.js --url https://... | --client slug | --all clients');
  process.exit(1);
}

function targetFromClient(slug) {
  const checkoutPath = path.join('clients', slug, 'funnel', 'checkout.json');
  const outreachPath = path.join('clients', slug, 'outreach', 'outreach-pack.json');
  const checkout = readJsonIfExists(checkoutPath);
  const outreach = readJsonIfExists(outreachPath);
  const url = checkout?.hiddenFields?.preview_url || outreach?.previewUrl || '';
  return { clientSlug: slug, url };
}

function listClientSlugs(root) {
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function readJsonIfExists(file) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
