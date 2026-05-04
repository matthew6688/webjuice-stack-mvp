import fs from 'fs';
import path from 'path';

const VALID_TYPES = new Set(['activate', 'revise', 'publish', 'domain', 'qa-fix']);
const VALID_CREATED_FROM = new Set(['tally_payment', 'tally_feedback', 'manual']);

export function createAgentTask({
  clientSlug,
  type = 'activate',
  repo,
  branch = 'dev',
  evidencePath,
  contentPath,
  designPath,
  checkoutPath,
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
  if (!task.id) errors.push('id is required');
  if (!task.clientSlug) errors.push('clientSlug is required');
  if (!VALID_TYPES.has(task.type)) errors.push(`type must be one of: ${Array.from(VALID_TYPES).join(', ')}`);
  if (!task.repo) errors.push('repo is required');
  if (!['dev', 'main'].includes(task.branch)) errors.push('branch must be dev or main');
  if (!task.evidencePath) errors.push('evidencePath is required');
  if (!task.contentPath) errors.push('contentPath is required');
  if (!task.designPath) errors.push('designPath is required');
  if (!VALID_CREATED_FROM.has(task.createdFrom)) {
    errors.push(`createdFrom must be one of: ${Array.from(VALID_CREATED_FROM).join(', ')}`);
  }
  if (!Array.isArray(task.acceptanceCriteria) || !task.acceptanceCriteria.length) {
    errors.push('acceptanceCriteria must not be empty');
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
