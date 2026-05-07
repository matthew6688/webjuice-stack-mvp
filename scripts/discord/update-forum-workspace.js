#!/usr/bin/env node

import { loadLocalEnv } from '../../core/env/load-local-env.js';
import { updateForumWorkspaceStage } from '../../core/funnel/discord-workspace.js';

loadLocalEnv();

const args = parseArgs(process.argv.slice(2));
if (args.help || args.h) {
  printHelp();
  process.exit(0);
}
const threadId = args.thread || args['thread-id'] || '';
const workspace = args.workspace || 'projects';
const kind = args.kind || 'sale';
const channelId = args.channel || args['channel-id']
  || (workspace === 'leads' ? process.env.WEBSITE_LEADS_DISCORD_CHANNEL_ID : process.env.WEBSITE_PROJECTS_DISCORD_CHANNEL_ID)
  || '';
const botToken = args.token || process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN || '';

if (!threadId) {
  printHelp();
  throw new Error('Missing --thread / --thread-id');
}
if (!botToken) throw new Error('Missing Discord bot token');

const result = await updateForumWorkspaceStage({
  workspace,
  threadId,
  channelId,
  botToken,
  kind,
  order: {
    clientSlug: args.client || '',
    company: args.company || '',
    template: args.template || 'webjuice-restaurant',
    paymentStatus: args.payment || '',
  },
  caseFile: args.status ? {
    status: args.status,
    revision: args.limit ? { used: Number(args.used || 0), policy: { limit: Number(args.limit) } } : undefined,
  } : (args.limit ? {
    revision: { used: Number(args.used || 0), policy: { limit: Number(args.limit) } },
  } : null),
  revision: args.limit ? { used: Number(args.used || 0), limit: Number(args.limit) } : null,
});

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

function printHelp() {
  console.log(`Usage:
  node scripts/discord/update-forum-workspace.js \\
    --workspace projects \\
    --thread 1501952700806463489 \\
    --kind live \\
    --client opa-bar-mezze-restaurant \\
    --company "Opa Bar & Mezze" \\
    --status waiting_for_customer_dns

Optional:
  --channel <forum-channel-id>
  --used <revision-used>
  --limit <revision-limit>
  --token <discord-bot-token>`);
}
