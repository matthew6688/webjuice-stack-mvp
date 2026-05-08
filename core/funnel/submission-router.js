import fs from 'fs';
import path from 'path';
import { buildCaseReference, recordCaseNotification, recordFunnelCaseEvent } from '../cases/case-file.js';
import { appendLedgerEvent, DEFAULT_LEDGER_PATH } from '../finance/ledger.js';
import { artifactTimestamp } from '../time.js';
import { buildOpenDesignWorkspace } from '../open-design/workspace.js';
import { buildFunnelCustomerEmail, sendCustomerEmail } from './customer-email.js';
import { createOrUpdateForumWorkspace } from './discord-workspace.js';
import {
  buildDiscordMessage,
  buildWebsiteAgentHandoffMessage,
  sendDiscordChannelMessage,
  sendDiscordThreadedMessage,
  sendDiscordWebhook,
} from './discord.js';
import { addExtraRevisionEntitlement, consumeRevisionEntitlement, createEntitlementFromOrder } from './entitlements.js';
import { loadLeadRegistry, resolveLeadByEmail } from './lead-registry.js';
import { normalizeStripeCheckoutEvent, stripeRevenueLedgerInput } from './stripe.js';
import { normalizeTallySubmission, tallyRevenueLedgerInput } from './tally.js';
import { assessPaidIntakeReadiness } from './paid-intake-readiness.js';

export function classifyFunnelSubmission(order) {
  if (order.orderKind === 'paid_intake') return 'paid_intake';
  if (order.tier === 'extra_revision') return 'extra_revision';
  const hasRevenue = Number(order.amount || 0) > 0 || ['one_time', 'yearly_maintenance'].includes(order.tier);
  return hasRevenue ? 'sale' : 'revision';
}

