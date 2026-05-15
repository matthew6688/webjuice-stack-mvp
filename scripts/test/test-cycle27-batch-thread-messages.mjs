/**
 * cycle-27 · TDD test · v2 batch-thread message builders
 *
 * Matthew (2026-05-15 from screenshot review):
 *   - 这种显示方式也加到我们之前的 stage 显示优化任务里面
 *   - 至少这些商家要 list 显示
 *   - 少 emoji
 *
 * Contract (per docs/v3/CYCLE-27-RICH-STAGES.md typography rules):
 *   - 正文零 emoji (status only with ✓/✗ sparingly)
 *   - 没数据 `—` 占位 · 不删行
 *   - businesses as bullet list (NOT inline · NOT 前 3/前 5)
 *   - LLM 校验 with blockquote for reason + bullet list for suspicious
 *   - `## ` header · `__under__` subsection · `-# ` subtext · `———` divider
 *   - ≤ 2000 char
 */
import assert from 'node:assert/strict';

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); failed++; }
}

console.log('cycle-27 · batch-thread v2 message builders\n');

const m = await import('../../core/funnel/batch-thread-messages.js');

// Helper: assert body has no problematic emoji (only ✓ ✗ allowed)
function assertNoBodyEmoji(body, name) {
  // Allow ✓ ✗ ━ — · # `; reject decorative emoji ranges
  const bad = body.match(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{27BF}]/gu);
  // Filter out allowed status glyphs · ✓ U+2713 · ✗ U+2717
  const filtered = (bad || []).filter((g) => g !== '✓' && g !== '✗');
  assert.equal(filtered.length, 0,
    `${name} contains decorative emoji: ${filtered.join(' ')} · body:\n${body}`);
}

