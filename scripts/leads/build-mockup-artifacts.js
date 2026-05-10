#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { buildOutreachPackMarkdown } from '../../core/outreach/pack.js';
import { loadLeadOutreachIndex } from '../../core/funnel/lead-outreach-index.js';

const args = parseArgs(process.argv.slice(2));
const clientSlug = clean(args['client-slug'] || args.clientSlug || args.client_slug);
const clientsRoot = args['clients-root'] || args.clientsRoot || 'clients';
const casesRoot = args['cases-root'] || args.casesRoot || 'data/cases';
const paidIntakesRoot = args['paid-intakes-root'] || args.paidIntakesRoot || 'data/paid-intakes';
const discoveryRoot = args['discovery-root'] || args.discoveryRoot || 'data/leads';
const publicRoot = args['public-root'] || args.publicRoot || 'public/admin-artifacts';
const dryRun = args['dry-run'] === true || args['dry-run'] === 'true' || args.dryRun === true || args.dryRun === 'true';

if (!clientSlug) {
  console.error(JSON.stringify({ ok: false, error: 'client_slug is required' }, null, 2));
  process.exit(1);
}

const index = loadLeadOutreachIndex({ clientsRoot, casesRoot, paidIntakesRoot, discoveryRoot });
const record = index.records.find((item) => item.clientSlug === clientSlug);
if (!record) {
  console.error(JSON.stringify({ ok: false, error: `Lead not found: ${clientSlug}` }, null, 2));
  process.exit(1);
}
if (!['mockup_building', 'ready_for_mockup', 'needs_human'].includes(record.pipelineStage)) {
  console.error(JSON.stringify({
    ok: false,
    error: `Lead is not in a mockup artifact stage: ${record.pipelineStage}`,
    clientSlug,
    pipelineStage: record.pipelineStage,
  }, null, 2));
  process.exit(1);
}

const clientDir = path.join(clientsRoot, clientSlug);
const outreachDir = path.join(clientDir, 'outreach');
const conceptDir = path.join(clientDir, 'concept', 'open-design');
const publicDir = path.join(publicRoot, clientSlug);
const mockupRequestPath = path.join(conceptDir, 'mockup-request.json');
const mockupRequest = readJsonIfExists(mockupRequestPath) || {};
const previewPath = path.join(publicDir, 'mockup-preview.html');
const desktopPath = path.join(publicDir, 'mockup-desktop.png');
const mobilePath = path.join(publicDir, 'mockup-mobile.png');
const videoPath = path.join(publicDir, 'mockup-demo.mp4');
const previewUrl = args['preview-url'] || args.previewUrl || `/admin-artifacts/${clientSlug}/mockup-preview.html`;

const pack = buildPack(record, {
  previewUrl,
  mockupRequestPath,
  mockupRequest,
  desktopPath: publicPath(desktopPath),
  mobilePath: publicPath(mobilePath),
  videoPath: publicPath(videoPath),
});

const packPath = path.join(outreachDir, 'outreach-pack.json');
const markdownPath = path.join(outreachDir, 'outreach-pack.md');
const manifestPath = path.join(conceptDir, 'mockup-artifacts.json');

if (!dryRun) {
  fs.mkdirSync(outreachDir, { recursive: true });
  fs.mkdirSync(conceptDir, { recursive: true });
  fs.mkdirSync(publicDir, { recursive: true });
  fs.writeFileSync(packPath, `${JSON.stringify(pack, null, 2)}\n`, 'utf8');
  fs.writeFileSync(markdownPath, buildOutreachPackMarkdown(pack), 'utf8');
  fs.writeFileSync(manifestPath, `${JSON.stringify({
    schemaVersion: 1,
    kind: 'mockup_artifacts',
    generatedAt: pack.generatedAt,
    clientSlug,
    previewUrl,
    outreachPackPath: packPath,
    markdownPath,
    publicArtifacts: {
      preview: publicPath(previewPath),
      desktop: publicPath(desktopPath),
      mobile: publicPath(mobilePath),
      video: publicPath(videoPath),
    },
    sourceRequestPath: fs.existsSync(mockupRequestPath) ? mockupRequestPath : '',
    note: 'Placeholder proof artifacts created after mockup approval. Replace with Open Design/template screenshots and video when available.',
  }, null, 2)}\n`, 'utf8');
  fs.writeFileSync(previewPath, buildPreviewHtml(record, { mockupRequest }), 'utf8');
  writePlaceholderPng(desktopPath);
  writePlaceholderPng(mobilePath);
  fs.writeFileSync(videoPath, 'placeholder video artifact; replace with generated demo video\n', 'utf8');
}

