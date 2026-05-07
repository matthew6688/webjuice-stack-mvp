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
    buildPacketPath: path.join(dir, 'build-packet.md'),
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
  discord = null,
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
    discord: mergeDiscordWorkspace(existing?.discord, discord, kind),
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
      buildPacketPath: ref.buildPacketPath,
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
    discordChannelId: discord?.channelId || '',
    discordThreadId: discord?.threadId || '',
    discordMessageId: discord?.messageId || '',
    discordMessageUrl: discord?.messageUrl || '',
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

function mergeDiscordWorkspace(existing = {}, discord = null, kind = '') {
  const next = existing || {};
  if (!discord?.ok) {
    return {
      salesThreadId: next.salesThreadId || '',
      revisionThreadId: next.revisionThreadId || '',
      websiteTaskThreadId: next.websiteTaskThreadId || '',
      salesWorkspaceChannelId: next.salesWorkspaceChannelId || '',
      salesWorkspaceType: next.salesWorkspaceType || '',
      salesWorkspaceName: next.salesWorkspaceName || '',
      salesWorkspaceTagIds: next.salesWorkspaceTagIds || [],
      revisionWorkspaceChannelId: next.revisionWorkspaceChannelId || '',
      revisionWorkspaceType: next.revisionWorkspaceType || '',
      revisionWorkspaceName: next.revisionWorkspaceName || '',
      revisionWorkspaceTagIds: next.revisionWorkspaceTagIds || [],
      websiteWorkspaceChannelId: next.websiteWorkspaceChannelId || '',
      websiteWorkspaceType: next.websiteWorkspaceType || '',
      websiteWorkspaceName: next.websiteWorkspaceName || '',
      websiteWorkspaceTagIds: next.websiteWorkspaceTagIds || [],
      lastChannelId: next.lastChannelId || '',
      lastMessageId: next.lastMessageId || '',
      lastMessageUrl: next.lastMessageUrl || '',
      lastThreadUrl: next.lastThreadUrl || '',
    };
  }
  const threadId = discord.threadId || discord.channelId || '';
  return {
    salesThreadId: kind === 'sale' && threadId ? threadId : next.salesThreadId || '',
    revisionThreadId: kind === 'revision' && threadId ? threadId : next.revisionThreadId || '',
    websiteTaskThreadId: kind === 'website_task' && threadId ? threadId : next.websiteTaskThreadId || '',
    salesWorkspaceChannelId: kind === 'sale' ? (discord.channelId || next.salesWorkspaceChannelId || '') : next.salesWorkspaceChannelId || '',
    salesWorkspaceType: kind === 'sale' ? (discord.threadStyle || next.salesWorkspaceType || '') : next.salesWorkspaceType || '',
    salesWorkspaceName: kind === 'sale' ? (discord.threadName || next.salesWorkspaceName || '') : next.salesWorkspaceName || '',
    salesWorkspaceTagIds: kind === 'sale' ? (discord.appliedTagIds || next.salesWorkspaceTagIds || []) : next.salesWorkspaceTagIds || [],
    revisionWorkspaceChannelId: kind === 'revision' ? (discord.channelId || next.revisionWorkspaceChannelId || '') : next.revisionWorkspaceChannelId || '',
    revisionWorkspaceType: kind === 'revision' ? (discord.threadStyle || next.revisionWorkspaceType || '') : next.revisionWorkspaceType || '',
    revisionWorkspaceName: kind === 'revision' ? (discord.threadName || next.revisionWorkspaceName || '') : next.revisionWorkspaceName || '',
    revisionWorkspaceTagIds: kind === 'revision' ? (discord.appliedTagIds || next.revisionWorkspaceTagIds || []) : next.revisionWorkspaceTagIds || [],
    websiteWorkspaceChannelId: kind === 'website_task' ? (discord.channelId || next.websiteWorkspaceChannelId || '') : next.websiteWorkspaceChannelId || '',
    websiteWorkspaceType: kind === 'website_task' ? (discord.threadStyle || next.websiteWorkspaceType || '') : next.websiteWorkspaceType || '',
    websiteWorkspaceName: kind === 'website_task' ? (discord.threadName || next.websiteWorkspaceName || '') : next.websiteWorkspaceName || '',
    websiteWorkspaceTagIds: kind === 'website_task'
      ? (discord.appliedTagIds || next.websiteWorkspaceTagIds || [])
      : next.websiteWorkspaceTagIds || [],
    lastChannelId: discord.channelId || next.lastChannelId || '',
    lastMessageId: discord.messageId || next.lastMessageId || '',
    lastMessageUrl: discord.messageUrl || next.lastMessageUrl || '',
    lastThreadUrl: discord.threadUrl || next.lastThreadUrl || '',
    threadCreatedByBot: Boolean(discord.threadCreatedByBot || next.threadCreatedByBot),
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
    paths: caseFile.paths,
    buildPacketPath: caseFile.paths?.buildPacketPath || '',
    latestTask: caseFile.latestTask,
    recentTimeline: recentTimeline.slice(-20),
    agentStartProtocol: [
      'Read this context packet before changing files.',
      'Read case.json and timeline.jsonl for the full memory trail.',
      'Read build-packet.md and website-survey.json when present before choosing a build approach.',
      'Read evidence/content/design/brand files before planning any edit.',
      'Classify the request as website, menu, domain, or account utility before patching.',
      'Do not override locked decisions.',
      'Do not treat unverified customer text as source of truth for menu prices, hours, address, phone, or reservation links.',
      'If evidence conflicts with the customer request, stop and write needs_human_decision instead of guessing.',
      'After work, append an agent run summary and timeline event.',
    ],
  };
}

