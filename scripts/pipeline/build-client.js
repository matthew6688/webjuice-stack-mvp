#!/usr/bin/env node

import path from 'path';
import { defaultEvidencePath } from '../../core/evidence/evidence.js';
import { buildRestaurantContentFile } from '../../niches/restaurant/adapter.js';
import {
  buildRestaurantDesignBrief,
  saveRestaurantDesignBrief,
  validateRestaurantDesignBrief,
  writeBrandSpecMarkdown,
} from '../../core/design/restaurant-brief.js';
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
if (niche !== 'restaurant') {
  console.error(`Unsupported niche "${niche}". Currently supported: restaurant`);
  process.exit(1);
}

const clientSlug = args.client || clientSlugFromEvidencePath(evidencePath);
const outDir = args['out-dir'] || args.outDir || path.join('clients', clientSlug);
const contentPath = path.join(outDir, 'content.restaurant.json');
const designPath = path.join(outDir, 'design.restaurant.json');
const brandSpecPath = path.join(outDir, 'brand-spec.md');
const manifestPath = path.join(outDir, 'artifact-manifest.json');

const restaurantResult = buildRestaurantContentFile({
  evidencePath,
  outputPath: contentPath,
});
const designBrief = buildRestaurantDesignBrief(restaurantResult.content, { sourceContentPath: contentPath });
const designValidation = validateRestaurantDesignBrief(designBrief);

saveRestaurantDesignBrief(designBrief, designPath);
writeBrandSpecMarkdown(designBrief, brandSpecPath);
saveArtifactManifest(buildArtifactManifest({
  clientSlug,
  niche,
  evidencePath,
  contentPath,
  designPath,
  brandSpecPath,
  validations: {
    evidence: restaurantResult.evidenceValidation.ok ? 'ok' : 'failed',
    content: restaurantResult.contentValidation.ok ? 'ok' : 'failed',
    design: designValidation.ok ? 'ok' : 'failed',
  },
  warnings: designValidation.warnings,
}), manifestPath);

const ok = restaurantResult.evidenceValidation.ok
  && restaurantResult.contentValidation.ok
  && designValidation.ok;

console.log(`Client pipeline: ${clientSlug}`);
console.log(`Evidence: ${evidencePath}`);
console.log(`Content:  ${contentPath}`);
console.log(`Design:   ${designPath}`);
console.log(`Brand:    ${brandSpecPath}`);
console.log(`Manifest: ${manifestPath}`);
console.log(`Status:   ${ok ? 'ok' : 'failed'}`);

printIssues('Evidence errors', restaurantResult.evidenceValidation.errors);
printIssues('Content errors', restaurantResult.contentValidation.errors);
printIssues('Design errors', designValidation.errors);
printIssues('Design warnings', designValidation.warnings);

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
