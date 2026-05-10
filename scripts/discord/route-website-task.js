#!/usr/bin/env node

import fs from 'fs';
import { loadLocalEnv } from '../../core/env/load-local-env.js';
import {
  persistAndMaybeDispatchWebsiteTask,
  routeWebsiteTaskMessage,
} from '../../core/discord-tasks/task-router.js';
import {
  appendTaskLog,
  mirrorTaskLogToDiscord,
} from '../../core/discord-tasks/task-log.js';

loadLocalEnv();

const args = parseArgs(process.argv.slice(2));
const send = boolArg(args, 'send', false);
const persist = boolArg(args, 'persist', false);
const channelId = args.channel || args['channel-id'] || process.env.WEBSITE_TASKS_DISCORD_CHANNEL_ID || '';
const botToken = args.token || process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN || '';
const message = loadMessage(args);

if (!send && !persist) {
  const routed = routeWebsiteTaskMessage({ message, channelId });
  console.log(JSON.stringify({
    ok: true,
    dryRun: true,
    task: routed.task,
    initialPayload: routed.initialPayload,
  }, null, 2));
  process.exit(0);
}

const result = await persistAndMaybeDispatchWebsiteTask({
  message,
  channelId,
  botToken,
  send,
});

const firstLog = appendTaskLog(result.logPath, {
  event: 'stage',
  stage: result.task.intent.label,
  tool: 'discord-task-router',
  input: result.task.rawText,
  output: `已创建/关联 Discord thread：${result.task.thread.id || 'pending'}`,
  evidencePath: result.taskPath,
  decision: result.task.intent.workflowLabel,
  reason: `router confidence=${result.task.intent.confidence}`,
  nextAction: result.task.intent.nextAction,
});

if (send && result.task.thread.id) {
  await mirrorTaskLogToDiscord({
    threadId: result.task.thread.id,
    botToken,
    entry: firstLog,
  });
}

console.log(JSON.stringify(result, null, 2));

function loadMessage(values) {
  if (values.input) return JSON.parse(fs.readFileSync(values.input, 'utf8'));
  const attachments = values.attachment
    ? [{ id: 'cli-attachment', filename: values.attachment, url: values.attachment }]
    : [];
  return {
    id: values.message || values['message-id'] || '',
    channel_id: values.channel || values['channel-id'] || process.env.WEBSITE_TASKS_DISCORD_CHANNEL_ID || '',
    guild_id: values.guild || values['guild-id'] || '',
    threadId: values.thread || values['thread-id'] || '',
    author: { id: values.author || '', username: values.username || 'operator' },
    content: values.content || '',
    attachments,
  };
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