export function recordAgentRun(casePaths, runResult, { dryRun = false } = {}) {
  if (!casePaths?.casePath) return { ok: false, skipped: true, reason: 'missing_case_path' };
  const caseFile = readJsonIfExists(casePaths.casePath);
  if (!caseFile) return { ok: false, skipped: true, reason: 'case_not_found' };

  const now = artifactTimestamp();
  const runEvent = {
    id: `agent_run_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    taskId: runResult.taskId || '',
    ok: Boolean(runResult.ok),
    dryRun: Boolean(runResult.dryRun),
    mode: runResult.mode || '',
    repo: runResult.repo || caseFile.repo || '',
    branch: runResult.branch || caseFile.branch || '',
    repoDir: runResult.repoDir || '',
    changedFiles: runResult.changedFiles || [],
    pushed: Boolean(runResult.pushed),
    commit: runResult.commit || '',
    previewUrl: runResult.previewUrl || caseFile.previewUrl || '',
    audit: {
      contextRead: runResult.audit?.contextRead || {},
      designProtocolUsed: runResult.audit?.designProtocolUsed || {},
      qaScreenshots: runResult.audit?.qaScreenshots || [],
      devDeployUrl: runResult.audit?.devDeployUrl || runResult.previewUrl || caseFile.previewUrl || '',
      customerEmailId: runResult.audit?.customerEmailId || '',
    },
    steps: (runResult.steps || []).map((step) => ({
      id: step.id,
      ok: step.ok,
      command: step.command,
    })),
    startedAt: runResult.startedAt || now,
    finishedAt: runResult.finishedAt || now,
    createdAt: now,
  };

  const timelineEvent = {
    id: `case_evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    type: timelineTypeForAgentRun(runResult),
    ok: Boolean(runResult.ok),
    taskId: runResult.taskId || '',
    repo: runResult.repo || caseFile.repo || '',
    branch: runResult.branch || caseFile.branch || '',
    runId: runEvent.id,
    changedFiles: runEvent.changedFiles,
    pushed: runEvent.pushed,
    commit: runEvent.commit,
    createdAt: now,
  };

  const updatedCase = {
    ...caseFile,
    status: statusForAgentRun(runResult),
    latestAgentRun: runEvent,
    updatedAt: now,
  };
  const contextPacket = buildCaseContextPacket(updatedCase, {
    recentTimeline: appendPreview(casePaths.timelinePath || updatedCase.paths?.timelinePath, timelineEvent),
  });

  if (!dryRun) {
    writeJson(casePaths.casePath, updatedCase);
    writeJson(casePaths.contextPath || updatedCase.paths?.contextPath, contextPacket);
    appendJsonl(casePaths.agentRunsPath || updatedCase.paths?.agentRunsPath, runEvent);
    appendJsonl(casePaths.timelinePath || updatedCase.paths?.timelinePath, timelineEvent);
  }

  return {
    ok: true,
    dryRun,
    caseFile: updatedCase,
    runEvent,
    timelineEvent,
    contextPacket,
  };
}

