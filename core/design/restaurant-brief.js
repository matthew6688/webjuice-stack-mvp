import fs from 'fs';
import path from 'path';
import { artifactTimestamp } from '../time.js';

export function buildRestaurantDesignBrief(content, { sourceContentPath = null } = {}) {
  const inferredPalette = inferPalette(content);
  const brandColors = Array.isArray(content.brand?.colors) && content.brand.colors.length
    ? content.brand.colors
    : inferredPalette.colors;
  const warnings = [];

  const assets = [
    assetStatus('logo', content.brand?.logo, 'Logo is required for strong brand recognition.'),
    assetStatus('heroFoodPhoto', firstGalleryUrl(content), 'Use official or Google Places food/interior photos before generated imagery.'),
    assetStatus('menuSource', content.menu?.sourceUrl, 'Menu source is required for factual menu design.'),
    assetStatus('reservationUrl', content.cta?.reserveUrl, 'Reservation CTA is optional but valuable when available.'),
    assetStatus('brandColors', content.brand?.colors?.length ? content.brand.colors.join(', ') : '', 'Use official colors when extracted.'),
  ];

  if (!content.brand?.colors?.length) warnings.push('Brand colors are inferred, not scraped.');
  if (!content.brand?.logo) warnings.push('Logo missing. Ask customer or extract from official site before final design.');
  if (!firstGalleryUrl(content)) warnings.push('Primary photo missing. Use Google Places/official photos or generate clearly marked fallback imagery.');

  return {
    schemaVersion: 1,
    designSkill: 'huashu-design',
    clientSlug: content.clientSlug,
    sourceContentPath,
    generatedAt: artifactTimestamp(),
    business: {
      name: content.hero?.name || '',
      cuisine: content.hero?.cuisine || '',
      rating: content.hero?.rating ?? null,
      reviewCount: content.hero?.reviewCount || 0,
      fallbackLevel: content.fallbackLevel,
    },
    assetProtocol: {
      requiredAssets: assets,
      warnings,
      rules: [
        'Use real logo as an image asset; do not redraw it as SVG/CSS.',
        'Use real restaurant/menu/food photos first.',
        'Generated imagery must be marked as generated in evidence.',
        'Do not render sample menu items.',
        'Menu item text must come from menu.sections evidence.',
      ],
    },
    tokens: {
      colorSource: content.brand?.colors?.length ? 'scraped' : 'inferred',
      colors: brandColors,
      palette: {
        background: brandColors[0],
        surface: brandColors[1],
        ink: brandColors[2],
        accent: brandColors[3],
        muted: brandColors[4],
      },
      typography: {
        heading: 'Editorial serif or brand heading font when extracted',
        body: 'Humanist sans-serif for mobile menu readability',
        numeric: 'Tabular figures for prices',
      },
      radius: {
        cards: '8px',
        buttons: '999px',
      },
    },
    directions: designDirections(content),
    layoutRules: [
      'Mobile-first menu: section tabs, sticky call/map/reserve actions, readable prices.',
      'Desktop menu: two-column rhythm only when item text remains readable.',
      'Address links open Google Maps; phone links use tel:.',
      'Reservation CTA appears only when official provider URL exists.',
      'No nested decorative cards; menu sections are content, not marketing panels.',
    ],
    conversionRules: {
      primaryCta: content.cta?.reserveUrl ? 'reserve' : 'call',
      secondaryCtas: ['map', 'call'].filter((cta) => cta !== (content.cta?.reserveUrl ? 'reserve' : 'call')),
      funnel: {
        purchaseProvider: 'tally_or_stripe',
        requiredHiddenFields: ['clientSlug', 'previewUrl', 'repo', 'campaignId', 'niche', 'package', 'price'],
      },
    },
  };
}

export function validateRestaurantDesignBrief(brief) {
  const errors = [];
  const warnings = [...(brief.assetProtocol?.warnings || [])];

  if (!brief.clientSlug) errors.push('clientSlug is required');
  if (!brief.business?.name) errors.push('business.name is required');
  if (!Array.isArray(brief.directions) || brief.directions.length < 3) errors.push('at least 3 design directions are required');
  if (!brief.tokens?.palette?.accent) errors.push('accent color is required');
  if (!brief.assetProtocol?.requiredAssets?.some((asset) => asset.id === 'menuSource' && asset.status === 'present')) {
    errors.push('menuSource asset is required');
  }

  return { ok: errors.length === 0, errors, warnings };
}

