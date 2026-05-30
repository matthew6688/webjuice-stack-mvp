/** test-gather-candidates.mjs · multi-source union/dedup (codex R134 step B). Injected search impls. */
import assert from 'node:assert';
import { gatherCandidates } from '../../core/enrichment/identity/gather-candidates.js';
let p = 0; const ok = (c, m) => { assert.ok(c, m); p++; };

const tinyfish = async () => ({ results: [
  { url: 'https://acmeroofing.com.au', title: 'Acme Roofing' },
  { url: 'https://facebook.com/acme', title: 'Acme on FB' },
] });
const ddg = async () => ({ results: [
  { url: 'https://www.acmeroofing.com.au/about', title: 'About — dup host' }, // same host as tinyfish #1 → deduped
  { url: 'https://hipages.com.au/acme', title: 'hipages listing' },
] });

const r = await gatherCandidates({ latest: { business_name: 'Acme Roofing', city: 'Sydney', niche: 'roofing' } }, { tinyfish, ddg });
ok(r.queries[0] === 'Acme Roofing Sydney roofing', 'query built from name+city+niche');
const domains = r.candidates.map((c) => c.domain);
ok(domains.includes('acmeroofing.com.au') && domains.includes('facebook.com') && domains.includes('hipages.com.au'), 'union across providers');
ok(domains.filter((d) => d === 'acmeroofing.com.au').length === 1, 'dedup by host (www + path variant collapsed)');
ok(r.candidates.length === 3, 'exactly 3 unique-host candidates');
ok(r.candidates.every((c) => c.name === 'Acme Roofing' && c.source === 'web'), 'candidates carry name + source');
ok(r.sources.find((s) => s.via === 'tinyfish') && r.sources.find((s) => s.via === 'ddg'), 'both sources recorded');

// no name → empty (no blind search)
const r2 = await gatherCandidates({ latest: { city: 'X' } }, { tinyfish, ddg });
ok(r2.candidates.length === 0, 'no business name → no candidates');

// one provider throws → other still yields (graceful)
const r3 = await gatherCandidates({ latest: { business_name: 'Acme Roofing' } }, { tinyfish: async () => { throw new Error('rate limit'); }, ddg });
ok(r3.candidates.length >= 1 && r3.sources.find((s) => s.via === 'tinyfish' && s.ok === false), 'one provider fails → other still supplies + error recorded');

console.log(`gather-candidates: ${p} passed, 0 failed`);
