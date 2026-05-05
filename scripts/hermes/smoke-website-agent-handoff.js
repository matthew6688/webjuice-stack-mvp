#!/usr/bin/env node

import { setTimeout as sleep } from 'timers/promises';
import { loadLocalEnv } from '../../core/env/load-local-env.js';
import { buildWebsiteAgentHandoffMessage, sendDiscordChannelMessage } from '../../core/funnel/discord.js';

loadLocalEnv();

const args = parseArgs(process.argv.slice(2));
const send = boolArg(args, 'send', false);
const wait = boolArg(args, 'wait', true);
const channelId = args.channel || args['channel-id'] || process.env.WEBSITE_TASKS_DISCORD_CHANNEL_ID || '';
const botToken = args.token || process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN || '';
const mention = args.mention || process.env.WEBSITE_AGENT_MENTION || '<@1501073096696664184>';
const intent = args.intent || 'validate';

const order = {
  clientSlug: args.client || 'opa-bar-mezze-restaurant',
  repo: args.repo || 'matthew6688/opa-bar-mezze-restaurant',
  orderId: args.order || `smoke_${Date.now()}`,
  previewUrl: args.preview || 'https://opa-bar-mezze-restaurant-dev.pages.dev/',
};
const task = {
  kind: args.kind || 'sale',
  clientSlug: order.clientSlug,
  repo: order.repo,
  previewUrl: order.previewUrl,
  order: { id: order.orderId },
  taskPath: `data/agent-tasks/${order.clientSlug}/${args.kind || 'sale'}-${order.orderId}.json`,
  case: {
    casePath: `data/cases/${order.clientSlug}/${order.orderId}/case.json`,
    contextPath: `data/cases/${order.clientSlug}/${order.orderId}/context-packet.json`,
  },
  requiredContext: {
    evidence: `clients/${order.clientSlug}/evidence/evidence.json`,
    content: `clients/${order.clientSlug}/content.restaurant.json`,
    design: `clients/${order.clientSlug}/design.restaurant.json`,
    brandSpec: `clients/${order.clientSlug}/brand-spec.md`,
  },
};
const payload = buildWebsiteAgentHandoffMessage({
  kind: task.kind,
  order,
  task,
  caseRecord: { ref: task.case },
  mention,
  action: intent === 'full'
    ? undefined
    : 'Smoke validation only: confirm pickup and thread memory. Do not read files, do not edit files, do not deploy. Reply exactly: website-agent handoff smoke ok.',
});

if (!send) {
  console.log(JSON.stringify({
    ok: true,
    dryRun: true,
    intent,
    channelId: channelId || null,
    mention,
    payload,
  }, null, 2));
  process.exit(0);
}

if (!channelId) throw new Error('Missing WEBSITE_TASKS_DISCORD_CHANNEL_ID or --channel');
if (!botToken) throw new Error('Missing WEBSITE_TASKS_DISCORD_BOT_TOKEN/DISCORD_BOT_TOKEN or --token');

const sender = await discordGet('/users/@me', botToken);
const mentionedIds = mentionUserIds(mention);
if (mentionedIds.includes(sender.id) && !boolArg(args, 'allow-self-sender', false)) {
  throw new Error([
    `Refusing to send handoff from the same bot that is mentioned (${sender.username}).`,
    'Use a separate handoff/sales bot token for WEBSITE_TASKS_DISCORD_BOT_TOKEN, or pass --allow-self-sender true only for manual debugging.',
  ].join(' '));
}

const sent = await sendDiscordChannelMessage({ channelId, botToken, payload });
let thread = sent.threadId ? { id: sent.threadId, url: sent.threadUrl } : null;
let reply = null;
if (wait) {
  thread = thread || await waitForThread({ channelId: sent.channelId, messageId: sent.messageId, botToken });
  if (thread?.id) {
    reply = await waitForWebsiteAgentReply({ threadId: thread.id, botToken });
  }
}

console.log(JSON.stringify({
  ok: true,
  dryRun: false,
  intent,
  message: sent,
  thread,
  reply,
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

async function discordGet(path, token) {
  const response = await fetch(`https://discord.com/api/v10${path}`, {
    headers: {
      Authorization: `Bot ${token}`,
      'User-Agent': 'profitslocal-website-agent-smoke',
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
