#!/usr/bin/env node
// M3 auto demo hook · grade-router · A/B grade triggers demo_build task
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { makeRunner, REPO_ROOT } from './_test-helpers.mjs';

const r = makeRunner('m3-demo-hook');

const grade = await import(path.join(REPO_ROOT, 'core/leads/grade-router.js'));
const taskStore = await import(path.join(REPO_ROOT, 'core/tasks/task-store.js'));

// Prep · ensure test entity exists with name (so slug can derive)
const TEST_KEY = '__e2e_m3_demo__';
const entitiesDir = path.join(REPO_ROOT, 'data/leads/entities');
fs.mkdirSync(entitiesDir, { recursive: true });
fs.writeFileSync(path.join(entitiesDir, `${TEST_KEY}.json`), JSON.stringify({
  entityKey: TEST_KEY,
  latest: { name: 'E2E M3 Demo Test', niche: 'roofing', city: 'Brisbane', phone: '0400000000' },
  status: 'ready_for_outreach',
}, null, 2));

// Cleanup any prior test tasks + cold-outreach entries
const cleanupTestTasks = () => {
  const tasks = taskStore.listTasks({ kind: 'demo_build' });
  for (const t of tasks) {
    if ((t.input?.text || '').includes('__e2e_m3_demo__')) {
      const src = path.join(REPO_ROOT, 'data/tasks', `${t.task_id}.json`);
      const archDir = path.join(REPO_ROOT, 'data/tasks/_archive/m3-demo-test');
      fs.mkdirSync(archDir, { recursive: true });
      if (fs.existsSync(src)) fs.renameSync(src, path.join(archDir, `${t.task_id}.json`));
    }
  }
  // Also purge from cold-outreach queue (grade C test pollutes)
  const QUEUE = path.join(REPO_ROOT, 'data/leads/cold-outreach-queue.json');
  if (fs.existsSync(QUEUE)) {
    try {
      const items = JSON.parse(fs.readFileSync(QUEUE, 'utf8'));
      const filtered = items.filter((it) => it.entityKey !== TEST_KEY);
      fs.writeFileSync(QUEUE, JSON.stringify(filtered, null, 2));
    } catch {}
  }
};
cleanupTestTasks();

await r.assert('grade A triggers demo_build task', async () => {
  const out = await grade.persistLeadGrade({
    entityKey: TEST_KEY,
    grade: 'A',
    __mockDiscord: { openLeadThread: () => ({ threadId: 'mock_t_a' }) },
  });
  if (!out.demoTaskId) throw new Error(`expected demoTaskId · got ${JSON.stringify(out)}`);
  const t = taskStore.readTask(out.demoTaskId);
  if (!t) throw new Error('task not in store');
  if (t.kind !== 'demo_build') throw new Error(`kind=${t.kind}`);
  if (t.target?.cli !== 'pl:build-from-reference') throw new Error(`cli=${t.target?.cli}`);
  if (!t.target?.args?.includes('--slug')) throw new Error('args missing --slug');
  if (!t.target?.args?.includes('e2e-m3-demo-test')) throw new Error(`slug not derived: ${t.target?.args}`);
  return { taskId: out.demoTaskId };
});

await r.assert('grade B triggers demo_build task', async () => {
  cleanupTestTasks();
  const out = await grade.persistLeadGrade({
    entityKey: TEST_KEY,
    grade: 'B',
    __mockDiscord: { openLeadThread: () => ({ threadId: 'mock_t_b' }) },
  });
  if (!out.demoTaskId) throw new Error('expected demoTaskId for grade B');
  return true;
});

await r.assert('grade C does NOT trigger demo_build', async () => {
  cleanupTestTasks();
  const out = await grade.persistLeadGrade({
    entityKey: TEST_KEY,
    grade: 'C',
    __mockDiscord: { openLeadThread: () => ({ threadId: 'mock_t_c' }) },
  });
  if (out.demoTaskId) throw new Error('grade C should NOT trigger demo_build · still got task');
  // But should be in cold-outreach queue
  if (!out.enqueued) throw new Error('grade C should enqueue cold outreach');
  return true;
});

await r.assert('grade D does NOT trigger anything', async () => {
  cleanupTestTasks();
  const out = await grade.persistLeadGrade({
    entityKey: TEST_KEY,
    grade: 'D',
    __mockDiscord: { openLeadThread: () => ({ threadId: 'mock_t_d' }) },
  });
  if (out.demoTaskId) throw new Error('grade D should NOT trigger demo_build');
  if (out.enqueued) throw new Error('grade D should NOT enqueue cold outreach');
  return true;
});

await r.assert('A grade dedup · re-call same entity → no 2nd task', async () => {
  cleanupTestTasks();
  const out1 = await grade.persistLeadGrade({
    entityKey: TEST_KEY,
    grade: 'A',
    __mockDiscord: { openLeadThread: () => ({ threadId: 'mock' }) },
  });
  const out2 = await grade.persistLeadGrade({
    entityKey: TEST_KEY,
    grade: 'A',
    __mockDiscord: { openLeadThread: () => ({ threadId: 'mock' }) },
  });
  if (!out1.demoTaskId) throw new Error('first call should create');
  if (out2.demoTaskId) throw new Error(`second call should debounce · got ${out2.demoTaskId}`);
  return { first: out1.demoTaskId, second_blocked: !out2.demoTaskId };
});

// Cleanup
cleanupTestTasks();
fs.unlinkSync(path.join(entitiesDir, `${TEST_KEY}.json`));

const s = r.summary();
process.exit(s.exitCode);
