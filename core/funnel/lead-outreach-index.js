import { loadLeadRegistry } from './lead-registry.js';
import { stageLabel, stageTone } from './stage-config.js';

export const LEAD_ADMIN_VIEWS = {
  all: { label: '全部' },
  new_lead: { label: stageLabel('new_lead') },
  researching: { label: stageLabel('researching') },
  needs_human: { label: stageLabel('needs_human') },
  discovery_ready: { label: stageLabel('discovery_ready') },
  needs_evidence: { label: stageLabel('needs_evidence') },
  ready_for_mockup: { label: stageLabel('ready_for_mockup') },
  mockup_building: { label: stageLabel('mockup_building') },
  mockup_ready: { label: stageLabel('mockup_ready') },
  draft_ready: { label: stageLabel('draft_ready') },
  outreach_sent: { label: stageLabel('outreach_sent') },
  follow_up_due: { label: stageLabel('follow_up_due') },
  replied: { label: stageLabel('replied') },
  bounced: { label: stageLabel('bounced') },
  paid_handoff: { label: stageLabel('paid_handoff') },
  skipped: { label: stageLabel('skipped') },
  missing_assets: { label: '缺素材' },
  missing_email: { label: '缺草稿' },
};

export const LEAD_PIPELINE_STAGES = [
  { key: 'new_lead', label: stageLabel('new_lead') },
  { key: 'researching', label: stageLabel('researching') },
  { key: 'needs_human', label: stageLabel('needs_human') },
  { key: 'ready_for_mockup', label: stageLabel('ready_for_mockup') },
  { key: 'mockup_building', label: stageLabel('mockup_building') },
  { key: 'mockup_ready', label: stageLabel('mockup_ready') },
  { key: 'draft_ready', label: stageLabel('draft_ready') },
  { key: 'outreach_sent', label: stageLabel('outreach_sent') },
  { key: 'follow_up_due', label: stageLabel('follow_up_due') },
  { key: 'replied', label: stageLabel('replied') },
  { key: 'bounced', label: stageLabel('bounced') },
  { key: 'paid_handoff', label: stageLabel('paid_handoff') },
  { key: 'skipped', label: stageLabel('skipped') },
];

export function loadLeadOutreachIndex(options = {}) {
  const registry = loadLeadRegistry(options);
  const list = dedupeLeadRecords(registry.records)
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

function dedupeLeadRecords(records = []) {
  const byKey = new Map();
  const output = [];
  for (const record of records) {
    const key = duplicateLeadKey(record);
    if (!key || record.paymentStatus === 'paid' || record.orderId) {
      output.push(record);
      continue;
    }
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, record);
      output.push(record);
      continue;
    }
    const winner = preferredDuplicateRecord(existing, record);
    if (winner !== existing) {
      byKey.set(key, record);
      const index = output.indexOf(existing);
      if (index >= 0) output[index] = record;
    }
  }
  return output;
}

