/**
 * cycle-26/27 · TDD test · Stage 7 (Qualification) v2 message format.
 *
 * Verifies stage5Message v2 typography:
 *   - `__Verdict__` block at TOP (operator sees result first)
 *   - Hard Gates listed per-gate (`- ✓ passed` / `- ✗ failed: reason`)
 *   - Scorecard 5 dims with explicit total + threshold
 *   - 数据采集 section at end
 *   - 3 verdict variants: ready-to-build · qa-pending · archived
 */
import assert from 'node:assert/strict';
import { stage5Message } from '../../core/funnel/audit-stage-messages.js';

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); failed++; }
}

console.log('cycle-26/27 · Stage 7 qualification v2 format\n');

const baseEntity = { entityKey: 'test_x' };
const passedGates = [
  { id: 'has_phone', passed: true },
  { id: 'has_address', passed: true },
  { id: 'has_website', passed: true },
];
const mixedGates = [
  { id: 'has_phone', passed: true },
  { id: 'has_address', passed: false, reason: 'no address field' },
  { id: 'has_website', passed: true },
  { id: 'has_email', passed: false, reason: 'email missing' },
];
const scorecard = {
  A_core_info: { score: 24, max: 30, items: ['name', 'phone', 'email'] },
  B_brand: { score: 5, max: 15, items: ['logo'] },
  C_scope: { score: 22, max: 25, items: ['5pages'] },
  D_tech: { score: 15, max: 15, items: ['sitemap'] },
  E_solvability: { score: 6, max: 15, items: ['design'] },
  total: 72,
  threshold: 60,
};
const crawl = { pages_crawled: 5, sitemap_source: '/sitemap.xml', pages_via_firecrawl: 5, pages_via_direct: 0, cost_estimate: 0.075, duration_ms: 6900 };
const brief = { provider: 'codex_cli', duration_ms: 74600, cost_estimate: 0.5 };

// ─── ready-to-build variant ─────────────────────────────────────────────────
const okMsg = stage5Message({
  entity: baseEntity,
  verdict: { verdict: 'ready-to-build', hard_gates: passedGates, scorecard },
  crawl,
  briefResult: brief,
});

t('ready-to-build · Verdict block appears FIRST (before Hard Gates)', () => {
  const idxVerdict = okMsg.indexOf('__Verdict__');
  const idxGates = okMsg.indexOf('__Hard Gates__');
  const idxScorecard = okMsg.indexOf('__Scorecard');
  const idxCrawl = okMsg.indexOf('__数据采集__');
  assert.ok(idxVerdict >= 0, 'verdict section present');
  assert.ok(idxGates > idxVerdict, 'verdict must precede gates');
  assert.ok(idxScorecard > idxGates, 'scorecard must follow gates');
  assert.ok(idxCrawl > idxScorecard, '数据采集 must be at end');
});

t('ready-to-build · Verdict line has **ready-to-build** + total + threshold', () => {
  assert.ok(okMsg.includes('**ready-to-build**'), 'bold ready-to-build');
  assert.ok(okMsg.includes('72/60'), 'score/threshold');
  assert.ok(okMsg.includes('✓'), 'pass mark');
});

t('passed gates listed with `- ✓` · counts in sub-header', () => {
  assert.ok(okMsg.includes('- ✓ has_phone'));
  assert.ok(okMsg.includes('- ✓ has_address'));
  assert.ok(okMsg.includes('- ✓ has_website'));
  assert.ok(okMsg.includes('3/3 passed'), 'count in sub-header');
});

// ─── qa-pending variant ─────────────────────────────────────────────────────
const qaMsg = stage5Message({
  entity: baseEntity,
  verdict: { verdict: 'qa-pending', hard_gates: passedGates, scorecard: { ...scorecard, total: 57 } },
  crawl,
  briefResult: brief,
});

t('qa-pending · Verdict has **qa-pending** + ✗ + total < threshold', () => {
  assert.ok(qaMsg.includes('**qa-pending**'));
  assert.ok(qaMsg.includes('57/60'));
  assert.ok(qaMsg.includes('✗'));
});

// ─── archived variant ──────────────────────────────────────────────────────
const archMsg = stage5Message({
  entity: baseEntity,
  verdict: { verdict: 'archived', hard_gates: [], archive_reason: 'multi_business categories ≥ 4' },
  crawl,
  briefResult: brief,
});

t('archived · Verdict has **archived** + reason', () => {
  assert.ok(archMsg.includes('**archived**'));
  assert.ok(archMsg.includes('multi_business'));
});

// ─── mixed gates: passed first, failed after (logic order) ──────────────────
const mixedMsg = stage5Message({
  entity: baseEntity,
  verdict: { verdict: 'qa-pending', hard_gates: mixedGates, scorecard: { ...scorecard, total: 55 } },
  crawl,
  briefResult: brief,
});

t('mixed gates · ✓ passed listed BEFORE ✗ failed', () => {
  const idxPhoneOk = mixedMsg.indexOf('- ✓ has_phone');
  const idxAddrFail = mixedMsg.indexOf('- ✗ has_address');
  const idxWebOk = mixedMsg.indexOf('- ✓ has_website');
  const idxEmailFail = mixedMsg.indexOf('- ✗ has_email');
  assert.ok(idxPhoneOk > 0 && idxAddrFail > 0 && idxWebOk > 0 && idxEmailFail > 0, 'all 4 gates listed');
  assert.ok(idxPhoneOk < idxAddrFail);
  assert.ok(idxWebOk < idxAddrFail);
  assert.ok(idxPhoneOk < idxEmailFail);
  assert.ok(idxWebOk < idxEmailFail);
});

t('failed gates include reason', () => {
  assert.ok(mixedMsg.includes('- ✗ has_address: no address field'));
  assert.ok(mixedMsg.includes('- ✗ has_email: email missing'));
});

t('mixed gates · 2/4 passed shown in sub-header', () => {
  assert.ok(mixedMsg.includes('2/4 passed'));
});

// ─── stage label v2 ────────────────────────────────────────────────────────
t('Stage label says "Stage 7/9 · 资格复核"', () => {
  for (const m of [okMsg, qaMsg, archMsg, mixedMsg]) {
    assert.ok(m.includes('Stage 7/9 · 资格复核'), `missing stage label`);
  }
});

t('v2 typography: ## header used · NO emoji body (except ✓/✗)', () => {
  // ## header at start
  assert.match(okMsg, /^## Stage 7\/9/);
  // No decorative emojis (✅⚠️❌🚀🎉 etc) · only ✓ ✗ allowed
  for (const msg of [okMsg, qaMsg, archMsg, mixedMsg]) {
    const decorative = msg.match(/[\u{1F300}-\u{1F9FF}]|[\u{2700}-\u{27BF}]/gu) || [];
    const filtered = decorative.filter((g) => g !== '✓' && g !== '✗');
    assert.equal(filtered.length, 0,
      `decorative emoji present: ${filtered.join(' ')}`);
  }
});

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed === 0 ? 0 : 1);
