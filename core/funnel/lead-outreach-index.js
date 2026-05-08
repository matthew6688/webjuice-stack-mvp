import fs from 'fs';
import path from 'path';
import { normalizeOutreachArtifactState } from './outreach-provider-state.js';

export const LEAD_ADMIN_VIEWS = {
  all: { label: '全部 leads' },
  demo_ready: { label: 'Demo ready' },
  draft_ready: { label: 'Draft ready' },
  outreach_sent: { label: 'Outreach sent' },
  paid: { label: 'Paid' },
  missing_assets: { label: 'Missing assets' },
  missing_email: { label: 'Missing outreach draft' },
};

export function loadLeadOutreachIndex({
  clientsRoot = 'clients',
  casesRoot = 'data/cases',
  paidIntakesRoot = 'data/paid-intakes',
} = {}) {
  const records = new Map();

  ingestOutreachArtifacts(records, clientsRoot);
  ingestCaseFiles(records, casesRoot);
  ingestPaidIntakes(records, paidIntakesRoot);

  const list = [...records.values()]
    .map((record) => finalizeLeadRecord(record))
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));

  return {
    records: list,
    counts: buildCounts(list),
    updatedAt: new Date().toISOString(),
  };
}

export function matchesLeadView(record, view = 'all') {
  switch (view) {
    case 'demo_ready':
      return Boolean(record.previewUrl && record.assetsReady);
    case 'draft_ready':
      return record.emailDraftReady;
    case 'outreach_sent':
      return record.outreachSent === true;
    case 'paid':
      return record.paymentStatus === 'paid';
    case 'missing_assets':
      return !record.assetsReady;
    case 'missing_email':
      return !record.emailDraftReady;
    case 'all':
    default:
      return true;
  }
}

function ingestOutreachArtifacts(records, clientsRoot) {
  if (!fs.existsSync(clientsRoot)) return;
  for (const clientSlug of fs.readdirSync(clientsRoot).sort()) {
    const clientDir = path.join(clientsRoot, clientSlug);
    if (!fs.statSync(clientDir).isDirectory()) continue;
    const packPath = path.join(clientDir, 'outreach', 'outreach-pack.json');
    if (!fs.existsSync(packPath)) continue;
    const pack = readJsonIfExists(packPath) || {};
    const emailDir = path.join(clientDir, 'outreach', 'email');
    const emailArtifacts = readEmailArtifacts(emailDir);
    const record = ensureRecord(records, clientSlug);
    record.clientSlug = clientSlug;
    record.company = record.company || pack.businessName || titleFromSlug(clientSlug);
    record.previewUrl = pack.previewUrl || record.previewUrl || '';
    record.outreachPackPath = packPath;
    record.outreachMarkdownPath = fs.existsSync(path.join(clientDir, 'outreach', 'outreach-pack.md'))
      ? path.join(clientDir, 'outreach', 'outreach-pack.md')
      : '';
    record.outreachEmailDir = fs.existsSync(emailDir) ? emailDir : '';
    record.proofPoints = Array.isArray(pack?.emailBrief?.proofPoints) ? pack.emailBrief.proofPoints.length : record.proofPoints || 0;
    record.assetsReady = Boolean(pack?.assets?.screenshots?.desktop && pack?.assets?.screenshots?.mobile && pack?.assets?.video);
    record.auditVerdict = pack?.audit?.verdict || record.auditVerdict || '';
    record.auditScore = Number.isFinite(pack?.audit?.score) ? pack.audit.score : (record.auditScore ?? null);
    record.emailDraftReady = emailArtifacts.length > 0;
    record.emailArtifacts = emailArtifacts;
    record.latestEmailArtifact = emailArtifacts[0] || null;
    const sentArtifact = emailArtifacts.find((artifact) => artifact.outreachState.status === 'sent');
    const repliedArtifact = emailArtifacts.find((artifact) => artifact.outreachState.replyState === 'replied' || artifact.outreachState.status === 'replied');
    const bouncedArtifact = emailArtifacts.find((artifact) => artifact.outreachState.bounceState === 'bounced' || artifact.outreachState.status === 'bounced');
    record.outreachSent = emailArtifacts.some((artifact) => artifact.outreachState.status === 'sent');
    record.outreachSentAt = sentArtifact?.outreachState?.sentAt || '';
    record.outreachSendId = sentArtifact?.outreachState?.sendId || '';
    record.outreachProvider = sentArtifact?.outreachState?.provider || repliedArtifact?.outreachState?.provider || bouncedArtifact?.outreachState?.provider || '';
    record.outreachSourceSystem = sentArtifact?.outreachState?.sourceSystem || repliedArtifact?.outreachState?.sourceSystem || bouncedArtifact?.outreachState?.sourceSystem || '';
    record.replyState = repliedArtifact ? 'replied' : (record.replyState || '');
    record.replySnippet = repliedArtifact?.outreachState?.replySnippet || '';
    record.nextFollowUpDue = repliedArtifact?.outreachState?.nextFollowUpDue || sentArtifact?.outreachState?.nextFollowUpDue || record.nextFollowUpDue || '';
    record.bounceState = bouncedArtifact?.outreachState?.bounceState || record.bounceState || '';
    record.outreachCampaignId = sentArtifact?.outreachState?.externalCampaignId || repliedArtifact?.outreachState?.externalCampaignId || bouncedArtifact?.outreachState?.externalCampaignId || '';
    record.outreachLeadId = sentArtifact?.outreachState?.externalLeadId || repliedArtifact?.outreachState?.externalLeadId || bouncedArtifact?.outreachState?.externalLeadId || '';
    record.outreachMessageId = sentArtifact?.outreachState?.externalMessageId || repliedArtifact?.outreachState?.externalMessageId || bouncedArtifact?.outreachState?.externalMessageId || '';
    record.outreachThreadUrl = repliedArtifact?.outreachState?.externalThreadUrl || sentArtifact?.outreachState?.externalThreadUrl || '';
    record.updatedAt = maxDate(record.updatedAt, pack.generatedAt, emailArtifacts[0]?.generatedAt);
  }
}

