#!/usr/bin/env node

import { setTimeout as sleep } from 'timers/promises';
import { loadLocalEnv } from '../../core/env/load-local-env.js';
import {
  buildAgentReviewDiscordMessage,
  buildLivePublishedDiscordMessage,
  buildWebsiteAgentHandoffMessage,
  sendDiscordChannelMessage,
  sendDiscordThreadedMessage,
} from '../../core/funnel/discord.js';

loadLocalEnv();

const args = parseArgs(process.argv.slice(2));
const send = boolArg(args, 'send', false);
const channelId = args.channel || args['channel-id'] || process.env.WEBSITE_TASKS_DISCORD_CHANNEL_ID || '';
const botToken = args.token || process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN || '';
const mention = args.mention || process.env.WEBSITE_AGENT_MENTION || '<@1501073096696664184>';
const orderId = args.order || `approval_loop_smoke_${Date.now()}`;

const caseFile = {
  clientSlug: args.client || 'opa-bar-mezze-restaurant',
  repo: args.repo || 'matthew6688/opa-bar-mezze-restaurant',
  previewUrl: args.preview || 'https://opa-bar-mezze-restaurant-dev.pages.dev/',
  order: { id: orderId },
  customer: {
    company: args.company || 'Opa Bar & Mezze',
    email: args.email || 'matthew6688@gmail.com',
  },
};
const task = {
  kind: 'sale',
  id: `sale_${caseFile.clientSlug}_${orderId}`,
  clientSlug: caseFile.clientSlug,
  repo: caseFile.repo,
  previewUrl: caseFile.previewUrl,
  order: { id: orderId },
  taskPath: `data/agent-tasks/${caseFile.clientSlug}/sale-${orderId}.json`,
  case: {
    casePath: `data/cases/${caseFile.clientSlug}/${orderId}/case.json`,
    contextPath: `data/cases/${caseFile.clientSlug}/${orderId}/context-packet.json`,
  },
  requiredContext: {
    evidence: `clients/${caseFile.clientSlug}/evidence/evidence.json`,
    content: `clients/${caseFile.clientSlug}/content.restaurant.json`,
    design: `clients/${caseFile.clientSlug}/design.restaurant.json`,
    brandSpec: `clients/${caseFile.clientSlug}/brand-spec.md`,
  },
};
const handoffPayload = buildWebsiteAgentHandoffMessage({
  kind: 'sale',
  order: {
    clientSlug: caseFile.clientSlug,
    repo: caseFile.repo,
    orderId,
    previewUrl: caseFile.previewUrl,
  },
  task,
  caseRecord: { ref: task.case },
  mention,
  action: 'Approval-loop smoke only. Do not read files, do not edit files, do not deploy. Reply exactly: website-agent approval loop smoke ok.',
});
const reviewPayload = buildAgentReviewDiscordMessage({
  caseFile,
  runResult: {
    ok: true,
    taskId: task.id,
    previewUrl: caseFile.previewUrl,
    commit: 'smoke-dev-commit',
    changedFiles: ['smoke-only-no-files-changed'],
    finishedAt: new Date().toISOString(),
  },
  deployResult: { status: 'completed', conclusion: 'success' },
});
const livePayload = buildLivePublishedDiscordMessage({
  caseFile,
  publishResult: {
    ok: true,
    commit: 'smoke-live-commit',
    devCommit: 'smoke-dev-commit',
    liveUrl: args.live || 'https://opa.example.com',
    finishedAt: new Date().toISOString(),
  },
  deployResult: { status: 'completed', conclusion: 'success' },
  liveUrl: args.live || 'https://opa.example.com',
});

if (!send) {
  console.log(JSON.stringify({
    ok: true,
    dryRun: true,
    channelId: channelId || null,
    mention,
    orderId,
    payloads: {
      handoff: handoffPayload,
      review: reviewPayload,
      live: livePayload,
    },
  }, null, 2));
  process.exit(0);
}

if (!channelId) throw new Error('Missing WEBSITE_TASKS_DISCORD_CHANNEL_ID or --channel');
if (!botToken) throw new Error('Missing WEBSITE_TASKS_DISCORD_BOT_TOKEN/DISCORD_BOT_TOKEN or --token');

const sender = await discordGet('/users/@me', botToken);
const mentionedIds = mentionUserIds(mention);
if (mentionedIds.includes(sender.id) && !boolArg(args, 'allow-self-sender', false)) {
  throw new Error(`Refusing to send from the same bot that is mentioned (${sender.username}).`);
}

const handoff = await sendDiscordThreadedMessage({
  channelId,
  botToken,
  payload: handoffPayload,
  threadName: `${caseFile.customer.company}-approval-${orderId}`
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90),
});
const thread = { id: handoff.threadId, url: handoff.threadUrl };
if (!thread?.id) throw new Error('Discord task thread was not created for approval-loop smoke.');

const agentReply = await waitForWebsiteAgentReply({ threadId: thread.id, botToken });
const review = await sendDiscordChannelMessage({ channelId: thread.id, botToken, payload: reviewPayload });
const live = await sendDiscordChannelMessage({ channelId: thread.id, botToken, payload: livePayload });

console.log(JSON.stringify({
  ok: true,
  dryRun: false,
  orderId,
  thread,
  agentReply,
  handoff,
  review: { ...review, threadId: thread.id },
  live: { ...live, threadId: thread.id },
  assertions: {
    createdThread: Boolean(thread.id),
    agentReplied: agentReply?.content === 'website-agent approval loop smoke ok.',
    reviewPostedToThread: review.channelId === thread.id,
    livePostedToThread: live.channelId === thread.id,
  },
}, null, 2));

async function waitForThread({ channelId: parentChannelId, messageId, botToken: token }) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const message = await discordGet(`/channels/${parentChannelId}/messages/${messageId}`, token);
    if (message.thread?.id) {
      return {
        id: message.thread.id,
        name: message.thread.name || '',
        url: message.guild_id ? `https://discord.com/channels/${message.guild_id}/${message.thread.id}` : '',
      };
    }
    await sleep(2500);
  }
  return null;
}

async function waitForWebsiteAgentReply({ threadId, botToken: token }) {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const messages = await discordGet(`/channels/${threadId}/messages?limit=10`, token);
    const reply = [...messages].reverse().find((message) => (
      message.author?.bot
      && message.author?.username === 'website-agent'
      && String(message.content || '').trim()
    ));
    if (reply) {
      return {
        id: reply.id,
        author: reply.author.username,
        content: reply.content,
      };
    }
    await sleep(2500);
  }
  return null;
}

async function discordGet(discordPath, token) {
  const response = await fetch(`https://discord.com/api/v10${discordPath}`, {
    headers: {
      Authorization: `Bot ${token}`,
      'User-Agent': 'profitslocal-website-agent-approval-loop-smoke',
    },
  });
  const text = await response.text().catch(() => '');
  if (!response.ok) throw new Error(`Discord GET failed: ${response.status} ${text}`.trim());
  return text ? JSON.parse(text) : null;
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      i += 1;
    }
  }
  return parsed;
}

function boolArg(values, key, defaultValue = false) {
  if (values[key] === undefined) return defaultValue;
  return values[key] === true || String(values[key]).toLowerCase() === 'true';
}

function mentionUserIds(value) {
  return [...String(value || '').matchAll(/<@!?(\d+)>/g)].map((match) => match[1]);
}
