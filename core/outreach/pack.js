import fs from 'fs';
import path from 'path';
import { validateRestaurantLinks } from '../qa/links.js';

export function buildOutreachPack({
  clientSlug,
  manifest,
  content,
  design,
  previewUrl,
  outputDir,
}) {
  const linkQa = validateRestaurantLinks(content);
  const packDir = outputDir || path.join('clients', clientSlug, 'outreach');
  const screenshotDir = path.join(packDir, 'screenshots');
  const videoPath = path.join(packDir, 'demo.mp4');

  return {
    schemaVersion: 1,
    clientSlug,
    generatedAt: new Date().toISOString(),
    previewUrl: previewUrl || '',
    sourceArtifacts: {
      manifest: manifest ? 'artifact-manifest.json' : '',
      content: manifest?.rendererContract?.allowedInputs?.content || '',
      design: manifest?.rendererContract?.allowedInputs?.design || '',
      brandSpec: manifest?.rendererContract?.allowedInputs?.brandSpec || '',
    },
    business: {
      name: content.hero?.name || '',
      cuisine: content.hero?.cuisine || '',
      rating: content.hero?.rating ?? null,
      reviewCount: content.hero?.reviewCount || 0,
      address: content.contact?.address || '',
    },
    qa: {
      links: linkQa,
    },
    assets: {
      screenshots: {
        desktop: path.join(screenshotDir, 'desktop.png'),
        mobile: path.join(screenshotDir, 'mobile.png'),
      },
      video: videoPath,
    },
    emailBrief: {
      subject: `${content.hero?.name || 'Your restaurant'} menu preview`,
      proofPoints: [
        content.menu?.sourceUrl ? `Menu source: ${content.menu.sourceUrl}` : '',
        content.contact?.googleMapsUrl ? 'Address and map CTA verified' : '',
        content.cta?.callUrl ? 'Mobile call CTA verified' : '',
      ].filter(Boolean),
      cta: previewUrl || 'preview URL pending',
    },
    designSummary: {
      selectedDirections: (design?.directions || []).map((direction) => direction.name),
      warnings: design?.assetProtocol?.warnings || [],
    },
  };
}

export function saveOutreachPack(pack, outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(pack, null, 2)}\n`);
  return pack;
}
