#!/usr/bin/env node

import fs from 'fs';
import { createAgentTask, saveAgentTask, taskFromTallyOrder } from '../../core/agents/task.js';
import { normalizeTallySubmission } from '../../core/funnel/tally.js';

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i += 1) {
    if (!args[i].startsWith('--')) continue;
    parsed[args[i].slice(2)] = args[i + 1]?.startsWith('--') ? true : (args[i + 1] || true);
  }
  return parsed;
}

const args = parseArgs();

let task;
if (args.tally) {
  const payload = JSON.parse(fs.readFileSync(args.tally, 'utf8'));
  const order = normalizeTallySubmission(payload, {
    ...process.env,
    DEFAULT_CAMPAIGN_ID: args.campaign || process.env.DEFAULT_CAMPAIGN_ID,
  });
  task = taskFromTallyOrder(order, args.type ? { type: args.type } : {});
} else {
  if (!args.client || !args.repo) {
    console.error('Usage: node scripts/agent/create-task.js --client slug --repo owner/repo [--type activate]');
    console.error('   or: node scripts/agent/create-task.js --tally tally-webhook.json');
    process.exit(1);
  }
  task = createAgentTask({
    clientSlug: args.client,
    repo: args.repo,
    type: args.type || 'activate',
    branch: args.branch || 'dev',
    createdFrom: args.from || 'manual',
  });
}

const outputPath = saveAgentTask(task, args.queue || 'agent-tasks', args.state || 'pending');
console.log(`Agent task written: ${outputPath}`);
console.log(`Task: ${task.id}`);
console.log(`Type: ${task.type}`);
console.log(`Client: ${task.clientSlug}`);
