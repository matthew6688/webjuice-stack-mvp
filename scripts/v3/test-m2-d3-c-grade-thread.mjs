#!/usr/bin/env node
// M2-D3 · C-grade Discord thread + cold-outreach queue
import fs from 'fs';
import path from 'path';
import { makeRunner, tryImport, REPO_ROOT } from './_test-helpers.mjs';

const r = makeRunner('m2-d3-c-grade-thread');

const m = await tryImport('core/leads/grade-router.js');
if (!m || m.__error) {
  r.skip('grade-router-exists', `core/leads/grade-router.js missing (${m?.__error || 'not found'})`);
  const s = r.summary({ implementation_present: false });
  process.exit(1);
}

const QUEUE = path.join(REPO_ROOT, 'data', 'leads', 'cold-outreach-queue.json');

function readQueue() {
  if (!fs.existsSync(QUEUE)) return [];
  try { return JSON.parse(fs.readFileSync(QUEUE, 'utf8')); } catch { return []; }
}

await r.assert('persistLeadGrade-exposed', () => {
  if (typeof m.persistLeadGrade !== 'function') throw new Error('persistLeadGrade(opts) required');
  return true;
});

await r.assert('c-grade-opens-discord-thread', async () => {
  let opened = false;
  await m.persistLeadGrade({
    entityKey: '__test_c1__',
    grade: 'C',
    __mockDiscord: { openLeadThread: () => { opened = true; return { threadId: 't1' }; } },
  });
  if (!opened) throw new Error('C grade must call openLeadThread');
  return true;
});

await r.assert('c-grade-adds-to-cold-queue', async () => {
  await m.persistLeadGrade({ entityKey: '__test_c2__', grade: 'C', __mockDiscord: { openLeadThread: () => ({ threadId: 't2' }) } });
  const q = readQueue();
  if (!q.find(e => e.entityKey === '__test_c2__' && e.status === 'pending')) {
    throw new Error('C entity not in cold-outreach-queue with pending status');
  }
  return true;
});

await r.assert('c-grade-dedup-in-queue', async () => {
  const before = readQueue().filter(e => e.entityKey === '__test_c3__').length;
  await m.persistLeadGrade({ entityKey: '__test_c3__', grade: 'C', __mockDiscord: { openLeadThread: () => ({ threadId: 't3' }) } });
  await m.persistLeadGrade({ entityKey: '__test_c3__', grade: 'C', __mockDiscord: { openLeadThread: () => ({ threadId: 't3' }) } });
  const after = readQueue().filter(e => e.entityKey === '__test_c3__').length;
  if (after - before !== 1) throw new Error(`expected 1 entry · got ${after - before}`);
  return true;
});

await r.assert('a-b-grade-skips-cold-queue', async () => {
  await m.persistLeadGrade({ entityKey: '__test_a1__', grade: 'A', __mockDiscord: { openLeadThread: () => ({ threadId: 'ta1' }) } });
  await m.persistLeadGrade({ entityKey: '__test_b1__', grade: 'B', __mockDiscord: { openLeadThread: () => ({ threadId: 'tb1' }) } });
  const q = readQueue();
  if (q.find(e => e.entityKey === '__test_a1__' || e.entityKey === '__test_b1__')) {
    throw new Error('A/B grades must not enter cold-outreach queue');
  }
  return true;
});

const s = r.summary();
process.exit(s.exitCode);
