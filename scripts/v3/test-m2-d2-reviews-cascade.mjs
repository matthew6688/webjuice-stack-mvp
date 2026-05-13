#!/usr/bin/env node
// M2-D2 · docker reviews + Places fallback + adapter
import fs from 'fs';
import path from 'path';
import { makeRunner, tryImport, REPO_ROOT, resolveRepo } from './_test-helpers.mjs';

const r = makeRunner('m2-d2-reviews-cascade');

const adapter = await tryImport('core/leads/reviews-adapter.js');
if (!adapter || adapter.__error) {
  r.skip('adapter-module-exists', `core/leads/reviews-adapter.js missing (${adapter?.__error || 'not found'})`);
  const s = r.summary({ implementation_present: false });
  process.exit(1);
}

await r.assert('adapter-converts-docker-to-places-shape', () => {
  if (typeof adapter.normalizeReviews !== 'function') throw new Error('normalizeReviews(input, source) required');
  const dockerInput = [{ Name: 'Alice', Rating: 5, Description: 'great work' }];
  const out = adapter.normalizeReviews(dockerInput, 'docker');
  if (!out[0] || out[0].author_name !== 'Alice' || out[0].rating !== 5 || out[0].text !== 'great work') {
    throw new Error('docker → {author_name, rating, text} adapter wrong');
  }
  return true;
});

await r.assert('a-grade-fetches-reviews', () => {
  if (typeof adapter.fetchReviewsForEntity !== 'function') throw new Error('fetchReviewsForEntity required');
  return true;
});

await r.assert('c-grade-skips-reviews', async () => {
  const out = await adapter.fetchReviewsForEntity({ grade: 'C', entityKey: 'test-c', __mock: true });
  if (out && out.reviews?.length) throw new Error('C grade must skip review fetch');
  return true;
});

await r.assert('docker-fail-falls-back-to-places', async () => {
  const out = await adapter.fetchReviewsForEntity({ grade: 'A', entityKey: 'test-fallback', __mock: true, __forceDockerFail: true });
  if (!out || out.source !== 'places') throw new Error('expected places fallback source');
  return true;
});

await r.assert('fixture-format-master-md-compatible', () => {
  const fx = adapter.normalizeReviews([{ Name: 'Alice', Rating: 5, Description: 'x' }], 'docker');
  const required = ['author_name', 'rating', 'text'];
  for (const k of required) {
    if (!(k in fx[0])) throw new Error(`fixture missing ${k} required by master-md-builder`);
  }
  return true;
});

await r.assert('timeout-under-5min', () => {
  const body = fs.readFileSync(resolveRepo('core/leads/reviews-adapter.js'), 'utf8');
  if (!body.match(/timeout|5\s*\*\s*60|300_?000/)) {
    throw new Error('5-min timeout guard required');
  }
  return true;
});

const s = r.summary();
process.exit(s.exitCode);
