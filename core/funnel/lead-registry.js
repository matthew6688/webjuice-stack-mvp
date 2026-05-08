import fs from 'fs';
import path from 'path';
import { readLeadNotes } from './lead-notes.js';
import { normalizeOutreachArtifactState } from './outreach-provider-state.js';

export function loadLeadRegistry({
  clientsRoot = 'clients',
  casesRoot = 'data/cases',
  paidIntakesRoot = 'data/paid-intakes',
} = {}) {
  const records = new Map();

  ingestClientArtifacts(records, clientsRoot);
  ingestCaseFiles(records, casesRoot);
  ingestPaidIntakes(records, paidIntakesRoot);

  const list = [...records.values()]
    .map((record) => finalizeLeadRecord(record))
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));

  return {
    records: list,
    byClientSlug: new Map(list.map((record) => [record.clientSlug, record])),
    updatedAt: new Date().toISOString(),
  };
}

export function resolveLeadByEmail(registryOrRecords, email) {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return { ok: false, reason: 'missing_email', match: null, candidates: [] };
  }

  const records = Array.isArray(registryOrRecords)
    ? registryOrRecords
    : Array.isArray(registryOrRecords?.records)
      ? registryOrRecords.records
      : [];

  const candidates = records.filter((record) => {
    const emails = [
      record.email,
      record.customerEmail,
      record.leadRecipientEmail,
      ...(Array.isArray(record.contactEmails) ? record.contactEmails : []),
    ]
      .map(normalizeEmail)
      .filter(Boolean);
    return emails.includes(normalized);
  });

  if (candidates.length === 1) {
    return { ok: true, reason: 'unique_match', match: candidates[0], candidates };
  }
  if (candidates.length > 1) {
    return { ok: false, reason: 'ambiguous_email', match: null, candidates };
  }
  return { ok: false, reason: 'not_found', match: null, candidates: [] };
}

