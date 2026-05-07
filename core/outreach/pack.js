import fs from 'fs';
import path from 'path';
import { validateRestaurantLinks } from '../qa/links.js';
import { artifactTimestamp } from '../time.js';

export function buildOutreachPack({
  clientSlug,
  manifest,
  content,
  design,
  previewUrl,
  outputDir,
  audit = null,
}) {
  const linkQa = validateRestaurantLinks(content);
  const packDir = outputDir || path.join('clients', clientSlug, 'outreach');
  const screenshotDir = path.join(packDir, 'screenshots');
  const videoPath = path.join(packDir, 'demo.mp4');

  return {
    schemaVersion: 1,
    clientSlug,
    generatedAt: artifactTimestamp(),
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
    audit: audit ? {
      ok: Boolean(audit.ok),
      verdict: audit.verdict || '',
      score: audit.score ?? null,
      summary: audit.summary || null,
      path: audit.path || '',
    } : null,
  };
}

export function saveOutreachPack(pack, outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(pack, null, 2)}\n`);
  return pack;
}

export function validateOutreachPack(pack) {
  const errors = [];
  const warnings = [];

  if (!pack.clientSlug) errors.push('clientSlug is required');
  if (!pack.business?.name) errors.push('business.name is required');
  if (!pack.previewUrl) warnings.push('previewUrl is missing');
  if (!pack.qa?.links) errors.push('qa.links is required');
  if (pack.qa?.links && pack.qa.links.ok !== true) errors.push('qa.links must be ok');
  if (!pack.assets?.screenshots?.desktop) errors.push('assets.screenshots.desktop is required');
  if (!pack.assets?.screenshots?.mobile) errors.push('assets.screenshots.mobile is required');
  if (!pack.assets?.video) errors.push('assets.video is required');
  if (!Array.isArray(pack.emailBrief?.proofPoints) || !pack.emailBrief.proofPoints.length) {
    errors.push('emailBrief.proofPoints must not be empty');
  }
  if (!pack.sourceArtifacts?.content) errors.push('sourceArtifacts.content is required');
  if (!pack.sourceArtifacts?.design) errors.push('sourceArtifacts.design is required');

  return { ok: errors.length === 0, errors, warnings };
}

export function buildOutreachPackMarkdown(pack) {
  const proofPoints = Array.isArray(pack.emailBrief?.proofPoints) ? pack.emailBrief.proofPoints : [];
  const directions = Array.isArray(pack.designSummary?.selectedDirections) ? pack.designSummary.selectedDirections : [];
  const warnings = Array.isArray(pack.designSummary?.warnings) ? pack.designSummary.warnings : [];
  const lines = [
    `# Outreach Pack: ${pack.business?.name || pack.clientSlug}`,
    '',
    `Client slug: ${pack.clientSlug || '-'}`,
    `Generated at: ${pack.generatedAt || '-'}`,
    `Preview URL: ${pack.previewUrl || '-'}`,
    '',
    '## Business Snapshot',
    '',
    `- Name: ${pack.business?.name || '-'}`,
    `- Cuisine: ${pack.business?.cuisine || '-'}`,
    `- Rating: ${pack.business?.rating ?? '-'}`,
    `- Review count: ${pack.business?.reviewCount ?? '-'}`,
    `- Address: ${pack.business?.address || '-'}`,
    '',
    '## Proof Points',
    '',
    ...(proofPoints.length ? proofPoints.map((item) => `- ${item}`) : ['- No proof points recorded']),
    '',
    '## Design Summary',
    '',
    `- Selected directions: ${directions.length ? directions.join(', ') : '-'}`,
    ...(warnings.length ? warnings.map((item) => `- Warning: ${item}`) : ['- No design warnings recorded']),
    '',
    '## QA',
    '',
    `- Link QA: ${pack.qa?.links?.ok === true ? 'pass' : 'fail'}`,
    `- Link errors: ${(pack.qa?.links?.errors || []).length}`,
    `- Link warnings: ${(pack.qa?.links?.warnings || []).length}`,
    '',
    '## Assets',
    '',
    `- Desktop screenshot: ${pack.assets?.screenshots?.desktop || '-'}`,
    `- Mobile screenshot: ${pack.assets?.screenshots?.mobile || '-'}`,
    `- Demo video: ${pack.assets?.video || '-'}`,
    '',
    '## Email Brief',
    '',
    `- Subject: ${pack.emailBrief?.subject || '-'}`,
    `- CTA: ${pack.emailBrief?.cta || '-'}`,
  ];

  if (pack.audit) {
    lines.push('', '## Local AI Audit', '', `- Verdict: ${pack.audit.verdict || '-'}`, `- Score: ${pack.audit.score ?? '-'}`, `- Path: ${pack.audit.path || '-'}`);
    if (pack.audit.summary) {
      lines.push(`- Findings: total ${pack.audit.summary.total ?? 0}, critical ${pack.audit.summary.critical ?? 0}, high ${pack.audit.summary.high ?? 0}`);
    }
  }

  if (pack.sourceArtifacts) {
    lines.push('', '## Source Artifacts', '', `- Manifest: ${pack.sourceArtifacts.manifest || '-'}`, `- Content: ${pack.sourceArtifacts.content || '-'}`, `- Design: ${pack.sourceArtifacts.design || '-'}`, `- Brand spec: ${pack.sourceArtifacts.brandSpec || '-'}`);
  }

  return `${lines.join('\n')}\n`;
}
