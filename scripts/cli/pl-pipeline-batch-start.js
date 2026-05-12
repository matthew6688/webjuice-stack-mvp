#!/usr/bin/env node
/**
 * pl-pipeline-batch-start — start a new pipeline batch.
 *
 * Creates a forum thread in lead-discovery-runs channel, persists batch state,
 * tags "in-progress". **Auto-chains a `pl:scrape-docker` task** (kind=intake)
 * via SOP-0 dispatcher · 修复 2026-05-13: 此前只创 thread 不抓数据。
 *
 * Usage:
 *   npm run pl:pipeline-batch-start -- \
 *     --niche roofing --city sydney --count 10
 *
 * Optional:
 *   --batch-id <custom-id>     (default: pipe-<niche>-<city>-<YYYYMMDDHHmm>)
 *   --title "<custom title>"   (default: auto-generated)
 *   --skip-gbp                 (note in flags; informational)
 *   --discord-c-d              (note in flags; pre-create threads for C/D too)
 *   --no-chain                 跳过自动链 pl:scrape-docker (调试用 · default 不跳)
 */

import { parseArgs, die, emit } from './_pl-shared.js';
import { startBatchThread } from '../../core/funnel/pipeline-batch-thread.js';
import { createTask } from '../../core/tasks/task-store.js';

const args = parseArgs(process.argv.slice(2));

const niche = args.niche || die('--niche required');
const city = args.city || die('--city required');
const count = parseInt(args.count || '10', 10);

function pad(n) { return String(n).padStart(2, '0'); }
const now = new Date();
const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}`;
const batchId = args['batch-id'] || `pipe-${niche}-${city}-${stamp}`;
const title = args.title || `[Pipeline] ${niche} / ${city} / ${count} leads — ${now.toISOString().slice(0, 16).replace('T', ' ')} UTC`;

const runFlags = {
  refetch: true,
  with_reviews: true,
  with_gbp_extras: args['skip-gbp'] !== true && false, // skipped this run by Matthew
  skip_gbp: args['skip-gbp'] === true || true,
  precreate_threads_all_grades: args['discord-c-d'] === true,
  outreach: false,
};

const res = await startBatchThread({
  batchId,
  title,
  summary: 'Stage 0 (Discovery) starts next — will pause for review after entities land.',
  niche, city, count,
  runFlags,
});

// 链式触发 pl:scrape-docker · 修复 2026-05-13:
// 此前 pl:pipeline-batch-start 只创 thread + state，不调 gosom → 0 entity 入库。
// 现在创建一个 chained intake task，SOP-0 dispatcher 异步跑 pl:scrape-docker，
// 它再 spawn `leads:maps-scrape` 把 entity 写进 store。
// scrape 通常 3-5 min · 用 10 min timeout 保险。
const NO_CHAIN = args['no-chain'] === true;
let chainedTask = null;
if (!NO_CHAIN) {
  try {
    chainedTask = createTask({
      kind: 'intake',
      source: {
        platform:  'internal',
        thread_id: res.thread_id || null,
        author:    'pl:pipeline-batch-start auto-chain',
        message_id: null,
      },
      input: {
        text: `auto: gosom scrape · niche=${niche} · city=${city} · count=${count} · batch=${batchId}`,
        attachments: [],
      },
      target: {
        cli:               'pl:scrape-docker',
        args:              ['--niche', niche, '--city', city, '--count', String(count), '--batch-id', batchId],
        timeout_ms:        600_000,  // 10 min · scraping needs ~3-5 min + buffer
      },
    });
    console.error(`[pl:pipeline-batch-start] ✓ chained scrape task: ${chainedTask.task_id}`);
  } catch (err) {
    console.error(`[pl:pipeline-batch-start] chain scrape failed: ${err.message}`);
  }
}

emit({
  ok: true,
  batch_id: res.batch_id,
  thread_id: res.thread_id,
  thread_url: res.thread_url,
  state_path: res.state_path,
  scrape_chained: chainedTask?.task_id || null,
});