export async function routeFunnelSubmission(payload, options = {}) {
  const provider = options.provider || detectProvider(payload);
  let order = provider === 'stripe'
    ? normalizeStripeCheckoutEvent(payload, { ...process.env, ...(options.env || {}) })
    : normalizeTallySubmission(payload, { ...process.env, ...(options.env || {}) });
  order = resolveOrderLeadContext(order, options);
  const kind = options.kind || classifyFunnelSubmission(order);
  const caseOrder = kind === 'extra_revision' && order.parentOrderId
    ? { ...order, orderId: order.parentOrderId }
    : order;
  const clientSlug = order.clientSlug || 'unknown-client';
  const submissionId = safeId(submissionKey(kind, order));
  const taskPath = options.taskPath || path.join(
    options.tasksDir || 'data/agent-tasks',
    clientSlug,
    `${kind}-${submissionId}.json`,
  );
  const submissionPath = options.submissionPath || path.join(
    options.submissionsDir || 'data/funnel/submissions',
    clientSlug,
    `${kind}-${submissionId}.json`,
  );
  if (!options.dryRun && fs.existsSync(submissionPath)) {
    const existing = readJson(submissionPath);
    return {
      ok: true,
      duplicate: true,
      provider,
      kind,
      order,
      task: null,
      taskPath: null,
      submissionPath,
      entitlement: null,
      ledgerEvent: null,
      discord: { ok: false, skipped: true, reason: 'duplicate_submission' },
      websiteAgentHandoff: { ok: false, skipped: true, reason: 'duplicate_submission' },
      customerEmail: { ok: false, skipped: true, reason: 'duplicate_submission' },
      discordPayload: null,
      caseRecord: null,
      existing,
    };
  }
  const caseRef = buildCaseReference(caseOrder, { casesDir: options.casesDir });
  let entitlement = null;
  if (kind === 'revision') {
    entitlement = consumeRevisionEntitlement(order, {
      entitlementsDir: options.entitlementsDir,
      dryRun: options.dryRun,
    });
    if (!entitlement.ok && !options.allowOverLimit) {
      const emailMessage = buildFunnelCustomerEmail({
        kind,
        order,
        entitlement,
        extraRevisionUrl: options.extraRevisionUrl || options.env?.EXTRA_REVISION_CHECKOUT_URL || process.env.EXTRA_REVISION_CHECKOUT_URL || '',
      });
      let customerEmail = { ok: false, skipped: true };
      if (options.sendEmail && emailMessage && !options.dryRun) {
        customerEmail = await sendCustomerEmail({ ...process.env, ...(options.env || {}) }, emailMessage, {
          ...options,
          clientSlug: order.clientSlug,
          campaignId: order.campaignId || options.campaignId || null,
          emailMetadata: { kind, orderId: order.orderId || '', outcome: 'revision_denied' },
        });
      }
      if (!options.dryRun) {
        writeJson(submissionPath, {
          schemaVersion: 1,
          kind: 'revision_denied',
          receivedAt: artifactTimestamp(),
          order,
          entitlement,
          payload,
        });
      }
      const caseRecord = recordFunnelCaseEvent({
        kind,
        provider,
        order,
        entitlement,
        submissionPath,
        payload,
        ok: false,
        reason: entitlement.reason,
        casesDir: options.casesDir,
        dryRun: options.dryRun,
      });
      return {
        ok: false,
        provider,
        kind,
        order,
        entitlement,
        task: null,
        taskPath: null,
        submissionPath,
        ledgerEvent: null,
        discord: { ok: false, skipped: true },
        customerEmail,
        discordPayload: buildDiscordMessage({ kind, order, task: null }),
        caseRecord,
      };
    }
  }
  if (kind === 'sale') {
    entitlement = {
      ok: true,
      reason: 'entitlement_created',
      entitlement: createEntitlementFromOrder(order, {
        entitlementsDir: options.entitlementsDir,
        dryRun: options.dryRun,
      }),
    };
  }
  if (kind === 'paid_intake') {
    if (!options.dryRun) {
      writeJson(submissionPath, {
        schemaVersion: 1,
        kind,
        receivedAt: artifactTimestamp(),
        order,
        payload,
      });
    }
    const ledgerEvent = !options.dryRun
      ? appendLedgerEvent(
        provider === 'stripe' ? stripeRevenueLedgerInput(order) : tallyRevenueLedgerInput(order),
        options.ledgerPath || DEFAULT_LEDGER_PATH,
      )
      : null;
    const paidIntake = buildPaidIntakeRecord({ order, provider, submissionPath, ledgerEvent });
    const paidIntakePath = path.join(
      options.paidIntakesDir || 'data/paid-intakes',
      clientSlug,
      `${submissionId}.json`,
    );
    if (!options.dryRun) {
      writeJson(paidIntakePath, paidIntake);
    }
    let caseRecord = recordFunnelCaseEvent({
      kind,
      provider,
      order,
      submissionPath,
      ledgerEvent,
      payload,
      ok: true,
      casesDir: options.casesDir,
      dryRun: options.dryRun,
    });
    const discordPayload = buildDiscordMessage({ kind, order, task: null });
    let discord = { ok: false, skipped: true };
    const webhookUrl = options.salesWebhookUrl || options.env?.SALES_DISCORD_WEBHOOK_URL || process.env.SALES_DISCORD_WEBHOOK_URL;
    if (options.sendDiscord && webhookUrl && !options.dryRun) {
      discord = await sendDiscordWebhook(webhookUrl, discordPayload, {
        ...options,
        botToken: options.discordBotToken || options.env?.DISCORD_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN || '',
        threadName: discordThreadName(kind, order),
      });
    }
    let customerEmail = { ok: false, skipped: true };
    const emailMessage = buildFunnelCustomerEmail({ kind, order, entitlement: null });
    if (options.sendEmail && emailMessage && !options.dryRun) {
      customerEmail = await sendCustomerEmail({ ...process.env, ...(options.env || {}) }, emailMessage, {
        ...options,
        clientSlug: order.clientSlug,
        campaignId: order.campaignId || options.campaignId || null,
        emailMetadata: { kind, orderId: order.orderId || '', outcome: 'paid_intake_created' },
      });
    }
    let leadWorkspace = { ok: false, skipped: true };
    if (!options.dryRun) {
      leadWorkspace = await sendLeadWorkspaceUpdate({
        kind,
        order,
        payload: discordPayload,
        caseRecord,
        options,
      });
    }
    if (leadWorkspace.ok) {
      caseRecord = recordCaseLeadWorkspace(caseRecord, leadWorkspace, options);
    }
    return {
      ok: true,
      provider,
      kind,
      order,
      task: null,
      taskPath: null,
      paidIntake,
      paidIntakePath,
      submissionPath,
      entitlement: null,
      ledgerEvent,
      discord,
      leadWorkspace,
      websiteAgentHandoff: { ok: false, skipped: true, reason: 'paid_intake_needs_structured_intake' },
      customerEmail,
      discordPayload,
      caseRecord,
    };
  }
  if (kind === 'extra_revision') {
    entitlement = addExtraRevisionEntitlement(order, {
      entitlementsDir: options.entitlementsDir,
      dryRun: options.dryRun,
    });
    if (!options.dryRun) {
      writeJson(submissionPath, {
        schemaVersion: 1,
        kind,
        receivedAt: artifactTimestamp(),
        order,
        entitlement,
        payload,
      });
    }
    const ledgerEvent = !options.dryRun
      ? appendLedgerEvent(
        provider === 'stripe' ? stripeRevenueLedgerInput(order) : tallyRevenueLedgerInput(order),
        options.ledgerPath || DEFAULT_LEDGER_PATH,
      )
      : null;
    let customerEmail = { ok: false, skipped: true };
    const emailMessage = buildFunnelCustomerEmail({ kind, order, entitlement });
    if (options.sendEmail && emailMessage && !options.dryRun) {
      customerEmail = await sendCustomerEmail({ ...process.env, ...(options.env || {}) }, emailMessage, {
        ...options,
        clientSlug: order.clientSlug,
        campaignId: order.campaignId || options.campaignId || null,
        emailMetadata: { kind, orderId: order.orderId || '', outcome: entitlement?.reason || '' },
      });
    }
    const caseRecord = recordFunnelCaseEvent({
      kind,
      provider,
      order: caseOrder,
      entitlement,
      submissionPath,
      ledgerEvent,
      payload,
      ok: entitlement.ok,
      reason: entitlement.reason,
      casesDir: options.casesDir,
      dryRun: options.dryRun,
    });
    return {
      ok: entitlement.ok,
      provider,
      kind,
      order,
      task: null,
      taskPath: null,
      submissionPath,
      entitlement,
      ledgerEvent,
      discord: { ok: false, skipped: true },
      websiteAgentHandoff: { ok: false, skipped: true, reason: 'extra_revision_no_agent_task' },
      customerEmail,
      discordPayload: buildDiscordMessage({ kind, order, task: null }),
      caseRecord,
    };
  }

  const task = buildAgentTask({ kind, order, submissionId, entitlement, caseRef });

  if (!options.dryRun) {
    writeJson(taskPath, task);
    writeJson(submissionPath, {
      schemaVersion: 1,
      kind,
      receivedAt: artifactTimestamp(),
      order,
      payload,
    });
  }

  let ledgerEvent = null;
  if (kind === 'sale') {
    if (!options.dryRun) {
      ledgerEvent = appendLedgerEvent(
        provider === 'stripe' ? stripeRevenueLedgerInput(order) : tallyRevenueLedgerInput(order),
        options.ledgerPath || DEFAULT_LEDGER_PATH,
      );
    }
  }

  const discordPayload = buildDiscordMessage({
    kind,
    order,
    task: { ...task, taskPath },
  });
  let discord = { ok: false, skipped: true };
  const webhookUrl = kind === 'sale'
    ? options.salesWebhookUrl || options.env?.SALES_DISCORD_WEBHOOK_URL || process.env.SALES_DISCORD_WEBHOOK_URL
    : options.reviseWebhookUrl || options.env?.REVISE_DISCORD_WEBHOOK_URL || process.env.REVISE_DISCORD_WEBHOOK_URL;
  if (options.sendDiscord && webhookUrl && !options.dryRun) {
    discord = await sendDiscordWebhook(webhookUrl, discordPayload, {
      ...options,
      botToken: options.discordBotToken || options.env?.DISCORD_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN || '',
      threadName: discordThreadName(kind, order),
    });
  }

  let customerEmail = { ok: false, skipped: true };
  const emailMessage = buildFunnelCustomerEmail({
    kind,
    order,
    entitlement,
    extraRevisionUrl: options.extraRevisionUrl || options.env?.EXTRA_REVISION_CHECKOUT_URL || process.env.EXTRA_REVISION_CHECKOUT_URL || '',
  });
  if (options.sendEmail && emailMessage && !options.dryRun) {
    customerEmail = await sendCustomerEmail({ ...process.env, ...(options.env || {}) }, emailMessage, {
      ...options,
      clientSlug: order.clientSlug,
      campaignId: order.campaignId || options.campaignId || null,
      emailMetadata: { kind, orderId: order.orderId || '', outcome: entitlement?.reason || '' },
    });
  }

  let caseRecord = recordFunnelCaseEvent({
    kind,
    provider,
    order,
    entitlement,
    task,
    taskPath,
    submissionPath,
    ledgerEvent,
    discord,
    payload,
    ok: true,
    casesDir: options.casesDir,
    dryRun: options.dryRun,
  });
  let leadWorkspace = { ok: false, skipped: true };
  if (kind === 'sale' && !options.dryRun) {
    leadWorkspace = await sendLeadWorkspaceUpdate({
      kind,
      order,
      payload: discordPayload,
      caseRecord,
      options,
    });
    if (leadWorkspace.ok) {
      caseRecord = recordCaseLeadWorkspace(caseRecord, leadWorkspace, options);
    }
  }
  const websiteAgentHandoff = await sendWebsiteAgentHandoff({
    kind,
    order,
    task: { ...task, taskPath },
    caseRecord,
    options,
  });
  if (websiteAgentHandoff.ok && !options.dryRun) {
    caseRecord = recordCaseWebsiteHandoff(caseRecord, websiteAgentHandoff, kind, options);
  }

  return {
    ok: true,
    provider,
    kind,
    order,
    task,
    taskPath,
    submissionPath,
    entitlement,
    ledgerEvent,
    discord,
    leadWorkspace,
    websiteAgentHandoff,
    customerEmail,
    discordPayload,
    caseRecord,
  };
}

