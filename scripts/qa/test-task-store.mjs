#!/usr/bin/env node
/**
 * scripts/qa/test-task-store.mjs · SOP-0 P1 smoke test
 *
 * Exercises core/tasks/task-store.js end-to-end:
 *  1. generateTaskId format
 *  2. createTask → readTask roundtrip
 *  3. listTasks filter
 *  4. canTransition matrix
 *  5. transitionStatus pending → running → done
 *  6. appendProgress + ring buffer
 *  7. tryClaim atomic semantics (sequential second claim fails)
 *  8. loadForumTags + appliedTagsFor
 *  9. Illegal transition throws
 *
 * Run: node scripts/qa/test-task-store.mjs
 * Exits 0 on pass, 1 on any fail. Cleans up after itself.
 */

import fs from 'node:fs';
import path from 'node:path';
import * as ts from '../../core/tasks/task-store.js';

const TASKS_DIR = path.resolve(process.cwd(), 'data/tasks');
const GREEN = '\x1b[32m'; const RED = '\x1b[31m'; const DIM = '\x1b[2m'; const RESET = '\x1b[0m';

let pass = 0, fail = 0;
const created = []; // track for cleanup

function check(label, cond, detail = '') {
  if (cond) { pass++; console.log(`  ${GREEN}✓${RESET} ${label}`); }
  else      { fail++; console.log(`  ${RED}✗${RESET} ${label}${detail ? ` ${DIM}${detail}${RESET}` : ''}`); }
}

function cleanup() {
  for (const id of created) {
    try { fs.unlinkSync(path.join(TASKS_DIR, `${id}.json`)); } catch {}
    try { fs.unlinkSync(path.join(TASKS_DIR, `${id}.json.claiming`)); } catch {}
  }
}

try {
  console.log('1. generateTaskId format');
  const id1 = ts.generateTaskId();
  check('matches YYYYMMDD-HHMMSS-rand6', /^\d{8}-\d{6}-[0-9a-f]{6}$/.test(id1), `got ${id1}`);
  const id2 = ts.generateTaskId();
  check('unique consecutive ids', id1 !== id2);

  console.log('\n2. createTask + readTask roundtrip');
  const t1 = ts.createTask({
    kind: 'intake',
    source: { platform: 'discord', thread_id: 'test-thread-1', author: 'test' },
    input: { text: 'find brisbane roofers' },
    target: { cli: 'pl:pipeline-batch-step', args: ['--niche', 'roofer'] },
  });
  created.push(t1.task_id);
  check('created task has correct kind', t1.kind === 'intake');
  check('default status is pending', t1.status === 'pending');
  check('schemaVersion = 1', t1.schemaVersion === 1);
  check('file written to disk', fs.existsSync(path.join(TASKS_DIR, `${t1.task_id}.json`)));
  const t1read = ts.readTask(t1.task_id);
  check('readTask matches', t1read.task_id === t1.task_id && t1read.input.text === 'find brisbane roofers');

  console.log('\n3. listTasks filter');
  const t2 = ts.createTask({ kind: 'audit', input: { text: 'audit place_xyz' } });
  created.push(t2.task_id);
  const allPending = ts.listTasks({ status: 'pending' });
  check('lists pending tasks ≥ 2', allPending.length >= 2);
  const onlyIntake = ts.listTasks({ kind: 'intake', status: 'pending' });
  check('filter by kind works', onlyIntake.every((t) => t.kind === 'intake'));

  console.log('\n4. canTransition matrix');
  check('pending → running OK',  ts.canTransition('pending', 'running'));
  check('pending → done BAD',    !ts.canTransition('pending', 'done'));
  check('running → done OK',     ts.canTransition('running', 'done'));
  check('done → anything BAD',   !ts.canTransition('done', 'pending'));
  check('failed → pending OK',   ts.canTransition('failed', 'pending'));
  check('self-loop BAD',         !ts.canTransition('running', 'running'));

  console.log('\n5. transitionStatus lifecycle');
  ts.transitionStatus(t1.task_id, 'running');
  check('pending → running', ts.readTask(t1.task_id).status === 'running');
  ts.transitionStatus(t1.task_id, 'done', { result: { exit_code: 0, entity_keys: ['place_xyz'] } });
  const t1done = ts.readTask(t1.task_id);
  check('running → done', t1done.status === 'done');
  check('result merged', t1done.result.exit_code === 0 && t1done.result.entity_keys[0] === 'place_xyz');

  console.log('\n6. appendProgress + ring buffer');
  ts.appendProgress(t2.task_id, 'router.resolved', 'kind=audit');
  ts.appendProgress(t2.task_id, 'cli.spawned', 'pid=12345');
  const t2p = ts.readTask(t2.task_id);
  check('progress has 2 entries', t2p.progress.length === 2);
  check('first entry has at + step + detail',
    t2p.progress[0].at && t2p.progress[0].step === 'router.resolved');
  // Push 60 more → ring buffer caps at 50
  for (let i = 0; i < 60; i++) ts.appendProgress(t2.task_id, `step.${i}`, '');
  const t2capped = ts.readTask(t2.task_id);
  check('progress ring buffer capped at 50', t2capped.progress.length === 50);

  console.log('\n7. tryClaim atomic semantics');
  const t3 = ts.createTask({ kind: 'enrich', input: { text: 'claim race' } });
  created.push(t3.task_id);
  const claim1 = ts.tryClaim(t3.task_id);
  check('first claim succeeds', claim1 && claim1.status === 'running');
  const claim2 = ts.tryClaim(t3.task_id);
  check('second claim returns null', claim2 === null);

  console.log('\n8. loadForumTags + appliedTagsFor');
  const tags = ts.loadForumTags();
  check('tags file loads', tags && tags.channelId === '1503702990761099419');
  check('kind tags has 8 entries', Object.keys(tags.kind).length === 8);
  check('status tags has 5 entries', Object.keys(tags.status).length === 5);
  const applied = ts.appliedTagsFor('intake', 'pending');
  check('appliedTagsFor returns [kind, status] pair', Array.isArray(applied) && applied.length === 2);

  console.log('\n9. Illegal transition throws');
  let threw = false;
  try { ts.transitionStatus(t1done.task_id, 'pending'); } catch { threw = true; }
  check('done → pending throws', threw);
  let badKind = false;
  try { ts.createTask({ kind: 'bogus' }); } catch { badKind = true; }
  check('invalid kind throws', badKind);

  console.log(`\n${pass} pass · ${fail} fail`);
} finally {
  cleanup();
}

process.exit(fail === 0 ? 0 : 1);
