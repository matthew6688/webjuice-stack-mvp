#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const args = parseArgs(process.argv.slice(2));
const clientSlug = args.client || '';

if (!clientSlug) {
  console.error('Usage: node scripts/open-design/build-production-handoff.js --client slug [--content file] [--target-repo path] [--target-branch dev]');
  process.exit(1);
}

const conceptDir = path.resolve(args['concept-dir'] || path.join('clients', clientSlug, 'concept', 'open-design'));
const contentPath = optionalPath(args.content || path.join('clients', clientSlug, 'content.restaurant.json'));
const designPath = optionalPath(args.design || path.join('clients', clientSlug, 'design.restaurant.json'));
const evidencePath = optionalPath(args.evidence || path.join('clients', clientSlug, 'evidence', 'evidence.json'));
const surveyPath = optionalPath(args.survey || path.join('clients', clientSlug, 'intake', 'website-survey.json'));
const targetRepo = args['target-repo'] || '';
const targetBranch = args['target-branch'] || 'dev';
const outputJsonPath = path.resolve(args.out || path.join(conceptDir, 'production-handoff.json'));
const outputMdPath = outputJsonPath.replace(/\.json$/i, '.md');

const manifestPath = path.join(conceptDir, 'concept-manifest.json');
const indexPath = path.join(conceptDir, 'index.html');
const brandSpecPath = path.join(conceptDir, 'brand-spec.md');
const qualityAuditPath = path.join(conceptDir, 'concept-quality-audit.json');

const manifest = readJson(manifestPath);
const indexHtml = readText(indexPath);
const conceptBrandSpec = readTextOptional(brandSpecPath);
const qualityAudit = readJsonOptional(qualityAuditPath);
const content = contentPath ? readJson(contentPath) : null;
const design = designPath ? readJson(designPath) : null;
const survey = surveyPath ? readJson(surveyPath) : null;

const conceptFacts = extractConceptFacts(indexHtml, conceptBrandSpec);
const contentFacts = extractContentFacts(content);
const pages = inferPages(indexHtml, manifest.files || []);
const assets = (manifest.files || []).filter((file) => file.kind === 'image' || /\.(png|jpe?g|webp|gif|avif)$/i.test(file.path || ''));
const sourcePages = (manifest.files || []).filter((file) => /^source-.*\.html$/i.test(file.path || ''));
const tokens = extractCssTokens(conceptBrandSpec || indexHtml);

const requiredSourceFacts = [
  'business name',
  'phone',
  'address',
  'primary CTA',
  'brand/logo',
  'navigation/sitemap intent',
];
if ((content?.niche || survey?.niche) === 'restaurant' || /restaurant/i.test(manifest.businessType || '')) {
  requiredSourceFacts.push('menu source', 'reservation link when available');
}

const warnings = [];
if (!targetRepo) warnings.push('targetRepo was not supplied; handoff is tool-agnostic and must be bound before implementation.');
if (!content) warnings.push('content artifact not found; importer must not trust concept text as final business data.');
if (!conceptBrandSpec) warnings.push('Open Design brand-spec.md missing; production builder must manually extract tokens from index.html.');
if (sourcePages.length === 0 && manifest.sourceUrl) warnings.push('No captured source pages found for source redesign.');
if (assets.length === 0) warnings.push('No local concept image assets found.');
if (!qualityAudit) warnings.push('Concept quality audit missing; run open-design:audit-concept before production handoff is accepted.');
if (qualityAudit && !qualityAudit.ok) warnings.push(`Concept quality audit failed with score ${qualityAudit.score}; production handoff is for diagnosis only until fixed.`);