function buildPaidIntakeRecord({ order, provider, submissionPath, ledgerEvent }) {
  const now = artifactTimestamp();
  const record = {
    schemaVersion: 1,
    status: 'paid_intake_pending_preview',
    order: {
      id: order.orderId,
      provider,
      tier: order.tier,
      amount: order.amount,
      currency: order.currency,
      paymentStatus: order.paymentStatus,
    },
    clientSlug: order.clientSlug,
    repo: order.repo,
    template: order.template,
    previewUrl: order.previewUrl,
    customer: {
      company: order.company,
      email: order.email,
      phone: order.phone || '',
      domain: order.domain || '',
    },
    intake: {
      launchNotes: order.feedback || '',
      referenceUrl: order.referenceUrl || '',
      files: order.files || [],
      assets: [],
      assetManifestUrl: order.assetManifestUrl || '',
      assetManifestPublicId: order.assetManifestPublicId || '',
      source: 'direct_checkout',
    },
    paths: {
      submissionPath,
    },
    ledgerEventId: ledgerEvent?.id || '',
    createdAt: now,
    updatedAt: now,
  };
  return {
    ...record,
    readiness: assessPaidIntakeReadiness(record),
  };
}

async function sendWebsiteAgentHandoff({ kind, order, task, caseRecord, options }) {
  const env = { ...process.env, ...(options.env || {}) };
  const channelId = options.websiteProjectsChannelId
    || env.WEBSITE_PROJECTS_DISCORD_CHANNEL_ID
    || options.websiteTasksChannelId
    || env.WEBSITE_TASKS_DISCORD_CHANNEL_ID
    || '';
  const botToken = options.websiteTasksBotToken || env.WEBSITE_TASKS_DISCORD_BOT_TOKEN || '';
  const mention = options.websiteAgentMention || env.WEBSITE_AGENT_MENTION || '';
  if (!options.sendDiscord || options.dryRun) {
    return { ok: false, skipped: true, reason: options.dryRun ? 'dry_run' : 'send_discord_disabled' };
  }
  if (!channelId || !botToken || !mention) {
    return {
      ok: false,
      skipped: true,
      reason: 'missing_website_agent_handoff_config',
      needs: ['WEBSITE_PROJECTS_DISCORD_CHANNEL_ID or WEBSITE_TASKS_DISCORD_CHANNEL_ID', 'WEBSITE_TASKS_DISCORD_BOT_TOKEN', 'WEBSITE_AGENT_MENTION'],
    };
  }
  const payload = buildWebsiteAgentHandoffMessage({ kind, order, task, caseRecord, mention });
  const existingThreadId = caseRecord?.caseFile?.discord?.websiteTaskThreadId || '';
  const discord = await createOrUpdateForumWorkspace({
    workspace: 'projects',
    channelId,
    botToken,
    payload,
    existingThreadId,
    kind,
    order,
    caseFile: caseRecord?.caseFile || null,
    revision: caseRecord?.caseFile?.revision || null,
    fetchImpl: options.fetchImpl || fetch,
  });
  if (existingThreadId) {
    discord.threadId = existingThreadId;
    discord.threadReused = true;
  }
  return { ok: true, discord, payload };
}

