#!/usr/bin/env node
/**
 * QA: core/leads/dedup-llm-decider.js
 *
 * Uses a mock ollamaFn (no live Ollama dependency) so it runs in CI.
 *
 * Cases:
 *   1. Identical Acacia Plumbing entries → 'same' high conf
 *   2. Same phone + different name + different city → 'different' / 'uncertain'
 *   3. Same domain, different names (parent/subsidiary) → 'uncertain'
 *   4. Ollama unreachable → 'uncertain' source:'fallback'
 *   5. Non-JSON / schema-invalid output → 'uncertain' source:'fallback'
 *   6. Verdict object always has required fields
 *
 * Exits 0 on all pass, 1 on any fail.
 */

import { llmDecideDedup } from '../../core/leads/dedup-llm-decider.js';

const GREEN = '\x1b[32m'; const RED = '\x1b[31m'; const RESET = '\x1b[0m';
let pass = 0, fail = 0;
const failures = [];

function check(label, cond, detail = '') {
  if (cond) { pass++; console.log(`  ${GREEN}✓${RESET} ${label}`); }
  else      { fail++; failures.push(`${label}${detail ? ' — ' + detail : ''}`); console.log(`  ${RED}✗${RESET} ${label}  ${detail}`); }
}

/* ── Mock entities ─────────────────────────────────────────────────── */

const acaciaA = {
  entityKey: 'domain_acaciaplumbing.com.au',
  identifiers: { place_id: 'ChIJacacia1', phoneDigits: '61398765432', websiteDomain: 'acaciaplumbing.com.au' },
  latest: { name: 'Acacia Plumbing', phone: '03 9876 5432', website: 'https://acaciaplumbing.com.au', address: '12 Main St', city: 'Melbourne', state: 'VIC', niche: 'plumber' },
};
const acaciaB = {
  entityKey: 'place_ChIJacacia1',
  identifiers: { place_id: 'ChIJacacia1', phoneDigits: '61398765432', websiteDomain: 'acaciaplumbing.com.au' },
  latest: { name: 'Acacia Plumbing', phone: '03 9876 5432', website: 'https://acaciaplumbing.com.au', address: '12 Main St', city: 'Melbourne', state: 'VIC', niche: 'plumber' },
};

const samePhoneDiffCity_A = {
  entityKey: 'phone_a',
  identifiers: { phoneDigits: '61400111222' },
  latest: { name: "Joe's Bakery", phone: '0400 111 222', address: '5 King St', city: 'Sydney', state: 'NSW', niche: 'bakery' },
};
const samePhoneDiffCity_B = {
  entityKey: 'phone_b',
  identifiers: { phoneDigits: '61400111222' },
  latest: { name: 'Sunrise Auto Repair', phone: '0400 111 222', address: '88 Beach Rd', city: 'Perth', state: 'WA', niche: 'mechanic' },
};

const domainParent_A = {
  entityKey: 'dom_a',
  identifiers: { websiteDomain: 'megacorp.com.au' },
  latest: { name: 'MegaCorp Group', website: 'https://megacorp.com.au', city: 'Sydney', niche: 'holding' },
};
const domainParent_B = {
  entityKey: 'dom_b',
  identifiers: { websiteDomain: 'megacorp.com.au' },
  latest: { name: 'MegaCorp Plumbing Division', website: 'https://megacorp.com.au/plumbing', city: 'Brisbane', niche: 'plumber' },
};

/* ── Mock ollamaFn factory ─────────────────────────────────────────── */

function mockOllama(json, { latency = 42 } = {}) {
  return async () => ({ parsedJson: json, rawText: JSON.stringify(json), latencyMs: latency });
}
function mockOllamaThrow(err = 'ECONNREFUSED') {
  return async () => { throw new Error(err); };
}
function mockOllamaBadJson() {
  return async () => ({ parsedJson: null, rawText: 'not json at all', latencyMs: 10 });
}
function mockOllamaSchemaInvalid(j) {
  return async () => ({ parsedJson: j, rawText: JSON.stringify(j), latencyMs: 10 });
}

/* ── Case 1: identical entries → 'same' high confidence ─────────── */

console.log('\n=== Case 1 · identical Acacia Plumbing ===');
{
  const v = await llmDecideDedup(acaciaA, acaciaB, { reason: 'place_id-match', matched_field: 'place_id', matched_value: 'ChIJacacia1' }, {
    ollamaFn: mockOllama({
      verdict: 'same', confidence: 0.97,
      reasoning: 'place_id 一致 · 电话域名地址全相同 · 同一家无疑',
      fields_supporting_same: ['place_id', 'phone', 'website', 'address', 'name'],
      fields_supporting_different: [],
    }),
  });
  check('verdict === same', v.verdict === 'same', `got ${v.verdict}`);
  check('confidence >= 0.85', v.confidence >= 0.85, `got ${v.confidence}`);
  check('source === llm', v.source === 'llm');
  check('reasoning is non-empty string', typeof v.reasoning === 'string' && v.reasoning.length > 0);
  check('fields_supporting_same is array w/ items', Array.isArray(v.fields_supporting_same) && v.fields_supporting_same.length > 0);
  check('model is qwen3.5:9b by default', v.model === 'qwen3.5:9b', `got ${v.model}`);
  check('latency_ms is number', typeof v.latency_ms === 'number');
}

