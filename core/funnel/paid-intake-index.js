import fs from 'fs';
import path from 'path';
import { readLedger, summarizeLedger } from '../finance/ledger.js';

export const ADMIN_VIEWS = {
  all: { label: '全部项目' },
  review_ready: { label: 'Ready for review' },
  revision_pending: { label: 'Revisions pending' },
  waiting_dns: { label: 'Waiting DNS' },
  missing_open_design: { label: 'Missing Open Design' },
  qa_blocked: { label: 'QA blocked' },
};

export function loadPaidIntakeIndex({ root = 'data/paid-intakes' } = {}) {
  const records = [];
  if (!fs.existsSync(root)) return { records, counts: statusCounts(records), updatedAt: new Date().toISOString() };
  for (const clientSlug of fs.readdirSync(root).sort()) {
    const clientDir = path.join(root, clientSlug);
    if (!fs.statSync(clientDir).isDirectory()) continue;
    for (const filename of fs.readdirSync(clientDir).sort()) {
      if (!filename.endsWith('.json') || filename.endsWith('-timeline.json')) continue;
      const filePath = path.join(clientDir, filename);
      try {
        records.push(summarizePaidIntakeRecord(JSON.parse(fs.readFileSync(filePath, 'utf8')), filePath));
      } catch (error) {
        records.push({
          filePath,
          clientSlug,
          orderId: filename.replace(/\.json$/, ''),
          status: 'invalid_record',
          customer: { company: '', email: '', domain: '' },
          error: error instanceof Error ? error.message : String(error),
          updatedAt: '',
        });
      }
    }
  }
  records.sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
  return { records, counts: statusCounts(records), updatedAt: new Date().toISOString() };
}

export function loadPaidIntakeRecord({ root = 'data/paid-intakes', clientSlug, orderId } = {}) {
  const filePath = path.join(root, clientSlug || '', `${orderId || ''}.json`);
  const timelinePath = path.join(root, clientSlug || '', `${orderId || ''}-timeline.jsonl`);
  if (!fs.existsSync(filePath)) return null;
  const record = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const timeline = fs.existsSync(timelinePath)
    ? fs.readFileSync(timelinePath, 'utf8').split(/\n+/).filter(Boolean).map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return { type: 'invalid_timeline_line', raw: line };
      }
    })
    : [];
  return {
    record,
    summary: summarizePaidIntakeRecord(record, filePath),
    filePath,
    timelinePath,
    timeline,
  };
}

export function summarizePaidIntakeRecord(record, filePath = '') {
  const revisions = Array.isArray(record.revisions) ? record.revisions : [];
  const acceptedRevisions = revisions.filter((revision) => revision.accepted !== false);
  const artifactSummary = buildArtifactSummary(record, filePath);
  const stageSummary = buildStageSummary(record, artifactSummary);
  const milestoneSummary = buildMilestoneSummary(record, artifactSummary);
  const blockerSummary = buildBlockerSummary(record, artifactSummary);
  const nextActionSummary = buildNextActionSummary(record, artifactSummary);
  const workflowSummary = buildWorkflowSummary(record, artifactSummary);
  return {
    filePath,
    clientSlug: record.clientSlug || '',
    orderId: record.orderId || record.order?.id || '',
    status: record.status || '',
    readinessStatus: record.readiness?.status || '',
    missing: record.readiness?.missing || [],
    customer: {
      company: record.customer?.company || '',
      email: record.customer?.email || '',
      phone: record.customer?.phone || '',
      domain: record.customer?.domain || '',
    },
    repo: record.repo || '',
    previewUrl: record.previewUrl || '',
    liveUrl: record.liveUrl || record.launch?.liveUrl || '',
    discordThreadId: record.discord?.websiteTaskThreadId || record.discord?.salesThreadId || '',
    discordThreadUrl: record.discord?.lastThreadUrl || record.discord?.websiteTaskThreadUrl || '',
    casePath: record.case?.casePath || record.paths?.casePath || '',
    websiteSurveyPath: record.websiteReady?.surveyPath || record.readiness?.surveyPath || '',
    buildPacketPath: record.websiteReady?.buildPacketPath || record.readiness?.buildPacketPath || '',
    leadRecipientEmail: record.leadDelivery?.recipientEmail || '',
    tier: record.order?.tier || '',
    amount: record.order?.amount || '',
    currency: record.order?.currency || 'USD',
    assetCount: Array.isArray(record.intake?.assets) ? record.intake.assets.length : 0,
    fileCount: Array.isArray(record.intake?.files) ? record.intake.files.length : 0,
    revisionCount: acceptedRevisions.length,
    revisionLimit: record.revisionPolicy?.includedRevisions || includedRevisionsForTier(record.order?.tier),
    latestRevisionStatus: revisions[revisions.length - 1]?.status || '',
    firstVersionConfirmed: record.firstVersionConfirmation?.confirmed === true,
    artifactSummary,
    stageSummary,
    milestoneSummary,
    blockerSummary,
    nextActionSummary,
    workflowSummary,
    createdAt: record.createdAt || '',
    updatedAt: record.updatedAt || '',
  };
}