function recordCaseWebsiteHandoff(caseRecord, handoff, kind, options) {
  const paths = caseRecord?.caseFile?.paths || caseRecord?.ref || {};
  const record = recordCaseNotification(paths, {
    type: 'website_agent_handoff_sent',
    kind: 'website_task',
    ok: true,
    channel: 'discord',
    reason: `${kind || 'task'}_handoff`,
    discord: handoff.discord,
  }, {
    dryRun: options.dryRun,
  });
  return record.ok ? record : caseRecord;
}

async function sendLeadWorkspaceUpdate({ kind, order, payload, caseRecord, options }) {
  const env = { ...process.env, ...(options.env || {}) };
  const channelId = options.websiteLeadsChannelId || env.WEBSITE_LEADS_DISCORD_CHANNEL_ID || '';
  const botToken = options.websiteTasksBotToken || env.WEBSITE_TASKS_DISCORD_BOT_TOKEN || env.DISCORD_BOT_TOKEN || '';
  if (!options.sendDiscord || options.dryRun) return { ok: false, skipped: true, reason: options.dryRun ? 'dry_run' : 'send_discord_disabled' };
  if (!channelId || !botToken) return { ok: false, skipped: true, reason: 'missing_website_leads_config' };
  const existingThreadId = caseRecord?.caseFile?.discord?.salesThreadId || '';
  const parentPayload = {
    content: `Lead workspace: ${order.company || order.clientSlug}\nkind: ${kind}\nemail: ${order.email || 'N/A'}`,
    allowed_mentions: { parse: [] },
  };
  const discord = await createOrUpdateForumWorkspace({
    workspace: 'leads',
    channelId,
    botToken,
    payload,
    existingThreadId,
    kind,
    order,
    caseFile: caseRecord?.caseFile || null,
    fetchImpl: options.fetchImpl || fetch,
    parentPayload,
  });
  return { ok: true, discord, payload };
}

