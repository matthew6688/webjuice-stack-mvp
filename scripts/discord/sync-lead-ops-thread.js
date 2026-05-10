#!/usr/bin/env node

import { loadLocalEnv } from '../../core/env/load-local-env.js';
import {
  extractLeadCandidatesFromThreadMessages,
  syncLeadOpsCandidatesFromThread,
} from '../../core/discord-tasks/lead-ops-sync.js';
import {
  fetchDiscordThreadInfo,
  fetchDiscordThreadMessages,
} from '../../core/discord-tasks/thread-sync.js';
import { syncWebsiteTaskThreadTitle } from '../../core/discord-tasks/thread-title.js';
import { sendDiscordChannelMessage } from '../../core/funnel/discord.js';

loadLocalEnv();

const args = parseArgs(process.argv.slice(2));
const threadId = args.thread || args['thread-id'] || '';
const send = boolArg(args, 'send', false);
const updateTitle = boolArg(args, 'update-title', send);
const postSummary = boolArg(args, 'post-summary', send);
if (!threadId) throw new Error('Missing --thread');

const botToken = args.token || process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN || '';
if (!botToken) throw new Error('Missing WEBSITE_TASKS_DISCORD_BOT_TOKEN or DISCORD_BOT_TOKEN');

const [thread, messages] = await Promise.all([
  fetchDiscordThreadInfo({ threadId, botToken }),
  fetchDiscordThreadMessages({ threadId, botToken, limit: Number(args.limit || 50) }),
]);
const candidates = extractLeadCandidatesFromThreadMessages(messages);

if (!send) {
  console.log(JSON.stringify({
    ok: true,
    dryRun: true,
    thread: { id: thread.id, name: thread.name },
    candidates,
  }, null, 2));
  process.exit(0);
}

const result = syncLeadOpsCandidatesFromThread({
  clientLeads: candidates,
  thread,
  messages,
  sourceLabel: `Discord lead-ops thread ${threadId}`,
});

let title = null;
if (updateTitle) {
  try {
    title = await syncWebsiteTaskThreadTitle({
      threadId,
      botToken,
      stage: result.count ? 'ready_for_mockup' : 'needs_human',
      businessName: result.count === 1 ? result.synced[0].businessName : `Lead ops (${result.count})`,
      industry: candidates[0]?.industry || 'lead discovery',
      city: candidates[0]?.city || '',
    });
  } catch (error) {
    title = { ok: false, error: error.message || String(error), nonFatal: true };
  }
}

let summaryMessage = null;
if (postSummary) {
  summaryMessage = await sendDiscordChannelMessage({
    channelId: threadId,
    botToken,
    payload: {
      username: 'ProfitsLocal Lead Ops Sync',
      content: buildSummary(result),
      allowed_mentions: { parse: [] },
    },
  });
}

console.log(JSON.stringify({ ...result, title, summaryMessage }, null, 2));

function buildSummary(result) {
  const lines = [
    `Lead ops 已同步到 admin：${result.count} 条`,
    '',
    ...result.synced.map((item, index) => `${index + 1}. ${item.businessName} -> ${item.clientSlug}`),
    '',
    '下一步：在 admin 里查看「可做 Mockup」，确认是否创建 mockup。',
  ];
  return lines.join('\n').slice(0, 1900);
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
