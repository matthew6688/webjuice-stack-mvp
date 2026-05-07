import fs from 'fs';
import path from 'path';
import { buildClientRepoBootstrapReference } from '../deploy/client-repo-bootstrap.js';
import { buildOpenDesignWorkspace } from '../open-design/workspace.js';

const VALID_TYPES = new Set(['activate', 'revise', 'publish', 'domain', 'qa-fix', 'sale', 'revision']);
const VALID_CREATED_FROM = new Set(['tally_payment', 'tally_feedback', 'stripe_payment', 'manual']);

export function createAgentTask({
  clientSlug,
  type = 'activate',
  repo,
  branch = 'dev',
  evidencePath,
  contentPath,
  designPath,
  checkoutPath,
  brandSpecPath,
  websiteSurveyPath,
  buildPacketPath,
  openDesign,
  productionHandoffPath,
  repoBootstrap,
  order,
  createdFrom = 'manual',
  acceptanceCriteria,
}) {
  const task = {
    schemaVersion: 1,
    id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    clientSlug,
    type,
    repo: repo || order?.repo || '',
    branch,
    evidencePath: evidencePath || defaultClientPath(clientSlug, 'evidence/evidence.json'),
    contentPath: contentPath || defaultClientPath(clientSlug, 'content.restaurant.json'),
    designPath: designPath || defaultClientPath(clientSlug, 'design.restaurant.json'),
    checkoutPath: checkoutPath || defaultClientPath(clientSlug, 'funnel/checkout.json'),
    brandSpecPath: brandSpecPath || defaultClientPath(clientSlug, 'brand-spec.md'),
    websiteSurveyPath: websiteSurveyPath || defaultClientPath(clientSlug, 'intake/website-survey.json'),
    requiredContext: {
      evidence: evidencePath || defaultClientPath(clientSlug, 'evidence/evidence.json'),
      content: contentPath || defaultClientPath(clientSlug, 'content.restaurant.json'),
      design: designPath || defaultClientPath(clientSlug, 'design.restaurant.json'),
      brandSpec: brandSpecPath || defaultClientPath(clientSlug, 'brand-spec.md'),
      checkout: checkoutPath || defaultClientPath(clientSlug, 'funnel/checkout.json'),
      websiteSurvey: websiteSurveyPath || defaultClientPath(clientSlug, 'intake/website-survey.json'),
    },
    buildPacketPath: buildPacketPath || '',
    openDesign: openDesign || defaultOpenDesign(clientSlug),
    productionHandoffPath: productionHandoffPath || defaultClientPath(clientSlug, 'concept/open-design/production-handoff.json'),
    repoBootstrap: repoBootstrap || buildClientRepoBootstrapReference({
      repo: repo || order?.repo || '',
      pagesProjectName: repoName(repo || order?.repo || clientSlug),
    }),
    createdFrom,
    createdAt: new Date().toISOString(),
    order: order || null,
    acceptanceCriteria: acceptanceCriteria || defaultAcceptanceCriteria(type),
  };

  const validation = validateAgentTask(task);
  if (!validation.ok) throw new Error(`Invalid agent task: ${validation.errors.join('; ')}`);
  return task;
}

export function validateAgentTask(task) {
  const errors = [];
  const taskType = task.type || task.kind;
  const contentPath = task.contentPath || task.requiredContext?.content;
  const designPath = task.designPath || task.requiredContext?.design;
  if (!task.id) errors.push('id is required');
  if (!task.clientSlug) errors.push('clientSlug is required');
  if (!VALID_TYPES.has(taskType)) errors.push(`type/kind must be one of: ${Array.from(VALID_TYPES).join(', ')}`);
  if (!task.repo) errors.push('repo is required');
  if (!['dev', 'main'].includes(task.branch)) errors.push('branch must be dev or main');
  if (!task.evidencePath && !task.requiredContext?.evidence) errors.push('evidencePath or requiredContext.evidence is required');
  if (!contentPath) errors.push('contentPath or requiredContext.content is required');
  if (!designPath) errors.push('designPath or requiredContext.design is required');
  if (task.createdFrom && !VALID_CREATED_FROM.has(task.createdFrom)) {
    errors.push(`createdFrom must be one of: ${Array.from(VALID_CREATED_FROM).join(', ')}`);
  }
  if (task.acceptanceCriteria && (!Array.isArray(task.acceptanceCriteria) || !task.acceptanceCriteria.length)) {
    errors.push('acceptanceCriteria must not be empty');
  }
  if (task.openDesign) {
    const requiresBoundProject = task.openDesign.status !== 'not_created';
    if (requiresBoundProject && !task.openDesign.projectId) errors.push('openDesign.projectId is required when openDesign is bound');
    if (!task.openDesign.dataDir) errors.push('openDesign.dataDir is required when openDesign is present');
    if (!task.openDesign.conceptPath) errors.push('openDesign.conceptPath is required when openDesign is present');
    if (!task.openDesign.manifestPath) errors.push('openDesign.manifestPath is required when openDesign is present');
  }
  if (task.repoBootstrap) {
    if (!task.repoBootstrap.command) errors.push('repoBootstrap.command is required when repoBootstrap is present');
    if (!task.repoBootstrap.status) errors.push('repoBootstrap.status is required when repoBootstrap is present');
  }
  return { ok: errors.length === 0, errors };
}

export function saveAgentTask(task, queueRoot = 'agent-tasks', state = 'pending') {
  const outputDir = path.join(queueRoot, state);
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `${task.id}.json`);
  fs.writeFileSync(outputPath, `${JSON.stringify(task, null, 2)}\n`);
  return outputPath;
}

export function taskFromTallyOrder(order, options = {}) {
  return createAgentTask({
    clientSlug: order.clientSlug,
    type: order.feedback ? 'revise' : 'activate',
    repo: order.repo,
    branch: 'dev',
    order,
    createdFrom: order.feedback ? 'tally_feedback' : 'tally_payment',
    ...options,
  });
}

function defaultClientPath(clientSlug, filePath) {
  return clientSlug ? `clients/${clientSlug}/${filePath}` : '';
}

function repoName(repoOrSlug = '') {
  return String(repoOrSlug || '').includes('/')
    ? String(repoOrSlug).split('/').pop()
    : String(repoOrSlug || '');
}

function defaultOpenDesign(clientSlug) {
  return buildOpenDesignWorkspace(clientSlug);
}

function defaultAcceptanceCriteria(type) {
  if (type === 'activate') {
    return [
      'Apply validated content/design/checkout artifacts to the client repo.',
      'Deploy the dev preview successfully.',
      'Run link QA and capture updated screenshots.',
      'Prepare domain onboarding instructions when a domain is present.',
    ];
  }
  if (type === 'revise') {
    return [
      'Apply customer requested revisions only.',
      'Keep real menu evidence and source links intact.',
      'Deploy the dev preview and capture screenshots.',
      'Summarize changes for customer review.',
    ];
  }
  return [
    'Complete the requested task.',
    'Run the relevant validation command.',
    'Record outcome and next action.',
  ];
}
