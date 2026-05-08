#!/usr/bin/env node

import fs from 'fs';
import { parseArgs } from '../lib/args.js';
import { recordLeadNote } from '../../core/funnel/lead-notes.js';

const args = parseArgs(process.argv.slice(2));
const inputPath = args.input || '';
const payload = inputPath
  ? JSON.parse(fs.readFileSync(inputPath, 'utf8'))
  : {
      client_slug: args.client || args.client_slug || '',
      order_id: args.order || args.order_id || '',
      company: args.company || '',
      actor: args.actor || 'profitslocal-admin',
      note: args.note || '',
      next_follow_up_due: args['next-follow-up-due'] || args.next_follow_up_due || '',
    };

const result = await recordLeadNote(payload, {
  dryRun: args['dry-run'] === 'true' || args.dryRun === 'true',
  sendDiscord: args['send-discord'] !== 'false',
});

if (!result.ok) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(result, null, 2));
