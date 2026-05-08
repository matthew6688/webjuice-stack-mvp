#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { routeFunnelSubmission } from '../../core/funnel/submission-router.js';
import { loadLeadOutreachIndex } from '../../core/funnel/lead-outreach-index.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lead-to-paid-handoff-'));
const clientsRoot = path.join(root, 'clients');
const casesRoot = path.join(root, 'data', 'cases');
const paidIntakesRoot = path.join(root, 'data', 'paid-intakes');
const submissionsDir = path.join(root, 'data', 'submissions');
const tasksDir = path.join(root, 'data', 'tasks');
const entitlementsDir = path.join(root, 'data', 'entitlements');
const artifactDir = path.join(process.cwd(), 'data', 'qa', 'lead-closure-smoke');
const calls = [];

seedLead();

const sale = await routeFunnelSubmission(stripeSalePayload(), {
  provider: 'stripe',
  kind: 'sale',
  dryRun: false,
  sendDiscord: true,
  sendEmail: false,
  clientsRoot,
  casesDir: casesRoot,
  paidIntakesDir: paidIntakesRoot,
  submissionsDir,
  tasksDir,
  entitlementsDir,
  ledgerPath: path.join(root, 'data', 'ledger.jsonl'),
  websiteLeadsChannelId: 'forum-leads',
  websiteProjectsChannelId: 'forum-projects',
  websiteTasksBotToken: 'bot-token',
  websiteAgentMention: '<@website-agent>',
  fetchImpl: mockDiscordFetch(calls),
});

const leadIndex = loadLeadOutreachIndex({ clientsRoot, casesRoot, paidIntakesRoot });
const lead = leadIndex.records.find((record) => record.clientSlug === 'fresh-lead-restaurant');

const assertions = {
  saleOk: sale.ok === true,
  resolvedClientSlug: sale.order.clientSlug === 'fresh-lead-restaurant',
  resolvedByLeadEmail: sale.order.leadMatch?.reason === 'unique_match',
  previewInheritedFromLead: sale.order.previewUrl === 'https://fresh-lead-restaurant-dev.pages.dev/',
  leadWorkspaceCreated: Boolean(sale.caseRecord?.caseFile?.discord?.salesThreadId),
  projectWorkspaceCreated: Boolean(sale.caseRecord?.caseFile?.discord?.websiteTaskThreadId),
  leadStagePaid: lead?.stageKey === 'paid',
  leadRetainsContactEmail: lead?.email === 'hello@freshlead.example',
  leadHasProjectWorkspace: Boolean(lead?.websiteTaskThreadId),
  leadHasLeadWorkspace: Boolean(lead?.salesThreadId),
  paidCountIncremented: (leadIndex.counts.paid || 0) >= 1,
  bothForumsUsed: calls.filter((call) => call.url.endsWith('/threads') && call.method === 'POST').length >= 2,
};

const failed = Object.entries(assertions).filter(([, ok]) => !ok).map(([name]) => name);
const result = {
  ok: failed.length === 0,
  root,
  assertions,
  failed,
  sale: {
    order: sale.order,
    caseDiscord: sale.caseRecord?.caseFile?.discord || null,
    leadWorkspace: sale.leadWorkspace || null,
    websiteAgentHandoff: sale.websiteAgentHandoff || null,
  },
  lead: lead || null,
  counts: leadIndex.counts,
  calls,
};