function ingestCaseFiles(records, casesRoot) {
  if (!fs.existsSync(casesRoot)) return;
  for (const clientSlug of fs.readdirSync(casesRoot).sort()) {
    const clientDir = path.join(casesRoot, clientSlug);
    if (!fs.statSync(clientDir).isDirectory()) continue;
    for (const orderId of fs.readdirSync(clientDir).sort()) {
      const casePath = path.join(clientDir, orderId, 'case.json');
      if (!fs.existsSync(casePath)) continue;
      const caseFile = readJsonIfExists(casePath);
      if (!caseFile?.clientSlug) continue;
      const record = ensureRecord(records, caseFile.clientSlug);
      if (!record.casePath || newer(caseFile.updatedAt, record.caseUpdatedAt)) {
        record.casePath = casePath;
        record.caseUpdatedAt = caseFile.updatedAt || '';
        record.caseStatus = caseFile.status || '';
        record.company = caseFile.customer?.company || record.company || titleFromSlug(caseFile.clientSlug);
        record.customerEmail = caseFile.customer?.email || record.customerEmail || '';
        record.domain = caseFile.customer?.domain || record.domain || '';
        record.paymentStatus = caseFile.order?.paymentStatus || record.paymentStatus || '';
        record.orderId = caseFile.order?.id || record.orderId || '';
        record.orderTier = caseFile.order?.tier || record.orderTier || '';
        record.amount = caseFile.order?.amount ?? record.amount ?? null;
        record.currency = caseFile.order?.currency || record.currency || 'USD';
        record.salesThreadId = caseFile.discord?.salesThreadId || record.salesThreadId || '';
        record.salesWorkspaceChannelId = caseFile.discord?.salesWorkspaceChannelId || record.salesWorkspaceChannelId || '';
        record.salesWorkspaceName = caseFile.discord?.salesWorkspaceName || record.salesWorkspaceName || '';
        record.salesWorkspaceTagIds = caseFile.discord?.salesWorkspaceTagIds || record.salesWorkspaceTagIds || [];
        record.websiteTaskThreadId = caseFile.discord?.websiteTaskThreadId || record.websiteTaskThreadId || '';
        record.previewUrl = record.previewUrl || caseFile.previewUrl || '';
      }
      record.updatedAt = maxDate(record.updatedAt, caseFile.updatedAt);
    }
  }
}