/* ── Case 2: same phone, different city/niche → 'different' ─────── */

console.log('\n=== Case 2 · same phone diff name/city → different ===');
{
  const v = await llmDecideDedup(samePhoneDiffCity_A, samePhoneDiffCity_B, { reason: 'phone-match', matched_field: 'phone', matched_value: '61400111222' }, {
    ollamaFn: mockOllama({
      verdict: 'different', confidence: 0.9,
      reasoning: '虽同电话但业态/城市完全不同 · 应是号码回收 · 不同商家',
      fields_supporting_same: ['phone'],
      fields_supporting_different: ['name', 'city', 'state', 'niche', 'address'],
    }),
  });
  check('verdict === different', v.verdict === 'different');
  check('confidence high', v.confidence >= 0.85);
  check('fields_supporting_different non-empty', v.fields_supporting_different.length > 0);
}

/* ── Case 3: same domain parent/sub → uncertain ─────────────────── */

console.log('\n=== Case 3 · same domain parent/subsidiary → uncertain ===');
{
  const v = await llmDecideDedup(domainParent_A, domainParent_B, { reason: 'domain-match', matched_field: 'domain', matched_value: 'megacorp.com.au' }, {
    ollamaFn: mockOllama({
      verdict: 'uncertain', confidence: 0.55,
      reasoning: '同域名但名称是母公司 vs 子部门 · 业态不同 · 需要人工核实是否分离档案',
      fields_supporting_same: ['website_domain'],
      fields_supporting_different: ['name', 'city', 'niche'],
    }),
  });
  check('verdict === uncertain', v.verdict === 'uncertain');
  check('confidence < 0.85', v.confidence < 0.85);
}

/* ── Case 4: ollama unreachable → fallback uncertain ────────────── */

console.log('\n=== Case 4 · ollama unreachable → fallback ===');
{
  const v = await llmDecideDedup(acaciaA, acaciaB, { reason: 'place_id-match', matched_value: 'X' }, {
    ollamaFn: mockOllamaThrow('ECONNREFUSED 127.0.0.1:11434'),
  });
  check('verdict === uncertain on throw', v.verdict === 'uncertain', `got ${v.verdict}`);
  check('source === fallback', v.source === 'fallback', `got ${v.source}`);
  check('reasoning mentions failure', /失败|unreachable|ECONN/.test(v.reasoning), v.reasoning);
  check('confidence === 0 in fallback', v.confidence === 0);
}

/* ── Case 5a: non-JSON output → fallback ────────────────────────── */

console.log('\n=== Case 5a · ollama returns non-JSON ===');
{
  const v = await llmDecideDedup(acaciaA, acaciaB, { reason: 'phone-match' }, {
    ollamaFn: mockOllamaBadJson(),
  });
  check('verdict uncertain', v.verdict === 'uncertain');
  check('source fallback', v.source === 'fallback');
  check('reasoning mentions parse', /JSON|失败/.test(v.reasoning));
}

/* ── Case 5b: schema-invalid JSON → fallback ────────────────────── */

console.log('\n=== Case 5b · ollama returns wrong schema ===');
{
  const v = await llmDecideDedup(acaciaA, acaciaB, { reason: 'phone-match' }, {
    ollamaFn: mockOllamaSchemaInvalid({ verdict: 'maybe', confidence: 'high' }),
  });
  check('verdict uncertain on schema fail', v.verdict === 'uncertain');
  check('source fallback on schema fail', v.source === 'fallback');
}

{
  // missing reasoning field
  const v = await llmDecideDedup(acaciaA, acaciaB, { reason: 'phone-match' }, {
    ollamaFn: mockOllamaSchemaInvalid({ verdict: 'same', confidence: 0.9 }),
  });
  check('missing-reasoning rejected', v.source === 'fallback', `got source=${v.source}`);
}

/* ── Case 6: model override flag works ──────────────────────────── */

console.log('\n=== Case 6 · model override ===');
{
  const v = await llmDecideDedup(acaciaA, acaciaB, { reason: 'phone-match' }, {
    model: 'qwen3:4b',
    ollamaFn: mockOllama({ verdict: 'same', confidence: 0.9, reasoning: 'x', fields_supporting_same: [], fields_supporting_different: [] }),
  });
  check('model override respected', v.model === 'qwen3:4b', `got ${v.model}`);
}

/* ── Summary ───────────────────────────────────────────────────── */

console.log(`\n${pass + fail} checks · ${GREEN}${pass} passed${RESET} · ${fail ? RED + fail + ' failed' + RESET : '0 failed'}`);
if (fail) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
process.exit(0);