// ─── T1 · batchStartMessage ────────────────────────────────────────────
t('batchStartMessage · all 4 base fields + flags', () => {
  const body = m.batchStartMessage({
    batchId: 'places-roofer-in-geelong-202605151916',
    niche: 'roofer',
    city: 'geelong',
    count: 10,
    source: 'google places api',
    runFlags: { source: 'places_search', query: 'roofer in geelong', with_details: true },
    startedAt: '2026-05-15T09:16:00Z',
  });
  assert.match(body, /^## 批次启动/);
  assert.match(body, /行业:.*`roofer`/);
  assert.match(body, /城市:.*`geelong`/);
  assert.match(body, /目标:.*\*\*10\*\*/);
  assert.match(body, /数据源:.*`google places api`/);
  assert.match(body, /-# batch_id: `places-roofer-in-geelong-202605151916`/);
  assert.match(body, /-# 启动时间: 2026-05-15T09:16:00Z/);
  assert.match(body, /-# flags:.*with_details=true/);
  assertNoBodyEmoji(body, 'batchStart');
});

t('batchStartMessage · missing fields → em-dash placeholder', () => {
  const body = m.batchStartMessage({ batchId: 'b1' });
  assert.match(body, /行业:.*`—`/);
  assert.match(body, /城市:.*`—`/);
  assert.match(body, /目标:.*\*\*—\*\*/);
  assert.match(body, /数据源:.*—/);
});

t('batchStartMessage · length ≤ 2000', () => {
  const body = m.batchStartMessage({
    batchId: 'x', niche: 'roofer', city: 'sydney', count: 100,
    source: 'gosom docker', runFlags: { a: 1, b: 2, c: 3 }, startedAt: 'now',
  });
  assert.ok(body.length <= 2000, `length ${body.length}`);
});

// ─── T2 · batchSearchMessage ───────────────────────────────────────────
t('batchSearchMessage · happy path', () => {
  const body = m.batchSearchMessage({ query: 'mobile mechanic in mackay', count: 5, withDetails: true });
  assert.match(body, /^## 搜索/);
  assert.match(body, /查询:.*`mobile mechanic in mackay`/);
  assert.match(body, /商家数:.*\*\*5\*\*/);
  assert.match(body, /-# 正在拉详细信息/);
  assertNoBodyEmoji(body, 'batchSearch');
});

t('batchSearchMessage · 0 results triggers fail blockquote', () => {
  const body = m.batchSearchMessage({ query: 'roofer in nowhere', count: 0 });
  assert.match(body, /> 没找到任何商家/);
});

t('batchSearchMessage · missing query → em-dash', () => {
  const body = m.batchSearchMessage({ count: 3 });
  assert.match(body, /查询:.*`—`/);
});

// ─── T3 · batchEntityWriteMessage · all businesses as bullet list ──────
t('batchEntityWriteMessage · ALL businesses listed (not 前 3 / 前 5)', () => {
  const names = ['Vantage mobile mechanic', 'Mechanic 2 U Mackay', 'A.M.D. Automotive Services',
                 'Heathz Mechanical', 'The Mechanic Mackay'];
  const body = m.batchEntityWriteMessage({ count: 5, entityNames: names });
  assert.match(body, /^## 写入实体/);
  assert.match(body, /\*\*5 个商家入库\*\*/);
  for (const n of names) {
    assert.ok(body.includes(`- ${n}`), `must list "${n}" as bullet · body:\n${body}`);
  }
  assertNoBodyEmoji(body, 'batchEntityWrite');
});

t('batchEntityWriteMessage · LLM judge block · blockquote reason + suspicious bullet list', () => {
  const body = m.batchEntityWriteMessage({
    count: 5,
    entityNames: ['A','B','C'],
    llmJudge: {
      verdict: 'human-gate',
      confidence: 0.65,
      reason: 'All candidates appear to be real Mackay-area mechanic businesses, but a couple look like generic workshop/automotive services rather than clearly mobile mechanics.',
      suspicious_picks: ['A.M.D. Automotive Services', 'Heathz Mechanical'],
      provider: 'codex_cli',
    },
  });
  assert.match(body, /__LLM 校验__/);
  assert.match(body, /verdict: `human-gate`/);
  assert.match(body, /confidence `0\.65`/);
  assert.match(body, /^> All candidates appear to be real/m, 'reason must be blockquote');
  assert.match(body, /可疑名单:\n- A\.M\.D\. Automotive Services\n- Heathz Mechanical/);
  assert.match(body, /-# provider: `codex_cli`/);
  assertNoBodyEmoji(body, 'batchEntityWrite-llm');
});

t('batchEntityWriteMessage · no businesses → em-dash placeholder row', () => {
  const body = m.batchEntityWriteMessage({ count: 0, entityNames: [] });
  assert.match(body, /\*\*0 个商家入库\*\*/);
  assert.match(body, /- —/, 'placeholder row when no entities');
});

t('batchEntityWriteMessage · LLM judge missing suspicious_picks → em-dash row', () => {
  const body = m.batchEntityWriteMessage({
    count: 3,
    entityNames: ['A','B','C'],
    llmJudge: { verdict: 'trust', confidence: 0.95, reason: 'looks fine', suspicious_picks: [] },
  });
  assert.match(body, /可疑名单:\n- —/, 'em-dash when no suspicious');
});

// ─── T4 · batchDedupMessage ────────────────────────────────────────────
t('batchDedupMessage · 0 dup groups → clean blockquote', () => {
  const body = m.batchDedupMessage({ dupGroups: 0 });
  assert.match(body, /^## 去重审核/);
  assert.match(body, /重复组数:.*\*\*0\*\*/);
  assert.match(body, /> 数据库干净 · 无重复/);
  assert.match(body, /嫌疑 entity 数: —/);
  assertNoBodyEmoji(body, 'batchDedup');
});

t('batchDedupMessage · with dup groups → review hint', () => {
  const body = m.batchDedupMessage({ dupGroups: 3, suspectCount: 7 });
  assert.match(body, /找到 \*\*3\*\* 组重复/);
  assert.match(body, /嫌疑 entity 数: \*\*7\*\*/);
  assert.match(body, /-# 审 dedup-review-queue\.json/);
});

// ─── T5 · batchFinalizeMessage ─────────────────────────────────────────
t('batchFinalizeMessage · standard happy path', () => {
  const body = m.batchFinalizeMessage({ query: 'roofer in geelong', count: 10, expectedTotal: 10 });
  assert.match(body, /^## 批次完成/);
  assert.match(body, /查询:.*`roofer in geelong`/);
  assert.match(body, /入库:.*\*\*10\*\*/);
  assert.match(body, /目标:.*`10`/);
  assert.match(body, /链路: audit chain 已自动触发/);
  assert.match(body, /-# 详情见各 lead thread/);
  assertNoBodyEmoji(body, 'batchFinalize');
});

t('batchFinalizeMessage · no query (docker scrape path)', () => {
  const body = m.batchFinalizeMessage({ count: 5 });
  assert.match(body, /入库:.*\*\*5\*\*/);
  // No query line · skip · OK
  assert.ok(!/查询/.test(body));
});

// ─── T6 · all builders honor 2000-char limit ──────────────────────────
t('all 5 builders ≤ 2000 char even with large inputs', () => {
  const huge = Array(50).fill().map((_, i) => `Long Business Name ${i}`);
  const bodies = {
    start: m.batchStartMessage({ batchId: 'x', niche: 'roofer', city: 'sydney', count: 50 }),
    search: m.batchSearchMessage({ query: 'q'.repeat(100), count: 50 }),
    write: m.batchEntityWriteMessage({ count: 50, entityNames: huge,
      llmJudge: { verdict: 'human-gate', reason: 'r'.repeat(500), suspicious_picks: huge.slice(0,5) } }),
    dedup: m.batchDedupMessage({ dupGroups: 10, suspectCount: 20 }),
    finalize: m.batchFinalizeMessage({ query: 'q', count: 50, expectedTotal: 50 }),
  };
  for (const [name, body] of Object.entries(bodies)) {
    assert.ok(body.length <= 2000, `${name} too long: ${body.length}`);
  }
});

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed === 0 ? 0 : 1);