function ingestPaidIntakes(records, root) {
  if (!fs.existsSync(root)) return;
  for (const clientSlug of fs.readdirSync(root).sort()) {
    const clientDir = path.join(root, clientSlug);
    if (!fs.statSync(clientDir).isDirectory()) continue;
    for (const filename of fs.readdirSync(clientDir).sort()) {
      if (!filename.endsWith('.json') || filename.endsWith('-timeline.json')) continue;
      const filePath = path.join(clientDir, filename);
      const intake = readJsonIfExists(filePath);
      if (!intake?.clientSlug) continue;
      const record = ensureRecord(records, intake.clientSlug);
      if (!record.paidIntakePath || newer(intake.updatedAt, record.paidIntakeUpdatedAt)) {
        record.paidIntakePath = filePath;
        record.paidIntakeUpdatedAt = intake.updatedAt || '';
        record.paidIntakeStatus = intake.status || '';
        record.company = intake.customer?.company || record.company || titleFromSlug(intake.clientSlug);
        record.customerEmail = intake.customer?.email || record.customerEmail || '';
        record.domain = intake.customer?.domain || record.domain || '';
        record.paymentStatus = intake.order?.paymentStatus || record.paymentStatus || '';
        record.orderId = intake.order?.id || record.orderId || intake.orderId || '';
        record.orderTier = intake.order?.tier || record.orderTier || '';
        record.amount = intake.order?.amount ?? record.amount ?? null;
        record.currency = intake.order?.currency || record.currency || 'USD';
        record.readinessStatus = intake.readiness?.status || '';
        record.missing = intake.readiness?.missing || [];
        record.leadRecipientEmail = intake.leadDelivery?.recipientEmail || record.leadRecipientEmail || '';
      }
      record.updatedAt = maxDate(record.updatedAt, intake.updatedAt);
    }
  }
}

function finalizeLeadRecord(input) {
  const record = { ...input };
  record.stageKey = deriveStageKey(record);
  record.stageLabel = deriveStageLabel(record.stageKey);
  record.stageTone = deriveStageTone(record.stageKey);
  record.nextAction = deriveNextAction(record);
  record.blocker = deriveBlocker(record);
  return record;
}

function deriveStageKey(record) {
  if (record.paymentStatus === 'paid') return 'paid';
  if (record.replyState === 'replied') return 'replied';
  if (record.bounceState === 'bounced') return 'bounced';
  if (record.outreachSent) return 'outreach_sent';
  if (record.emailDraftReady && record.assetsReady && record.previewUrl) return 'draft_ready';
  if (record.assetsReady && record.previewUrl) return 'demo_ready';
  if (record.outreachPackPath) return 'building_demo';
  return 'lead';
}

function deriveStageLabel(stageKey) {
  return {
    paid: 'Paid',
    replied: 'Replied',
    bounced: 'Bounced',
    outreach_sent: 'Outreach Sent',
    draft_ready: 'Draft Ready',
    demo_ready: 'Demo Ready',
    building_demo: 'Building Demo',
    lead: 'Lead',
  }[stageKey] || 'Lead';
}

function deriveStageTone(stageKey) {
  return {
    paid: 'ready',
    replied: 'ready',
    bounced: 'alert',
    outreach_sent: 'working',
    draft_ready: 'working',
    demo_ready: 'ready',
    building_demo: 'working',
    lead: 'info',
  }[stageKey] || 'info';
}

function deriveNextAction(record) {
  if (record.paymentStatus === 'paid') {
    return {
      label: '转正式项目执行',
      reason: '客户已经付款，下一步应该在 website-projects 里推进 build/review/live。',
    };
  }
  if (record.replyState === 'replied') {
    return {
      label: '处理 prospect 回复',
      reason: '已经收到回复，下一步应该把回复结果落回 case / forum，并决定是否推进成交。',
    };
  }
  if (record.bounceState === 'bounced') {
    return {
      label: '修正邮箱或替换发送通道',
      reason: 'cold outreach 已记录 bounce，下一步应该核对邮箱、名单质量，或换发送平台重新触达。',
    };
  }
  if (record.outreachSent) {
    return {
      label: '等待或安排 follow-up',
      reason: record.nextFollowUpDue
        ? `已发送 cold outreach，下一次建议跟进时间：${record.nextFollowUpDue}。`
        : '已发送 cold outreach，下一步应该在外部邮箱系统或 agentic inbox 里查看回复。',
    };
  }
  if (!record.outreachPackPath) {
    return {
      label: '生成 outreach pack',
      reason: '还没有 demo preview 与 proof pack，无法进入冷启动触达。',
    };
  }
  if (!record.assetsReady) {
    return {
      label: '补截图和视频',
      reason: 'demo 资产不完整，暂时不适合发 cold outreach。',
    };
  }
  if (!record.emailDraftReady) {
    return {
      label: '生成 cold outreach draft',
      reason: '已有 demo 与 proof，但还没有可发送的 outreach 邮件草稿。',
    };
  }
  return {
    label: '发送或跟进 outreach',
    reason: 'demo、proof、draft 都在，可以用外部 cold outreach 系统发出或继续跟进。',
  };
}

