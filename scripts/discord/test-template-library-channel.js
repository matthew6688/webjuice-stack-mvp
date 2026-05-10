#!/usr/bin/env node

import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'template-channel-'));
const outPath = path.join(tmp, 'channel.json');
const scriptPath = path.resolve('scripts/discord/setup-template-library-channel.js');

const result = spawnSync(process.execPath, [
  scriptPath,
  '--dry-run',
  '--name',
  'Website Template Library',
  '--from',
  '1501072883001065614',
  '--out',
  outPath,
], {
  cwd: process.cwd(),
  encoding: 'utf8',
});

if (result.status !== 0) {
  console.error(result.stderr || result.stdout);
  process.exit(result.status || 1);
}

const data = JSON.parse(fs.readFileSync(outPath, 'utf8'));
const assertions = {
  plannedOnly: data.plannedOnly === true,
  normalizedName: data.name === 'website-template-library',
  hasReferenceTag: data.tags.includes('reference'),
  hasOpenDesignTag: data.tags.includes('open-design'),
  typeForum: data.type === 'forum',
};

if (!Object.values(assertions).every(Boolean)) {
  console.error(JSON.stringify({ ok: false, assertions, data }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, assertions }, null, 2));