export function matchesAdminView(record, view = 'all') {
  switch (view) {
    case 'review_ready':
      return record.stageSummary?.key === 'review_ready';
    case 'revision_pending':
      return record.status === 'revision_requested';
    case 'waiting_dns':
      return record.artifactSummary?.domainStatus === 'waiting_for_customer_dns';
    case 'missing_open_design':
      return !record.artifactSummary?.openDesignBound;
    case 'qa_blocked':
      return !record.artifactSummary?.deliveryQaReady;
    case 'all':
    default:
      return true;
  }
}

export function statusCounts(records) {
  return records.reduce((counts, record) => {
    const key = record.status || 'unknown';
    counts[key] = (counts[key] || 0) + 1;
    counts.total = (counts.total || 0) + 1;
    return counts;
  }, { total: 0 });
}

export function includedRevisionsForTier(tier) {
  if (tier === 'yearly_maintenance') return 12;
  return 3;
}

function buildArtifactSummary(record, filePath = '') {
  const clientSlug = record.clientSlug || '';
  const orderId = record.orderId || record.order?.id || '';
  const casePath = record.case?.casePath || record.paths?.casePath || path.join('data', 'cases', clientSlug, orderId, 'case.json');
  const caseDir = casePath ? path.dirname(casePath) : path.join('data', 'cases', clientSlug, orderId);
  const outreachPackPath = path.join('clients', clientSlug, 'outreach', 'outreach-pack.json');
  const outreachMarkdownPath = path.join('clients', clientSlug, 'outreach', 'outreach-pack.md');
  const outreachEmailDir = path.join('clients', clientSlug, 'outreach', 'email');
  const deliveryQaPath = path.join(caseDir, 'delivery-qa.json');
  const financeSummaryPath = path.join('data', 'finance', `${clientSlug}-summary.json`);
  const conceptManifestPath = path.join('clients', clientSlug, 'concept', 'open-design', 'concept-manifest.json');
  const productionHandoffPath = path.join('clients', clientSlug, 'concept', 'open-design', 'production-handoff.json');
  const outreachPack = readJsonIfExists(outreachPackPath);
  const deliveryQa = readJsonIfExists(deliveryQaPath);
  const financeSummary = readFinanceSummary(clientSlug, financeSummaryPath);
  const conceptManifest = readJsonIfExists(conceptManifestPath);
  const productionHandoff = readJsonIfExists(productionHandoffPath);
  const caseFile = readJsonIfExists(casePath);
  const latestDomainRequest = readLatestDomainRequest(clientSlug);
  const latestTimeline = readLatestTimelineEvent(record, { casePath, filePath });
  const timelineEntries = readTimelineEntries(record, { casePath, filePath });
  const latestSmoke = readLatestOpsSmoke(orderId);
  return {
    conceptManifestPath: existsOrEmpty(conceptManifestPath),
    openDesignBound: Boolean(conceptManifest?.projectId),
    productionHandoffPath: existsOrEmpty(productionHandoffPath),
    productionHandoffReady: Boolean(productionHandoff?.concept?.projectId || productionHandoff?.metadata?.clientSlug || productionHandoff?.clientSlug),
    outreachPackPath: existsOrEmpty(outreachPackPath),
    outreachMarkdownPath: existsOrEmpty(outreachMarkdownPath),
    outreachEmailDir: fs.existsSync(outreachEmailDir) ? outreachEmailDir : '',
    outreachPreviewUrl: outreachPack?.previewUrl || '',
    outreachProofPoints: Array.isArray(outreachPack?.emailBrief?.proofPoints) ? outreachPack.emailBrief.proofPoints.length : 0,
    outreachAssetsReady: Boolean(outreachPack?.assets?.screenshots?.desktop && outreachPack?.assets?.screenshots?.mobile && outreachPack?.assets?.video),
    deliveryQaPath: existsOrEmpty(deliveryQaPath),
    deliveryQaReady: deliveryQa?.readyForCustomerReview === true,
    financeSummaryPath: financeSummary.path,
    financeSummary,
    caseStatus: caseFile?.status || '',
    latestTask: caseFile?.latestTask || null,
    latestAgentRun: caseFile?.latestAgentRun || null,
    latestTimeline,
    timelineEntries,
    latestSmoke,
    domainRequestPath: latestDomainRequest?.path || '',
    domainStatus: latestDomainRequest?.status || '',
    domainName: latestDomainRequest?.domain || '',
    openDesignStatus: conceptManifest?.status?.status || '',
    openDesignCompletionMode: conceptManifest?.status?.completionMode || '',
  };
}

