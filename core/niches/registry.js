import path from 'path';
import { buildRestaurantContentFile } from '../../niches/restaurant/adapter.js';
import {
  buildRestaurantDesignBrief,
  saveRestaurantDesignBrief,
  validateRestaurantDesignBrief,
  writeBrandSpecMarkdown,
} from '../design/restaurant-brief.js';

const NICHE_REGISTRY = {
  restaurant: {
    id: 'restaurant',
    label: 'Restaurant',
    contentFileName: 'content.restaurant.json',
    designFileName: 'design.restaurant.json',
    templateRepo: 'matthew6688/webjuice-restaurant',
    buildContentFile: buildRestaurantContentFile,
    buildDesignBrief: buildRestaurantDesignBrief,
    saveDesignBrief: saveRestaurantDesignBrief,
    validateDesignBrief: validateRestaurantDesignBrief,
    writeBrandSpec: writeBrandSpecMarkdown,
  },
};

export function getNiche(id = 'restaurant') {
  const niche = NICHE_REGISTRY[id];
  if (!niche) {
    throw new Error(`Unsupported niche "${id}". Currently supported: ${listNiches().join(', ')}`);
  }
  return niche;
}

export function listNiches() {
  return Object.keys(NICHE_REGISTRY);
}

export function buildClientArtifactsForNiche({
  nicheId = 'restaurant',
  evidencePath,
  outDir,
  clientSlug,
}) {
  const niche = getNiche(nicheId);
  const contentPath = path.join(outDir, niche.contentFileName);
  const designPath = path.join(outDir, niche.designFileName);
  const brandSpecPath = path.join(outDir, 'brand-spec.md');

  const contentResult = niche.buildContentFile({
    evidencePath,
    outputPath: contentPath,
  });
  const designBrief = niche.buildDesignBrief(contentResult.content, { sourceContentPath: contentPath });
  const designValidation = niche.validateDesignBrief(designBrief);

  niche.saveDesignBrief(designBrief, designPath);
  niche.writeBrandSpec(designBrief, brandSpecPath);

  return {
    niche,
    clientSlug,
    contentPath,
    designPath,
    brandSpecPath,
    contentResult,
    designBrief,
    designValidation,
  };
}
