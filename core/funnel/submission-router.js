import fs from 'fs';
import path from 'path';
import { buildCaseReference, recordFunnelCaseEvent } from '../cases/case-file.js';
import { appendLedgerEvent, DEFAULT_LEDGER_PATH } from '../finance/ledger.js';
import { artifactTimestamp } from '../time.js';
import { buildFunnelCustomerEmail, sendCustomerEmail } from './customer-email.js';
import { buildDiscordMessage, sendDiscordWebhook } from './discord.js';
import { consumeRevisionEntitlement, createEntitlementFromOrder } from './entitlements.js';
import { normalizeStripeCheckoutEvent, stripeRevenueLedgerInput } from './stripe.js';
import { normalizeTallySubmission, tallyRevenueLedgerInput } from './tally.js';

export function classifyFunnelSubmission(order) {
  const hasRevenue = Number(order.amount || 0) > 0 || ['one_time', 'yearly_maintenance'].includes(order.tier);
  return hasRevenue ? 'sale' : 'revision';
}

export async function routeFunnelSubmission(payload, options = {}) {
  const provider = options.provider || detectProvider(payload);
  const order = provider === 'stripe'
    ? normalizeStripeCheckoutEvent(payload, { ...process.env, ...(options.env || {}) })
    : normalizeTallySubmission(payload, { ...process.env, ...(options.env || {}) });
  const kind = options.kind || classifyFunnelSubmission(order);
  const clientSlug = order.clientSlug || 'unknown-client';
  const submissionId = safeId(order.orderId || order.rawSubmissionId || Date.now());
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
  const caseRef = buildCaseReference(order, { casesDir: options.casesDir });
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
        customerEmail = await sendCustomerEmail({ ...process.env, ...(options.env || {}) }, emailMessage, options);
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
    discord = await sendDiscordWebhook(webhookUrl, discordPayload, options);
  }

  let customerEmail = { ok: false, skipped: true };
  const emailMessage = buildFunnelCustomerEmail({
    kind,
    order,
    entitlement,
    extraRevisionUrl: options.extraRevisionUrl || options.env?.EXTRA_REVISION_CHECKOUT_URL || process.env.EXTRA_REVISION_CHECKOUT_URL || '',
  });
  if (options.sendEmail && emailMessage && !options.dryRun) {
    customerEmail = await sendCustomerEmail({ ...process.env, ...(options.env || {}) }, emailMessage, options);
  }

  const caseRecord = recordFunnelCaseEvent({
    kind,
    provider,
    order,
    entitlement,
    task,
    taskPath,
    submissionPath,
    ledgerEvent,
    payload,
    ok: true,
    casesDir: options.casesDir,
    dryRun: options.dryRun,
  });

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
    customerEmail,
    discordPayload,
    caseRecord,
  };
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
    } : null,
    requiredContext: requiredContext(order.clientSlug),
    designProtocol: designProtocol(kind),
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

function requiredContext(clientSlug) {
  const prefix = clientSlug ? `clients/${clientSlug}` : 'clients/<clientSlug>';
  return {
    evidence: `${prefix}/evidence/evidence.json`,
    content: `${prefix}/content.restaurant.json`,
    design: `${prefix}/design.restaurant.json`,
    brandSpec: `${prefix}/brand-spec.md`,
    checkout: `${prefix}/funnel/checkout.json`,
  };
}

function designProtocol(kind) {
  return {
    requiredSkill: 'huashu-design',
    supportingSkills: ['design', 'frontend-design', 'design-review'],
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

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function safeId(value) {
  return String(value || 'unknown')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'unknown';
}
