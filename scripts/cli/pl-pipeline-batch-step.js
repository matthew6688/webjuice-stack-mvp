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
import { spawnSync } from 'child_process';
import path from 'path';
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
  res = await finalizeBatch({
    batchId,
    terminalTag: swapTag || 'completed',
    summary: `**${stage}** — _${status}_\n\n${summary}`,
  });

  // SOP-X-Dedup hook: after batch completes, auto-run dedup-audit so any
  // suspicious phone/domain collisions land in the review queue immediately.
  // Synchronous spawnSync — exit code/output captured + emitted in final JSON.
  // Skipped only if --skip-dedup-audit flag is passed (for debug / dry-run).
  if (!args['skip-dedup-audit']) {
    try {
      const repoRoot = path.resolve(process.argv[1], '../../..');
      const r = spawnSync('node', [
        '--env-file-if-exists=.env.local',
        'scripts/cli/pl-dedup-audit.js',
      ], { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      // Parse the JSON object from stdout (audit emits a single JSON object first)
      let parsed = null;
      try {
        const jsonMatch = r.stdout.match(/\{[\s\S]*?\n\}/);
        if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
      } catch {}
      dedupAuditResult = {
        ok: r.status === 0,
        total_suspects: parsed?.total_suspects ?? null,
        summary: parsed?.summary ?? null,
      };
    } catch (err) {
      dedupAuditResult = { ok: false, error: err.message };
    }
  }
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