export function saveRestaurantDesignBrief(brief, outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(brief, null, 2)}\n`);
}

export function writeBrandSpecMarkdown(brief, outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const assets = Object.fromEntries((brief.assetProtocol?.requiredAssets || []).map((asset) => [asset.id, asset]));
  const lines = [
    `# ${brief.business.name} Brand Spec`,
    `> Generated: ${brief.generatedAt}`,
    `> Source: ${brief.sourceContentPath || 'content.restaurant.json'}`,
    `> Asset completeness: ${brief.assetProtocol.warnings.length ? 'partial' : 'complete'}`,
    '',
    '## Core Assets',
    '',
    '### Logo',
    `- Status: ${assets.logo?.status || 'missing'}`,
    `- Source: ${assets.logo?.value || 'missing'}`,
    '- Rule: use as a real image asset; do not redraw.',
    '',
    '### Food / Venue Photos',
    `- Status: ${assets.heroFoodPhoto?.status || 'missing'}`,
    `- Primary: ${assets.heroFoodPhoto?.value || 'missing'}`,
    '- Rule: official or Google Places photos first; generated imagery must be labeled.',
    '',
    '### Menu',
    `- Status: ${assets.menuSource?.status || 'missing'}`,
    `- Source: ${assets.menuSource?.value || 'missing'}`,
    '- Rule: no sample menu items.',
    '',
    '## Palette',
    `- Source: ${brief.tokens.colorSource}`,
    `- Background: ${brief.tokens.palette.background}`,
    `- Surface: ${brief.tokens.palette.surface}`,
    `- Ink: ${brief.tokens.palette.ink}`,
    `- Accent: ${brief.tokens.palette.accent}`,
    `- Muted: ${brief.tokens.palette.muted}`,
    '',
    '## Typography',
    `- Heading: ${brief.tokens.typography.heading}`,
    `- Body: ${brief.tokens.typography.body}`,
    `- Numeric: ${brief.tokens.typography.numeric}`,
    '',
    '## Design Directions',
    ...brief.directions.flatMap((direction) => [
      '',
      `### ${direction.name}`,
      `- Philosophy: ${direction.philosophy}`,
      `- Use when: ${direction.bestFor}`,
      `- Visual traits: ${direction.visualTraits.join(', ')}`,
    ]),
    '',
    '## Warnings',
    ...(brief.assetProtocol.warnings.length ? brief.assetProtocol.warnings.map((warning) => `- ${warning}`) : ['- None']),
    '',
  ];
  fs.writeFileSync(outputPath, `${lines.join('\n')}`);
}

function designDirections(content) {
  const cuisine = content.hero?.cuisine || 'restaurant';
  return [
    {
      id: 'editorial-menu',
      name: 'Editorial Menu System',
      philosophy: 'Pentagram-style information architecture',
      bestFor: 'Restaurants with rich menus where clarity and trust matter most.',
      visualTraits: ['tight typographic hierarchy', 'clear price alignment', 'low ornament', 'strong source labeling'],
      menuTreatment: `${cuisine} sections become the main visual rhythm.`,
    },
    {
      id: 'photo-led-hospitality',
      name: 'Photo-Led Hospitality',
      philosophy: 'Field.io motion warmth adapted for food photography',
      bestFor: 'Restaurants with strong official or Google Places photos.',
      visualTraits: ['large real imagery', 'soft motion', 'warm contrast', 'sticky mobile actions'],
      menuTreatment: 'Photos introduce sections, but text remains scannable.',
    },
    {
      id: 'quiet-premium',
      name: 'Quiet Premium',
      philosophy: 'Kenya Hara-inspired restraint',
      bestFor: 'Higher-ticket venues or brands with limited assets that need taste, not noise.',
      visualTraits: ['generous whitespace', 'controlled accent color', 'small details', 'paper-like menu surface'],
      menuTreatment: 'Menu reads like a refined printed object on mobile.',
    },
  ];
}

function assetStatus(id, value, note) {
  return {
    id,
    status: value ? 'present' : 'missing',
    value: value || '',
    note,
  };
}

function firstGalleryUrl(content) {
  const first = content.gallery?.[0];
  return first?.url || first?.reference || content.brand?.ogImage || '';
}

function inferPalette(content) {
  const cuisine = String(content.hero?.cuisine || '').toLowerCase();
  if (cuisine.includes('bar') || cuisine.includes('wine')) {
    return { source: 'inferred', colors: ['#15110f', '#f7efe4', '#fffaf3', '#9b2635', '#7f7568'] };
  }
  if (cuisine.includes('asian') || cuisine.includes('chinese')) {
    return { source: 'inferred', colors: ['#17130f', '#fff7ea', '#fffdf8', '#b7352d', '#74685b'] };
  }
  return { source: 'inferred', colors: ['#151515', '#f8f3ea', '#fffdf8', '#2f6f62', '#756f66'] };
}