console.log(JSON.stringify({
  ok: true,
  dryRun,
  clientSlug,
  previousStage: record.pipelineStage,
  nextExpectedStage: 'mockup_ready',
  previewUrl,
  packPath,
  markdownPath,
  manifestPath,
}, null, 2));

function buildPack(record, artifacts) {
  const proofPoints = [
    record.currentSiteOutreachHook,
    record.customerOpportunitySummary,
    record.currentSiteAuditScore ? `Current site audit score: ${record.currentSiteAuditScore}/100` : '',
    record.currentSiteSalesDecision ? `Audit decision: ${record.currentSiteSalesDecision}` : '',
  ].filter(Boolean);
  return {
    schemaVersion: 1,
    clientSlug,
    generatedAt: new Date().toISOString(),
    previewUrl: artifacts.previewUrl,
    sourceArtifacts: {
      manifest: artifacts.mockupRequestPath,
      content: record.leadIntakePath || '',
      design: record.websiteBuildHandoffPath || '',
      brandSpec: '',
    },
    business: {
      name: record.company || record.businessName || clientSlug,
      cuisine: record.niche || record.leadFamilyId || '',
      rating: record.rating ?? null,
      reviewCount: record.reviewCount || 0,
      address: record.address || '',
    },
    qa: {
      links: { ok: true, errors: [], warnings: ['Mockup proof artifacts are placeholders until Open Design/template output replaces them.'] },
    },
    assets: {
      screenshots: {
        desktop: artifacts.desktopPath,
        mobile: artifacts.mobilePath,
      },
      video: artifacts.videoPath,
    },
    emailBrief: {
      subject: `${record.company || clientSlug} website preview`,
      proofPoints: proofPoints.length ? proofPoints : ['Human-approved mockup request is ready for preview generation.'],
      cta: artifacts.previewUrl,
    },
    outreachBrief: {
      diagnosis: record.currentSiteAuditSummary || record.customerOpportunitySummary || '',
      siteBrief: record.currentSiteOpenDesignDirection || artifacts.mockupRequest?.openDesign?.direction || '',
      coldMessage: record.currentSiteOutreachHook || '',
      followUps: [],
      channelRecommendation: record.outreachChannelRecommendation || '',
      subjectLines: [`${record.company || 'Your'} website preview`],
      proofPoints,
      previewMode: artifacts.mockupRequest?.openDesign?.mode || 'lead_mockup',
    },
    designSummary: {
      selectedDirections: [record.currentSiteOpenDesignDirection || artifacts.mockupRequest?.openDesign?.direction || 'Lead-approved mockup direction'].filter(Boolean),
      warnings: ['Placeholder artifact pack; do not send until visual QA replaces proof assets.'],
    },
    audit: record.currentSiteAuditPath ? {
      ok: true,
      verdict: record.currentSiteAuditVerdict || '',
      score: record.currentSiteAuditScore ?? null,
      summary: { total: Array.isArray(record.currentSiteAuditFindings) ? record.currentSiteAuditFindings.length : 0 },
      path: record.currentSiteAuditPath,
    } : null,
  };
}

function buildPreviewHtml(record, { mockupRequest }) {
  const title = escapeHtml(record.company || record.businessName || clientSlug);
  const direction = escapeHtml(record.currentSiteOpenDesignDirection || mockupRequest?.openDesign?.direction || 'Approved mockup direction pending visual generation.');
  const hook = escapeHtml(record.currentSiteOutreachHook || record.customerOpportunitySummary || 'Human-approved mockup request is ready.');
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title} mockup request</title>
    <style>
      body { margin: 0; font-family: Inter, Arial, sans-serif; background: #fff8ed; color: #151515; }
      main { min-height: 100vh; display: grid; place-items: center; padding: 48px; }
      section { max-width: 820px; border: 2px solid #151515; background: #fffdf8; padding: 36px; box-shadow: 8px 8px 0 #151515; }
      h1 { margin: 0 0 18px; font-size: clamp(42px, 8vw, 92px); line-height: .9; }
      p { font-size: 18px; line-height: 1.55; }
      small { display: block; margin-top: 28px; font-weight: 800; color: #666; }
    </style>
  </head>
  <body>
    <main>
      <section>
        <h1>${title}</h1>
        <p>${hook}</p>
        <p>${direction}</p>
        <small>Internal placeholder preview. Replace with Open Design/template output before outreach.</small>
      </section>
    </main>
  </body>
</html>
`;
}

function publicPath(filePath) {
  return filePath.replace(/^public\//, '/');
}

function writePlaceholderPng(filePath) {
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';
  fs.writeFileSync(filePath, Buffer.from(png, 'base64'));
}

function readJsonIfExists(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function clean(value) {
  return String(value || '').trim();
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    parsed[key] = next && !next.startsWith('--') ? next : true;
    if (next && !next.startsWith('--')) i += 1;
  }
  return parsed;
}
