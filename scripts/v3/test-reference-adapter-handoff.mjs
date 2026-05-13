#!/usr/bin/env node
// Contract test · core/leads/reference-adapter-handoff.js
import fs from 'fs';
import path from 'path';
import { makeRunner, REPO_ROOT } from './_test-helpers.mjs';

const r = makeRunner('reference-adapter-handoff');

const mod = await import(path.join(REPO_ROOT, 'core/leads/reference-adapter-handoff.js'));

await r.assert('exports buildReferenceAdapterPrompt + resolveReferenceSite + buildAdapterPayload', () => {
  if (typeof mod.buildReferenceAdapterPrompt !== 'function') throw new Error('buildReferenceAdapterPrompt missing');
  if (typeof mod.resolveReferenceSite !== 'function') throw new Error('resolveReferenceSite missing');
  if (typeof mod.buildAdapterPayload !== 'function') throw new Error('buildAdapterPayload missing');
  return true;
});

await r.assert('resolveReferenceSite roofing → classic-premium-roftix', () => {
  const ref = mod.resolveReferenceSite({ niche: 'roofing' });
  if (ref.family !== 'classic-premium-roftix') throw new Error(`family=${ref.family}`);
  if (!ref.html.includes('Brisbane Premium Roof Co')) throw new Error('reference HTML body unexpected');
  if (!ref.boundaries.includes('LOCKED')) throw new Error('boundaries body unexpected');
  if (!fs.existsSync(ref.assetsDir)) throw new Error(`assetsDir missing: ${ref.assetsDir}`);
  return { family: ref.family, htmlBytes: ref.html.length };
});

await r.assert('resolveReferenceSite unknown niche → throws helpful error', () => {
  try {
    mod.resolveReferenceSite({ niche: 'florist' });
    throw new Error('expected throw');
  } catch (err) {
    if (!err.message.includes('No reference family')) throw new Error(`wrong error: ${err.message}`);
    return true;
  }
});

await r.assert('buildReferenceAdapterPrompt embeds reference HTML + boundaries + customer brief', () => {
  const prompt = mod.buildReferenceAdapterPrompt({
    slug: 'test',
    entity: { entityKey: 'test', latest: { name: 'Test Roofing', niche: 'roofing', phone: '0412', city: 'Brisbane' } },
    audit: { score: 55, decision: 'strong_redesign', issues: ['no phone visible', 'mobile slow'] },
  });
  if (!prompt.includes('Brisbane Premium Roof Co')) throw new Error('reference not embedded');
  if (!prompt.includes('LOCKED')) throw new Error('boundaries not embedded');
  if (!prompt.includes('Test Roofing')) throw new Error('customer brief not embedded');
  if (!prompt.includes('audit pain points')) throw new Error('audit instruction missing');
  if (prompt.length < 40_000) throw new Error(`prompt too short: ${prompt.length}`);
  return { promptBytes: prompt.length };
});

await r.assert('buildAdapterPayload returns prompt + assetsDir + family', () => {
  const p = mod.buildAdapterPayload({
    slug: 'test',
    entity: { entityKey: 'test', latest: { name: 'Test', niche: 'roofing' } },
  });
  if (typeof p.prompt !== 'string') throw new Error('prompt missing');
  if (!p.assetsDir || !fs.existsSync(p.assetsDir)) throw new Error('assetsDir invalid');
  if (p.family !== 'classic-premium-roftix') throw new Error('family resolution wrong');
  return p.family;
});

await r.assert('prefers masterMd when provided', () => {
  const masterMd = '---\nbusiness_name: "Real Roofer"\n---\n# Real Roofer\nAudit found 3 issues.\n';
  const p = mod.buildReferenceAdapterPrompt({
    slug: 'r',
    entity: { latest: { name: 'Real Roofer', niche: 'roofing' } },
    masterMd,
  });
  if (!p.includes('Audit found 3 issues')) throw new Error('masterMd content not embedded');
  return true;
});

const s = r.summary();
process.exit(s.exitCode);
