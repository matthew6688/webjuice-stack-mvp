import fs from 'fs';
import path from 'path';
import { appendLedgerEvent, DEFAULT_LEDGER_PATH } from '../finance/ledger.js';
import { artifactTimestamp } from '../time.js';
import { buildDiscordMessage, sendDiscordWebhook } from './discord.js';
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
  const task = buildAgentTask({ kind, order, submissionId });
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
  if (kind === 'sale' && !options.dryRun) {
    ledgerEvent = appendLedgerEvent(
      provider === 'stripe' ? stripeRevenueLedgerInput(order) : tallyRevenueLedgerInput(order),
      options.ledgerPath || DEFAULT_LEDGER_PATH,
    );
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

  return {
    ok: true,
    provider,
    kind,
    order,
    task,
    taskPath,
    submissionPath,
    ledgerEvent,
    discord,
    discordPayload,
  };
}

function detectProvider(payload) {
  if (payload?.type?.startsWith?.('checkout.') || payload?.object === 'event' || payload?.data?.object?.object === 'checkout.session') {
    return 'stripe';
  }
  return 'tally';
}

export function buildAgentTask({ kind, order, submissionId }) {
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
