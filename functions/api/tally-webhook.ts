import type { PagesFunction } from '@cloudflare/workers-types';
import { normalizeTallySubmission, tallyRevenueLedgerInput } from '../../core/funnel/tally.js';

interface Env {
  DISCORD_WEBHOOK_URL?: string;
  AGENT_WEBHOOK_URL?: string;
  ROI_WEBHOOK_URL?: string;
  DEFAULT_CAMPAIGN_ID?: string;
  ROI_CURRENCY?: string;
  TALLY_TIER_PRICES?: string;
}

/**
 * Tally.so webhook handler
 * Receives form submissions and forwards to Discord
 *
 * Tally webhook setup:
 * 1. Go to your Tally form > Integrations > Webhooks
 * 2. Add endpoint: https://your-site.com/api/tally-webhook
 * 3. Form should include hidden fields: repo, template, tally_order_id, campaign_id, preview_url, client_slug
 */

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const payload = await context.request.json();

    const order = normalizeTallySubmission(payload, context.env);
    const revenueEvent = tallyRevenueLedgerInput(order);
    const agentTask = taskFromTallyOrderEdgeSafe(order);

    // Build Discord message
    const discordPayload = {
      username: 'WebJuice Orders',
      embeds: [{
        title: `New Order: ${order.company}`,
        color: 0x00ff00,
        fields: [
          { name: 'Repo', value: order.repo, inline: true },
          { name: 'Template', value: order.template, inline: true },
          { name: 'Order ID', value: order.orderId, inline: true },
          { name: 'Tier', value: order.tier, inline: true },
          { name: 'Amount', value: `${order.currency} ${order.amount}`, inline: true },
          { name: 'Email', value: order.email, inline: true },
          { name: 'Preview', value: order.previewUrl || 'None', inline: false },
          { name: 'Domain', value: order.domain || 'None', inline: false },
          { name: 'Reference', value: order.referenceUrl || 'None', inline: false },
          { name: 'Feedback', value: order.feedback.slice(0, 1000) || 'None', inline: false },
          { name: 'Files', value: order.files.length > 0 ? order.files.join('\n') : 'None', inline: false },
        ],
        timestamp: new Date().toISOString(),
      }],
    };

    // Send to Discord if webhook configured
    if (context.env.DISCORD_WEBHOOK_URL) {
      await fetch(context.env.DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(discordPayload),
      });
    }

    if (context.env.ROI_WEBHOOK_URL) {
      await fetch(context.env.ROI_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order, revenueEvent }),
      });
    }

    if (context.env.AGENT_WEBHOOK_URL) {
      await fetch(context.env.AGENT_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: agentTask,
          revenueEvent,
          nextAction: 'prepare_customer_activation',
        }),
      });
    }

    return new Response(JSON.stringify({ success: true, order, revenueEvent, agentTask }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Webhook error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

function taskFromTallyOrderEdgeSafe(order: ReturnType<typeof normalizeTallySubmission>) {
  const taskType = order.feedback ? 'revise' : 'activate';
  return {
    schemaVersion: 1,
    id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    clientSlug: order.clientSlug,
    type: taskType,
    repo: order.repo,
    branch: 'dev',
    evidencePath: defaultClientPath(order.clientSlug, 'evidence/evidence.json'),
    contentPath: defaultClientPath(order.clientSlug, 'content.restaurant.json'),
    designPath: defaultClientPath(order.clientSlug, 'design.restaurant.json'),
    checkoutPath: defaultClientPath(order.clientSlug, 'funnel/checkout.json'),
    createdFrom: order.feedback ? 'tally_feedback' : 'tally_payment',
    createdAt: new Date().toISOString(),
    order,
    acceptanceCriteria: taskType === 'revise'
      ? [
          'Apply customer requested revisions only.',
          'Keep real menu evidence and source links intact.',
          'Deploy the dev preview and capture screenshots.',
          'Summarize changes for customer review.',
        ]
      : [
          'Apply validated content/design/checkout artifacts to the client repo.',
          'Deploy the dev preview successfully.',
          'Run link QA and capture updated screenshots.',
          'Prepare domain onboarding instructions when a domain is present.',
        ],
  };
}

function defaultClientPath(clientSlug: string | null, filePath: string) {
  return clientSlug ? `clients/${clientSlug}/${filePath}` : '';
}

export const onRequest: PagesFunction = async (context) => {
  if (context.request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return onRequestPost(context);
};
