#!/usr/bin/env node

import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const args = parseArgs();
const url = args.url || 'https://dokobot.ai/skill';
const output = args.output || '';
const device = args.device || firstLocalDevice();

if (!device) {
  console.error('No Dokobot local browser device found. Run `dokobot install-bridge`, open Chrome with the Dokobot extension, then retry.');
  process.exit(1);
}

const readArgs = [
  'read',
  '--local',
  '--device',
  device,
  '--screens',
  String(args.screens || 1),
  '--timeout',
  String(args.timeout || 30),
  url,
];

const text = execFileSync('dokobot', readArgs, { encoding: 'utf8', timeout: Number(args.timeout || 30) * 1000 + 5000 });
if (output) {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, text);
}

console.log(JSON.stringify({
  ok: true,
  cliVersion: execFileSync('dokobot', ['--version'], { encoding: 'utf8' }).trim(),
  device,
  url,
  output: output || null,
  chars: text.length,
  preview: text.split('\n').slice(0, 12).join('\n'),
}, null, 2));

function firstLocalDevice() {
  const output = execFileSync('dokobot', ['doko', 'list'], { encoding: 'utf8', timeout: 10000 });
  const match = output.match(/^\s+([a-f0-9-]{20,})\s+pid\s+\d+/m);
  return match?.[1] || '';
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    parsed[argv[i].slice(2)] = argv[i + 1]?.startsWith('--') ? true : (argv[i + 1] || true);
  }
  return parsed;
}