fs.mkdirSync(artifactDir, { recursive: true });
fs.writeFileSync(path.join(artifactDir, 'lead-to-paid-handoff.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);

function seedLead() {
  const clientDir = path.join(clientsRoot, 'fresh-lead-restaurant');
  fs.mkdirSync(path.join(clientDir, 'outreach', 'email'), { recursive: true });
  fs.mkdirSync(path.join(clientDir, 'intake'), { recursive: true });

  writeJson(path.join(clientDir, 'outreach', 'outreach-pack.json'), {
    generatedAt: '2026-05-08T09:00:00.000Z',
    previewUrl: 'https://fresh-lead-restaurant-dev.pages.dev/',
    business: {
      name: 'Fresh Lead Restaurant',
      address: '123 Test Street, Brisbane QLD 4000',
    },
    assets: {
      screenshots: {
        desktop: '/tmp/fresh-lead-desktop.png',
        mobile: '/tmp/fresh-lead-mobile.png',
      },
      video: '/tmp/fresh-lead-demo.mp4',
    },
    emailBrief: {
      proofPoints: ['New hero', 'Mobile cleanup', 'Better booking CTA'],
    },
  });

  writeJson(path.join(clientDir, 'outreach', 'email', '01-fresh-lead.json'), {
    generatedAt: '2026-05-08T09:05:00.000Z',
    to: 'hello@freshlead.example',
    subject: 'Fresh Lead Restaurant preview',
    bodyText: 'Preview draft',
    sendResult: {
      status: 'sent',
      sentAt: '2026-05-08T09:06:00.000Z',
      provider: 'agentic-email',
      sourceSystem: 'agentic-email',
      externalThreadUrl: 'https://mail.profitslocal.com/mailbox/hi@profitslocal.com/emails/inbox?thread=fresh-lead-thread',
      externalMessageId: 'fresh-lead-message-001',
      nextFollowUpDue: '2026-05-11',
    },
  });

  writeJson(path.join(clientDir, 'content.restaurant.json'), {
    business: { name: 'Fresh Lead Restaurant' },
    contact: {
      email: 'hello@freshlead.example',
      phone: '+61 7 3000 0000',
      website: 'https://freshlead.example',
      address: '123 Test Street, Brisbane QLD 4000',
    },
  });

  writeJson(path.join(clientDir, 'intake', 'website-survey.json'), {
    generatedAt: '2026-05-08T08:55:00.000Z',
    businessName: 'Fresh Lead Restaurant',
    niche: 'restaurant',
    readyToBuild: true,
    contact: {
      email: 'hello@freshlead.example',
      phone: '+61 7 3000 0000',
      website: 'https://freshlead.example',
      address: '123 Test Street, Brisbane QLD 4000',
    },
  });
}

function stripeSalePayload() {
  return {
    id: 'evt_test_lead_to_paid_handoff',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_lead_to_paid_handoff',
        payment_status: 'paid',
        amount_total: 39900,
        currency: 'usd',
        customer_details: { email: 'hello@freshlead.example' },
        metadata: {
          tier: 'one_time',
          business_name: 'Fresh Lead Restaurant',
          template: 'webjuice-restaurant',
          repo: 'unknown',
          preview_url: '',
        },
      },
    },
  };
}

function mockDiscordFetch(calls) {
  const forums = {
    'forum-leads': [],
    'forum-projects': [],
  };
  let seq = 0;
  return async (url, init = {}) => {
    const method = init.method || 'GET';
    const parsedBody = init.body ? JSON.parse(init.body) : null;
    calls.push({ url, method, body: parsedBody });

    for (const channelId of Object.keys(forums)) {
      if (url.endsWith(`/channels/${channelId}`) && method === 'GET') {
        return jsonResponse({
          id: channelId,
          type: 15,
          available_tags: forums[channelId],
        });
      }
      if (url.endsWith(`/channels/${channelId}`) && method === 'PATCH') {
        forums[channelId] = (parsedBody?.available_tags || []).map((tag, index) => ({
          id: tag.id || `${channelId}-tag-${index + 1}`,
          name: tag.name,
          moderated: Boolean(tag.moderated),
          emoji_id: null,
          emoji_name: null,
        }));
        return jsonResponse({
          id: channelId,
          type: 15,
          available_tags: forums[channelId],
        });
      }
      if (url.endsWith(`/channels/${channelId}/threads`) && method === 'POST') {
        seq += 1;
        return jsonResponse({
          id: `${channelId}-thread-${seq}`,
          guild_id: 'guild-1',
          last_message_id: `${channelId}-message-${seq}`,
          name: parsedBody?.name || '',
        }, 201);
      }
    }

    if (/\/channels\/forum-(leads|projects)-thread-\d+\/messages$/.test(url) && method === 'POST') {
      seq += 1;
      const threadId = url.match(/\/channels\/([^/]+)\/messages$/)?.[1] || `thread-${seq}`;
      return jsonResponse({
        id: `message-${seq}`,
        guild_id: 'guild-1',
        channel_id: threadId,
      }, 200);
    }

    if (/\/channels\/forum-(leads|projects)-thread-\d+$/.test(url) && method === 'PATCH') {
      const threadId = url.match(/\/channels\/([^/]+)$/)?.[1] || '';
      return jsonResponse({
        id: threadId,
        guild_id: 'guild-1',
        name: parsedBody?.name || '',
        applied_tags: parsedBody?.applied_tags || [],
      });
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

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}
