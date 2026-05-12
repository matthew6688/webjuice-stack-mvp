#!/usr/bin/env node
/**
 * pl-pipeline-batch-step — post a stage update to the batch thread.
 *
 * Usage:
 *   npm run pl:pipeline-batch-step -- \
 *     --batch-id pipe-roofing-sydney-202605120300 \
 *     --stage "Stage 0 Discovery" \
 *     --status ok \
 *     --summary "Pulled 10/10 leads from Google Places (query: \"roofing sydney\")."
 *
 * Optional:
 *   --swap-tag <name>   one of: in-progress | paused | completed |
 *                       partial-failed | retry-pending | aborted
 *   --finalize          set finished_at; pair with --swap-tag completed
 *   --summary-file <path>   read summary from file (for large multi-line content)
 */

import fs from 'fs';
import { parseArgs, die, emit } from './_pl-shared.js';
import { postStageUpdate, finalizeBatch } from '../../core/funnel/pipeline-batch-thread.js';

const args = parseArgs(process.argv.slice(2));

const batchId = args['batch-id'] || die('--batch-id required');
const stage = args.stage || die('--stage required');
const status = args.status || 'info';
const swapTag = args['swap-tag'] || null;
const finalize = args.finalize === true;

let summary = args.summary || '';
if (args['summary-file']) {
  summary = fs.readFileSync(args['summary-file'], 'utf8');
}
if (!summary) die('--summary or --summary-file required');

const validStatus = ['ok', 'fail', 'skip', 'paused', 'info'];
if (!validStatus.includes(status)) die(`--status must be one of ${validStatus.join('|')}`);

const validTags = ['in-progress', 'paused', 'completed', 'partial-failed', 'retry-pending', 'aborted'];
if (swapTag && !validTags.includes(swapTag)) die(`--swap-tag must be one of ${validTags.join('|')}`);

let res;
let dedupAuditResult = null;

if (finalize) {
  // SOP-X-Dedup hook is now inside finalizeBatch() itself (so all callers
  // get auto-dedup, not just this CLI). Pass skipDedupAudit:true to bypass
  // for debug / dry-run runs.
  res = await finalizeBatch({
    batchId,
    terminalTag: swapTag || 'completed',
    summary: `**${stage}** — _${status}_\n\n${summary}`,
    skipDedupAudit: args['skip-dedup-audit'] === true,
  });
  // Mirror dedup result into emit payload for backwards-compat (was here
  // before the hook moved). Read from batch state file.
  try {
    const state = JSON.parse(fs.readFileSync(`data/v2/pipeline-batches/${batchId}.json`, 'utf8'));
    if (state.dedup_audit) dedupAuditResult = state.dedup_audit;
  } catch {}
} else {
  res = await postStageUpdate({ batchId, stage, status, summary, swapTag });
}

emit({
  ok: true,
  batch_id: batchId,
  message_id: res.message_id,
  message_url: res.message_url,
  current_tag: res.current_tag,
  ...(dedupAuditResult && { dedup_audit: dedupAuditResult }),
});
