#!/usr/bin/env node

import { loadLocalEnv } from '../../core/env/load-local-env.js';
import {
  buildDiscordThreadSnapshot,
  fetchDiscordThreadInfo,
  fetchDiscordThreadMessages,
  writeDiscordThreadSnapshot,
} from '../../core/discord-tasks/thread-sync.js';

loadLocalEnv();

const args = parseArgs(process.argv.slice(2));
const threadId = args.thread || args['thread-id'] || '';
const clientSlug = args.client || args['client-slug'] || '';
const limit = Number(args.limit || 50);
const botToken = args.token || process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN || '';
if (!threadId) throw new Error('Missing --thread');
if (!clientSlug) throw new Error('Missing --client');
if (!botToken) throw new Error('Missing WEBSITE_TASKS_DISCORD_BOT_TOKEN or DISCORD_BOT_TOKEN');

const [thread, messages] = await Promise.all([
  fetchDiscordThreadInfo({ threadId, botToken }),
  fetchDiscordThreadMessages({ threadId, botToken, limit }),
]);
const snapshot = buildDiscordThreadSnapshot({ clientSlug, thread, messages });
const outputPath = writeDiscordThreadSnapshot(snapshot);

console.log(JSON.stringify({
  ok: true,
  threadId,
  clientSlug,
  outputPath,
  threadName: snapshot.thread.name,
  threadUrl: snapshot.thread.url,
  messages: snapshot.messages.length,
  latestSummary: snapshot.latestSummary,
}, null, 2));

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