function ingestClientArtifacts(records, clientsRoot) {
  if (!fs.existsSync(clientsRoot)) return;
  for (const clientSlug of fs.readdirSync(clientsRoot).sort()) {
    const clientDir = path.join(clientsRoot, clientSlug);
    if (!fs.statSync(clientDir).isDirectory()) continue;
    const record = ensureRecord(records, clientSlug);
    record.clientSlug = clientSlug;

    const outreachPack = readJsonIfExists(path.join(clientDir, 'outreach', 'outreach-pack.json')) || {};
    const survey = readJsonIfExists(path.join(clientDir, 'intake', 'website-survey.json')) || {};
    const evidence = readJsonIfExists(path.join(clientDir, 'evidence', 'evidence.json')) || {};
    const content = readJsonIfExists(path.join(clientDir, 'content.restaurant.json')) || {};

    const emailDir = path.join(clientDir, 'outreach', 'email');
    const emailArtifacts = readEmailArtifacts(emailDir);
    const leadNotes = readLeadNotes(clientSlug, { clientsRoot });

    record.businessName = firstNonEmpty(
      record.businessName,
      survey.businessName,
      outreachPack.business?.name,
      content.business?.name,
      titleFromSlug(clientSlug),
    );
    record.company = record.businessName;
    record.niche = firstNonEmpty(record.niche, survey.niche, outreachPack.business?.cuisine, content.meta?.niche);
    record.previewUrl = firstNonEmpty(record.previewUrl, outreachPack.previewUrl);
    record.address = firstNonEmpty(record.address, survey.contact?.address, content.contact?.address, outreachPack.business?.address);
    record.phone = firstNonEmpty(record.phone, survey.contact?.phone, content.contact?.phone);
    record.email = firstNonEmpty(record.email, survey.contact?.email, content.contact?.email, emailArtifacts[0]?.to);
    record.websiteUrl = firstNonEmpty(record.websiteUrl, survey.contact?.website, content.contact?.website);
    record.contactPageUrl = firstNonEmpty(record.contactPageUrl, content.cta?.contactPageUrl, survey.contact?.primaryCtaUrl);
    record.googleMapsUrl = firstNonEmpty(
      record.googleMapsUrl,
      findQaLink(outreachPack, 'map'),
      firstEvidenceUrl(evidence, 'google_places'),
    );
    record.googlePlaceId = firstNonEmpty(record.googlePlaceId, extractPlaceIdFromEvidence(evidence));
    record.menuUrl = firstNonEmpty(record.menuUrl, survey.offer?.menuSource, findQaLink(outreachPack, 'menuSource'), survey.assets?.menuSource);
    record.reservationUrl = firstNonEmpty(record.reservationUrl, findQaLink(outreachPack, 'reserve'));
    record.logoUrl = firstNonEmpty(record.logoUrl, survey.assets?.logo, content.brand?.logo?.src);
    record.hasWebsite = Boolean(record.websiteUrl || survey.contact?.website);
    record.evidenceSources = Array.isArray(evidence.sources) ? evidence.sources : [];
    record.qualificationStatus = deriveQualificationStatus(survey, evidence, outreachPack);
    record.previewUrl = firstNonEmpty(record.previewUrl, survey.case?.previewUrl);
    record.readiness = firstNonEmpty(record.readiness, survey.readiness, survey.readyToBuild ? 'website_ready_to_build' : '');
    record.contentPath = fs.existsSync(path.join(clientDir, 'content.restaurant.json')) ? path.join(clientDir, 'content.restaurant.json') : '';
    record.websiteSurveyPath = fs.existsSync(path.join(clientDir, 'intake', 'website-survey.json')) ? path.join(clientDir, 'intake', 'website-survey.json') : '';
    record.outreachPackPath = fs.existsSync(path.join(clientDir, 'outreach', 'outreach-pack.json')) ? path.join(clientDir, 'outreach', 'outreach-pack.json') : '';
    record.outreachMarkdownPath = fs.existsSync(path.join(clientDir, 'outreach', 'outreach-pack.md')) ? path.join(clientDir, 'outreach', 'outreach-pack.md') : '';
    record.outreachEmailDir = fs.existsSync(emailDir) ? emailDir : '';
    record.proofPoints = Array.isArray(outreachPack?.emailBrief?.proofPoints) ? outreachPack.emailBrief.proofPoints.length : record.proofPoints || 0;
    record.assetsReady = Boolean(outreachPack?.assets?.screenshots?.desktop && outreachPack?.assets?.screenshots?.mobile && outreachPack?.assets?.video);
    record.auditVerdict = firstNonEmpty(record.auditVerdict, outreachPack.audit?.verdict);
    record.auditScore = Number.isFinite(outreachPack?.audit?.score) ? outreachPack.audit.score : record.auditScore;
    record.emailDraftReady = emailArtifacts.length > 0;
    record.emailArtifacts = emailArtifacts;
    record.latestEmailArtifact = emailArtifacts[0] || null;
    record.leadNotes = leadNotes;
    record.latestLeadNote = leadNotes[0] || null;
    record.notes = leadNotes;
    record.contactEmails = uniqueValues([
      survey.contact?.email,
      emailArtifacts[0]?.to,
    ]);
    mergeOutreachState(record, emailArtifacts);
    if (!record.nextFollowUpDue && leadNotes[0]?.nextFollowUpDue) {
      record.nextFollowUpDue = leadNotes[0].nextFollowUpDue;
    }
    record.updatedAt = maxDate(record.updatedAt, outreachPack.generatedAt, survey.generatedAt, emailArtifacts[0]?.generatedAt);
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
        record.businessName = firstNonEmpty(record.businessName, caseFile.customer?.company);
        record.company = record.businessName;
        record.customerEmail = firstNonEmpty(record.customerEmail, caseFile.customer?.email);
        record.email = firstNonEmpty(record.email, caseFile.customer?.email, record.email);
        record.phone = firstNonEmpty(record.phone, caseFile.customer?.phone, record.phone);
        record.domain = firstNonEmpty(record.domain, caseFile.customer?.domain);
        record.paymentStatus = firstNonEmpty(record.paymentStatus, caseFile.order?.paymentStatus);
        record.orderId = firstNonEmpty(record.orderId, caseFile.order?.id);
        record.orderTier = firstNonEmpty(record.orderTier, caseFile.order?.tier);
        record.amount = caseFile.order?.amount ?? record.amount ?? null;
        record.currency = firstNonEmpty(record.currency, caseFile.order?.currency, 'USD');
        record.salesThreadId = firstNonEmpty(record.salesThreadId, caseFile.discord?.salesThreadId);
        record.salesWorkspaceChannelId = firstNonEmpty(record.salesWorkspaceChannelId, caseFile.discord?.salesWorkspaceChannelId);
        record.salesWorkspaceName = firstNonEmpty(record.salesWorkspaceName, caseFile.discord?.salesWorkspaceName);
        record.salesWorkspaceTagIds = caseFile.discord?.salesWorkspaceTagIds || record.salesWorkspaceTagIds || [];
        record.websiteTaskThreadId = firstNonEmpty(record.websiteTaskThreadId, caseFile.discord?.websiteTaskThreadId);
        record.previewUrl = firstNonEmpty(record.previewUrl, caseFile.previewUrl);
        record.projectCaseId = firstNonEmpty(record.projectCaseId, caseFile.caseId);
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
        record.businessName = firstNonEmpty(record.businessName, intake.customer?.company);
        record.company = record.businessName;
        record.customerEmail = firstNonEmpty(record.customerEmail, intake.customer?.email);
        record.email = firstNonEmpty(record.email, intake.customer?.email, record.email);
        record.phone = firstNonEmpty(record.phone, intake.customer?.phone, record.phone);
        record.domain = firstNonEmpty(record.domain, intake.customer?.domain);
        record.address = firstNonEmpty(record.address, intake.intake?.address, record.address);
        record.paymentStatus = firstNonEmpty(record.paymentStatus, intake.order?.paymentStatus);
        record.orderId = firstNonEmpty(record.orderId, intake.order?.id, intake.orderId);
        record.orderTier = firstNonEmpty(record.orderTier, intake.order?.tier);
        record.amount = intake.order?.amount ?? record.amount ?? null;
        record.currency = firstNonEmpty(record.currency, intake.order?.currency, record.currency, 'USD');
        record.readinessStatus = firstNonEmpty(record.readinessStatus, intake.readiness?.status);
        record.missing = intake.readiness?.missing || [];
        record.leadRecipientEmail = firstNonEmpty(record.leadRecipientEmail, intake.leadDelivery?.recipientEmail);
        record.contactPageUrl = firstNonEmpty(record.contactPageUrl, intake.intake?.referenceUrl);
      }
      record.updatedAt = maxDate(record.updatedAt, intake.updatedAt);
    }
  }
}

