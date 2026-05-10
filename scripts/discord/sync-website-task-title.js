#!/usr/bin/env node

import { loadLocalEnv } from '../../core/env/load-local-env.js';
import {
  buildWebsiteTaskThreadTitle,
  syncWebsiteTaskThreadTitle,
} from '../../core/discord-tasks/thread-title.js';

loadLocalEnv();

const args = parseArgs(process.argv.slice(2));
const threadId = args.thread || args['thread-id'] || '';
const send = boolArg(args, 'send', false);
const titleInput = {
  stage: args.stage || 'researching',
  businessName: args.business || args.name || '',
  industry: args.industry || '',
  city: args.city || '',
  taskId: args.task || args['task-id'] || '',
};
const name = buildWebsiteTaskThreadTitle(titleInput);

if (!send) {
  console.log(JSON.stringify({ ok: true, dryRun: true, threadId, name, input: titleInput }, null, 2));
  process.exit(0);
}

const botToken = args.token || process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN || '';
if (!botToken) throw new Error('Missing WEBSITE_TASKS_DISCORD_BOT_TOKEN or DISCORD_BOT_TOKEN');
const result = await syncWebsiteTaskThreadTitle({
  threadId,
  botToken,
  ...titleInput,
});
console.log(JSON.stringify(result, null, 2));

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
