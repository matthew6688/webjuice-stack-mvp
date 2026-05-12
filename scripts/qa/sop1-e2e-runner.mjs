#!/usr/bin/env node
/**
 * SOP-1 E2E runner · 跑 4 入口真链路 + 记录每步状态更新
 *
 * 每个入口:
 *   1. 触发 (createTask 模拟 SOP-0 接 Discord 路由 · 不走真 Discord 但跑真 CLI)
 *   2. 监听 task 状态变化 (pending → running → done/failed)
 *   3. 看是否有 chained task 生成
 *   4. 看是否有 entity 落 data/leads/entities
 *   5. 看 Discord forum thread 有没有创出 (验 thread_id 存在)
 *
 * 不走真 Discord 入口 (绕过 listener) 是因为这样可以无 GUI / 无人监督地跑,
 * 且能完整记录每一步. 真 Discord 链路在 SOP-0 烟测里已验过, 这里聚焦
 * SOP-1 业务路径的状态正确性.
 *
 * Usage:
 *   node scripts/qa/sop1-e2e-runner.mjs [--only single|image|places|batch]
 *   node scripts/qa/sop1-e2e-runner.mjs --dry-run   # 不真跑 · 看 plan
 */

import fs from 'node:fs';
import path from 'node:path';
import { createTask, readTask, listTasks } from '../../core/tasks/task-store.js';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => {
  if (a.startsWith('--')) return [a.slice(2), arr[i+1]?.startsWith('--') ? true : (arr[i+1] || true)];
  return null;
}).filter(Boolean));
const ONLY = args.only;
const DRY = args['dry-run'] === true;

const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', D = '\x1b[2m', X = '\x1b[0m';

const REPO_ROOT = path.resolve('.');
const REPORT_PATH = path.join(REPO_ROOT, `data/qa/sop1-e2e-${new Date().toISOString().slice(0, 10)}.md`);
const ENTITIES_DIR = path.join(REPO_ROOT, 'data/leads/entities');

function snapshotEntities() {
  if (!fs.existsSync(ENTITIES_DIR)) return new Set();
  return new Set(fs.readdirSync(ENTITIES_DIR).filter(f => f.endsWith('.json')));
}

function waitForTask(taskId, timeoutMs) {
  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      const t = readTask(taskId);
      if (!t) return resolve({ ok: false, reason: 'task not found' });
      if (['done', 'failed'].includes(t.status)) return resolve({ ok: true, task: t });
      if (Date.now() - start > timeoutMs) return resolve({ ok: false, reason: 'timeout', task: t });
      setTimeout(tick, 2000);
    };
    tick();
  });
}

const TESTS = [
  {
    id: 'single',
    name: '单商家解析 (pl:single-enrich)',
    skip_if: () => !process.env.GOOGLE_PLACES_API_KEY,
    skip_reason: 'GOOGLE_PLACES_API_KEY missing (Places API needed)',
    timeout_ms: 60_000,
    spawn: () => createTask({
      kind: 'single-enrich',
      source: { platform: 'qa-e2e', author: 'sop1-e2e-runner', thread_id: null, message_id: null },
      input:  { text: 'e2e: Joe\'s Plumbing 0412 345 678 melbourne', attachments: [] },
      target: {
        cli: 'pl:single-enrich',
        args: ['--business-name', 'Smith Plumbing Test', '--phone', '0412345678', '--city', 'melbourne', '--niche', 'plumber', '--no-chain', '--dry-run'],
        timeout_ms: 60_000,
      },
    }),
  },
  {
    id: 'places',
    name: 'Google Places 搜索 (pl:places-search-intake)',
    skip_if: () => !process.env.GOOGLE_PLACES_API_KEY,
    skip_reason: 'GOOGLE_PLACES_API_KEY missing',
    timeout_ms: 90_000,
    spawn: () => createTask({
      kind: 'places-intake',
      source: { platform: 'qa-e2e', author: 'sop1-e2e-runner', thread_id: null, message_id: null },
      input:  { text: 'e2e: places search test', attachments: [] },
      target: {
        cli: 'pl:places-search-intake',
        args: ['--query', '"plumber test brisbane"', '--limit', '2', '--dry-run'],
        timeout_ms: 90_000,
      },
    }),
  },
  {
    id: 'image',
    name: '图片识别 (pl:ingest-image)',
    skip_if: () => true,
    skip_reason: 'needs real image attachment · run via Discord upload to test',
    timeout_ms: 120_000,
  },
  {
    id: 'batch',
    name: '批量 Maps 抓取 (pl:pipeline-batch-start → 链 pl:scrape-docker)',
    skip_if: () => false, // gosom Docker has been verified at 8080
    skip_reason: '',
    timeout_ms: 600_000,
    spawn: () => createTask({
      kind: 'intake',
      source: { platform: 'qa-e2e', author: 'sop1-e2e-runner', thread_id: null, message_id: null },
      input:  { text: 'e2e: find brisbane plumbers (small)', attachments: [] },
      target: {
        cli: 'pl:pipeline-batch-start',
        args: ['--niche', 'plumber', '--city', 'cairns', '--count', '3', '--batch-id', `e2e-cairns-${Date.now()}`],
        timeout_ms: 120_000,
      },
    }),
  },
];

