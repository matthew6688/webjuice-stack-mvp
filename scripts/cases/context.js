#!/usr/bin/env node

import fs from 'fs';
import { buildCaseContextPacket } from '../../core/cases/case-file.js';

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
if (!args.case) {
  console.error('Usage: node scripts/cases/context.js --case data/cases/<client>/<order>/case.json [--output context-packet.json]');
  process.exit(1);
}

const caseFile = JSON.parse(fs.readFileSync(args.case, 'utf8'));
const timelinePath = caseFile.paths?.timelinePath || args.case.replace(/case\.json$/, 'timeline.jsonl');
const recentTimeline = fs.existsSync(timelinePath)
  ? fs.readFileSync(timelinePath, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line)).slice(-20)
  : [];
const packet = buildCaseContextPacket(caseFile, { recentTimeline });

if (args.output) {
  fs.writeFileSync(args.output, `${JSON.stringify(packet, null, 2)}\n`);
} else {
  console.log(JSON.stringify(packet, null, 2));
}
