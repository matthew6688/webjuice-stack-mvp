import { loadLeadRegistry } from './lead-registry.js';

export const LEAD_ADMIN_VIEWS = {
  all: { label: '全部线索' },
  demo_ready: { label: 'Demo 就绪' },
  draft_ready: { label: '草稿就绪' },
  outreach_sent: { label: '已发送触达' },
  follow_up_due: { label: '待跟进' },
  follow_up_overdue: { label: '跟进已过期' },
  replied: { label: '已回复' },
  replied_unprocessed: { label: '已回复待处理' },
  bounced: { label: '退信' },
  paid: { label: '已付款' },
  paid_handoff_pending: { label: '已付款待交接' },
  missing_assets: { label: '缺少素材' },
  missing_email: { label: '缺少 outreach 草稿' },
};

export function loadLeadOutreachIndex(options = {}) {
  const registry = loadLeadRegistry(options);
  const list = registry.records
    .map((record) => finalizeLeadRecord(record))
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  const prospectRecords = list.filter((record) => record.paymentStatus !== 'paid');
  const customerRecords = list.filter((record) => record.paymentStatus === 'paid');

  return {
    records: list,
    prospectRecords,
    customerRecords,
    counts: buildCounts(list),
    prospectCounts: buildCounts(prospectRecords),
    customerCounts: buildCounts(customerRecords),
    updatedAt: registry.updatedAt,
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
    case 'follow_up_due':
      return record.stageKey === 'follow_up_due';
    case 'follow_up_overdue':
      return record.stageKey === 'follow_up_overdue';
    case 'replied':
      return record.stageKey === 'replied';
    case 'replied_unprocessed':
      return record.stageKey === 'replied' && !record.websiteTaskThreadId && record.paymentStatus !== 'paid';
    case 'bounced':
      return record.stageKey === 'bounced';
    case 'paid':
      return record.paymentStatus === 'paid';
    case 'paid_handoff_pending':
      return record.paymentStatus === 'paid' && !record.websiteTaskThreadId;
    case 'missing_assets':
      return !record.assetsReady;
    case 'missing_email':
      return !record.emailDraftReady;
    case 'all':
    default:
      return true;
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
  if (isOverdue(record.nextFollowUpDue)) return 'follow_up_overdue';
  if (record.nextFollowUpDue) return 'follow_up_due';
  if (record.outreachSent) return 'outreach_sent';
  if (record.emailDraftReady && record.assetsReady && record.previewUrl) return 'draft_ready';
  if (record.assetsReady && record.previewUrl) return 'demo_ready';
  if (record.outreachPackPath) return 'building_demo';
  return 'lead';
}

function deriveStageLabel(stageKey) {
  return {
    paid: '已付款',
    replied: '已回复',
    bounced: '退信',
    follow_up_overdue: '跟进已过期',
    follow_up_due: '待跟进',
    outreach_sent: '已发送触达',
    draft_ready: '草稿就绪',
    demo_ready: 'Demo 就绪',
    building_demo: '生成 demo 中',
    lead: '线索',
  }[stageKey] || '线索';
}

function deriveStageTone(stageKey) {
  return {
    paid: 'ready',
    replied: 'ready',
    bounced: 'alert',
    follow_up_overdue: 'alert',
    follow_up_due: 'warn',
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
      label: record.websiteTaskThreadId ? '转正式项目执行' : '补项目 workspace',
      reason: record.websiteTaskThreadId
        ? '客户已经付款，下一步应该在 website-projects 里推进 build/review/live。'
        : '客户已经付款，但还没有 website-projects workspace。先补正式项目交接，再继续 build/review/live。',
    };
  }
  if (record.replyState === 'replied') {
    return {
      label: record.websiteTaskThreadId ? '把回复推进到项目执行' : '处理回复并判断是否成交',
      reason: record.websiteTaskThreadId
        ? '这个 lead 已经进入项目 workspace，下一步应该把最新回复同步到项目执行和报价/付款判断。'
        : '已经收到 prospect 回复，先记录 note、判断购买意向，再决定是否推进到 paid/project handoff。',
    };
  }
  if (record.bounceState === 'bounced') {
    return {
      label: '修正邮箱或替换发送通道',
      reason: 'cold outreach 已记录 bounce，下一步应该核对邮箱、名单质量，或换发送平台重新触达。',
    };
  }
  if (isOverdue(record.nextFollowUpDue)) {
    return {
      label: '今天必须 follow-up',
      reason: `跟进日期 ${record.nextFollowUpDue} 已经过期。优先联系并补一条新的 lead note 或 provider event。`,
    };
  }
  if (record.nextFollowUpDue) {
    return {
      label: '执行下一次 follow-up',
      reason: `当前记录的下一次跟进时间是 ${record.nextFollowUpDue}。发送跟进后，记得补一条 lead note 或 provider event。`,
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
  if (isOverdue(record.nextFollowUpDue)) return 'follow-up 已过期';
  if (record.outreachSent) return '';
  if (!record.outreachPackPath) return '缺少 outreach pack';
  if (!record.assetsReady) return '缺少 outreach proof 资产';
  if (!record.emailDraftReady) return '缺少 cold outreach draft';
  if (!record.email && !record.customerEmail && !record.leadRecipientEmail) return '缺少明确的联系邮箱';
  return '';
}

function buildCounts(records) {
  return records.reduce((acc, record) => {
    acc.total += 1;
    acc[record.stageKey] = (acc[record.stageKey] || 0) + 1;
    if (record.previewUrl && record.assetsReady) acc.demoReady += 1;
    if (record.assetsReady) acc.assetsReady += 1;
    if (record.emailDraftReady) acc.emailDraftReady += 1;
    if (record.outreachSent) acc.outreachSent += 1;
    if (record.stageKey === 'follow_up_overdue') acc.followUpOverdue += 1;
    if (record.stageKey === 'replied' && !record.websiteTaskThreadId && record.paymentStatus !== 'paid') acc.repliedNeedsReview += 1;
    if (record.paymentStatus === 'paid' && !record.websiteTaskThreadId) acc.paidHandoffPending += 1;
    if (record.blocker) acc.blocked += 1;
    return acc;
  }, {
    total: 0,
    demoReady: 0,
    assetsReady: 0,
    emailDraftReady: 0,
    outreachSent: 0,
    followUpOverdue: 0,
    repliedNeedsReview: 0,
    paidHandoffPending: 0,
    blocked: 0,
  });
}

function isOverdue(dateString) {
  const value = String(dateString || '').trim();
  if (!value) return false;
  const due = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(due.getTime())) return false;
  const today = new Date();
  const utcToday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  return due < utcToday;
}