function recordCaseLeadWorkspace(caseRecord, leadWorkspace, options) {
  const paths = caseRecord?.caseFile?.paths || caseRecord?.ref || {};
  const record = recordCaseNotification(paths, {
    type: 'lead_workspace_discord_sent',
    kind: 'sale',
    ok: true,
    channel: 'discord',
    reason: 'lead_workspace',
    discord: leadWorkspace.discord,
  }, {
    dryRun: options.dryRun,
  });
  return record.ok ? record : caseRecord;
}

function discordThreadName(kind, order) {
  const label = kind === 'sale' ? 'sale' : 'revision';
  const client = order.company || order.businessName || order.clientSlug || 'client';
  const orderId = order.orderId || order.rawSubmissionId || '';
  return `${client}-${label}-${orderId}`
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}

function detectProvider(payload) {
  if (payload?.type?.startsWith?.('checkout.') || payload?.object === 'event' || payload?.data?.object?.object === 'checkout.session') {
    return 'stripe';
  }
  return 'tally';
}

export function buildAgentTask({ kind, order, submissionId, entitlement = null, caseRef = null }) {
  const isSale = kind === 'sale';
  return {
    schemaVersion: 1,
    id: `${kind}_${order.clientSlug || 'unknown'}_${submissionId}`,
    kind,
    status: 'queued',
    executionMode: kind === 'revision' ? 'local_open_design' : 'remote_artifact_runner',
    createdAt: artifactTimestamp(),
    clientSlug: order.clientSlug,
    repo: order.repo,
    branch: 'dev',
    previewUrl: order.previewUrl,
    customer: {
      company: order.company,
      email: order.email,
      phone: order.phone || '',
      domain: order.domain,
    },
    order: {
      id: order.orderId,
      tier: order.tier,
      amount: order.amount,
      currency: order.currency,
    },
    requestedChanges: order.feedback || '',
    case: caseRef ? {
      id: caseRef.caseId,
      dir: caseRef.dir,
      casePath: caseRef.casePath,
      contextPath: caseRef.contextPath,
      timelinePath: caseRef.timelinePath,
      decisionsPath: caseRef.decisionsPath,
      customerMessagesPath: caseRef.customerMessagesPath,
      agentRunsPath: caseRef.agentRunsPath,
      buildPacketPath: caseRef.buildPacketPath,
    } : null,
    requiredContext: requiredContext(order.clientSlug),
    designProtocol: designProtocol(kind),
    openDesign: openDesignWorkspace(order.clientSlug),
    productionHandoffPath: `clients/${order.clientSlug}/concept/open-design/production-handoff.json`,
    allowedFiles: allowedFilesFor(kind),
    activeConstraints: [
      'Read the case context packet before planning edits.',
      'Website and menu are separate products; classify the request before editing.',
      'Use evidence/content/design/brand files as source of truth.',
      'Do not invent or overwrite menu prices, hours, address, phone, reservation links, or photos without evidence.',
      'Do not overwrite locked decisions from the case file.',
      'Push only to dev until customer approval.',
    ],
    entitlement: entitlement?.entitlement ? {
      orderId: entitlement.entitlement.orderId,
      tier: entitlement.entitlement.tier,
      revisionPolicy: entitlement.entitlement.revisionPolicy,
      revisionUsed: entitlement.entitlement.revisionUsed,
      revisionStatus: entitlement.reason,
    } : null,
    referenceUrl: order.referenceUrl || '',
    files: order.files || [],
    instructions: isSale ? saleInstructions(order) : revisionInstructions(order),
    completion: {
      deployBranch: 'dev',
      notifyDiscord: true,
      sendCustomerReviewEmail: true,
      customerReviewUrl: order.previewUrl || '',
    },
  };
}

