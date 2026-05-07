#!/usr/bin/env node

import fs from 'fs';
import os from 'os';
import path from 'path';
import { routeFunnelSubmission } from '../../core/funnel/submission-router.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lead-forum-routing-'));
const calls = [];

const paidIntake = await routeFunnelSubmission(stripePaidIntakePayload(), {
  provider: 'stripe',
  kind: 'paid_intake',
  dryRun: false,
  sendDiscord: true,
  sendEmail: false,
  websiteLeadsChannelId: 'forum-leads',
  websiteTasksBotToken: 'bot-token',
  fetchImpl: mockDiscordFetch(calls),
  submissionsDir: path.join(root, 'submissions'),
  paidIntakesDir: path.join(root, 'paid-intakes'),
  casesDir: path.join(root, 'cases'),
  entitlementsDir: path.join(root, 'entitlements'),
  tasksDir: path.join(root, 'tasks'),
  ledgerPath: path.join(root, 'ledger.jsonl'),
});

const sale = await routeFunnelSubmission(stripeSalePayload(), {
  provider: 'stripe',
  kind: 'sale',
  dryRun: false,
  sendDiscord: true,
  sendEmail: false,
  websiteLeadsChannelId: 'forum-leads',
  websiteTasksBotToken: 'bot-token',
  fetchImpl: mockDiscordFetch(calls),
  submissionsDir: path.join(root, 'submissions'),
  paidIntakesDir: path.join(root, 'paid-intakes'),
  casesDir: path.join(root, 'cases'),
  entitlementsDir: path.join(root, 'entitlements'),
  tasksDir: path.join(root, 'tasks'),
  ledgerPath: path.join(root, 'ledger.jsonl'),
});

const assertions = {
  paidIntakeLeadWorkspaceOk: paidIntake.leadWorkspace?.ok === true,
  saleLeadWorkspaceOk: sale.leadWorkspace?.ok === true,
  paidIntakeSalesThreadStored: Boolean(paidIntake.caseRecord?.caseFile?.discord?.salesThreadId),
  saleSalesThreadStored: Boolean(sale.caseRecord?.caseFile?.discord?.salesThreadId),
  createdForumPosts: calls.filter((call) => call.url.endsWith('/channels/forum-leads/threads') && call.method === 'POST').length >= 2,
};
const failed = Object.entries(assertions).filter(([, ok]) => !ok).map(([name]) => name);
const result = {
  ok: failed.length === 0,
  root,
  assertions,
  failed,
  paidIntake: {
    leadWorkspace: paidIntake.leadWorkspace,
    discord: paidIntake.caseRecord?.caseFile?.discord,
  },
  sale: {
    leadWorkspace: sale.leadWorkspace,
    discord: sale.caseRecord?.caseFile?.discord,
  },
  callCount: calls.length,
};

const artifactDir = path.join(process.cwd(), 'data', 'qa', 'discord-forum-smoke');
fs.mkdirSync(artifactDir, { recursive: true });
fs.writeFileSync(path.join(artifactDir, 'lead-forum-routing.json'), `${JSON.stringify(result, null, 2)}\n`);

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);

function mockDiscordFetch(calls) {
  const state = {
    forumLeadsTags: [],
  };
  return async (url, init = {}) => {
    const method = init.method || 'GET';
    calls.push({ url, method, body: init.body ? JSON.parse(init.body) : null });
    if (url.endsWith('/channels/forum-leads') && method === 'GET') {
      return jsonResponse({
        id: 'forum-leads',
        type: 15,
        available_tags: state.forumLeadsTags,
      });
    }
    if (url.endsWith('/channels/forum-leads') && method === 'PATCH') {
      const body = JSON.parse(init.body);
      state.forumLeadsTags = (body.available_tags || []).map((tag, index) => ({
        id: tag.id || `tag-${index + 1}`,
        name: tag.name,
        moderated: Boolean(tag.moderated),
        emoji_id: null,
        emoji_name: null,
      }));
      return jsonResponse({
        id: 'forum-leads',
        type: 15,
        available_tags: state.forumLeadsTags,
      });
    }
    if (url.endsWith('/channels/forum-leads/threads') && method === 'POST') {
      const body = JSON.parse(init.body);
      return jsonResponse({
        id: `thread-${calls.length}`,
        guild_id: 'guild-1',
        last_message_id: `thread-${calls.length}`,
        name: body.name,
      }, 201);
    }
    throw new Error(`Unexpected Discord mock call: ${method} ${url}`);
  };
}

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function stripePaidIntakePayload() {
  return {
    id: 'evt_test_paid_intake_lead_forum',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_paid_intake_lead_forum',
        payment_status: 'paid',
        amount_total: 39900,
        currency: 'usd',
        customer_details: { email: 'owner@example.com' },
        metadata: {
          tier: 'one_time',
          order_kind: 'paid_intake',
          client_slug: 'lead-forum-paid-intake',
          business_name: 'Lead Forum Paid Intake',
          template: 'webjuice-restaurant',
        },
      },
    },
  };
}

function stripeSalePayload() {
  return {
    id: 'evt_test_sale_lead_forum',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_sale_lead_forum',
        payment_status: 'paid',
        amount_total: 39900,
        currency: 'usd',
        customer_details: { email: 'owner@example.com' },
        metadata: {
          tier: 'one_time',
          client_slug: 'lead-forum-sale',
          business_name: 'Lead Forum Sale',
          template: 'webjuice-restaurant',
          repo: 'matthew6688/lead-forum-sale',
          preview_url: 'https://lead-forum-sale-dev.pages.dev/',
        },
      },
    },
  };
}