function finalizeLeadRecord(input) {
  const record = { ...input };
  record.contactEmails = uniqueValues([
    record.email,
    record.customerEmail,
    record.leadRecipientEmail,
    ...(record.contactEmails || []),
  ]);
  record.leadId = firstNonEmpty(
    record.leadId,
    record.outreachLeadId && record.outreachProvider ? `${record.outreachProvider}:${record.outreachLeadId}` : '',
    record.clientSlug && record.email ? `${record.clientSlug}:${normalizeEmail(record.email)}` : '',
    record.clientSlug,
  );
  record.outreachStatus = deriveOutreachStatus(record);
  record.replyStatus = firstNonEmpty(record.replyStatus, record.replyState);
  record.followUpDue = firstNonEmpty(record.followUpDue, record.nextFollowUpDue);
  record.provider = firstNonEmpty(record.provider, record.outreachProvider);
  record.externalThreadUrl = firstNonEmpty(record.externalThreadUrl, record.outreachThreadUrl);
  record.status = deriveLeadStatus(record);
  return record;
}

function mergeOutreachState(record, emailArtifacts) {
  const sentArtifact = emailArtifacts.find((artifact) => artifact.outreachState.status === 'sent');
  const repliedArtifact = emailArtifacts.find((artifact) => artifact.outreachState.replyState === 'replied' || artifact.outreachState.status === 'replied');
  const bouncedArtifact = emailArtifacts.find((artifact) => artifact.outreachState.bounceState === 'bounced' || artifact.outreachState.status === 'bounced');
  const latestArtifact = emailArtifacts[0] || null;
  record.outreachSent = emailArtifacts.some((artifact) => artifact.outreachState.status === 'sent');
  record.outreachSentAt = firstNonEmpty(record.outreachSentAt, sentArtifact?.outreachState?.sentAt);
  record.outreachSendId = firstNonEmpty(record.outreachSendId, sentArtifact?.outreachState?.sendId);
  record.outreachProvider = firstNonEmpty(record.outreachProvider, sentArtifact?.outreachState?.provider, repliedArtifact?.outreachState?.provider, bouncedArtifact?.outreachState?.provider);
  record.outreachSourceSystem = firstNonEmpty(record.outreachSourceSystem, sentArtifact?.outreachState?.sourceSystem, repliedArtifact?.outreachState?.sourceSystem, bouncedArtifact?.outreachState?.sourceSystem);
  record.replyState = firstNonEmpty(record.replyState, repliedArtifact?.outreachState?.replyState, repliedArtifact ? 'replied' : '');
  record.replySnippet = firstNonEmpty(record.replySnippet, repliedArtifact?.outreachState?.replySnippet);
  record.nextFollowUpDue = firstNonEmpty(record.nextFollowUpDue, repliedArtifact?.outreachState?.nextFollowUpDue, sentArtifact?.outreachState?.nextFollowUpDue);
  record.bounceState = firstNonEmpty(record.bounceState, bouncedArtifact?.outreachState?.bounceState);
  record.outreachCampaignId = firstNonEmpty(record.outreachCampaignId, sentArtifact?.outreachState?.externalCampaignId, repliedArtifact?.outreachState?.externalCampaignId, bouncedArtifact?.outreachState?.externalCampaignId);
  record.outreachLeadId = firstNonEmpty(record.outreachLeadId, sentArtifact?.outreachState?.externalLeadId, repliedArtifact?.outreachState?.externalLeadId, bouncedArtifact?.outreachState?.externalLeadId);
  record.outreachMessageId = firstNonEmpty(record.outreachMessageId, sentArtifact?.outreachState?.externalMessageId, repliedArtifact?.outreachState?.externalMessageId, bouncedArtifact?.outreachState?.externalMessageId);
  record.outreachThreadUrl = firstNonEmpty(record.outreachThreadUrl, repliedArtifact?.outreachState?.externalThreadUrl, sentArtifact?.outreachState?.externalThreadUrl);
  record.latestProviderEventType = firstNonEmpty(
    record.latestProviderEventType,
    latestArtifact?.providerEvent?.eventType,
    latestArtifact?.providerEvent?.status,
  );
  record.latestProviderEventAt = firstNonEmpty(
    record.latestProviderEventAt,
    latestArtifact?.providerEvent?.receivedAt,
    latestArtifact?.providerEvent?.occurredAt,
    latestArtifact?.generatedAt,
  );
  const artifactWorkspace = emailArtifacts.find((artifact) => artifact.leadWorkspace?.threadId || artifact.leadWorkspace?.channelId)?.leadWorkspace || {};
  record.salesThreadId = firstNonEmpty(record.salesThreadId, artifactWorkspace.threadId);
  record.salesWorkspaceChannelId = firstNonEmpty(record.salesWorkspaceChannelId, artifactWorkspace.channelId);
  record.salesWorkspaceName = firstNonEmpty(record.salesWorkspaceName, artifactWorkspace.name);
  record.salesWorkspaceTagIds = (record.salesWorkspaceTagIds && record.salesWorkspaceTagIds.length)
    ? record.salesWorkspaceTagIds
    : (artifactWorkspace.tagIds || []);
}

