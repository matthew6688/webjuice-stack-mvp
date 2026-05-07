#!/usr/bin/env node

import { loadLocalEnv } from '../../core/env/load-local-env.js';
import {
  buildForumThreadName,
  defaultDiscordForumBlueprints,
  desiredForumTagNames,
  sendDiscordChannelMessage,
  sendDiscordThreadedMessage,
  syncDiscordForumTags,
  updateDiscordThread,
} from '../../core/funnel/discord.js';

loadLocalEnv();

const args = parseArgs(process.argv.slice(2));
const botToken = args.token || process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN || '';
const leadsChannelId = args.leads || args['leads-channel-id'] || process.env.WEBSITE_LEADS_DISCORD_CHANNEL_ID || '';
const projectsChannelId = args.projects || args['projects-channel-id'] || process.env.WEBSITE_PROJECTS_DISCORD_CHANNEL_ID || '';
const clientSlug = args.client || 'forum-smoke-restaurant';
const company = args.company || 'Forum Smoke Restaurant';

if (!botToken) throw new Error('Missing Discord bot token.');
if (!leadsChannelId || !projectsChannelId) throw new Error('Both leads and projects forum channel IDs are required.');

const blueprints = defaultDiscordForumBlueprints();
const leadsConfig = await syncDiscordForumTags({ channelId: leadsChannelId, botToken, tags: blueprints.leads });
const projectsConfig = await syncDiscordForumTags({ channelId: projectsChannelId, botToken, tags: blueprints.projects });

const leadOrder = {
  clientSlug,
  company,
  template: 'webjuice-restaurant',
  paymentStatus: 'pending',
};
const projectOrder = {
  clientSlug,
  company,
  template: 'webjuice-restaurant',
};

const leadThreadName = buildForumThreadName({ workspace: 'leads', kind: 'sale', order: leadOrder });
const leadTagIds = desiredForumTagNames({ workspace: 'leads', kind: 'sale', order: leadOrder }).map((name) => leadsConfig.tagsByName[name]).filter(Boolean);
const leadPost = await sendDiscordThreadedMessage({
  channelId: leadsChannelId,
  botToken,
  threadName: leadThreadName,
  forumTagIds: leadTagIds,
  payload: {
    content: [
      'ProfitsLocal forum smoke',
      `workspace: leads`,
      `client: ${clientSlug}`,
      `company: ${company}`,
      'intent: validate forum visibility, title, and tags',
    ].join('\n'),
    allowed_mentions: { parse: [] },
  },
});

const projectThreadName = buildForumThreadName({ workspace: 'projects', kind: 'sale', order: projectOrder });
const projectReviewTags = desiredForumTagNames({ workspace: 'projects', kind: 'sale', order: projectOrder }).map((name) => projectsConfig.tagsByName[name]).filter(Boolean);
const projectPost = await sendDiscordThreadedMessage({
  channelId: projectsChannelId,
  botToken,
  threadName: projectThreadName,
  forumTagIds: projectReviewTags,
  payload: {
    content: [
      'ProfitsLocal forum smoke',
      `workspace: projects`,
      `client: ${clientSlug}`,
      `company: ${company}`,
      'stage: review',
    ].join('\n'),
    allowed_mentions: { parse: [] },
  },
});

const revisionThreadName = buildForumThreadName({
  workspace: 'projects',
  kind: 'revision',
  order: projectOrder,
  caseFile: { revision: { used: 1, policy: { limit: 3 } } },
  revision: { used: 1, limit: 3 },
});
const projectRevisionTags = desiredForumTagNames({
  workspace: 'projects',
  kind: 'revision',
  order: projectOrder,
  caseFile: { revision: { used: 1, policy: { limit: 3 } } },
}).map((name) => projectsConfig.tagsByName[name]).filter(Boolean);

await updateDiscordThread({
  threadId: projectPost.threadId,
  botToken,
  name: revisionThreadName,
  appliedTagIds: projectRevisionTags,
});

const revisionReply = await sendDiscordChannelMessage({
  channelId: projectPost.threadId,
  botToken,
  payload: {
    content: 'forum smoke update: stage moved from review to revision 1/3',
    allowed_mentions: { parse: [] },
  },
});

console.log(JSON.stringify({
  ok: true,
  leads: {
    channelId: leadsChannelId,
    tagsByName: leadsConfig.tagsByName,
    post: leadPost,
  },
  projects: {
    channelId: projectsChannelId,
    tagsByName: projectsConfig.tagsByName,
    post: projectPost,
    renamedTo: revisionThreadName,
    appliedTagIds: projectRevisionTags,
    revisionReply,
  },
}, null, 2));

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
