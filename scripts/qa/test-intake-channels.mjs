#!/usr/bin/env node
/**
 * CI test · SOP-1 intake channels registry integrity.
 *
 * 强制规则:
 *   1. registry JSON 合法且至少 1 channel
 *   2. 每个 active channel 的 cli_file 必须真存在
 *   3. 每个 active channel id 唯一
 *   4. CLI 命名规范 (pl:xxx)
 *   5. lastUpdated 是合法日期
 *
 * 进 CI · failed → 不允许 merge · 防止删了一个入口忘了改 doc/admin。
 */

import fs from 'node:fs';
import path from 'node:path';
import { loadIntakeChannels, activeChannels } from '../../core/leads/intake-channels.js';

const G = '\x1b[32m', R = '\x1b[31m', X = '\x1b[0m';
let pass = 0, fail = 0;
function check(label, cond, detail = '') {
  if (cond) { pass++; console.log(`  ${G}✓${X} ${label}`); }
  else      { fail++; console.log(`  ${R}✗${X} ${label}${detail ? ' — ' + detail : ''}`); }
}

const repoRoot = path.resolve(process.cwd());

console.log('=== SOP-1 intake channels registry ===');

const reg = loadIntakeChannels();
check('registry loads + has channels[]', Array.isArray(reg.channels) && reg.channels.length > 0,
  `len=${reg.channels?.length}`);
check('lastUpdated is valid date', !isNaN(Date.parse(reg.lastUpdated)),
  `got=${reg.lastUpdated}`);

const ids = new Set();
for (const ch of reg.channels) {
  check(`[${ch.id}] has required fields`,
    ch.id && ch.name_zh && ch.cli && ch.cli_file && ch.trigger && ch.primary_use && ch.status);
  check(`[${ch.id}] id is unique`, !ids.has(ch.id), `dup of existing`);
  ids.add(ch.id);
  check(`[${ch.id}] cli is "pl:xxx" format`, /^pl:[a-z][a-z0-9-]*$/.test(ch.cli || ''),
    `got "${ch.cli}"`);
  const cliFullPath = path.join(repoRoot, ch.cli_file);
  check(`[${ch.id}] cli_file exists on disk`, fs.existsSync(cliFullPath),
    `expected ${ch.cli_file}`);
  check(`[${ch.id}] status is valid enum`,
    ['active', 'active-but-broken', 'deprecated'].includes(ch.status), `got "${ch.status}"`);
  // active-but-broken 必须有 known_issue
  if (ch.status === 'active-but-broken') {
    check(`[${ch.id}] active-but-broken must have known_issue`,
      typeof ch.known_issue === 'string' && ch.known_issue.length > 30);
  }
}

const active = activeChannels();
check(`at least 1 active channel`, active.length >= 1, `got ${active.length}`);
check(`max 1 channel per CLI`,
  new Set(active.map((c) => c.cli)).size === active.length,
  `duplicate CLI in active set`);

console.log(`\n${pass} pass · ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
