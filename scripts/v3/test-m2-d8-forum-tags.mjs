#!/usr/bin/env node
// M2-D8 · Forum tag set · 14 tags · no new additions
import fs from 'fs';
import path from 'path';
import { makeRunner, REPO_ROOT, resolveRepo } from './_test-helpers.mjs';

const r = makeRunner('m2-d8-forum-tags');

const TAGS_FILE = 'data/discord/website-tasks-forum-tags.json';
const abs = resolveRepo(TAGS_FILE);

if (!abs) {
  r.skip('tags-file-exists', `${TAGS_FILE} missing`);
  const s = r.summary({ implementation_present: false });
  process.exit(1);
}

await r.assert('json-parseable', () => {
  JSON.parse(fs.readFileSync(abs, 'utf8'));
  return true;
});

await r.assert('14-tags-present', () => {
  const tags = JSON.parse(fs.readFileSync(abs, 'utf8'));
  const list = Array.isArray(tags) ? tags : (tags.tags || []);
  if (list.length !== 14) throw new Error(`expected 14 tags · got ${list.length}`);
  return true;
});

await r.assert('no-duplicate-tags', () => {
  const tags = JSON.parse(fs.readFileSync(abs, 'utf8'));
  const list = Array.isArray(tags) ? tags : (tags.tags || []);
  const names = list.map(t => t.name || t.id || t);
  const set = new Set(names);
  if (set.size !== names.length) throw new Error('duplicate tag names');
  return true;
});

const s = r.summary();
process.exit(s.exitCode);
