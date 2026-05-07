#!/usr/bin/env node

import { loadLocalEnv } from '../../core/env/load-local-env.js';
import { defaultDiscordForumBlueprints, syncDiscordForumTags } from '../../core/funnel/discord.js';

loadLocalEnv();

const args = parseArgs(process.argv.slice(2));
const botToken = args.token || process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN || '';
const leadsChannelId = args.leads || args['leads-channel-id'] || process.env.WEBSITE_LEADS_DISCORD_CHANNEL_ID || '';
const projectsChannelId = args.projects || args['projects-channel-id'] || process.env.WEBSITE_PROJECTS_DISCORD_CHANNEL_ID || '';

if (!botToken) throw new Error('Missing Discord bot token.');
if (!leadsChannelId && !projectsChannelId) {
  throw new Error('Provide --leads / --projects or set WEBSITE_LEADS_DISCORD_CHANNEL_ID / WEBSITE_PROJECTS_DISCORD_CHANNEL_ID.');
}

const blueprints = defaultDiscordForumBlueprints();
const output = { ok: true, results: {} };

if (leadsChannelId) {
  output.results.leads = await syncDiscordForumTags({
    channelId: leadsChannelId,
    botToken,
    tags: blueprints.leads,
  });
}

if (projectsChannelId) {
  output.results.projects = await syncDiscordForumTags({
    channelId: projectsChannelId,
    botToken,
    tags: blueprints.projects,
  });
}

console.log(JSON.stringify(output, null, 2));

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