function deriveBlocker(record) {
  if (record.paymentStatus === 'paid') return '';
  if (record.replyState === 'replied') return '';
  if (record.bounceState === 'bounced') return '';
  if (record.outreachSent) return '';
  if (!record.outreachPackPath) return '缺少 outreach pack';
  if (!record.assetsReady) return '缺少 outreach proof 资产';
  if (!record.emailDraftReady) return '缺少 cold outreach draft';
  if (!record.customerEmail && !record.leadRecipientEmail) return '缺少明确的联系邮箱';
  return '';
}

function ensureRecord(records, clientSlug) {
  if (!records.has(clientSlug)) {
    records.set(clientSlug, {
      clientSlug,
      company: '',
      previewUrl: '',
      customerEmail: '',
      leadRecipientEmail: '',
      domain: '',
      paymentStatus: '',
      orderId: '',
      orderTier: '',
      amount: null,
      currency: 'USD',
      proofPoints: 0,
      assetsReady: false,
      auditVerdict: '',
      auditScore: null,
      emailDraftReady: false,
      emailArtifacts: [],
      latestEmailArtifact: null,
      outreachSent: false,
      outreachSentAt: '',
      outreachSendId: '',
      outreachProvider: '',
      outreachSourceSystem: '',
      outreachCampaignId: '',
      outreachLeadId: '',
      outreachMessageId: '',
      outreachThreadUrl: '',
      replyState: '',
      replySnippet: '',
      nextFollowUpDue: '',
      bounceState: '',
      outreachPackPath: '',
      outreachMarkdownPath: '',
      outreachEmailDir: '',
      casePath: '',
      caseStatus: '',
      paidIntakePath: '',
      paidIntakeStatus: '',
      readinessStatus: '',
      missing: [],
      salesThreadId: '',
      salesWorkspaceChannelId: '',
      salesWorkspaceName: '',
      salesWorkspaceTagIds: [],
      websiteTaskThreadId: '',
      updatedAt: '',
      caseUpdatedAt: '',
      paidIntakeUpdatedAt: '',
    });
  }
  return records.get(clientSlug);
}

function readEmailArtifacts(emailDir) {
  if (!fs.existsSync(emailDir)) return [];
  return fs.readdirSync(emailDir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => {
      const fullPath = path.join(emailDir, file);
      const json = readJsonIfExists(fullPath) || {};
      return {
        path: fullPath,
        to: json.to || '',
        subject: json.subject || '',
        generatedAt: json.generatedAt || '',
        dryRun: json.dryRun !== false,
        sendResult: json.sendResult || null,
        providerEvent: json.providerEvent || null,
        outreachState: normalizeOutreachArtifactState(json),
      };
    })
    .sort((a, b) => String(b.generatedAt || '').localeCompare(String(a.generatedAt || '')));
}

function buildCounts(records) {
  return records.reduce((acc, record) => {
    acc.total += 1;
    acc[record.stageKey] = (acc[record.stageKey] || 0) + 1;
    if (record.previewUrl && record.assetsReady) acc.demoReady += 1;
    if (record.assetsReady) acc.assetsReady += 1;
    if (record.emailDraftReady) acc.emailDraftReady += 1;
    if (record.outreachSent) acc.outreachSent += 1;
    if (record.replyState === 'replied') acc.replied += 1;
    if (record.bounceState === 'bounced') acc.bounced += 1;
    if (record.paymentStatus === 'paid') acc.paid += 1;
    if (record.blocker) acc.blocked += 1;
    return acc;
  }, {
    total: 0,
    demoReady: 0,
    assetsReady: 0,
    emailDraftReady: 0,
    outreachSent: 0,
    replied: 0,
    bounced: 0,
    paid: 0,
    blocked: 0,
  });
}

function readJsonIfExists(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function titleFromSlug(slug) {
  return String(slug || '')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function newer(left, right) {
  return String(left || '') > String(right || '');
}

function maxDate(...values) {
  return values.filter(Boolean).sort().slice(-1)[0] || '';
}
