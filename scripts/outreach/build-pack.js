#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { buildOutreachPack, buildOutreachPackMarkdown, saveOutreachPack } from '../../core/outreach/pack.js';

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

if (!args.client && !args.manifest) {
  console.error('Usage: node scripts/outreach/build-pack.js --client slug [--manifest clients/slug/artifact-manifest.json] [--preview-url url] [--out-dir clients/slug/outreach]');
  process.exit(1);
}

const clientSlug = args.client || clientSlugFromManifest(args.manifest);
const manifestPath = args.manifest || path.join('clients', clientSlug, 'artifact-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const contentPath = manifest.rendererContract.allowedInputs.content;
const designPath = manifest.rendererContract.allowedInputs.design;
const content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
const design = JSON.parse(fs.readFileSync(designPath, 'utf8'));
const auditPath = args.audit || path.join('clients', clientSlug, 'audit', 'local-llm-audit.json');
const audit = fs.existsSync(auditPath)
  ? { ...JSON.parse(fs.readFileSync(auditPath, 'utf8')), path: auditPath }
  : null;
const outreachBriefPath = args['outreach-brief'] || args.outreachBrief || path.join('clients', clientSlug, 'outreach', 'outreach-brief.json');
const outreachBrief = fs.existsSync(outreachBriefPath)
  ? JSON.parse(fs.readFileSync(outreachBriefPath, 'utf8'))
  : null;
const outDir = args['out-dir'] || args.outDir || path.join('clients', clientSlug, 'outreach');
const outputPath = path.join(outDir, 'outreach-pack.json');
const markdownPath = path.join(outDir, 'outreach-pack.md');
const pack = buildOutreachPack({
  clientSlug,
  manifest,
  content,
  design,
  previewUrl: args['preview-url'] || args.previewUrl || '',
  outputDir: outDir,
  audit,
  outreachBrief,
});

saveOutreachPack(pack, outputPath);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(markdownPath, buildOutreachPackMarkdown(pack));

console.log(`Outreach pack written: ${outputPath}`);
console.log(`Outreach summary: ${markdownPath}`);
console.log(`Link QA: ${pack.qa.links.ok ? 'ok' : 'failed'}`);
console.log(`Desktop screenshot target: ${pack.assets.screenshots.desktop}`);
console.log(`Mobile screenshot target: ${pack.assets.screenshots.mobile}`);
console.log(`Demo video target: ${pack.assets.video}`);

if (pack.qa.links.errors.length) {
  console.log('\nLink errors');
  for (const error of pack.qa.links.errors) console.log(`- ${error}`);
}
if (pack.qa.links.warnings.length) {
  console.log('\nLink warnings');
  for (const warning of pack.qa.links.warnings) console.log(`- ${warning}`);
}

process.exit(pack.qa.links.ok ? 0 : 1);

function clientSlugFromManifest(manifestPath) {
  return path.basename(path.dirname(manifestPath));
}
