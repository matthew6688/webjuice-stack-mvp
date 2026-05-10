#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { loadLocalEnv } from '../../core/env/load-local-env.js';
import { syncDiscordForumTags } from '../../core/funnel/discord.js';

loadLocalEnv();

const args = parseArgs(process.argv.slice(2));
const botToken = args.token || process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN || '';
const fromChannelId = args.from || args['from-channel'] || process.env.WEBSITE_TASKS_DISCORD_CHANNEL_ID || '1501072883001065614';
const guildIdArg = args.guild || args['guild-id'] || process.env.DISCORD_GUILD_ID || process.env.DISCORD_SERVER_ID || '';
const name = normalizeChannelName(args.name || process.env.WEBSITE_TEMPLATE_LIBRARY_CHANNEL_NAME || 'website-templates');
const channelType = args.type || 'forum';
const dryRun = Boolean(args['dry-run'] || args.dryRun);
const outPath = args.out || 'data/qa/discord-template-library-channel.json';

if (!botToken && !dryRun) throw new Error('Missing Discord bot token.');
if (!['forum', 'text'].includes(channelType)) throw new Error('--type must be forum or text');

const tags = templateForumTags();
const plan = {
  ok: true,
  action: 'setup_template_library_channel',
  name,
  type: channelType,
  fromChannelId,
  guildId: guildIdArg || '(infer from channel)',
  tags: tags.map((tag) => tag.name),
  dryRun,
};

if (dryRun) {
  writeJson(outPath, { ...plan, plannedOnly: true });
  console.log(JSON.stringify({ ...plan, outPath }, null, 2));
  process.exit(0);
}

const sourceChannel = await discordGet(`/channels/${fromChannelId}`, botToken);
const guildId = guildIdArg || sourceChannel.guild_id;
if (!guildId) throw new Error(`Unable to infer guild_id from channel ${fromChannelId}; pass --guild`);

const channels = await discordGet(`/guilds/${guildId}/channels`, botToken);
const existing = channels.find((channel) => channel.name === name);
let channel = existing;
let created = false;

if (!channel) {
  channel = await discordPost(`/guilds/${guildId}/channels`, botToken, {
    name,
    type: channelType === 'forum' ? 15 : 0,
    parent_id: sourceChannel.parent_id || undefined,
    topic: 'ProfitsLocal niche template library: screenshots, reference links, Open Design runs, QA, and publish decisions.',
    available_tags: channelType === 'forum' ? tags : undefined,
  });
  created = true;
}

let tagSync = null;
if (channelType === 'forum' || channel.type === 15 || channel.type === 16) {
  tagSync = await syncDiscordForumTags({
    channelId: channel.id,
    botToken,
    tags,
  });
}

const result = {
  ...plan,
  dryRun: false,
  guildId,
  channelId: channel.id,
  channelName: channel.name,
  channelType: channel.type,
  created,
  url: `https://discord.com/channels/${guildId}/${channel.id}`,
  tagsByName: tagSync?.tagsByName || {},
  outPath,
  updatedAt: new Date().toISOString(),
};

writeJson(outPath, result);
console.log(JSON.stringify(result, null, 2));

function templateForumTags() {
  return [
    { name: 'reference' },
    { name: 'roofing' },
    { name: 'one-page' },
    { name: 'multi-page' },
    { name: 'open-design' },
    { name: 'qa-needed' },
    { name: 'approved' },
    { name: 'published' },
  ];
}

async function discordGet(endpoint, token) {
  const response = await fetch(`https://discord.com/api/v10${endpoint}`, {
    headers: {
      Authorization: `Bot ${token}`,
      'User-Agent': 'profitslocal-template-library-channel',
    },
  });
  const text = await response.text().catch(() => '');
  if (!response.ok) throw new Error(`Discord GET ${endpoint} failed: ${response.status} ${text}`.trim());
  return text ? JSON.parse(text) : null;
}

async function discordPost(endpoint, token, body) {
  const response = await fetch(`https://discord.com/api/v10${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'profitslocal-template-library-channel',
    },
    body: JSON.stringify(body),
  });
  const text = await response.text().catch(() => '');
  if (!response.ok) throw new Error(`Discord POST ${endpoint} failed: ${response.status} ${text}`.trim());
  return text ? JSON.parse(text) : null;
}

function normalizeChannelName(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'website-templates';
}

function writeJson(filePath, data) {
  const absolute = path.resolve(filePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `${JSON.stringify(data, null, 2)}\n`);
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) parsed[key] = true;
    else {
      parsed[key] = next;
      i += 1;
    }
  }
  return parsed;
}
