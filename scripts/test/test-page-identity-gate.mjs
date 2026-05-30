/**
 * test-page-identity-gate.mjs · deterministic guard tests for judgePageIdentity promotion (codex R131).
 * No real LLM — mocks opts.runner with crafted verdicts. Locks: (HIGH) promotion requires a
 * DETERMINISTICALLY-verified strong identifier matching a known target fact, NOT the model's self-label;
 * (MEDIUM) only explicit providers may promote (unknown / non-allowlisted local → never).
 */
import assert from 'node:assert';
import { judgePageIdentity } from '../../core/llm/match-judge.js';

let p = 0; const ok = (c, m) => { assert.ok(c, m); p++; };
const mk = (verdict, provider = 'codex_cli', model = 'cli-default') => async () => ({ text: JSON.stringify(verdict), provider, model });

// 1 · HIGH: model CLAIMS owned_domain but entity has NO known website → deterministic verifier fails → not promotable
const r1 = await judgePageIdentity(
  { entity: { latest: { business_name: 'Premier Roofing', city: 'Geelong', state: 'VIC' } }, page: { url: 'https://premierroofinggeelong.com.au', text: 'Premier Roofing Geelong — quality roofing.' } },
  { runner: mk({ status: 'same', confidence: 0.9, evidence: [{ type: 'owned_domain', detail: 'premierroofinggeelong.com.au' }], conflicts: [] }) });
ok(r1.status === 'same' && r1.promotable === false, 'model-claimed owned_domain w/o known website → NOT promotable (deterministic gate beats prompt obedience)');

// 2 · verified phone (entity phone actually in page) → promotable (cloud provider)
const r2 = await judgePageIdentity(
  { entity: { latest: { business_name: 'Vicwest Roofing', phone: '03 5333 1111' } }, page: { url: 'x', text: 'Call us on (03) 5333 1111 today.' } },
  { runner: mk({ status: 'same', confidence: 0.9, evidence: [{ type: 'phone', detail: '(03) 5333 1111' }], conflicts: [] }) });
ok(r2.promotable === true && r2.verified_evidence === 'phone', 'verified phone match → promotable');

// 3 · verified owned_domain when entity HAS that website → promotable
const r3 = await judgePageIdentity(
  { entity: { latest: { business_name: 'Northside Roofing', website: 'https://northsideroofing.com.au' } }, page: { url: 'https://northsideroofing.com.au', text: 'Northside Roofing Brisbane.' } },
  { runner: mk({ status: 'same', evidence: [{ type: 'owned_domain' }], conflicts: [] }) });
ok(r3.promotable === true && r3.verified_evidence === 'owned_domain', 'verified known-website domain → promotable');

// 4 · MEDIUM: UNKNOWN provider → never promote, even with verified evidence
const r4 = await judgePageIdentity(
  { entity: { latest: { business_name: 'Vicwest Roofing', phone: '03 5333 1111' } }, page: { url: 'x', text: 'Call (03) 5333 1111' } },
  { runner: mk({ status: 'same', evidence: [{ type: 'phone' }], conflicts: [] }, 'unknown_wrapper', 'x') });
ok(r4.promotable === false, 'unknown provider → never promotable');

// 5 · local ollama NOT in PAGE_JUDGE_REDLINE_MODELS → not promotable even with verified evidence
const r5 = await judgePageIdentity(
  { entity: { latest: { business_name: 'Vicwest Roofing', phone: '03 5333 1111' } }, page: { url: 'x', text: 'Call (03) 5333 1111' } },
  { runner: mk({ status: 'same', evidence: [{ type: 'phone' }], conflicts: [] }, 'ollama', 'qwen3.6:27b') });
ok(r5.promotable === false, 'ollama not in REDLINE allowlist → not promotable (judges but cannot promote)');

// 6 · status 'different' never promotable
const r6 = await judgePageIdentity(
  { entity: { latest: { business_name: 'Vicwest Roofing', phone: '03 5333 1111' } }, page: { url: 'x', text: 'Call (03) 5333 1111' } },
  { runner: mk({ status: 'different', evidence: [{ type: 'phone' }], conflicts: [] }) });
ok(r6.promotable === false, "status 'different' → not promotable");

console.log(`page-identity-gate: ${p} passed, 0 failed`);
