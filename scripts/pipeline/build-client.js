#!/usr/bin/env node

import path from 'path';
import { defaultEvidencePath } from '../../core/evidence/evidence.js';
import { buildClientArtifactsForNiche, listNiches } from '../../core/niches/registry.js';
import {
  buildArtifactManifest,
  saveArtifactManifest,
} from '../../core/pipeline/manifest.js';

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
const niche = args.niche || 'restaurant';
const evidencePath = args.evidence || (args.client ? defaultEvidencePath(args.client) : null);

if (!args.client && !evidencePath) {
  console.error('Usage: node scripts/pipeline/build-client.js --client slug [--niche restaurant] [--evidence evidence.json] [--out-dir clients/slug]');
  process.exit(1);
}

const clientSlug = args.client || clientSlugFromEvidencePath(evidencePath);
const outDir = args['out-dir'] || args.outDir || path.join('clients', clientSlug);
const manifestPath = path.join(outDir, 'artifact-manifest.json');

let artifacts;
try {
  artifacts = buildClientArtifactsForNiche({
    nicheId: niche,
    evidencePath,
    outDir,
    clientSlug,
  });
} catch (error) {
  console.error(error.message);
  console.error(`Supported niches: ${listNiches().join(', ')}`);
  process.exit(1);
}

saveArtifactManifest(buildArtifactManifest({
  clientSlug,
  niche,
  evidencePath,
  contentPath: artifacts.contentPath,
  designPath: artifacts.designPath,
  brandSpecPath: artifacts.brandSpecPath,
  validations: {
    evidence: artifacts.contentResult.evidenceValidation.ok ? 'ok' : 'failed',
    content: artifacts.contentResult.contentValidation.ok ? 'ok' : 'failed',
    design: artifacts.designValidation.ok ? 'ok' : 'failed',
  },
  warnings: artifacts.designValidation.warnings,
}), manifestPath);

const ok = artifacts.contentResult.evidenceValidation.ok
  && artifacts.contentResult.contentValidation.ok
  && artifacts.designValidation.ok;

console.log(`Client pipeline: ${clientSlug}`);
console.log(`Evidence: ${evidencePath}`);
console.log(`Niche:    ${artifacts.niche.id}`);
console.log(`Template: ${artifacts.niche.templateRepo}`);
console.log(`Content:  ${artifacts.contentPath}`);
console.log(`Design:   ${artifacts.designPath}`);
console.log(`Brand:    ${artifacts.brandSpecPath}`);
console.log(`Manifest: ${manifestPath}`);
console.log(`Status:   ${ok ? 'ok' : 'failed'}`);

printIssues('Evidence errors', artifacts.contentResult.evidenceValidation.errors);
printIssues('Content errors', artifacts.contentResult.contentValidation.errors);
printIssues('Design errors', artifacts.designValidation.errors);
printIssues('Design warnings', artifacts.designValidation.warnings);

process.exit(ok ? 0 : 1);

function printIssues(title, issues = []) {
  if (!issues.length) return;
  console.log(`\n${title}`);
  for (const issue of issues) console.log(`- ${issue}`);
}

function clientSlugFromEvidencePath(filePath) {
  const parts = path.normalize(filePath).split(path.sep);
  const clientsIndex = parts.lastIndexOf('clients');
  return clientsIndex >= 0 ? parts[clientsIndex + 1] : path.basename(path.dirname(path.dirname(filePath)));
}