function duplicateLeadKey(record) {
  const name = String(record.businessName || record.company || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const contact = String(record.phone || record.email || record.address || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  return name && contact ? `${name}|${contact}` : '';
}

function preferredDuplicateRecord(a, b) {
  const score = (record) => [
    record.discordTaskThreadPath,
    record.evidenceSources?.length,
    record.leadOpsPath,
    record.outreachBriefPath,
    record.clientSlug?.includes(record.city ? String(record.city).toLowerCase().split(/\s+/)[0] : '____'),
  ].filter(Boolean).length;
  if (score(b) > score(a)) return b;
  return String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')) > 0 ? b : a;
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
      return hasMockupReady(record);
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
      return !hasMockupReady(record);
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
  if (record.humanDecision?.action === 'research_more') return 'needs_human';
  if (record.nextFollowUpDue) return 'follow_up_due';
  if (record.outreachSent) return 'outreach_sent';
  if (record.emailDraftReady && hasMockupReady(record)) return 'draft_ready';
  if (hasMockupReady(record)) return 'mockup_ready';
  if (record.humanDecision?.action === 'approve_mockup') return 'mockup_building';
  if (record.outreachPackPath || record.previewUrl || record.openDesignRunRequestStatus === 'started') return 'mockup_building';
  if (isReadyForMockup(record)) return 'ready_for_mockup';
  if (needsHuman(record)) return 'needs_human';
  if (isResearching(record)) return 'researching';
  return 'new_lead';
}

function deriveStageLabel(stageKey) {
  return stageLabel(stageKey) || '新线索';
}

function deriveStageTone(stageKey) {
  return stageTone(stageKey);
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
      label: '批准进入 Mockup 队列',
      reason: record.leadBuildMode === 'redesign'
        ? '已有联系方式和基础证据，可以让 AI 生成 redesign preview。生成前仍保留人工确认按钮。'
        : '已有联系方式和基础业务信息，可以生成 teaser preview 或 starter mockup。',
    };
  }
  if (record.pipelineStage === 'mockup_ready') {
    const draftReady = Boolean(record.emailDraftReady || record.outreachBriefPath);
    return {
      label: draftReady ? '确认并发送触达草稿' : '生成 outreach pack',
      reason: draftReady
        ? 'Open Design concept 已 native 结束并通过质量审计；下一步确认触达文案和发送渠道。'
        : 'Open Design concept 已 native 结束并通过质量审计；下一步生成截图、预览链接和 cold outreach 草稿。',
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
  if (!record.outreachPackPath && !hasMockupReady(record)) {
    return {
      label: '生成 outreach pack',
      reason: record.outreachDiagnosis
        ? `还没有 demo preview 与 proof pack。当前诊断：${record.outreachDiagnosis}`
        : '还没有 demo preview 与 proof pack，无法进入冷启动触达。',
    };
  }
  if (!record.assetsReady && !hasMockupReady(record)) {
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
  if (!record.outreachPackPath && !hasMockupReady(record)) return '缺少 Mockup / 触达包';
  if (!record.assetsReady && !hasMockupReady(record)) return '缺少截图或视频';
  if (!record.emailDraftReady && !record.outreachBriefPath) return '缺少冷启动草稿';
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
    && (record.leadIntakePath || record.discoveryStorePath)
    && !record.leadResearchPath
    && !record.leadOpsPath
    && record.leadGateStatus !== 'blocked_unreachable'
  );
}

function isReadyForMockup(record) {
  if (record.leadAiConclusion === 'ready_for_mockup' && hasContactPath(record) && !hasWeakCurrentSiteAudit(record)) return true;
  if (!hasContactPath(record)) return false;
  if (!['ready_for_preview', 'ready_for_redesign_preview', 'ready_for_teaser'].includes(record.leadPreviewability)) return false;
  if (record.leadReadyToBuildStatus === 'blocked') return false;
  if (hasWeakCurrentSiteAudit(record)) return false;
  if (needsMoreImageLeadDiscovery(record)) return false;
  return hasEvidence(record) || record.outreachBriefPath;
}

function needsMoreImageLeadDiscovery(record) {
  if (record.leadSourceType !== 'image_ocr') return false;
  if ((record.websiteUrl || record.officialWebsiteUrl) && !record.currentSiteAuditPath) return true;
  if (!hasImageLeadSearchMatch(record)) return true;
  if (!(record.address || record.city || record.googleMapsUrl || record.googlePlaceId)) return true;
  return false;
}

function hasImageLeadSearchMatch(record) {
  return (record.evidenceSources || []).some((source) => {
    const extractor = String(source.extractor || '');
    const sourceType = String(source.sourceType || '');
    const key = String(source.key || '');
    return extractor === 'web_search_phone_match'
      || extractor === 'google_places'
      || sourceType === 'google_places'
      || sourceType === 'official_site'
      || key === 'opportunity.noDedicatedWebsiteFound';
  });
}

function needsHuman(record) {
  if (record.leadAiConclusion === 'needs_human') return true;
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
  const findings = Array.isArray(record.currentSiteAuditFindings) ? record.currentSiteAuditFindings : [];
  const meaningfulFindings = findings.filter((finding) => finding.severity !== 'low');
  const verdict = String(record.currentSiteAuditVerdict || '');
  if (record.currentSiteSalesDecision === 'skip_or_monitor') return true;
  return Boolean(
    record.currentSiteAuditPath
    && score >= 80
    && meaningfulFindings.length === 0
    && !verdict.includes('clear')
  );
}

function hasStrongCurrentSiteOpportunity(record) {
  const score = Number(record.currentSiteAuditScore || 0);
  const findings = Array.isArray(record.currentSiteAuditFindings) ? record.currentSiteAuditFindings : [];
  const meaningfulFindings = findings.filter((finding) => finding.severity !== 'low');
  const verdict = String(record.currentSiteAuditVerdict || '');
  if (record.currentSiteSalesDecision === 'build_mockup') return true;
  if (record.currentSiteSalesDecision === 'skip_or_monitor') return false;
  return Boolean(
    record.currentSiteAuditPath
    && (score <= 72 || meaningfulFindings.length >= 2 || verdict.includes('clear'))
  );
}

function isSkipped(record) {
  return record.humanDecision?.action === 'skip_lead'
    || record.leadAiConclusion === 'skip'
    || record.currentSiteSalesDecision === 'skip_or_monitor'
    || ['skip', 'skipped', 'not_worth_pursuing'].includes(record.leadGateStatus)
    || record.leadReadyToBuildStatus === 'skip'
    || record.leadGateStatus === 'blocked_unreachable'
    || record.leadPreviewability === 'blocked_unreachable'
    || (!hasContactPath(record) && Boolean(record.leadResearchPath || record.leadOpsPath));
}

function deriveSkipReason(record) {
  if (record.humanDecision?.action === 'skip_lead') return record.humanDecision.note || '人工判断跳过。';
  if (record.currentSiteSalesDecision === 'skip_or_monitor') return '现站审计只发现低影响问题，没有足够强的销售突破口。';
  if (record.leadAiConclusion === 'skip') return 'AI 判断跳过：没有足够明确的价值突破口，或缺少真实触达路径。';
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
      confidence: record.leadAiConfidence || (hasStrongCurrentSiteOpportunity(record) ? '高' : (hasEvidence(record) ? '中' : '低')),
      score: Number.isFinite(record.leadAiScore) ? record.leadAiScore : null,
      reason: record.openDesignPrompt
        ? `${deriveCustomerOpportunitySummary(record)} 已生成 Open Design 输入，可用 AI 补全 demo 内容，但联系方式必须保持真实。`
        : deriveCustomerOpportunitySummary(record),
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
    reason: needsMoreImageLeadDiscovery(record)
      ? deriveImageLeadDiscoveryReason(record)
      : hasWeakCurrentSiteAudit(record)
        ? `现站 audit ${record.currentSiteAuditScore}分，只发现低影响问题。AI 不应该假装很有把握，建议跳过或人工确认是否另有突破口。`
        : 'AI 没有把握直接判断「跳过」或「可做 Mockup」。请看证据和工作记录后点击决策按钮。',
  };
}

function deriveImageLeadDiscoveryReason(record) {
  if ((record.websiteUrl || record.officialWebsiteUrl) && !record.currentSiteAuditPath) {
    return '图片线索搜索到了官网或疑似官网，必须先保存截图/正文并跑 site-audit，再决定是否 redesign 或 starter mockup。';
  }
  if (!hasImageLeadSearchMatch(record)) {
    return '图片线索目前只有 OCR/人工文字。需要用电话、品牌名或服务继续搜索，找到目录页、Google profile、官网、社媒或地区证据后再判断。';
  }
  if (!(record.address || record.city || record.googleMapsUrl || record.googlePlaceId)) {
    return '图片线索已有搜索匹配，但还缺地区/地址证据。先确认服务区域，避免做出无法定位客户的 mockup。';
  }
  return '图片线索还需要补搜索证据。';
}

function deriveCustomerOpportunitySummary(record) {
  if (record.currentSiteSalesDecision === 'skip_or_monitor') {
    return '当前官网基础较完整，只发现低影响问题。不要自动做 mockup；除非人工发现新的突破口，否则建议跳过或观察。';
  }
  if (record.currentSiteAuditSummary) return record.currentSiteAuditSummary;
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
    aiConclusion: {
      result: record.leadAiConclusion || record.aiAssessment?.result || '',
      score: Number.isFinite(record.leadAiScore) ? record.leadAiScore : record.aiAssessment?.score || null,
      confidence: record.leadAiConfidence || record.aiAssessment?.confidence || '',
      reason: record.aiAssessment?.reason || '',
    },
    websitePlanType: record.websitePlanType || '',
    currentWebsite: record.officialWebsiteUrl || record.websiteUrl || '',
    contactPage: record.contactPageUrl || '',
    contactProfile: {
      email: record.email || record.customerEmail || record.leadRecipientEmail || '',
      phone: record.phone || '',
      contactPage: record.contactPageUrl || '',
      socialAccounts: Array.isArray(record.socialAccounts) ? record.socialAccounts : [],
    },
    services: Array.isArray(record.leadCoreServices) ? record.leadCoreServices.slice(0, 5) : [],
    template: record.selectedTemplateId ? {
      id: record.selectedTemplateId,
      family: record.selectedTemplateFamily || '',
      confidence: record.templateMatchConfidence ?? null,
      reason: record.templateMatchReason || '',
    } : null,
    copyBrief: record.copyBriefPath ? {
      hero: record.copyBriefHero || '',
      primaryCta: record.copyBriefPrimaryCta || '',
      verifiedFacts: record.copyBriefVerifiedFacts || null,
      forbiddenClaims: record.copyBriefForbiddenClaims || [],
    } : null,
    run: record.openDesignRunRequestPath || record.openDesignRunStatePath || record.conceptManifestPath ? {
      requestStatus: record.openDesignRunRequestStatus || '',
      mode: record.openDesignRunRequestMode || '',
      timeoutMs: record.openDesignRunRequestTimeoutMs || null,
      nativeCleanFinish: record.openDesignRunNativeCleanFinish ?? null,
      completionMode: record.openDesignRunCompletionMode || '',
      questionForms: Array.isArray(record.openDesignRunQuestionForms) ? record.openDesignRunQuestionForms.length : 0,
      questionFormRounds: Array.isArray(record.openDesignRunQuestionFormRounds) ? record.openDesignRunQuestionFormRounds.length : 0,
      qualityScore: Number.isFinite(record.conceptQualityAuditScore) ? record.conceptQualityAuditScore : null,
      qualityOk: record.conceptQualityAuditOk ?? null,
      previewUrl: record.conceptPublicPreviewUrl || '',
      auditUrl: record.conceptPublicAuditUrl || '',
      runStateUrl: record.conceptPublicRunStateUrl || '',
      indexPath: record.conceptIndexPath || '',
      manifestPath: record.conceptManifestPath || '',
      auditPath: record.conceptQualityAuditPath || '',
    } : null,
    heroAngle: record.leadHeroAngle || record.outreachPrimaryProofPoint || '',
    auditFocus: record.currentSiteAuditFindings?.length
      ? record.currentSiteAuditFindings.filter((finding) => finding.severity !== 'low').slice(0, 3).map((finding) => finding.title)
      : issues.slice(0, 3),
    improvements: record.currentSitePriorityActions?.length
      ? record.currentSitePriorityActions.slice(0, 3).map((action) => action.fix)
      : improvements.slice(0, 3),
    auditSummary: record.currentSiteAuditSummary || '',
    outreachHook: record.currentSiteOutreachHook || '',
    openDesignDirection: record.currentSiteOpenDesignDirection || '',
    salesDecision: record.currentSiteSalesDecision || '',
    primaryCta: record.leadPrimaryCta || 'Call now',
    screenshot: record.currentSitePublicScreenshotUrl || record.currentSiteScreenshotPath || '',
    prompt: record.openDesignPrompt || '',
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
  const mockupReady = hasMockupReady(record);
  return {
    profile: Boolean(record.leadIntakePath || record.company),
    research: Boolean(record.leadResearchPath),
    evidence: hasEvidence(record),
    currentSiteAudit: Boolean(record.currentSiteAuditPath),
    templateMatch: Boolean(record.templateMatchPath),
    copyBrief: Boolean(record.copyBriefPath),
    openDesignHandoff: Boolean(record.templateOpenDesignHandoffPath || record.websiteBuildHandoffPath),
    openDesignRun: Boolean(record.openDesignRunRequestPath || record.openDesignRunStatePath || record.conceptManifestPath),
    openDesignNativeFinish: record.openDesignRunNativeCleanFinish === true,
    conceptQualityAudit: Boolean(record.conceptQualityAuditPath),
    mockup: Boolean(record.previewUrl || record.outreachPackPath || mockupReady),
    proof: Boolean(record.assetsReady || mockupReady),
    draft: Boolean(record.emailDraftReady || record.outreachBriefPath),
    sent: Boolean(record.outreachSent),
    reply: record.replyState === 'replied',
    discord: Boolean(record.salesThreadId || record.salesWorkspaceChannelId || record.websiteTaskThreadId || record.discordTaskThreadPath),
  };
}

function hasMockupReady(record) {
  return Boolean(
    (record.assetsReady && record.previewUrl)
      || (record.openDesignRunNativeCleanFinish === true && record.conceptQualityAuditOk === true && record.conceptManifestPath)
  );
}

function deriveActionLog(record) {
  const entries = [];
  const push = (label, detail, at = '') => entries.push({ label, detail, at });
  if (record.discordConversationSummary) push('同步 Discord thread', record.discordConversationSummary, record.discordTaskThread?.syncedAt || record.updatedAt);
  for (const entry of (record.discoveryLog || [])) {
    push(`Discovery：${translateDiscoveryEvent(entry.event)}`, entry.summary || entry.detail || '', entry.at);
  }
  if (record.leadIntakePath) push('建立线索档案', formatSource(record.leadSourceType || 'manual'), record.updatedAt);
  if (record.leadResearchPath) push('完成背景研究', record.leadPreviewability ? `结论：${translateValue(record.leadPreviewability)}；服务：${formatServices(record)}` : '已整理业务信息', record.updatedAt);
  if (record.redesignCheckPath) push('检查现有网站', record.leadRedesignDecision ? `判断：${translateValue(record.leadRedesignDecision)}` : '已记录 redesign 判断', record.updatedAt);
  if (record.leadReadyToBuildPath) push('整理建站输入', record.leadReadyToBuildStatus ? `状态：${translateValue(record.leadReadyToBuildStatus)}` : '已生成可交接输入', record.updatedAt);
  if (record.templateMatchPath) push('匹配模板族', record.selectedTemplateId ? `选择：${record.selectedTemplateId}${Number.isFinite(record.templateMatchConfidence) ? `；置信度 ${Math.round(record.templateMatchConfidence * 100)}%` : ''}` : '已生成模板匹配结果', record.updatedAt);
  if (record.copyBriefPath) push('生成文案 Brief', record.copyBriefHero ? `Hero：${record.copyBriefHero}` : '已分离 verified / inferred / demo content', record.updatedAt);
  if (record.templateOpenDesignHandoffPath) push('生成 Open Design Handoff', record.templateOpenDesignRunRequirements?.nativeCleanFinishRequired ? '要求 native finish，并保留 audit gate' : '已生成标准设计交接 payload', record.updatedAt);
  if (record.openDesignRunRequestPath) push('创建 Open Design 运行请求', `${record.openDesignRunRequestMode || 'app-visible'}；checkpoint ${record.openDesignRunRequestTimeoutMs ? Math.round(record.openDesignRunRequestTimeoutMs / 60000) : '?'} 分钟；fallback=${record.openDesignRunRequestAllowFallback ? '允许' : '禁止'}`, record.updatedAt);
  if (record.openDesignRunStatePath) push('同步 Open Design 运行状态', `${record.openDesignRunNativeCleanFinish ? 'native clean finish' : translateValue(record.openDesignRunCompletionMode) || '运行中/待确认'}；question forms ${(record.openDesignRunQuestionForms || []).length}`, record.openDesignRunEndedAt || record.updatedAt);
  if (record.conceptQualityAuditPath) push('完成 Mockup 质量审计', `${record.conceptQualityAuditOk ? '通过' : '未通过'}${Number.isFinite(record.conceptQualityAuditScore) ? ` · ${record.conceptQualityAuditScore}分` : ''}`, record.updatedAt);
  if (hasMockupReady(record)) push('Mockup 已可审核', record.previewUrl ? '已有预览链接和质量审计' : '本地 Open Design concept 已 native 结束并通过质量审计', record.updatedAt);
  if (record.websiteBuildHandoffPath) push('生成 Open Design 输入', `${record.websitePlanType ? `${translateValue(record.websitePlanType)}；` : ''}${record.leadAiConclusion ? `AI：${translateValue(record.leadAiConclusion)} ${record.leadAiScore || ''}分` : '已生成建站 payload'}`, record.updatedAt);
  if (record.leadOpsPath) push('运行线索流程', record.leadFamilyId ? `分类：${translateValue(record.leadFamilyId)}；AI：${translateValue(record.leadAiConclusion) || '待定'}${record.leadAiScore ? ` ${record.leadAiScore}分` : ''}` : '已完成自动判断', record.updatedAt);
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
  return prioritizeRecentEntries(entries, 12, [
    (entry) => ['匹配模板族', '生成文案 Brief', '生成 Open Design Handoff', '创建 Open Design 运行请求', '同步 Open Design 运行状态', '完成 Mockup 质量审计'].includes(entry.label),
  ]);
}

function deriveWorkTrace(record) {
  const entries = [];
  const push = (tool, action, evidence = '') => entries.push({ tool, action, evidence });
  for (const message of (record.discordConversationMessages || []).slice(-4)) {
    push(
      message.bot ? 'Discord website-agent' : 'Discord operator',
      `${message.author || 'unknown'}：${String(message.content || '').replace(/\s+/g, ' ').slice(0, 220)}`,
      record.discordThreadUrl || record.discordTaskThread?.thread?.url || '',
    );
  }
  for (const entry of (record.discoveryLog || [])) {
    push(entry.tool || 'lead-discovery skill', `${translateDiscoveryEvent(entry.event)}：${entry.summary || entry.detail || '已记录'}`, entry.outputPath || entry.sourceUrl || record.discoveryLogPath || '');
  }
  if (record.leadIntakePath) push('lead-intake skill', `输出：来源=${formatSource(record.leadSourceType || 'manual')}；联系=${summarizeContact(record)}`, record.leadIntakePath);
  if (record.leadResearchPath) push('lead-research skill', `输出：${translateValue(record.leadPreviewability) || '已整理业务信息'}；服务=${formatServices(record)}`, record.leadResearchPath);
  if (record.redesignCheckPath) push('redesign-check skill', `输出：${translateValue(record.leadRedesignDecision) || '已记录 redesign 判断'}`, record.redesignCheckPath);
  if (record.leadReadyToBuildPath) push('ready-to-build skill', `输出：${translateValue(record.leadReadyToBuildStatus) || '可交接输入'}；模式=${translateValue(record.leadBuildMode) || record.leadBuildMode || '待定'}`, record.leadReadyToBuildPath);
  if (record.templateMatchPath) push('template matcher', `输出：${record.selectedTemplateId || '模板族已匹配'}${Number.isFinite(record.templateMatchConfidence) ? `；confidence=${record.templateMatchConfidence}` : ''}`, record.templateMatchPath);
  if (record.copyBriefPath) push('copy brief generator', `输出：${record.copyBriefHero || '文案 brief 已生成'}；CTA=${record.copyBriefPrimaryCta || '待定'}`, record.copyBriefPath);
  if (record.templateOpenDesignHandoffPath) push('Open Design handoff generator', `输出：template handoff；audit=${(record.templateOpenDesignQualityGate || []).join('/') || '待定'}`, record.templateOpenDesignHandoffPath);
  if (record.openDesignRunRequestPath) push('Open Design runner', `输出：运行请求；mode=${record.openDesignRunRequestMode || 'app-visible'}；fallback=${record.openDesignRunRequestAllowFallback ? 'opt-in' : 'off'}`, record.openDesignRunRequestPath);
  if (record.openDesignRunStatePath) push('Open Design runner', `输出：${record.openDesignRunNativeCleanFinish ? 'native clean finish' : translateValue(record.openDesignRunCompletionMode) || '状态待确认'}；questionForms=${(record.openDesignRunQuestionForms || []).length}`, record.openDesignRunStatePath);
  if (record.conceptQualityAuditPath) push('mockup quality audit', `输出：${record.conceptQualityAuditOk ? 'pass' : 'needs revision'}${Number.isFinite(record.conceptQualityAuditScore) ? `；score=${record.conceptQualityAuditScore}` : ''}`, record.conceptQualityAuditPath);
  if (record.websiteBuildHandoffPath) push('Open Design handoff generator', `输出：${translateValue(record.websitePlanType) || '建站 payload'}；AI=${translateValue(record.leadAiConclusion) || '待定'}${record.leadAiScore ? ` ${record.leadAiScore}分` : ''}`, record.websiteBuildHandoffPath);
  if (record.leadOpsPath) push('lead-ops skill', `输出：${translateValue(record.leadFamilyId) || '分类完成'}；建议=${record.leadRecommendedAction || '待确认'}`, record.leadOpsPath);
  if (record.outreachBriefPath) push('outreach-brief skill', `输出：渠道=${translateValue(record.outreachChannelRecommendation) || '待定'}；草稿=模板级，需要复写`, record.outreachBriefPath);
  if (record.currentSiteAuditPath) push('Playwright browser audit', `输出：截图+HTML/text+报告；${record.currentSiteAuditVerdict || '已审计'}${record.currentSiteAuditScore ? ` ${record.currentSiteAuditScore}分` : ''}`, record.currentSiteAuditPath);
  if (record.currentSiteScreenshotPath) push('Current site screenshot', '桌面截图已保存到 repo', record.currentSiteScreenshotPath);
  if (record.currentSiteTextPath) push('Current site text', '当前网站正文文本已保存到 repo', record.currentSiteTextPath);
  if (record.googleMapsUrl || record.googlePlaceId) push('Google Maps / Places', '核对地图或商家资料', record.googleMapsUrl || record.googlePlaceId);
  if (record.officialWebsiteUrl || record.websiteUrl) push('Browser / official site', '打开官网或已有网站，检查改版机会', record.officialWebsiteUrl || record.websiteUrl);
  for (const source of record.evidenceSources || []) {
    push(translateEvidenceSource(source.sourceType), source.sourceUrl ? `${source.extractor || '读取证据来源'}：${source.key || ''}${source.value ? `=${String(source.value).slice(0, 80)}` : ''}` : '记录证据来源', source.sourceUrl || source.sourceType || '');
  }
  if (!entries.length) push('等待自动研究', '还没有工具调用记录', '');
  return prioritizeRecentEntries(entries, 12, [
    (entry) => ['template matcher', 'copy brief generator', 'Open Design handoff generator', 'Open Design runner', 'mockup quality audit'].includes(entry.tool),
  ]);
}

function prioritizeRecentEntries(entries, limit, predicates = []) {
  const important = entries.filter((entry) => predicates.some((predicate) => predicate(entry)));
  const recent = entries.slice(-limit);
  const seen = new Set();
  return [...important, ...recent]
    .filter((entry) => {
      const key = JSON.stringify(entry);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

function translateDiscoveryEvent(value) {
  return {
    discord_image_received: '收到 Discord 图片线索',
    ocr_text_recorded: '记录 OCR / 人工文字',
    web_search_query: '执行网页搜索',
    web_search_result_matched: '匹配搜索结果',
    evidence_written: '写入证据',
    lead_ops_run: '运行 lead-ops',
    conflict_recorded: '记录冲突',
  }[value] || value || '发现记录';
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
      { action: 'mark_followed_up', label: '记录已跟进', tone: 'primary', note: '已执行本次 follow-up。' },
      { action: 'mark_replied', label: '记录已回复', tone: 'secondary', note: '人工确认客户已经回复。' },
      { action: 'skip_lead', label: '跳过', tone: 'secondary', note: '连续跟进无明确机会，跳过该线索。' },
    ];
  }
  if (record.pipelineStage === 'ready_for_mockup') {
    return [
      { action: 'approve_mockup', label: '批准进 Mockup 队列', tone: 'primary', note: '人工确认这个 lead 有明确价值，批准进入 Mockup 队列。' },
      { action: 'research_more', label: '记录需继续研究', tone: 'secondary', note: '需要再补充更多证据后再决定是否创建 Mockup。' },
      { action: 'skip_lead', label: '跳过', tone: 'secondary', note: '没有足够明确的突破口，跳过该线索。' },
    ];
  }
  if (record.pipelineStage === 'needs_human') {
    return [
      { action: 'approve_mockup', label: '批准进 Mockup 队列', tone: 'primary', note: '人工看过证据，确认这个 lead 有明确价值，批准进入 Mockup 队列。' },
      { action: 'skip_lead', label: '跳过', tone: 'secondary', note: '人工看过证据，仍没有明确突破口，跳过该线索。' },
      { action: 'research_more', label: '记录需再研究', tone: 'secondary', note: '人工认为还需要补充搜索、官网、地图、截图或 OCR 证据。' },
    ];
  }
  if (record.pipelineStage === 'researching') {
    return [
      { action: 'research_more', label: '记录需继续研究', tone: 'primary', note: '记录需要自动研究补充搜索、官网、地图、截图或 OCR 证据。' },
      { action: 'skip_lead', label: '跳过', tone: 'secondary', note: '线索明显不符合目标或不可触达，跳过该线索。' },
    ];
  }
  if (record.pipelineStage === 'new_lead') {
    return [
      { action: 'research_more', label: '记录需开始研究', tone: 'primary', note: '记录需要自动建档和研究，补充搜索、官网、地图、截图或 OCR 证据。' },
      { action: 'skip_lead', label: '跳过', tone: 'secondary', note: '线索明显不符合目标或不可触达，跳过该线索。' },
    ];
  }
  return [
    { action: 'research_more', label: '记录需继续研究', tone: 'primary', note: '继续补充搜索、官网、地图、截图或 OCR 证据。' },
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
    clinic: '诊所/医疗',
    studio_or_visual: '视觉/预约型服务',
    venue: '场地/活动',
    redesign: '改版',
    starter: '新站',
    teaser: '预览试探',
    one_page: '一页网站',
    simple_multi_page: '简单多页网站',
    ready_for_mockup: '可做 Mockup',
    needs_human: '需人工',
    skip: '跳过',
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
    research_more: '需继续研究',
    approve_mockup: '批准进 Mockup 队列',
    mark_followed_up: '记录已跟进',
    mark_replied: '已回复',
    move_to_paid_handoff: '成交交接',
  }[value] || value || '';
}