function deriveQualificationStatus(survey, evidence, outreachPack) {
  if (survey.customerConfirmed || survey.readyToBuild) return 'qualified';
  if (Array.isArray(evidence.sources) && evidence.sources.length) return 'research_started';
  if (outreachPack.previewUrl) return 'demo_ready';
  return '';
}

function deriveOutreachStatus(record) {
  if (record.paymentStatus === 'paid') return 'paid';
  if (record.replyState === 'replied') return 'replied';
  if (record.bounceState === 'bounced') return 'bounced';
  if (record.nextFollowUpDue) return 'follow_up_due';
  if (record.outreachSent) return 'sent';
  if (record.emailDraftReady) return 'draft_ready';
  if (record.assetsReady && record.previewUrl) return 'demo_ready';
  if (record.outreachPackPath) return 'building_demo';
  return 'lead';
}

function deriveLeadStatus(record) {
  if (record.paymentStatus === 'paid') return 'paid';
  if (record.replyState === 'replied') return 'engaged';
  if (record.bounceState === 'bounced') return 'blocked';
  if (record.nextFollowUpDue) return 'follow_up_due';
  if (record.outreachSent) return 'contacted';
  if (record.emailDraftReady) return 'ready_to_send';
  if (record.assetsReady && record.previewUrl) return 'demo_ready';
  return 'lead';
}

