#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { buildOpenDesignWorkspace } from '../../core/open-design/workspace.js';

const args = parseArgs(process.argv.slice(2));
const clientSlug = String(args.client || '').trim();
const businessName = String(args['business-name'] || args.businessName || clientSlug).trim();
const sourceUrl = String(args['source-url'] || args.sourceUrl || '').trim();
const repo = String(args.repo || `matthew6688/${clientSlug}`).trim();
const email = String(args.email || '').trim().toLowerCase();
const niche = String(args.niche || 'restaurant').trim();
const route = String(args.route || 'website').trim();
const root = path.resolve(String(args.root || process.cwd()));
const initId = String(args.id || `project_init_${Date.now()}`).trim();

if (!clientSlug) {
  console.error('Usage: npm run ops:init-project -- --client <slug> [--business-name "..."] [--source-url https://...] [--repo owner/repo] [--email customer@example.com] [--niche restaurant] [--route website]');
  process.exit(1);
}

const paths = {
  caseDir: path.join(root, 'data', 'cases', clientSlug, initId),
  casePath: path.join(root, 'data', 'cases', clientSlug, initId, 'case.json'),
  contextPath: path.join(root, 'data', 'cases', clientSlug, initId, 'context-packet.json'),
  timelinePath: path.join(root, 'data', 'cases', clientSlug, initId, 'timeline.jsonl'),
  buildPacketPath: path.join(root, 'data', 'cases', clientSlug, initId, 'build-packet.md'),
  bootstrapPath: path.join(root, 'clients', clientSlug, 'ops', 'project-init.json'),
  clientsRoot: path.join(root, 'clients', clientSlug),
  evidenceDir: path.join(root, 'clients', clientSlug, 'evidence'),
  intakeDir: path.join(root, 'clients', clientSlug, 'intake'),
  conceptDir: path.join(root, 'clients', clientSlug, 'concept', 'open-design'),
  funnelDir: path.join(root, 'clients', clientSlug, 'funnel'),
};

for (const dir of [paths.caseDir, paths.evidenceDir, paths.intakeDir, paths.conceptDir, paths.funnelDir, path.dirname(paths.bootstrapPath)]) {
  fs.mkdirSync(dir, { recursive: true });
}

const openDesign = buildOpenDesignWorkspace(clientSlug, {
  conceptPath: path.relative(root, paths.conceptDir),
  manifestPath: path.relative(root, path.join(paths.conceptDir, 'concept-manifest.json')),
  productionHandoffPath: path.relative(root, path.join(paths.conceptDir, 'production-handoff.json')),
});

const now = new Date().toISOString();
const caseFile = {
  schemaVersion: 1,
  caseId: `${clientSlug}_${initId}`,
  status: 'project_initialized',
  clientSlug,
  repo,
  branch: 'dev',
  previewUrl: `https://${clientSlug}-dev.pages.dev/`,
  order: {
    id: initId,
    provider: 'project_init',
    tier: 'not_paid',
    amount: 0,
    currency: 'USD',
    paymentStatus: 'not_paid',
  },
  customer: {
    company: businessName,
    email,
    phone: '',
    domain: '',
  },
  route,
  niche,
  sourceOfTruth: {
    evidence: `clients/${clientSlug}/evidence/evidence.json`,
    content: `clients/${clientSlug}/content.${niche}.json`,
    design: `clients/${clientSlug}/design.${niche}.json`,
    brandSpec: `clients/${clientSlug}/brand-spec.md`,
    websiteSurvey: `clients/${clientSlug}/intake/website-survey.json`,
  },
  openDesign: {
    required: true,
    status: openDesign.status,
    manifestPath: openDesign.manifestPath,
    productionHandoffPath: openDesign.productionHandoffPath,
  },
  paths: {
    casePath: relative(root, paths.casePath),
    contextPath: relative(root, paths.contextPath),
    timelinePath: relative(root, paths.timelinePath),
    buildPacketPath: relative(root, paths.buildPacketPath),
    artifactsDir: relative(root, path.join(paths.caseDir, 'artifacts')),
  },
  createdAt: now,
  updatedAt: now,
};

const contextPacket = {
  schemaVersion: 1,
  caseId: caseFile.caseId,
  status: caseFile.status,
  clientSlug,
  repo,
  branch: 'dev',
  sourceUrl,
  route,
  niche,
  customer: caseFile.customer,
  openDesign,
  requiredNextSteps: [
    '先完成 evidence 收集，再运行 intake:build-website-ready。',
    '创建或绑定 Open Design project，然后才能进入高保真设计阶段。',
    'production handoff 生成后，再 port 到 customer repo dev。',
  ],
};

const bootstrap = {
  schemaVersion: 1,
  clientSlug,
  businessName,
  sourceUrl,
  repo,
  email,
  route,
  niche,
  initId,
  createdAt: now,
  updatedAt: now,
  requiredMilestones: [
    'evidence_ready',
    'website_ready_to_build',
    'open_design_bound',
    'production_handoff_written',
    'dev_build_pass',
    'delivery_qa_pass',
    'ready_for_customer_review',
  ],
  paths: {
    casePath: relative(root, paths.casePath),
    contextPath: relative(root, paths.contextPath),
    bootstrapPath: relative(root, paths.bootstrapPath),
    conceptDir: relative(root, paths.conceptDir),
  },
  openDesign: {
    required: true,
    status: openDesign.status,
    createCommand: openDesign.createCommand,
    continueCommand: openDesign.continueCommand,
    syncCommand: openDesign.syncCommand,
    manifestPath: openDesign.manifestPath,
    productionHandoffPath: openDesign.productionHandoffPath,
  },
  commands: {
    buildWebsiteReady: `npm run intake:build-website-ready -- --client ${clientSlug} --source manual`,
    runConcept: openDesign.createCommand,
    dryRun: `npm run ops:project-dry-run -- --client ${clientSlug} --business-name ${shellQuote(businessName)} --source-url ${shellQuote(sourceUrl || '<official-site-url>')} --repo ${repo} --email ${shellQuote(email || '<checkout-email>')} --repo-dir ${shellQuote(`<local-repo-dir>`)} --order ${initId}`,
  },
};

writeJson(paths.casePath, caseFile);
writeJson(paths.contextPath, contextPacket);
writeJson(paths.bootstrapPath, bootstrap);
if (!fs.existsSync(paths.timelinePath)) fs.writeFileSync(paths.timelinePath, '');
fs.mkdirSync(path.join(paths.caseDir, 'artifacts'), { recursive: true });

console.log(JSON.stringify({
  ok: true,
  clientSlug,
  initId,
  casePath: relative(root, paths.casePath),
  bootstrapPath: relative(root, paths.bootstrapPath),
  openDesignRequired: true,
  openDesignStatus: openDesign.status,
  next: bootstrap.requiredMilestones,
}, null, 2));

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function relative(rootDir, filePath) {
  return path.relative(rootDir, filePath) || '.';
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    parsed[key] = next && !next.startsWith('--') ? next : true;
    if (next && !next.startsWith('--')) index += 1;
  }
  return parsed;
}

function shellQuote(value) {
  return `"${String(value || '').replace(/"/g, '\\"')}"`;
}
