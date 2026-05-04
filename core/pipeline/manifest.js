import fs from 'fs';
import path from 'path';

export function buildArtifactManifest({
  clientSlug,
  niche,
  evidencePath,
  contentPath,
  designPath,
  brandSpecPath,
  validations,
  warnings = [],
}) {
  return {
    schemaVersion: 1,
    clientSlug,
    niche,
    generatedAt: new Date().toISOString(),
    rendererContract: {
      allowedInputs: {
        evidence: evidencePath,
        content: contentPath,
        design: designPath,
        brandSpec: brandSpecPath,
      },
      forbiddenInputs: [
        'raw scrape JSON',
        'sample menu data',
        'unvalidated Google Places response',
        'unvalidated Firecrawl response',
      ],
      hardRules: [
        'Renderer must read content and design artifacts, not raw extractor output.',
        'Menu UI must render only content.menu.sections.',
        'Missing menu sections must fail rendering.',
        'Phone CTA must use content.cta.callUrl.',
        'Map CTA must use content.cta.mapUrl.',
        'Reservation CTA is rendered only when content.cta.reserveUrl exists.',
      ],
    },
    validations,
    warnings,
    nextCommands: {
      validateContent: `npm run restaurant:validate-content -- --file ${contentPath}`,
      buildDesign: `npm run design:restaurant-brief -- --content ${contentPath}`,
      qaLinks: `npm run qa:links -- --content ${contentPath}`,
    },
  };
}

export function validateArtifactManifest(manifest) {
  const errors = [];
  if (!manifest.clientSlug) errors.push('clientSlug is required');
  if (!manifest.niche) errors.push('niche is required');
  for (const key of ['evidence', 'content', 'design', 'brandSpec']) {
    if (!manifest.rendererContract?.allowedInputs?.[key]) errors.push(`allowedInputs.${key} is required`);
  }
  if (!manifest.rendererContract?.hardRules?.length) errors.push('rendererContract.hardRules are required');
  return { ok: errors.length === 0, errors };
}

export function saveArtifactManifest(manifest, outputPath) {
  const validation = validateArtifactManifest(manifest);
  if (!validation.ok) {
    throw new Error(`Invalid artifact manifest: ${validation.errors.join('; ')}`);
  }
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}
