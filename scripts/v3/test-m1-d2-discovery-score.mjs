#!/usr/bin/env node
// M1-D2 · 统一 discoveryScore across 4 entry points
import { makeRunner, tryImport } from './_test-helpers.mjs';

const r = makeRunner('m1-d2-discovery-score');

const CASES = [
  ['gosom-full', { sourceType: 'gosom', websiteStatus: 'https', phone: '0412', review_count: 100, rating: 4.5 }, (s) => s >= 25],
  ['places-full', { sourceType: 'places_search', websiteStatus: '', phone: '0412', review_count: 100, rating: 4.5 }, (s, ref) => Math.abs(s - ref) <= 5, 'gosom-full'],
  ['image-min', { sourceType: 'image_lead', phone: '' }, (s) => s === 0],
  ['single-enrich', { sourceType: 'single_enrich', phone: '0412', website: 'http://x.com' }, (s) => s >= 15],
  ['no-website-bonus', { sourceType: 'gosom', websiteStatus: 'NO_WEBSITE', phone: '0412' }, (s) => s >= 40],
  ['empty-no-crash', {}, (s) => s === 0],
];

const m = await tryImport('core/leads/discovery-score.js');

if (!m || m.__error) {
  for (const c of CASES) r.skip(`case-${c[0]}`, `discovery-score.js missing (${m?.__error || 'not found'})`);
  const s = r.summary({ implementation_present: false });
  process.exit(1);
}

const scores = {};
for (const [name, entity, check, refName] of CASES) {
  await r.assert(`case-${name}`, () => {
    const score = m.computeDiscoveryScore(entity);
    if (typeof score !== 'number') throw new Error('must return number');
    scores[name] = score;
    const ok = refName ? check(score, scores[refName]) : check(score);
    if (!ok) throw new Error(`score=${score} failed check`);
    return true;
  });
}

await r.assert('classify-website-status-shared', () => {
  if (typeof m.classifyWebsiteStatus !== 'function') throw new Error('classifyWebsiteStatus must be exported');
  return true;
});

const s = r.summary({ scores });
process.exit(s.exitCode);
