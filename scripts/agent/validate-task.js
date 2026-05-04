#!/usr/bin/env node

import fs from 'fs';
import { validateAgentTask } from '../../core/agents/task.js';

const filePath = process.argv[2] || '';
if (!filePath) {
  console.error('Usage: node scripts/agent/validate-task.js agent-tasks/pending/task.json');
  process.exit(1);
}

const task = JSON.parse(fs.readFileSync(filePath, 'utf8'));
const result = validateAgentTask(task);

console.log(`Agent task validation: ${filePath}`);
console.log(`Status: ${result.ok ? 'ok' : 'failed'}`);
if (result.errors.length) {
  console.log('\nErrors');
  for (const error of result.errors) console.log(`- ${error}`);
}

process.exit(result.ok ? 0 : 1);