const handoff = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  clientSlug,
  purpose: 'open_design_concept_to_webjuice_astro_handoff',
  status: warnings.length ? 'ready_with_warnings' : 'ready',
  concept: {
    conceptDir,
    manifestPath,
    indexPath,
    brandSpecPath: fs.existsSync(brandSpecPath) ? brandSpecPath : null,
    projectId: manifest.projectId,
    runId: manifest.runId,
    agentId: manifest.agentId,
    skillId: manifest.skillId,
    sourceUrl: manifest.sourceUrl || null,
    scope: manifest.scope || null,
    screenshots: manifest.screenshots || [],
    files: {
      total: (manifest.files || []).length,
      sourcePages: sourcePages.map((file) => file.path),
      assets: assets.map((file) => file.path),
    },
    qualityAudit: qualityAudit ? {
      path: qualityAuditPath,
      ok: qualityAudit.ok,
      score: qualityAudit.score,
      findingCount: Array.isArray(qualityAudit.findings) ? qualityAudit.findings.length : 0,
      criticalFindings: (qualityAudit.findings || [])
        .filter((item) => item.severity === 'critical')
        .map((item) => item.code),
    } : null,
  },
  sourceOfTruth: {
    evidencePath,
    contentPath,
    designPath,
    surveyPath,
    rule: 'Use evidence/content/design/survey for business facts. Use Open Design for visual direction, layout rhythm, tokens, and asset inspiration.',
  },
  target: {
    repo: targetRepo || null,
    branch: targetBranch,
    framework: 'Webjuice/Astro on Cloudflare Pages',
  },
  extracted: {
    conceptFacts,
    contentFacts,
    tokens,
    pages,
  },
  requiredPreservationChecks: requiredSourceFacts,
  implementationPlan: [
    'Validate the Open Design concept folder before implementation.',
    'Read the project capsule, evidence artifact, content artifact, design artifact, and survey/build packet.',
    'Port visual tokens, imagery direction, layout rhythm, and page hierarchy from the Open Design concept.',
    'Build production routes/components in the Webjuice/Astro repo instead of shipping the standalone concept HTML directly.',
    'Preserve official business facts from source-of-truth artifacts even when the concept has nicer copy.',
    'For redesigns, preserve old URL intent and add permanent redirects where route names change.',
    'Run build, link QA, visual QA screenshots, and delivery QA before customer review email.',
    'Push to the dev branch only until customer approval.',
  ],
  warnings,
};

fs.mkdirSync(path.dirname(outputJsonPath), { recursive: true });
fs.writeFileSync(outputJsonPath, `${JSON.stringify(handoff, null, 2)}\n`);
fs.writeFileSync(outputMdPath, renderMarkdown(handoff));

console.log(JSON.stringify({
  ok: true,
  status: handoff.status,
  clientSlug,
  outputJsonPath,
  outputMdPath,
  conceptFiles: handoff.concept.files.total,
  sourcePages: handoff.concept.files.sourcePages.length,
  assets: handoff.concept.files.assets.length,
  pages: handoff.extracted.pages.map((page) => page.label),
  warnings,
}, null, 2));

function extractConceptFacts(html, brandSpec) {
  const text = stripHtml(html);
  return {
    title: matchFirst(html, /<title[^>]*>([\s\S]*?)<\/title>/i),
    headings: [...html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)]
      .map((match) => cleanText(stripHtml(match[1])))
      .filter(Boolean)
      .slice(0, 12),
    phones: unique([...text.matchAll(/\(?\d{2}\)?[\s-]?\d{4}[\s-]?\d{4}/g)].map((match) => match[0])).slice(0, 5),
    urls: unique([...html.matchAll(/href=["']([^"']+)["']/gi)].map((match) => match[1])).slice(0, 20),
    brandSpecHighlights: cleanText(brandSpec).split('\n').filter((line) => /^- /.test(line)).slice(0, 12),
  };
}

function extractContentFacts(content) {
  if (!content) return null;
  return {
    niche: content.niche || null,
    businessName: content.hero?.name || content.businessName || null,
    phone: content.contact?.phone || null,
    address: content.contact?.address || null,
    website: content.contact?.website || null,
    callUrl: content.cta?.callUrl || null,
    mapUrl: content.cta?.mapUrl || null,
    reserveUrl: content.cta?.reserveUrl || null,
    menuSourceUrl: content.menu?.sourceUrl || null,
    menuSectionCount: Array.isArray(content.menu?.sections) ? content.menu.sections.length : 0,
    galleryCount: Array.isArray(content.gallery) ? content.gallery.length : 0,
  };
}

