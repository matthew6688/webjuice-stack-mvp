import { loadLeadRegistry } from './lead-registry.js';

export const LEAD_ADMIN_VIEWS = {
  all: { label: '全部' },
  new_lead: { label: '新线索' },
  researching: { label: '研究中' },
  needs_human: { label: '需人工' },
  discovery_ready: { label: '需人工' },
  needs_evidence: { label: '需人工' },
  ready_for_mockup: { label: '可做 Mockup' },
  mockup_building: { label: 'Mockup 制作中' },
  mockup_ready: { label: 'Mockup 就绪' },
  draft_ready: { label: '草稿就绪' },
  outreach_sent: { label: '已发送' },
  follow_up_due: { label: '待跟进' },
  replied: { label: '已回复' },
  bounced: { label: '退信' },
  paid_handoff: { label: '成交交接' },
  skipped: { label: '已跳过' },
  missing_assets: { label: '缺素材' },
  missing_email: { label: '缺草稿' },
};

export const LEAD_PIPELINE_STAGES = [
  { key: 'new_lead', label: '新线索' },
  { key: 'researching', label: '研究中' },
  { key: 'needs_human', label: '需人工' },
  { key: 'ready_for_mockup', label: '可做 Mockup' },
  { key: 'mockup_building', label: '制作中' },
  { key: 'mockup_ready', label: 'Mockup 就绪' },
  { key: 'draft_ready', label: '草稿就绪' },
  { key: 'outreach_sent', label: '已发送' },
  { key: 'follow_up_due', label: '待跟进' },
  { key: 'replied', label: '已回复' },
  { key: 'bounced', label: '退信' },
  { key: 'paid_handoff', label: '成交交接' },
  { key: 'skipped', label: '已跳过' },
];

export function loadLeadOutreachIndex(options = {}) {
  const registry = loadLeadRegistry(options);
  const list = registry.records
    .map((record) => finalizeLeadRecord(record))
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  const prospectRecords = list.filter((record) => !isCustomerSideRecord(record));
  const customerRecords = list.filter((record) => isCustomerSideRecord(record));

  return {
    records: list,
    prospectRecords,
    customerRecords,
    counts: buildCounts(list),
    prospectCounts: buildCounts(prospectRecords),
    customerCounts: buildCounts(customerRecords),
    pipelineStages: LEAD_PIPELINE_STAGES,
    updatedAt: registry.updatedAt,
  };
}

function isCustomerSideRecord(record) {
  return record.paymentStatus === 'paid' || Boolean(record.orderId) || record.pipelineStage === 'paid_handoff';
}