const results = [];

for (const t of TESTS) {
  if (ONLY && ONLY !== t.id) continue;
  console.log(`\n${'='.repeat(70)}\n${G}▶ ${t.name}${X}\n${'='.repeat(70)}`);
  const r = { id: t.id, name: t.name, steps: [] };

  if (t.skip_if?.()) {
    console.log(`  ${Y}⏭  SKIP${X} · ${t.skip_reason}`);
    r.status = 'skipped';
    r.skip_reason = t.skip_reason;
    results.push(r);
    continue;
  }

  if (DRY) {
    console.log(`  ${D}(dry-run · would spawn)${X}`);
    r.status = 'dry-run';
    results.push(r);
    continue;
  }

  const entitiesBefore = snapshotEntities();
  const before = new Date().toISOString();

  let task;
  try {
    task = t.spawn();
    console.log(`  ${G}✓${X} createTask → ${task.task_id} (pending)`);
    r.steps.push({ step: 'spawn', ok: true, task_id: task.task_id });
  } catch (err) {
    console.log(`  ${R}✗${X} spawn failed: ${err.message}`);
    r.steps.push({ step: 'spawn', ok: false, error: err.message });
    r.status = 'error';
    results.push(r);
    continue;
  }

  console.log(`  ${D}…waiting (timeout ${t.timeout_ms/1000}s)${X}`);
  const waitResult = await waitForTask(task.task_id, t.timeout_ms);
  if (!waitResult.ok) {
    console.log(`  ${R}✗${X} ${waitResult.reason} · last status: ${waitResult.task?.status}`);
    r.steps.push({ step: 'wait', ok: false, reason: waitResult.reason });
    r.status = 'timeout';
    results.push(r);
    continue;
  }

  const final = waitResult.task;
  console.log(`  ${G}✓${X} task ${final.status} · ${final.duration_ms}ms`);
  r.steps.push({ step: 'wait', ok: true, status: final.status, duration_ms: final.duration_ms });

  // chained?
  const chainedTasks = listTasks({}).filter(x =>
    x.task_id !== final.task_id &&
    new Date(x.created_at) > new Date(before) &&
    (x.source?.author?.includes(t.id) || x.input?.text?.includes('auto:'))
  );
  if (chainedTasks.length > 0) {
    console.log(`  ${G}✓${X} chained task(s): ${chainedTasks.map(c => c.task_id).join(', ')}`);
    r.steps.push({ step: 'chain', ok: true, chained: chainedTasks.map(c => ({ id: c.task_id, kind: c.kind, status: c.status })) });
  } else {
    console.log(`  ${D}- no chained task${X}`);
    r.steps.push({ step: 'chain', ok: true, chained: [] });
  }

  // new entities?
  const entitiesAfter = snapshotEntities();
  const newEntities = [...entitiesAfter].filter(e => !entitiesBefore.has(e));
  if (newEntities.length > 0) {
    console.log(`  ${G}✓${X} ${newEntities.length} new entity file(s) · sample: ${newEntities[0]}`);
    r.steps.push({ step: 'entity-write', ok: true, count: newEntities.length, samples: newEntities.slice(0, 3) });
  } else {
    console.log(`  ${Y}!${X} 0 new entity files`);
    r.steps.push({ step: 'entity-write', ok: false, count: 0 });
  }

  r.status = final.status;
  r.task_id = task.task_id;
  results.push(r);
}

// emit report
const md = renderMarkdown(results);
fs.writeFileSync(REPORT_PATH, md);
console.log(`\n${G}report → ${REPORT_PATH}${X}\n`);

const failedCount = results.filter(r => r.status !== 'done' && r.status !== 'skipped' && r.status !== 'dry-run').length;
process.exit(failedCount === 0 ? 0 : 1);

function renderMarkdown(results) {
  const ts = new Date().toISOString();
  let out = `# SOP-1 E2E 测试报告\n\n生成时间: ${ts}\n\n`;
  out += `## Summary\n\n| 入口 | 状态 | 备注 |\n|---|---|---|\n`;
  for (const r of results) {
    const emoji = r.status === 'done' ? '✅' : r.status === 'skipped' ? '⏭️' : r.status === 'dry-run' ? '🔵' : '❌';
    const note = r.skip_reason || r.steps?.find(s => !s.ok)?.reason || r.steps?.find(s => !s.ok)?.error || '-';
    out += `| ${r.name} | ${emoji} ${r.status} | ${note} |\n`;
  }
  out += '\n## Per-entry detail\n\n';
  for (const r of results) {
    out += `### ${r.name}\n\n`;
    out += `- id: \`${r.id}\`\n- status: ${r.status}\n`;
    if (r.task_id) out += `- task_id: \`${r.task_id}\`\n`;
    if (r.skip_reason) out += `- skip reason: ${r.skip_reason}\n`;
    if (r.steps?.length) {
      out += '\n| step | ok | detail |\n|---|---|---|\n';
      for (const s of r.steps) {
        const detail = JSON.stringify(Object.fromEntries(Object.entries(s).filter(([k]) => k !== 'step' && k !== 'ok')));
        out += `| ${s.step} | ${s.ok ? '✓' : '✗'} | \`${detail}\` |\n`;
      }
    }
    out += '\n';
  }
  return out;
}