function inferPages(html, files) {
  const pageIds = unique([...html.matchAll(/id=["']([^"']+)["']/gi)].map((match) => match[1]))
    .filter((id) => /home|menu|visit|contact|private|function|booking|gallery|experience/i.test(id));
  const sourcePageNames = files
    .filter((file) => /^source-.*\.html$/i.test(file.path || ''))
    .map((file) => file.path.replace(/^source-/, '').replace(/\.html$/i, ''));
  return unique([...pageIds, ...sourcePageNames]).slice(0, 12).map((label) => ({
    label,
    targetRoute: routeFor(label),
    source: pageIds.includes(label) ? 'concept-section' : 'captured-source-page',
  }));
}

function routeFor(label) {
  const normalized = String(label).toLowerCase();
  if (/home|index/.test(normalized)) return '/';
  if (/lunch|dinner|menu|banquet/.test(normalized)) return '/menu';
  if (/private|function|event/.test(normalized)) return '/private-dining';
  if (/visit|location|contact|booking/.test(normalized)) return '/contact';
  return `/${normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`;
}

function extractCssTokens(text) {
  const tokens = {};
  for (const match of text.matchAll(/--([a-z0-9-]+):\s*([^;]+);/gi)) {
    tokens[`--${match[1]}`] = match[2].trim();
  }
  return tokens;
}

function renderMarkdown(handoff) {
  const lines = [
    `# ${handoff.clientSlug} Production Handoff`,
    '',
    `Generated: ${handoff.generatedAt}`,
    '',
    '## Concept',
    '',
    `- Open Design project: ${handoff.concept.projectId}`,
    `- Open Design run: ${handoff.concept.runId}`,
    `- Agent: ${handoff.concept.agentId}`,
    `- Skill: ${handoff.concept.skillId}`,
    `- Concept path: ${handoff.concept.conceptDir}`,
    `- Source URL: ${handoff.concept.sourceUrl || '-'}`,
    `- Quality audit: ${handoff.concept.qualityAudit ? `${handoff.concept.qualityAudit.score} / pass ${handoff.concept.qualityAudit.ok}` : '-'}`,
    '',
    '## Source Of Truth',
    '',
    `- Evidence: ${handoff.sourceOfTruth.evidencePath || '-'}`,
    `- Content: ${handoff.sourceOfTruth.contentPath || '-'}`,
    `- Design: ${handoff.sourceOfTruth.designPath || '-'}`,
    `- Survey: ${handoff.sourceOfTruth.surveyPath || '-'}`,
    '',
    'Rule: business facts come from source-of-truth artifacts; Open Design supplies visual direction.',
    '',
    '## Target',
    '',
    `- Repo: ${handoff.target.repo || '-'}`,
    `- Branch: ${handoff.target.branch}`,
    `- Framework: ${handoff.target.framework}`,
    '',
    '## Concept Pages',
    '',
    ...handoff.extracted.pages.map((page) => `- ${page.label} -> ${page.targetRoute} (${page.source})`),
    '',
    '## Required Preservation Checks',
    '',
    ...handoff.requiredPreservationChecks.map((item) => `- ${item}`),
    '',
    '## Implementation Plan',
    '',
    ...handoff.implementationPlan.map((item, index) => `${index + 1}. ${item}`),
  ];
  if (handoff.warnings.length) {
    lines.push('', '## Warnings', '', ...handoff.warnings.map((item) => `- ${item}`));
  }
  return `${lines.join('\n')}\n`;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readJsonOptional(filePath) {
  return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : null;
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function readTextOptional(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function optionalPath(filePath) {
  return filePath && fs.existsSync(filePath) ? path.resolve(filePath) : null;
}

function stripHtml(value) {
  return String(value || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ');
}

function cleanText(value) {
  return String(value || '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function matchFirst(value, pattern) {
  const match = String(value || '').match(pattern);
  return match ? cleanText(match[1]) : null;
}

function unique(values) {
  return [...new Set(values.filter(Boolean).map((value) => String(value).trim()).filter(Boolean))];
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    parsed[key] = next && !next.startsWith('--') ? next : true;
    if (next && !next.startsWith('--')) i += 1;
  }
  return parsed;
}