export function matchesLeadView(record, view = 'all') {
  switch (view) {
    case 'new_lead':
    case 'researching':
    case 'needs_human':
    case 'ready_for_mockup':
    case 'mockup_building':
    case 'mockup_ready':
    case 'draft_ready':
    case 'outreach_sent':
    case 'follow_up_due':
    case 'replied':
    case 'bounced':
    case 'paid_handoff':
    case 'skipped':
      return record.pipelineStage === view;
    case 'demo_ready':
      return Boolean(record.previewUrl && record.assetsReady);
    case 'needs_evidence':
    case 'discovery_ready':
      return record.pipelineStage === 'needs_human';
    case 'draft_ready':
      return record.pipelineStage === 'draft_ready';
    case 'outreach_sent':
      return record.pipelineStage === 'outreach_sent';
    case 'follow_up_due':
      return record.pipelineStage === 'follow_up_due';
    case 'replied':
      return record.pipelineStage === 'replied';
    case 'bounced':
      return record.pipelineStage === 'bounced';
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

function finalizeLeadRecord(input) {
  const record = { ...input };
  record.profileCompleteness = deriveProfileCompleteness(record);
  record.artifactStatus = deriveArtifactStatus(record);
  record.workTrace = deriveWorkTrace(record);
  record.humanDecision = deriveHumanDecision(record);
  record.aiAssessment = deriveAiAssessment(record);
  record.customerOpportunitySummary = deriveCustomerOpportunitySummary(record);
  record.openDesignBrief = deriveOpenDesignBrief(record);
  record.actionLog = deriveActionLog(record);
  record.skipReason = deriveSkipReason(record);
  record.pipelineStage = derivePipelineStage(record);
  record.pipelineLabel = deriveStageLabel(record.pipelineStage);
  record.pipelineTone = deriveStageTone(record.pipelineStage);
  record.stageKey = record.pipelineStage;
  record.stageLabel = record.pipelineLabel;
  record.stageTone = record.pipelineTone;
  record.nextAction = deriveNextAction(record);
  record.blocker = deriveBlocker(record);
  record.blockingReason = record.blocker;
  record.decisionActions = deriveDecisionActions(record);
  return record;
}

function derivePipelineStage(record) {
  if (isSkipped(record)) return 'skipped';
  if (record.humanDecision?.action === 'move_to_paid_handoff') return 'paid_handoff';
  if (record.paymentStatus === 'paid') return 'paid_handoff';
  if (record.humanDecision?.action === 'mark_replied') return 'replied';
  if (record.replyState === 'replied') return 'replied';
  if (record.bounceState === 'bounced') return 'bounced';
  if (record.humanDecision?.action === 'approve_mockup') return 'mockup_building';
  if (record.humanDecision?.action === 'research_more') return 'needs_human';
  if (record.nextFollowUpDue) return 'follow_up_due';
  if (record.outreachSent) return 'outreach_sent';
  if (record.emailDraftReady && record.assetsReady && record.previewUrl) return 'draft_ready';
  if (record.assetsReady && record.previewUrl) return 'mockup_ready';
  if (record.outreachPackPath || record.previewUrl) return 'mockup_building';
  if (isReadyForMockup(record)) return 'ready_for_mockup';
  if (needsHuman(record)) return 'needs_human';
  if (isResearching(record)) return 'researching';
  return 'new_lead';
}

function deriveStageLabel(stageKey) {
  return {
    paid_handoff: '成交交接',
    replied: '已回复',
    bounced: '退信',
    follow_up_due: '待跟进',
    outreach_sent: '已发送',
    draft_ready: '草稿就绪',
    mockup_ready: 'Mockup 就绪',
    mockup_building: '制作中',
    ready_for_mockup: '可做 Mockup',
    needs_human: '需人工',
    needs_evidence: '需人工',
    discovery_ready: '需人工',
    researching: '研究中',
    skipped: '已跳过',
    new_lead: '新线索',
  }[stageKey] || '新线索';
}

function deriveStageTone(stageKey) {
  return {
    paid_handoff: 'ready',
    replied: 'ready',
    bounced: 'alert',
    follow_up_due: 'warn',
    outreach_sent: 'working',
    draft_ready: 'working',
    mockup_ready: 'ready',
    mockup_building: 'working',
    ready_for_mockup: 'info',
    needs_human: 'warn',
    needs_evidence: 'warn',
    discovery_ready: 'warn',
    researching: 'working',
    skipped: 'skip',
    new_lead: 'info',
  }[stageKey] || 'info';
}

function deriveNextAction(record) {
  if (record.paymentStatus === 'paid') {
    return {
      label: record.websiteTaskThreadId ? '进入正式项目' : '创建正式项目',
      reason: record.websiteTaskThreadId
        ? '客户已经付款，下一步应该在 website-projects 里推进 build/review/live。'
        : '客户已经付款，但还没有 website-projects workspace。先补正式项目交接，再继续 build/review/live。',
    };
  }
  if (record.replyState === 'replied') {
    return {
      label: '处理 prospect 回复',
      reason: record.outreachChannelRecommendation
        ? `已经收到回复。原计划通道是 ${record.outreachChannelRecommendation}，下一步应该把回复结果落回 case / forum，并决定是否推进成交。`
        : '已经收到回复，下一步应该把回复结果落回 case / forum，并决定是否推进成交。',
    };
  }
  if (record.bounceState === 'bounced') {
    return {
      label: '修正邮箱或替换发送通道',
      reason: 'cold outreach 已记录 bounce，下一步应该核对邮箱、名单质量，或换发送平台重新触达。',
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
  if (isSkipped(record)) {
    return {
      label: '保持跳过',
      reason: record.skipReason || '这个 lead 暂时没有足够突破口，已从主动推进队列移出。',
    };
  }
  if (record.pipelineStage === 'ready_for_mockup') {
    return {
      label: '创建 Mockup',
      reason: record.leadBuildMode === 'redesign'
        ? '已有联系方式和基础证据，可以让 AI 生成 redesign preview。生成前仍保留人工确认按钮。'
        : '已有联系方式和基础业务信息，可以生成 teaser preview 或 starter mockup。',
    };
  }
  if (record.pipelineStage === 'needs_human') {
    return {
      label: '人工判断',
      reason: record.aiAssessment.reason || 'AI 没有足够把握直接推进或跳过，需要人工看证据后决定。',
    };
  }
  if (record.pipelineStage === 'researching') {
    return {
      label: '等待自动研究',
      reason: '线索已经入库，但还没有研究结果。下一步应自动跑搜索、官网、地图、截图或 OCR，完成后只进入「可做 Mockup」「已跳过」或「需人工」。',
    };
  }
  if (record.pipelineStage === 'new_lead') {
    return {
      label: '自动建档并研究',
      reason: '这是刚进入系统或缺少 lead 研究产物的线索。下一步不是人工猜，而是先自动建档、搜索、打开官网/地图并记录证据。',
    };
  }
  if (!record.outreachPackPath) {
    return {
      label: '生成 outreach pack',
      reason: record.outreachDiagnosis
        ? `还没有 demo preview 与 proof pack。当前诊断：${record.outreachDiagnosis}`
        : '还没有 demo preview 与 proof pack，无法进入冷启动触达。',
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
      reason: record.outreachChannelRecommendation
        ? `已有 demo 与 proof，但还没有可发送草稿。建议优先按 ${record.outreachChannelRecommendation} 通道准备。`
        : '已有 demo 与 proof，但还没有可发送的 outreach 邮件草稿。',
    };
  }
  return {
    label: '发送或跟进 outreach',
    reason: record.outreachPrimaryProofPoint
      ? `demo、proof、draft 都在。主卖点：${record.outreachPrimaryProofPoint}`
      : 'demo、proof、draft 都在，可以用外部 cold outreach 系统发出或继续跟进。',
  };
}

function deriveBlocker(record) {
  if (isSkipped(record)) return record.skipReason || 'AI / 人工判断暂时没有明确突破口';
  if (record.paymentStatus === 'paid') return '';
  if (record.replyState === 'replied') return '';
  if (record.bounceState === 'bounced') return '';
  if (record.outreachSent) return '';
  if (record.pipelineStage === 'researching') return '等待 AI 自动研究';
  if (record.pipelineStage === 'needs_human') return 'AI 不确定，需要人工决定';
  if (!record.outreachPackPath) return '缺少 Mockup / 触达包';
  if (!record.assetsReady) return '缺少截图或视频';
  if (!record.emailDraftReady) return '缺少冷启动草稿';
  if (!record.email && !record.customerEmail && !record.leadRecipientEmail) return '缺少明确的联系邮箱';
  return '';
}

function buildCounts(records) {
  return records.reduce((acc, record) => {
    acc.total += 1;
    acc[record.pipelineStage] = (acc[record.pipelineStage] || 0) + 1;
    if (record.previewUrl && record.assetsReady) acc.demoReady += 1;
    if (record.assetsReady) acc.assetsReady += 1;
    if (record.emailDraftReady) acc.emailDraftReady += 1;
    if (record.outreachSent) acc.outreachSent += 1;
    if (record.pipelineStage === 'researching') acc.researching += 1;
    if (record.pipelineStage === 'needs_human') acc.needsHuman += 1;
    if (record.pipelineStage === 'follow_up_due') acc.followUpDue += 1;
    if (record.pipelineStage === 'follow_up_overdue') acc.followUpOverdue += 1;
    if (record.pipelineStage === 'replied') acc.replied += 1;
    if (record.pipelineStage === 'bounced') acc.bounced += 1;
    if (record.pipelineStage === 'paid_handoff') acc.paidHandoff += 1;
    if (record.pipelineStage === 'skipped') acc.skipped += 1;
    if (record.blocker) acc.blocked += 1;
    return acc;
  }, {
    total: 0,
    demoReady: 0,
    assetsReady: 0,
    emailDraftReady: 0,
    outreachSent: 0,
    discoveryReady: 0,
    researching: 0,
    needsHuman: 0,
    followUpDue: 0,
    followUpOverdue: 0,
    replied: 0,
    bounced: 0,
    paidHandoff: 0,
    skipped: 0,
    blocked: 0,
  });
}

function isResearching(record) {
  return Boolean(
    !record.outreachPackPath
    && record.leadIntakePath
    && !record.leadResearchPath
    && !record.leadOpsPath
    && record.leadGateStatus !== 'blocked_unreachable'
  );
}

function isReadyForMockup(record) {
  if (!hasContactPath(record)) return false;
  if (!['ready_for_preview', 'ready_for_redesign_preview', 'ready_for_teaser'].includes(record.leadPreviewability)) return false;
  if (record.leadReadyToBuildStatus === 'blocked') return false;
  if (hasWeakCurrentSiteAudit(record)) return false;
  return hasEvidence(record) || record.outreachBriefPath;
}

function needsHuman(record) {
  if (!record.leadIntakePath && !record.leadResearchPath && !record.leadOpsPath) return false;
  if (isReadyForMockup(record)) return false;
  if (isSkipped(record)) return false;
  return Boolean(record.leadResearchPath || record.leadOpsPath || record.leadPreviewability || hasContactPath(record));
}

function hasContactPath(record) {
  return Boolean(record.email || record.customerEmail || record.leadRecipientEmail || record.phone || record.contactPageUrl || record.websiteUrl);
}

function hasEvidence(record) {
  return Boolean(
    record.websiteSurveyPath
    || record.contentPath
    || record.redesignCheckPath
    || (Array.isArray(record.evidenceSources) && record.evidenceSources.length > 0)
    || record.googleMapsUrl
    || record.googlePlaceId
  );
}

function hasWeakCurrentSiteAudit(record) {
  const score = Number(record.currentSiteAuditScore || 0);
  const issues = Array.isArray(record.currentSiteAuditIssues) ? record.currentSiteAuditIssues : [];
  const verdict = String(record.currentSiteAuditVerdict || '');
  return Boolean(
    record.currentSiteAuditPath
    && score >= 80
    && issues.length <= 1
    && !verdict.includes('clear')
  );
}

function hasStrongCurrentSiteOpportunity(record) {
  const score = Number(record.currentSiteAuditScore || 0);
  const issues = Array.isArray(record.currentSiteAuditIssues) ? record.currentSiteAuditIssues : [];
  const verdict = String(record.currentSiteAuditVerdict || '');
  return Boolean(
    record.currentSiteAuditPath
    && (score <= 72 || issues.length >= 2 || verdict.includes('clear'))
  );
}

function isSkipped(record) {
  return record.humanDecision?.action === 'skip_lead'
    || ['skip', 'skipped', 'not_worth_pursuing'].includes(record.leadGateStatus)
    || record.leadReadyToBuildStatus === 'skip'
    || record.leadGateStatus === 'blocked_unreachable'
    || record.leadPreviewability === 'blocked_unreachable'
    || (!hasContactPath(record) && Boolean(record.leadResearchPath || record.leadOpsPath));
}

function deriveSkipReason(record) {
  if (record.humanDecision?.action === 'skip_lead') return record.humanDecision.note || '人工判断跳过。';
  if (!hasContactPath(record) && (record.leadIntakePath || record.leadResearchPath)) return '没有邮箱、电话、网站或联系页，无法触达。';
  if (record.leadGateStatus === 'blocked_unreachable') return '无法触达：缺少有效联系方式。';
  if (record.leadReadyToBuildStatus === 'skip') return record.leadRecommendedAction || 'AI 判断暂时不值得继续。';
  return '';
}

function deriveAiAssessment(record) {
  if (isSkipped(record)) {
    return {
      result: 'skip',
      label: 'AI 结论：跳过',
      confidence: record.humanDecision?.action === 'skip_lead' ? '人工确认' : '高',
      reason: deriveSkipReason(record) || '无法证明我们能提供明确价值，继续推进会浪费时间。',
    };
  }
  if (isReadyForMockup(record)) {
    return {
      result: 'ready_for_mockup',
      label: 'AI 结论：可做 Mockup',
      confidence: hasStrongCurrentSiteOpportunity(record) ? '高' : (hasEvidence(record) ? '中' : '低'),
      reason: deriveCustomerOpportunitySummary(record),
    };
  }
  if (isResearching(record)) {
    return {
      result: 'researching',
      label: 'AI 结论：研究中',
      confidence: '未完成',
      reason: '线索刚入库，还没有足够研究产物。系统应该自动补搜索、官网、地图、截图或 OCR。',
    };
  }
  if (!record.leadIntakePath && !record.leadResearchPath && !record.leadOpsPath) {
    return {
      result: 'new_lead',
      label: 'AI 结论：等待研究',
      confidence: '未开始',
      reason: '还没有 lead 研究产物。系统应该先自动建档并补搜索、官网、地图、截图或 OCR 证据。',
    };
  }
  return {
    result: 'needs_human',
    label: 'AI 结论：需人工',
    confidence: '不确定',
    reason: hasWeakCurrentSiteAudit(record)
      ? `现站 audit ${record.currentSiteAuditScore}分，只发现少量问题。AI 不应该假装很有把握，需要人工判断是否真的值得做 mockup。`
      : 'AI 没有把握直接判断「跳过」或「可做 Mockup」。请看证据和工作记录后点击决策按钮。',
  };
}

function deriveCustomerOpportunitySummary(record) {
  const issues = Array.isArray(record.currentSiteAuditIssues) ? record.currentSiteAuditIssues.filter(Boolean) : [];
  const improvements = Array.isArray(record.currentSiteImprovements) ? record.currentSiteImprovements.filter(Boolean) : [];
  const score = record.currentSiteAuditScore ? `${record.currentSiteAuditScore}分` : '';
  if (record.currentSiteAuditPath && issues.length) {
    const issueText = issues.slice(0, 2).join('；');
    const improvementText = improvements.length ? ` 可改进：${improvements.slice(0, 2).join('；')}` : '';
    return `现站 audit ${score || '已完成'}，主要问题：${issueText}.${improvementText}`;
  }
  if (record.currentSiteAuditPath) {
    return `现站 audit ${score || '已完成'}，暂时没有发现强突破口。需要人工判断是否继续，或者先跳过。`;
  }
  if (record.outreachDiagnosis) return record.outreachDiagnosis;
  if (record.leadBuildMode === 'redesign') return '需要先补官网截图、正文保存和 audit 报告，再判断是否有明确改版价值。';
  return '已有基础业务信息，但还需要补证据后再判断 mockup 价值。';
}

function deriveOpenDesignBrief(record) {
  const issues = Array.isArray(record.currentSiteAuditIssues) ? record.currentSiteAuditIssues.filter(Boolean) : [];
  const improvements = Array.isArray(record.currentSiteImprovements) ? record.currentSiteImprovements.filter(Boolean) : [];
  return {
    business: record.company || record.businessName || record.clientSlug,
    industry: record.niche || record.leadFamilyId || '行业待补',
    location: record.city || record.address || record.domain || '地区待补',
    currentWebsite: record.officialWebsiteUrl || record.websiteUrl || '',
    contactPage: record.contactPageUrl || '',
    contactProfile: {
      email: record.email || record.customerEmail || record.leadRecipientEmail || '',
      phone: record.phone || '',
      contactPage: record.contactPageUrl || '',
      socialAccounts: Array.isArray(record.socialAccounts) ? record.socialAccounts : [],
    },
    services: Array.isArray(record.leadCoreServices) ? record.leadCoreServices.slice(0, 5) : [],
    heroAngle: record.leadHeroAngle || record.outreachPrimaryProofPoint || '',
    auditFocus: issues.slice(0, 3),
    improvements: improvements.slice(0, 3),
    primaryCta: record.leadPrimaryCta || 'Call now',
    screenshot: record.currentSitePublicScreenshotUrl || record.currentSiteScreenshotPath || '',
  };
}

function deriveHumanDecision(record) {
  const decision = (record.leadNotes || []).find((note) => note.action);
  return decision ? {
    action: decision.action,
    note: decision.note || '',
    actor: decision.actor || '',
    createdAt: decision.createdAt || '',
  } : null;
}

function deriveProfileCompleteness(record) {
  const checks = [
    ['business', record.company || record.businessName],
    ['industry', record.niche || record.leadFamilyId],
    ['email', record.email || record.customerEmail || record.leadRecipientEmail],
    ['phone', record.phone],
    ['contact_page', record.contactPageUrl],
    ['social_accounts', Array.isArray(record.socialAccounts) && record.socialAccounts.length],
    ['website', record.websiteUrl || record.contactPageUrl],
    ['location', record.address || record.googleMapsUrl || record.googlePlaceId],
  ];
  const done = checks.filter(([, value]) => Boolean(value)).length;
  return {
    done,
    total: checks.length,
    percent: Math.round((done / checks.length) * 100),
    missing: checks.filter(([, value]) => !value).map(([key]) => translateValue(key)),
  };
}

function deriveArtifactStatus(record) {
  return {
    profile: Boolean(record.leadIntakePath || record.company),
    research: Boolean(record.leadResearchPath),
    evidence: hasEvidence(record),
    currentSiteAudit: Boolean(record.currentSiteAuditPath),
    mockup: Boolean(record.previewUrl || record.outreachPackPath),
    proof: Boolean(record.assetsReady),
    draft: Boolean(record.emailDraftReady || record.outreachBriefPath),
    sent: Boolean(record.outreachSent),
    reply: record.replyState === 'replied',
    discord: Boolean(record.salesThreadId || record.salesWorkspaceChannelId),
  };
}

function deriveActionLog(record) {
  const entries = [];
  const push = (label, detail, at = '') => entries.push({ label, detail, at });
  if (record.leadIntakePath) push('建立线索档案', formatSource(record.leadSourceType || 'manual'), record.updatedAt);
  if (record.leadResearchPath) push('完成背景研究', record.leadPreviewability ? `结论：${translateValue(record.leadPreviewability)}；服务：${formatServices(record)}` : '已整理业务信息', record.updatedAt);
  if (record.redesignCheckPath) push('检查现有网站', record.leadRedesignDecision ? `判断：${translateValue(record.leadRedesignDecision)}` : '已记录 redesign 判断', record.updatedAt);
  if (record.leadReadyToBuildPath) push('整理建站输入', record.leadReadyToBuildStatus ? `状态：${translateValue(record.leadReadyToBuildStatus)}` : '已生成可交接输入', record.updatedAt);
  if (record.leadOpsPath) push('运行线索流程', record.leadFamilyId ? `分类：${translateValue(record.leadFamilyId)}；下一步：${record.leadRecommendedAction || record.leadReadyToBuildStatus || '待确认'}` : '已完成自动判断', record.updatedAt);
  if (record.outreachBriefPath) push('生成触达策略', record.outreachChannelRecommendation ? `建议渠道：${translateValue(record.outreachChannelRecommendation)}；突破口：${record.outreachPrimaryProofPoint || '待复写'}` : '已生成诊断和冷启动话术', record.updatedAt);
  if (record.currentSiteAuditPath) push('完成现站审计', `${record.currentSiteAuditVerdict || '已生成报告'}${record.currentSiteAuditScore ? ` · ${record.currentSiteAuditScore}分` : ''}`, record.updatedAt);
  if (record.outreachPackPath) push('生成 Mockup 包', record.previewUrl ? '已有预览链接' : '已开始准备预览', record.updatedAt);
  if (record.latestEmailArtifact) push('生成邮件草稿', record.latestEmailArtifact.subject || '已生成可发送草稿', record.latestEmailArtifact.generatedAt);
  if (record.outreachSent) push('记录已发送', `${translateValue(record.outreachProvider || 'provider')} ${record.outreachSendId || ''}`.trim(), record.outreachSentAt);
  if (record.replyState === 'replied') push('收到回复', record.replySnippet || 'provider / 人工记录已回复', record.updatedAt);
  if (record.bounceState === 'bounced') push('退信', '需要修正联系方式或换渠道', record.updatedAt);
  for (const note of (record.leadNotes || []).slice(0, 3)) {
    push(note.action ? `人工决定：${translateValue(note.action)}` : '人工备注', note.note || '', note.createdAt);
  }
  if (record.aiAssessment) push(record.aiAssessment.label, `${record.aiAssessment.confidence}：${record.aiAssessment.reason}`, record.updatedAt);
  return entries.slice(0, 8);
}

function deriveWorkTrace(record) {
  const entries = [];
  const push = (tool, action, evidence = '') => entries.push({ tool, action, evidence });
  if (record.leadIntakePath) push('lead-intake skill', `输出：来源=${formatSource(record.leadSourceType || 'manual')}；联系=${summarizeContact(record)}`, record.leadIntakePath);
  if (record.leadResearchPath) push('lead-research skill', `输出：${translateValue(record.leadPreviewability) || '已整理业务信息'}；服务=${formatServices(record)}`, record.leadResearchPath);
  if (record.redesignCheckPath) push('redesign-check skill', `输出：${translateValue(record.leadRedesignDecision) || '已记录 redesign 判断'}`, record.redesignCheckPath);
  if (record.leadReadyToBuildPath) push('ready-to-build skill', `输出：${translateValue(record.leadReadyToBuildStatus) || '可交接输入'}；模式=${translateValue(record.leadBuildMode) || record.leadBuildMode || '待定'}`, record.leadReadyToBuildPath);
  if (record.leadOpsPath) push('lead-ops skill', `输出：${translateValue(record.leadFamilyId) || '分类完成'}；建议=${record.leadRecommendedAction || '待确认'}`, record.leadOpsPath);
  if (record.outreachBriefPath) push('outreach-brief skill', `输出：渠道=${translateValue(record.outreachChannelRecommendation) || '待定'}；草稿=模板级，需要复写`, record.outreachBriefPath);
  if (record.currentSiteAuditPath) push('Playwright browser audit', `输出：截图+HTML/text+报告；${record.currentSiteAuditVerdict || '已审计'}${record.currentSiteAuditScore ? ` ${record.currentSiteAuditScore}分` : ''}`, record.currentSiteAuditPath);
  if (record.currentSiteScreenshotPath) push('Current site screenshot', '桌面截图已保存到 repo', record.currentSiteScreenshotPath);
  if (record.currentSiteTextPath) push('Current site text', '当前网站正文文本已保存到 repo', record.currentSiteTextPath);
  if (record.googleMapsUrl || record.googlePlaceId) push('Google Maps / Places', '核对地图或商家资料', record.googleMapsUrl || record.googlePlaceId);
  if (record.officialWebsiteUrl || record.websiteUrl) push('Browser / official site', '打开官网或已有网站，检查改版机会', record.officialWebsiteUrl || record.websiteUrl);
  for (const source of record.evidenceSources || []) {
    push(translateEvidenceSource(source.sourceType), source.sourceUrl ? '读取证据来源' : '记录证据来源', source.sourceUrl || source.sourceType || '');
  }
  if (!entries.length) push('等待自动研究', '还没有工具调用记录', '');
  return entries.slice(0, 8);
}

function summarizeContact(record) {
  const parts = [];
  if (record.email || record.customerEmail || record.leadRecipientEmail) parts.push('邮箱');
  if (record.phone) parts.push('电话');
  if (record.websiteUrl) parts.push('网站');
  if (record.contactPageUrl) parts.push('联系页');
  if (Array.isArray(record.socialAccounts) && record.socialAccounts.length) parts.push('社媒');
  return parts.length ? parts.join('/') : '无';
}

function formatServices(record) {
  return Array.isArray(record.leadCoreServices) && record.leadCoreServices.length
    ? record.leadCoreServices.slice(0, 3).join('、')
    : (record.niche || record.leadFamilyId || '待补');
}

function deriveDecisionActions(record) {
  if (['paid_handoff', 'outreach_sent'].includes(record.pipelineStage)) return [];
  if (record.pipelineStage === 'skipped') {
    return [{ action: 'reopen_lead', label: '重新打开', tone: 'secondary', note: '重新打开线索，回到研究队列。' }];
  }
  if (record.pipelineStage === 'replied') {
    return [
      { action: 'move_to_paid_handoff', label: '进入成交交接', tone: 'primary', note: '客户已回复，准备进入正式项目交接。' },
      { action: 'skip_lead', label: '跳过', tone: 'secondary', note: '回复不合适或没有需求，跳过该线索。' },
    ];
  }
  if (record.pipelineStage === 'follow_up_due') {
    return [
      { action: 'mark_followed_up', label: '已跟进', tone: 'primary', note: '已执行本次 follow-up。' },
      { action: 'mark_replied', label: '标记已回复', tone: 'secondary', note: '人工确认客户已经回复。' },
      { action: 'skip_lead', label: '跳过', tone: 'secondary', note: '连续跟进无明确机会，跳过该线索。' },
    ];
  }
  if (record.pipelineStage === 'ready_for_mockup') {
    return [
      { action: 'approve_mockup', label: '创建 Mockup', tone: 'primary', note: '人工确认这个 lead 有明确价值，开始创建 Mockup。' },
      { action: 'research_more', label: '继续研究', tone: 'secondary', note: '需要再补充更多证据后再决定是否创建 Mockup。' },
      { action: 'skip_lead', label: '跳过', tone: 'secondary', note: '没有足够明确的突破口，跳过该线索。' },
    ];
  }
  if (record.pipelineStage === 'needs_human') {
    return [
      { action: 'approve_mockup', label: '创建 Mockup', tone: 'primary', note: '人工看过证据，确认这个 lead 有明确价值，开始创建 Mockup。' },
      { action: 'skip_lead', label: '跳过', tone: 'secondary', note: '人工看过证据，仍没有明确突破口，跳过该线索。' },
      { action: 'research_more', label: '再研究', tone: 'secondary', note: '人工认为还需要补充搜索、官网、地图、截图或 OCR 证据。' },
    ];
  }
  if (record.pipelineStage === 'researching') {
    return [
      { action: 'research_more', label: '开始/继续研究', tone: 'primary', note: '触发或安排自动研究，补充搜索、官网、地图、截图或 OCR 证据。' },
      { action: 'skip_lead', label: '跳过', tone: 'secondary', note: '线索明显不符合目标或不可触达，跳过该线索。' },
    ];
  }
  if (record.pipelineStage === 'new_lead') {
    return [
      { action: 'research_more', label: '开始研究', tone: 'primary', note: '触发或安排自动建档和研究，补充搜索、官网、地图、截图或 OCR 证据。' },
      { action: 'skip_lead', label: '跳过', tone: 'secondary', note: '线索明显不符合目标或不可触达，跳过该线索。' },
    ];
  }
  return [
    { action: 'research_more', label: '继续研究', tone: 'primary', note: '继续补充搜索、官网、地图、截图或 OCR 证据。' },
    { action: 'skip_lead', label: '跳过', tone: 'secondary', note: '当前没有明确突破口，跳过该线索。' },
  ];
}

function translateEvidenceSource(sourceType) {
  return {
    google_places: 'Google Places',
    official_site: 'Browser / official site',
    pdf: 'PDF reader / OCR',
    image_ocr: 'Image OCR',
    generated: 'AI placeholder',
    manual: 'Manual input',
  }[sourceType] || sourceType || 'Evidence source';
}

function formatSource(source) {
  return {
    manual: '手动录入',
    google_search: 'Google 搜索',
    google_maps: 'Google Maps',
    website_intake: '网站表单',
    scrape: '批量抓取',
  }[source] || source || '未知来源';
}

function translateValue(value) {
  return {
    business: '公司名称',
    industry: '行业',
    contact: '联系方式',
    email: '邮箱',
    phone: '电话',
    contact_page: '联系页',
    social_accounts: '社媒账号',
    website: '网站',
    location: '地址',
    field_service: '本地上门服务',
    professional_service: '专业服务',
    redesign: '改版',
    starter: '新站',
    teaser: '预览试探',
    ready_for_preview: '可做预览',
    ready_for_redesign_preview: '可做改版预览',
    ready_for_teaser: '可做试探预览',
    redesign_preview: '做改版预览',
    needs_more_research: '还需要更多研究',
    blocked_unreachable: '不可触达',
    sms_or_call: '短信或电话',
    email: '邮件',
    agentic_email: 'Agentic Email',
    provider: '发送服务',
    skip_lead: '跳过',
    reopen_lead: '重新打开',
    research_more: '继续研究',
    approve_mockup: '创建 Mockup',
    mark_followed_up: '已跟进',
    mark_replied: '已回复',
    move_to_paid_handoff: '成交交接',
  }[value] || value || '';
}