export function recordCaseNotification(casePaths, notification, { dryRun = false } = {}) {
  if (!casePaths?.casePath) return { ok: false, skipped: true, reason: 'missing_case_path' };
  const caseFile = readJsonIfExists(casePaths.casePath);
  if (!caseFile) return { ok: false, skipped: true, reason: 'case_not_found' };

  const now = artifactTimestamp();
  const timelineEvent = {
    id: `case_evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    type: notification.type || 'notification_sent',
    ok: notification.ok !== false,
    channel: notification.channel || 'discord',
    reason: notification.reason || '',
    discordChannelId: notification.discord?.channelId || '',
    discordThreadId: notification.discord?.threadId || '',
    discordMessageId: notification.discord?.messageId || '',
    discordMessageUrl: notification.discord?.messageUrl || '',
    createdAt: now,
  };

  const updatedCase = {
    ...caseFile,
    discord: mergeDiscordWorkspace(caseFile.discord, notification.discord, notification.kind || ''),
    updatedAt: now,
  };
  const contextPacket = buildCaseContextPacket(updatedCase, {
    recentTimeline: appendPreview(casePaths.timelinePath || updatedCase.paths?.timelinePath, timelineEvent),
  });

  if (!dryRun) {
    writeJson(casePaths.casePath, updatedCase);
    writeJson(casePaths.contextPath || updatedCase.paths?.contextPath, contextPacket);
    appendJsonl(casePaths.timelinePath || updatedCase.paths?.timelinePath, timelineEvent);
  }

  return {
    ok: true,
    dryRun,
    caseFile: updatedCase,
    timelineEvent,
    contextPacket,
  };
}

function timelineTypeForAgentRun(runResult) {
  if (runResult.mode === 'publish') return runResult.ok ? 'live_publish_completed' : 'live_publish_failed';
  return runResult.ok ? 'agent_run_completed' : 'agent_run_failed';
}

function statusForAgentRun(runResult) {
  if (!runResult.ok) return runResult.mode === 'publish' ? 'live_publish_failed' : 'agent_run_failed';
  if (runResult.mode === 'publish') return runResult.pushed ? 'live_published' : 'live_publish_ready';
  return runResult.pushed ? 'dev_pushed_needs_review' : 'agent_run_ready_for_review';
}

export function sourceOfTruthPaths(clientSlug) {
  const prefix = clientSlug ? `clients/${clientSlug}` : 'clients/<clientSlug>';
  return {
    evidence: `${prefix}/evidence/evidence.json`,
    content: `${prefix}/content.restaurant.json`,
    design: `${prefix}/design.restaurant.json`,
    brandSpec: `${prefix}/brand-spec.md`,
    checkout: `${prefix}/funnel/checkout.json`,
    websiteSurvey: `${prefix}/intake/website-survey.json`,
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
  if (kind === 'paid_intake') return 'paid_intake_pending_preview';
  if (kind === 'sale') return task ? 'paid_task_queued' : 'paid';
  if (kind === 'revision') return task ? 'revision_task_queued' : 'revision_received';
  return 'active';
}

function timelineType(kind, ok) {
  if (!ok) return 'revision_denied';
  if (kind === 'paid_intake') return 'paid_intake_created';
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