function openDesignWorkspace(clientSlug) {
  return buildOpenDesignWorkspace(clientSlug);
}

function requiredContext(clientSlug) {
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

function designProtocol(kind) {
  return {
    requiredSkill: 'huashu-design',
    supportingSkills: ['web-prototype', 'saas-landing', 'design', 'frontend-design', 'design-review', 'critique'],
    openDesignSkills: ['web-prototype', 'saas-landing', 'design-brief', 'critique', 'tweaks'],
    routeType: kind === 'revision' ? 'classify_from_customer_request' : 'website',
    rules: [
      'Official website work must look like a real formal website with brand hierarchy, not a data dump.',
      'Menu work must stay minimal, mobile-first, and content-focused.',
      'Preserve the existing design language unless the task explicitly asks for redesign.',
      'Use real restaurant photos and verified brand assets whenever available.',
    ],
  };
}

function allowedFilesFor(kind) {
  const common = [
    'src/**',
    'public/**',
    'content.restaurant.json',
    'design.restaurant.json',
    'brand-spec.md',
  ];
  if (kind === 'revision') return common;
  return [...common, 'src/data/**', 'README.md'];
}

function saleInstructions(order) {
  return [
    `Customer purchased ${order.tier || 'website'} for ${order.clientSlug}.`,
    'Verify the checkout submission and hidden repo fields.',
    'If launch notes include content changes, apply them on the dev branch first.',
    'Prepare domain onboarding instructions based on the preferred domain field.',
    'After dev deploy succeeds, post the review link in the sales Discord thread and prepare a customer email.',
  ];
}

function revisionInstructions(order) {
  return [
    `Customer requested revisions for ${order.clientSlug}.`,
    'Find the target repository from the hidden repo field.',
    'Apply requested changes on the dev branch only.',
    'Run build and preview QA before pushing.',
    'After dev deploy succeeds, post the updated preview link in the revision Discord thread and prepare a customer review email.',
  ];
}

function resolveOrderLeadContext(order, options = {}) {
  const maybeUnknownClient = !order?.clientSlug || order.clientSlug === 'unknown-client' || order.clientSlug === 'unknown';
  const hasUsefulEmail = Boolean(order?.email && order.email !== 'N/A');
  if (!maybeUnknownClient && !hasUsefulEmail) return order;

  const registry = loadLeadRegistry({
    clientsRoot: options.clientsRoot || 'clients',
    casesRoot: options.casesRoot || 'data/cases',
    paidIntakesRoot: options.paidIntakesRoot || 'data/paid-intakes',
  });
  const match = resolveLeadByEmail(registry, order.email);
  if (!match.ok || !match.match?.clientSlug) return order;

  const lead = match.match;
  return {
    ...order,
    clientSlug: maybeUnknownClient ? lead.clientSlug : order.clientSlug,
    company: firstNonEmpty(order.company, lead.businessName, lead.company),
    domain: firstNonEmpty(order.domain, lead.domain),
    previewUrl: firstNonEmpty(order.previewUrl, lead.previewUrl),
    leadMatch: {
      reason: match.reason,
      clientSlug: lead.clientSlug,
      leadId: lead.leadId || '',
      email: lead.email || lead.customerEmail || lead.leadRecipientEmail || '',
    },
  };
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function safeId(value) {
  return String(value || 'unknown')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'unknown';
}

function submissionKey(kind, order) {
  if (kind === 'revision') {
    return order.rawSubmissionId || `${order.orderId || 'revision'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
  return order.orderId || order.rawSubmissionId || Date.now();
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}