function ensureRecord(records, clientSlug) {
  if (!records.has(clientSlug)) {
    records.set(clientSlug, {
      leadId: '',
      clientSlug,
      businessName: '',
      company: '',
      niche: '',
      status: '',
      previewUrl: '',
      address: '',
      phone: '',
      email: '',
      customerEmail: '',
      leadRecipientEmail: '',
      contactEmails: [],
      websiteUrl: '',
      contactPageUrl: '',
      googleMapsUrl: '',
      googlePlaceId: '',
      menuUrl: '',
      reservationUrl: '',
      logoUrl: '',
      hasWebsite: false,
      evidenceSources: [],
      qualificationStatus: '',
      outreachStatus: '',
      replyStatus: '',
      followUpDue: '',
      notes: [],
      provider: '',
      externalThreadUrl: '',
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
      leadNotes: [],
      latestLeadNote: null,
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
      latestProviderEventType: '',
      latestProviderEventAt: '',
      replyState: '',
      replySnippet: '',
      nextFollowUpDue: '',
      bounceState: '',
      outreachPackPath: '',
      outreachMarkdownPath: '',
      outreachEmailDir: '',
      websiteSurveyPath: '',
      contentPath: '',
      casePath: '',
      caseStatus: '',
      paidIntakePath: '',
      paidIntakeStatus: '',
      readinessStatus: '',
      readiness: '',
      missing: [],
      salesThreadId: '',
      salesWorkspaceChannelId: '',
      salesWorkspaceName: '',
      salesWorkspaceTagIds: [],
      websiteTaskThreadId: '',
      projectCaseId: '',
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
        leadWorkspace: json.leadWorkspace || null,
        outreachState: normalizeOutreachArtifactState(json),
      };
    })
    .sort((a, b) => String(b.generatedAt || '').localeCompare(String(a.generatedAt || '')));
}

function readJsonIfExists(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function firstEvidenceUrl(evidence, sourceType) {
  const source = (Array.isArray(evidence?.sources) ? evidence.sources : [])
    .find((item) => item?.sourceType === sourceType && item?.sourceUrl);
  return source?.sourceUrl || '';
}

function extractPlaceIdFromEvidence(evidence) {
  const sourceUrl = firstEvidenceUrl(evidence, 'google_places');
  const match = String(sourceUrl).match(/[?&]cid=(\d+)/);
  return match?.[1] || '';
}

function findQaLink(outreachPack, label) {
  const checked = outreachPack?.qa?.links?.checked;
  if (!Array.isArray(checked)) return '';
  return checked.find((item) => item?.label === label)?.value || '';
}

function titleFromSlug(slug) {
  return String(slug || '')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (Array.isArray(value) && value.length) return value;
    if (value && typeof value === 'object') return value;
  }
  return '';
}

function uniqueValues(values) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function newer(left, right) {
  return String(left || '') > String(right || '');
}

function maxDate(...values) {
  return values.filter(Boolean).sort().slice(-1)[0] || '';
}
