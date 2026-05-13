#!/usr/bin/env node
// V3 E2E · Discord → Hermes → Discord chain · mocked (no real Discord I/O)
//
// Tests the integration logic WITHOUT requiring Discord bot / Matthew to post.
// Mocks postThreadReply via captured array · runs the real intent router +
// task store + humanize renderer.
//
// True live E2E (Matthew posts a real Discord message) is a separate procedure
// documented in docs/v3/SOP-DISCORD-HERMES-FLOW.md Phase 4.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { makeRunner } from './_test-helpers.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');
process.chdir(REPO);

const r = makeRunner('e2e-discord-chain-mock');

// ─────────────────────────────────────────────────────────────
// Stage 1 · Intent router · text → route
// ─────────────────────────────────────────────────────────────
const router = await import(path.join(REPO, 'core/tasks/intent-router.js'));

// Note: routes are what real regex/ollama router returns · documented here
// to capture current routing behaviour (not what we WISH it returned).
const ROUTE_SCENARIOS = [
  { text: 'find brisbane roofers',                          expectKind: 'intake',         expectCliPrefix: 'pl:pipeline-batch-start' },
  { text: '"cafe brisbane" "cafe melbourne"',               expectKind: 'places-intake',  expectCliPrefix: 'pl:places-search-intake' },
  { text: "Joe's Plumbing 0412345678 Sydney",               expectKind: 'single-enrich',  expectCliPrefix: 'pl:single-enrich' },
  { text: 'audit place_chijwdbif2xzkwsrru6lkmu2l0o',        expectKind: 'audit',          expectCliPrefix: 'run-pipeline' },
];

for (const sc of ROUTE_SCENARIOS) {
  await r.assert(`route: "${sc.text.slice(0, 40)}" → ${sc.expectKind}`, async () => {
    const route = await router.routeIntent({ text: sc.text, attachments: [] });
    if (!route) throw new Error('no route');
    if (route.kind !== sc.expectKind) throw new Error(`kind=${route.kind} expected=${sc.expectKind}`);
    if (sc.expectCliPrefix && !String(route.target_cli || '').includes(sc.expectCliPrefix)) {
      throw new Error(`cli=${route.target_cli} expected to contain ${sc.expectCliPrefix}`);
    }
    return { route };
  });
}

// ─────────────────────────────────────────────────────────────
// Stage 2 · Humanize rendering · simulates listener task-created post
// ─────────────────────────────────────────────────────────────
const humanize = await import(path.join(REPO, 'core/discord-tasks/humanize.js'));

await r.assert('listener post for intake task is human-readable', async () => {
  const route = await router.routeIntent({ text: 'find brisbane roofers', attachments: [] });
  // Override kind to scrape for humanize test (intake is the upstream router kind ·
  // dispatcher sees scrape after route resolution)
  const msg = humanize.renderTaskCreatedMessage({
    task: { task_id: 'test_abc' },
    route: { kind: 'scrape', target_cli: 'pl:scrape-docker', args: ['--niche', 'roofer'], target_entity_key: null, provider: 'regex' },
  });
  if (!msg.includes('批量抓客户')) throw new Error('label missing');
  if (!msg.includes('🔎')) throw new Error('emoji missing');
  if (!msg.includes('test_abc')) throw new Error('task id missing');
  if (msg.match(/^kind:\s*scrape\s*$/m)) throw new Error('jargon "kind: scrape" leaked');
  return { msg_bytes: msg.length };
});

await r.assert('dispatcher done message extracts business summary', async () => {
  const msg = humanize.renderDoneMessage({
    task: { kind: 'scrape', task_id: 'abc' },
    durationMs: 4800,
    tail: 'gosom: found 12 rows · lead_count=12 · entities=12',
    xref: null,
  });
  if (!msg.includes('找到 12')) throw new Error(`expected "找到 12" in: ${msg.slice(0, 200)}`);
  if (!msg.includes('<details>')) throw new Error('technical fold missing');
  return true;
});

await r.assert('failed message gives human-readable docker hint', async () => {
  const msg = humanize.renderFailedMessage({
    task: { kind: 'scrape', task_id: 'abc' },
    exitCode: 1,
    stderr: 'Error: connect ECONNREFUSED 127.0.0.1:8080',
    tail: 'Error: connect ECONNREFUSED 127.0.0.1:8080',
  });
  if (!msg.match(/Docker|docker/)) throw new Error(`expected docker hint in: ${msg.slice(0, 200)}`);
  if (!msg.match(/docker start|✅ 重试/)) throw new Error('expected actionable instructions');
  return true;
});

// ─────────────────────────────────────────────────────────────
// Stage 3 · Task store lifecycle · create → list → cleanup
// ─────────────────────────────────────────────────────────────
const taskStore = await import(path.join(REPO, 'core/tasks/task-store.js'));

let testTaskId = null;
await r.assert('createTask writes pending task', () => {
  const route = { kind: 'ops', target_cli: 'ops:health-check', args: [], provider: 'regex', confidence: 1 };
  const task = taskStore.createTask({
    kind: route.kind,
    source: { platform: 'test', thread_id: null, author: 'e2e-chain-mock', message_id: null },
    input: { text: 'e2e chain mock · health check sim', attachments: [] },
    target: { cli: route.target_cli, args: route.args, target_entity_key: null, timeout_ms: 30_000 },
  });
  testTaskId = task.task_id;
  if (!task.task_id) throw new Error('no task_id');
  if (task.status !== 'pending') throw new Error(`expected pending · got ${task.status}`);
  return { task_id: task.task_id };
});

await r.assert('readTask retrieves what was written', () => {
  const t = taskStore.readTask(testTaskId);
  if (!t) throw new Error('task disappeared');
  if (t.kind !== 'ops') throw new Error('kind mismatch');
  if (t.input.text !== 'e2e chain mock · health check sim') throw new Error('input.text mismatch');
  return true;
});

// Cleanup
await r.assert('cleanup test task', () => {
  const src = path.join(REPO, 'data/tasks', `${testTaskId}.json`);
  const archDir = path.join(REPO, 'data/tasks/_archive/regression');
  fs.mkdirSync(archDir, { recursive: true });
  if (fs.existsSync(src)) fs.renameSync(src, path.join(archDir, `${testTaskId}.json`));
  return true;
});

// ─────────────────────────────────────────────────────────────
// Stage 4 · Admin URL deep links · 4 surface types
// ─────────────────────────────────────────────────────────────
await r.assert('adminUrls covers all 6 surfaces', () => {
  const surfaces = ['task', 'discovery', 'customerAudit', 'customerDemo', 'customerPhotos', 'coldQueue'];
  for (const s of surfaces) {
    if (typeof humanize.adminUrls[s] !== 'function') throw new Error(`adminUrls.${s} missing`);
    const url = s.startsWith('customer') || s === 'task' || s === 'discovery'
      ? humanize.adminUrls[s]('test-input')
      : humanize.adminUrls[s]();
    if (!url.startsWith('http')) throw new Error(`${s} URL invalid: ${url}`);
  }
  return true;
});

const s = r.summary();
process.exit(s.exitCode);