function buildStageSummary(record, artifactSummary) {
  const status = record.status || '';
  if (artifactSummary.domainStatus === 'active') return stage('live', 'Live', 'ready');
  if (status === 'completed') return stage('launch_ready', 'Launch Ready', 'ready');
  if (status === 'revision_requested') return stage('revision', 'Revision', 'attention');
  if (artifactSummary.deliveryQaReady || status === 'v1_delivered') return stage('review_ready', 'Review Ready', 'ready');
  if (status === 'v1_generation_started' || artifactSummary.caseStatus === 'agent_completed') return stage('building', 'Building', 'working');
  if (artifactSummary.productionHandoffReady) return stage('port_to_dev', 'Port To Dev', 'working');
  if (artifactSummary.openDesignBound) return stage('open_design', 'Open Design Ready', 'working');
  if ((record.readiness?.status || '') === 'intake_ready_for_review') return stage('website_ready', 'Website Ready', 'working');
  if (record.readiness?.missing?.length) return stage('intake_blocked', 'Intake Blocked', 'blocked');
  return stage('intake', 'Intake', 'working');
}

function buildNextActionSummary(record, artifactSummary) {
  if (record.readiness?.missing?.length) {
    return action('补齐 intake 缺口', record.readiness.missing.join(', '), '先补齐客户资料，再继续 build。');
  }
  if (!artifactSummary.openDesignBound) {
    return action('创建/绑定 Open Design', '还没有 Open Design project。', `npm run open-design:run-concept -- --client ${record.clientSlug} --mode app-visible --source-url <official-site-url>`);
  }
  if (!artifactSummary.productionHandoffReady) {
    return action('生成 production handoff', '视觉概念还没有变成生产 handoff。', `npm run open-design:build-production-handoff -- --client ${record.clientSlug} --target-branch dev`);
  }
  if (!artifactSummary.deliveryQaReady) {
    return action('写 delivery QA', '还没有通过 customer review 前的 QA 门。', `npm run qa:write-delivery-qa -- --client ${record.clientSlug} --order ${record.orderId} --preview-url ${record.previewUrl || `https://${record.clientSlug}-dev.pages.dev/`} --email ${record.customer?.email || '<checkout-email>'}${record.repo ? ` --repo ${record.repo}` : ''}`);
  }
  if (record.status === 'revision_requested') {
    return action('处理最新 revision', record.latestRevisionStatus || '客户已提交 revision。', '回到同一个 Discord thread 和 dev branch 继续处理。');
  }
  if (artifactSummary.domainStatus === 'waiting_for_customer_dns') {
    return action('跟进客户 DNS', `等待 ${artifactSummary.domainName || '客户域名'} 的 CNAME 变更。`, '提醒客户完成 DNS，然后重查 domain status。');
  }
  if (record.status === 'v1_delivered' || artifactSummary.deliveryQaReady) {
    return action('发送 customer review', '项目已经具备 review 条件。', `npm run ops:send-review-email -- --client ${record.clientSlug} --order ${record.orderId} --send true`);
  }
  if (record.status === 'completed') {
    return action('推进 live / domain', '客户站已完成，检查 live 和 domain。', '检查 publish 结果、live URL、domain request。');
  }
  return action('查看项目 thread', '继续推进当前项目。', '打开 Discord thread、preview 和最新 QA。');
}

function buildMilestoneSummary(record, artifactSummary) {
  const timelineEntries = Array.isArray(artifactSummary.timelineEntries) ? artifactSummary.timelineEntries : [];
  const currentKey = deriveCurrentMilestoneKey(record, artifactSummary);
  const milestones = [
    milestone('lead_collected', 'Lead collected', true, eventAt(timelineEntries, [] ) || record.createdAt || record.updatedAt || ''),
    milestone('website_ready', 'Website ready', isWebsiteReady(record, artifactSummary), eventAt(timelineEntries, ['confirm_website_ready', 'readiness_confirmed']) || ''),
    milestone('open_design_started', 'Open Design started', Boolean(artifactSummary.openDesignBound), eventAt(timelineEntries, ['open_design_started']) || fileUpdatedAt(artifactSummary.conceptManifestPath)),
    milestone('open_design_succeeded', 'Open Design succeeded', artifactSummary.openDesignStatus === 'succeeded', eventAt(timelineEntries, ['open_design_succeeded']) || fileUpdatedAt(artifactSummary.conceptManifestPath)),
    milestone('ported_to_repo_dev', 'Ported to repo dev', Boolean(artifactSummary.productionHandoffReady), eventAt(timelineEntries, ['agent_run_completed']) || fileUpdatedAt(artifactSummary.productionHandoffPath)),
    milestone('dev_preview_ready', 'Dev preview ready', Boolean(record.previewUrl), eventAt(timelineEntries, ['mark_v1_delivered', 'admin_marked_v1_delivered']) || ''),
    milestone('delivery_qa_passed', 'Delivery QA passed', Boolean(artifactSummary.deliveryQaReady), eventAt(timelineEntries, ['delivery_qa_passed']) || fileUpdatedAt(artifactSummary.deliveryQaPath)),
    milestone('review_sent', 'Review sent', hasEvent(timelineEntries, ['customer_review_email_sent']), eventAt(timelineEntries, ['customer_review_email_sent'])),
    milestone('revision_requested', 'Revision requested', (record.status || '') === 'revision_requested' || hasEvent(timelineEntries, ['revision_routed']), eventAt(timelineEntries, ['revision_routed'])),
    milestone('approved_for_publish', 'Approved for publish', hasEvent(timelineEntries, ['approve_latest_revision', 'approval_request_received']), eventAt(timelineEntries, ['approve_latest_revision', 'approval_request_received'])),
    milestone('live', 'Live', (artifactSummary.domainStatus === 'active') || hasEvent(timelineEntries, ['live_publish_completed']), eventAt(timelineEntries, ['live_publish_completed'])),
    milestone('domain_waiting_customer', 'Domain waiting customer', artifactSummary.domainStatus === 'waiting_for_customer_dns', eventAt(timelineEntries, ['domain_status_discord_sent'])),
    milestone('domain_connected', 'Domain connected', artifactSummary.domainStatus === 'active', eventAt(timelineEntries, ['domain_status_discord_sent'])),
  ];

  const currentIndex = Math.max(0, milestones.findIndex((item) => item.key === currentKey));
  const completedCount = milestones.filter((item) => item.complete).length;
  return {
    currentKey,
    currentLabel: milestones[currentIndex]?.label || 'Lead collected',
    currentIndex,
    completedCount,
    total: milestones.length,
    milestones,
  };
}

function buildBlockerSummary(record, artifactSummary) {
  const blockers = [];
  if (record.readiness?.missing?.length) blockers.push(`缺少 intake 信息：${record.readiness.missing.join(', ')}`);
  if (!artifactSummary.openDesignBound) blockers.push('还没有绑定 Open Design project');
  if (artifactSummary.openDesignBound && !artifactSummary.productionHandoffReady) blockers.push('还没有 production handoff');
  if (!artifactSummary.deliveryQaReady) blockers.push('还没有通过 delivery QA');
  if ((record.status || '') === 'revision_requested') blockers.push('客户 revision 待处理');
  if (artifactSummary.domainStatus === 'waiting_for_customer_dns') blockers.push(`等待客户完成 DNS：${artifactSummary.domainName || 'customer domain'}`);

  return {
    blocking: blockers.length > 0,
    count: blockers.length,
    items: blockers,
    primary: blockers[0] || '',
  };
}

function buildWorkflowSummary(record, artifactSummary) {
  const latestAgentRun = artifactSummary.latestAgentRun || null;
  const latestSmoke = artifactSummary.latestSmoke || null;
  const latestTask = artifactSummary.latestTask || null;
  const latestTimeline = artifactSummary.latestTimeline || null;
  const latestAgentRunState = latestAgentRun
    ? (latestAgentRun.ok ? (latestAgentRun.pushed ? 'pushed' : 'completed') : 'failed')
    : 'missing';
  const latestWorkflow = latestSmoke?.approval?.requestedAt && latestSmoke?.revision?.requestedAt
    ? (new Date(latestSmoke.approval.requestedAt) > new Date(latestSmoke.revision.requestedAt)
      ? { kind: 'approval', ...latestSmoke.approval }
      : { kind: 'revision', ...latestSmoke.revision })
    : (latestSmoke?.approval?.requestedAt
      ? { kind: 'approval', ...latestSmoke.approval }
      : (latestSmoke?.revision?.requestedAt ? { kind: 'revision', ...latestSmoke.revision } : null));

  return {
    latestTaskId: latestTask?.id || '',
    latestTaskKind: latestTask?.kind || '',
    latestTaskStatus: latestTask?.status || '',
    latestTimelineType: latestTimeline?.type || '',
    latestTimelineAt: latestTimeline?.at || '',
    latestAgentRunId: latestAgentRun?.id || '',
    latestAgentRunState,
    latestAgentRunPreviewUrl: latestAgentRun?.previewUrl || '',
    latestWorkflowKind: latestWorkflow?.kind || '',
    latestWorkflowRunId: latestWorkflow?.workflowRunId || '',
    latestWorkflowUrl: latestWorkflow?.workflowUrl || '',
    latestWorkflowRequestedAt: latestWorkflow?.requestedAt || '',
    latestSmokePath: latestSmoke?.path || '',
  };
}

function stage(key, label, tone) {
  return { key, label, tone };
}

function action(label, reason, command = '') {
  return { label, reason, command };
}

function milestone(key, label, complete, at = '') {
  return { key, label, complete, at };
}

function deriveCurrentMilestoneKey(record, artifactSummary) {
  if (artifactSummary.domainStatus === 'active') return 'domain_connected';
  if (artifactSummary.domainStatus === 'waiting_for_customer_dns') return 'domain_waiting_customer';
  if (hasEvent(artifactSummary.timelineEntries || [], ['live_publish_completed'])) return 'live';
  if ((record.status || '') === 'completed') return 'approved_for_publish';
  if ((record.status || '') === 'revision_requested') return 'revision_requested';
  if (hasEvent(artifactSummary.timelineEntries || [], ['customer_review_email_sent'])) return 'review_sent';
  if (artifactSummary.deliveryQaReady) return 'delivery_qa_passed';
  if (record.previewUrl) return 'dev_preview_ready';
  if (artifactSummary.productionHandoffReady) return 'ported_to_repo_dev';
  if (artifactSummary.openDesignStatus === 'succeeded') return 'open_design_succeeded';
  if (artifactSummary.openDesignBound) return 'open_design_started';
  if (isWebsiteReady(record, artifactSummary)) return 'website_ready';
  return 'lead_collected';
}

function isWebsiteReady(record, artifactSummary) {
  return (record.readiness?.status || '') === 'intake_ready_for_review'
    || artifactSummary.openDesignBound
    || artifactSummary.productionHandoffReady
    || Boolean(record.previewUrl);
}

function hasEvent(entries, eventTypes) {
  return entries.some((entry) => eventTypes.includes(entry.type || entry.action || ''));
}

function eventAt(entries, eventTypes) {
  if (!eventTypes.length) return entries.at(0)?.createdAt || entries.at(0)?.submittedAt || '';
  const match = entries.find((entry) => eventTypes.includes(entry.type || entry.action || ''));
  return match?.createdAt || match?.submittedAt || '';
}

function fileUpdatedAt(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return '';
  return fs.statSync(filePath).mtime.toISOString();
}

function readFinanceSummary(clientSlug, financeSummaryPath) {
  const persisted = readJsonIfExists(financeSummaryPath);
  if (persisted?.summary) {
    return {
      path: financeSummaryPath,
      revenue: persisted.summary.revenue ?? 0,
      cost: persisted.summary.cost ?? 0,
      profit: persisted.summary.profit ?? 0,
      roi: persisted.summary.roi ?? null,
      eventCount: persisted.summary.eventCount ?? 0,
      revenueEventCount: persisted.summary.revenueEventCount ?? 0,
      costEventCount: persisted.summary.costEventCount ?? 0,
    };
  }
  try {
    const events = readLedger();
    const summary = summarizeLedger(events, { clientSlug });
    return {
      path: '',
      revenue: summary.revenue,
      cost: summary.cost,
      profit: summary.profit,
      roi: summary.roi,
      eventCount: summary.eventCount,
      revenueEventCount: summary.revenueEventCount ?? 0,
      costEventCount: summary.costEventCount ?? 0,
    };
  } catch {
    return {
      path: '',
      revenue: 0,
      cost: 0,
      profit: 0,
      roi: null,
      eventCount: 0,
      revenueEventCount: 0,
      costEventCount: 0,
    };
  }
}

function readLatestTimelineEvent(record, { casePath = '', filePath = '' } = {}) {
  const timeline = readTimelineEntries(record, { casePath, filePath });
  if (!timeline.length) return null;
  const event = timeline.at(-1);
  return {
    path: event.path || '',
    type: event.type || event.action || '',
    at: event.createdAt || event.submittedAt || '',
    note: event.note || '',
  };
}

function readTimelineEntries(record, { casePath = '', filePath = '' } = {}) {
  const siblingPaidTimelinePath = filePath ? filePath.replace(/\.json$/, '-timeline.jsonl') : '';
  const paidTimelinePath = fs.existsSync(siblingPaidTimelinePath)
    ? siblingPaidTimelinePath
    : (record.clientSlug && record.orderId ? path.join('data', 'paid-intakes', record.clientSlug, `${record.orderId}-timeline.jsonl`) : '');
  const caseTimelinePath = casePath ? path.join(path.dirname(casePath), 'timeline.jsonl') : '';
  const entries = [];
  for (const timelinePath of [paidTimelinePath, caseTimelinePath]) {
    if (!timelinePath || !fs.existsSync(timelinePath)) continue;
    const lines = fs.readFileSync(timelinePath, 'utf8').split(/\n+/).filter(Boolean);
    for (const line of lines) {
      try {
        const event = JSON.parse(line);
        entries.push({ ...event, path: timelinePath });
      } catch {
        // ignore malformed line
      }
    }
  }
  return entries.sort((a, b) => String(a.createdAt || a.submittedAt || '').localeCompare(String(b.createdAt || b.submittedAt || '')));
}

function readLatestDomainRequest(clientSlug) {
  const dir = path.join('data', 'domain', 'requests', clientSlug || '');
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((name) => name.endsWith('.json'));
  const entries = files
    .map((name) => {
      const filePath = path.join(dir, name);
      const data = readJsonIfExists(filePath);
      return data ? { ...data, path: filePath } : null;
    })
    .filter(Boolean)
    .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
  return entries[0] || null;
}

function readLatestOpsSmoke(orderId) {
  if (!orderId) return null;
  const root = path.join('data', 'ops-smoke');
  if (!fs.existsSync(root)) return null;
  let best = null;
  for (const entry of fs.readdirSync(root)) {
    const summaryPath = path.join(root, entry, 'summary.json');
    if (!fs.existsSync(summaryPath)) continue;
    const summary = readJsonIfExists(summaryPath);
    if (!summary) continue;
    const approvalOrderId = summary.approval?.orderId || '';
    const revisionOrderId = summary.revision?.orderId || '';
    if (approvalOrderId !== orderId && revisionOrderId !== orderId) continue;
    const stamp = summary.revision?.requestedAt || summary.approval?.requestedAt || '';
    if (!best || String(stamp).localeCompare(String(best.stamp)) > 0) {
      best = {
        stamp,
        path: summaryPath,
        approval: summary.approval || null,
        revision: summary.revision || null,
        assertions: summary.assertions || {},
        failed: summary.failed || [],
      };
    }
  }
  return best;
}

function existsOrEmpty(filePath) {
  return fs.existsSync(filePath) ? filePath : '';
}

function readJsonIfExists(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}
