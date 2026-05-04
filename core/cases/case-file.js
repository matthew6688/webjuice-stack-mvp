import fs from 'fs';
import path from 'path';
import { artifactTimestamp } from '../time.js';

export const DEFAULT_CASES_DIR = 'data/cases';

export function buildCaseReference(order, options = {}) {
  const clientSlug = order.clientSlug || 'unknown-client';
  const orderId = order.orderId || order.rawSubmissionId || 'unknown-order';
  const dir = path.join(options.casesDir || DEFAULT_CASES_DIR, safeId(clientSlug), safeId(orderId));
  return {
    caseId: `${safeId(clientSlug)}_${safeId(orderId)}`,
    dir,
    casePath: path.join(dir, 'case.json'),
    contextPath: path.join(dir, 'context-packet.json'),
    timelinePath: path.join(dir, 'timeline.jsonl'),
    decisionsPath: path.join(dir, 'decisions.jsonl'),
    customerMessagesPath: path.join(dir, 'customer-messages.jsonl'),
    agentRunsPath: path.join(dir, 'agent-runs.jsonl'),
    artifactsDir: path.join(dir, 'artifacts'),
  };
}

export function recordFunnelCaseEvent({
  kind,
  provider,
  order,
  entitlement = null,
  task = null,
  taskPath = null,
  submissionPath = null,
  ledgerEvent = null,
  payload = null,
  ok = true,
  reason = '',
  casesDir,
  dryRun = false,
} = {}) {
  const ref = buildCaseReference(order, { casesDir });
  const now = artifactTimestamp();
  const existing = readJsonIfExists(ref.casePath);
  const revisionPolicy = entitlement?.entitlement?.revisionPolicy || existing?.revision?.policy || null;
  const revisionUsed = entitlement?.entitlement?.revisionUsed ?? existing?.revision?.used ?? 0;

  const caseFile = {
    schemaVersion: 1,
    caseId: ref.caseId,
    status: statusFor(kind, ok, task),
    clientSlug: order.clientSlug || existing?.clientSlug || '',
    repo: order.repo || existing?.repo || '',
    branch: 'dev',
    previewUrl: order.previewUrl || existing?.previewUrl || '',
    template: order.template || existing?.template || '',
    order: {
      id: meaningful(order.orderId, existing?.order?.id),
      provider: kind === 'revision'
        ? meaningful(existing?.order?.provider, meaningful(order.provider || provider, ''))
        : meaningful(order.provider || provider, existing?.order?.provider),
      tier: meaningful(order.tier, existing?.order?.tier),
      amount: Number(order.amount || 0) > 0 ? order.amount : (existing?.order?.amount ?? order.amount ?? 0),
      currency: meaningful(order.currency, existing?.order?.currency, 'USD'),
      paymentStatus: meaningful(order.paymentStatus, existing?.order?.paymentStatus),
    },
    customer: {
      company: meaningful(order.company, existing?.customer?.company),
      email: meaningful(order.email, existing?.customer?.email),
      phone: meaningful(order.phone, existing?.customer?.phone),
      domain: meaningful(order.domain, existing?.customer?.domain),
    },
    revision: {
      policy: revisionPolicy,
      used: revisionUsed,
      remaining: revisionPolicy ? Math.max(Number(revisionPolicy.limit || 0) - Number(revisionUsed || 0), 0) : null,
      lastReason: entitlement?.reason || reason || existing?.revision?.lastReason || '',
    },
    discord: existing?.discord || {
      salesThreadId: '',
      revisionThreadId: '',
      lastMessageUrl: '',
    },
    sourceOfTruth: sourceOfTruthPaths(order.clientSlug),
    activeConstraints: activeConstraints(),
    lockedDecisions: existing?.lockedDecisions || [],
    latestTask: task ? {
      id: task.id,
      kind: task.kind,
      status: task.status,
      path: taskPath,
      createdAt: task.createdAt,
    } : existing?.latestTask || null,
    paths: {
      casePath: ref.casePath,
      contextPath: ref.contextPath,
      timelinePath: ref.timelinePath,
      decisionsPath: ref.decisionsPath,
      customerMessagesPath: ref.customerMessagesPath,
      agentRunsPath: ref.agentRunsPath,
      artifactsDir: ref.artifactsDir,
    },
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  const timelineEvent = {
    id: `case_evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    type: timelineType(kind, ok),
    ok,
    reason: reason || entitlement?.reason || '',
    provider: provider || order.provider || '',
    orderId: order.orderId || '',
    clientSlug: order.clientSlug || '',
    repo: order.repo || '',
    taskId: task?.id || '',
    taskPath: taskPath || '',
    submissionPath: submissionPath || '',
    ledgerEventId: ledgerEvent?.id || '',
    revisionUsed,
    revisionLimit: revisionPolicy?.limit ?? null,
    createdAt: now,
  };

  const customerMessage = customerMessageFromOrder({ kind, order, payload, now });
  const contextPacket = buildCaseContextPacket(caseFile, {
    recentTimeline: appendPreview(ref.timelinePath, timelineEvent),
  });

  if (!dryRun) {
    fs.mkdirSync(ref.dir, { recursive: true });
    fs.mkdirSync(ref.artifactsDir, { recursive: true });
    writeJson(ref.casePath, caseFile);
    writeJson(ref.contextPath, contextPacket);
    ensureJsonl(ref.decisionsPath);
    ensureJsonl(ref.agentRunsPath);
    appendJsonl(ref.timelinePath, timelineEvent);
    if (customerMessage) appendJsonl(ref.customerMessagesPath, customerMessage);
  }

  return {
    ref,
    caseFile,
    contextPacket,
    timelineEvent,
    customerMessage,
  };
}

export function buildCaseContextPacket(caseFile, { recentTimeline = [] } = {}) {
  return {
    schemaVersion: 1,
    caseId: caseFile.caseId,
    status: caseFile.status,
    clientSlug: caseFile.clientSlug,
    repo: caseFile.repo,
    branch: caseFile.branch,
    previewUrl: caseFile.previewUrl,
    order: caseFile.order,
    customer: caseFile.customer,
    revision: caseFile.revision,
    discord: caseFile.discord,
    sourceOfTruth: caseFile.sourceOfTruth,
    activeConstraints: caseFile.activeConstraints,
    lockedDecisions: caseFile.lockedDecisions,
    latestTask: caseFile.latestTask,
    recentTimeline: recentTimeline.slice(-20),
    agentStartProtocol: [
      'Read this context packet before changing files.',
      'Read case.json and timeline.jsonl for the full memory trail.',
      'Read evidence/content/design/brand files before planning any edit.',
      'Classify the request as website, menu, domain, or account utility before patching.',
      'Do not override locked decisions.',
      'Do not treat unverified customer text as source of truth for menu prices, hours, address, phone, or reservation links.',
      'If evidence conflicts with the customer request, stop and write needs_human_decision instead of guessing.',
      'After work, append an agent run summary and timeline event.',
    ],
  };
}

export function sourceOfTruthPaths(clientSlug) {
  const prefix = clientSlug ? `clients/${clientSlug}` : 'clients/<clientSlug>';
  return {
    evidence: `${prefix}/evidence/evidence.json`,
    content: `${prefix}/content.restaurant.json`,
    design: `${prefix}/design.restaurant.json`,
    brandSpec: `${prefix}/brand-spec.md`,
    checkout: `${prefix}/funnel/checkout.json`,
  };
}

export function activeConstraints() {
  return [
    'Website route and menu route are separate products; do not mix their information architecture.',
    'Use Huashu Design/open-design protocol for website-quality visual decisions.',
    'Preserve real evidence source chains for menu, address, phone, hours, reservation, and images.',
    'Push customer-facing implementation changes only to dev until explicit approval.',
    'Keep customer/order/payment/internal decision data out of client website repos.',
  ];
}

function statusFor(kind, ok, task) {
  if (!ok) return 'needs_human_or_extra_revision';
  if (kind === 'sale') return task ? 'paid_task_queued' : 'paid';
  if (kind === 'revision') return task ? 'revision_task_queued' : 'revision_received';
  return 'active';
}

function timelineType(kind, ok) {
  if (!ok) return 'revision_denied';
  if (kind === 'sale') return 'payment_routed';
  if (kind === 'revision') return 'revision_routed';
  return `${kind || 'event'}_routed`;
}

function customerMessageFromOrder({ kind, order, payload, now }) {
  const text = String(order.feedback || '').trim();
  if (!text) return null;
  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    source: kind === 'sale' ? 'checkout_launch_notes' : 'revision_form',
    orderId: order.orderId || '',
    email: order.email || '',
    text,
    referenceUrl: order.referenceUrl || '',
    files: order.files || [],
    rawSubmissionId: payload?.id || payload?.data?.submissionId || order.rawSubmissionId || '',
    createdAt: now,
  };
}

function appendPreview(filePath, event) {
  const existing = readJsonlIfExists(filePath);
  return [...existing, event].slice(-20);
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readJsonlIfExists(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function appendJsonl(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, `${JSON.stringify(data)}\n`);
}

function ensureJsonl(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, '');
}

function safeId(value) {
  return String(value || 'unknown')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'unknown';
}

function meaningful(value, fallback = '', defaultValue = '') {
  const normalized = String(value ?? '').trim();
  if (!normalized || ['unknown', 'n/a', 'null', 'undefined'].includes(normalized.toLowerCase())) {
    return fallback ?? defaultValue;
  }
  return value;
}
