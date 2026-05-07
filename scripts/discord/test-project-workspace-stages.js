#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { loadLocalEnv } from '../../core/env/load-local-env.js';
import { sendDiscordChannelMessage } from '../../core/funnel/discord.js';
import { createOrUpdateForumWorkspace, updateForumWorkspaceStage } from '../../core/funnel/discord-workspace.js';

loadLocalEnv();

const args = parseArgs(process.argv.slice(2));
const botToken = args.token || process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN || '';
const projectsChannelId = args.projects || args['projects-channel-id'] || process.env.WEBSITE_PROJECTS_DISCORD_CHANNEL_ID || '';
const clientSlug = args.client || `stage-smoke-${Date.now()}`;
const company = args.company || 'Stage Smoke Restaurant';

if (!botToken) throw new Error('Missing Discord bot token');
if (!projectsChannelId) throw new Error('Missing projects forum channel ID');

const order = { clientSlug, company, template: 'webjuice-restaurant' };
const created = await createOrUpdateForumWorkspace({
  workspace: 'projects',
  channelId: projectsChannelId,
  botToken,
  payload: {
    content: `stage smoke\nclient: ${clientSlug}\nstage: review`,
    allowed_mentions: { parse: [] },
  },
  kind: 'sale',
  order,
});

const approved = await updateForumWorkspaceStage({
  workspace: 'projects',
  threadId: created.threadId,
  channelId: projectsChannelId,
  botToken,
  kind: 'approved',
  order,
});
await sendDiscordChannelMessage({
  channelId: created.threadId,
  botToken,
  payload: { content: 'stage smoke update: approved', allowed_mentions: { parse: [] } },
});

const live = await updateForumWorkspaceStage({
  workspace: 'projects',
  threadId: created.threadId,
  channelId: projectsChannelId,
  botToken,
  kind: 'live',
  order,
});
await sendDiscordChannelMessage({
  channelId: created.threadId,
  botToken,
  payload: { content: 'stage smoke update: live', allowed_mentions: { parse: [] } },
});

const domainBlocked = await updateForumWorkspaceStage({
  workspace: 'projects',
  threadId: created.threadId,
  channelId: projectsChannelId,
  botToken,
  kind: 'live',
  order,
  caseFile: { status: 'waiting_for_customer_dns' },
});
await sendDiscordChannelMessage({
  channelId: created.threadId,
  botToken,
  payload: { content: 'stage smoke update: waiting for customer dns', allowed_mentions: { parse: [] } },
});

const result = {
  ok: true,
  channelId: projectsChannelId,
  threadId: created.threadId,
  created,
  approved,
  live,
  domainBlocked,
};

const artifactDir = path.join(process.cwd(), 'data', 'qa', 'discord-forum-smoke');
fs.mkdirSync(artifactDir, { recursive: true });
fs.writeFileSync(path.join(artifactDir, 'project-workspace-stages.json'), `${JSON.stringify(result, null, 2)}\n`);

console.log(JSON.stringify(result, null, 2));

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
