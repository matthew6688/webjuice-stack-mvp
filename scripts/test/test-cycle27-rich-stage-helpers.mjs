/**
 * cycle-27 · TDD test · audit-stage-content.js helpers
 *
 * Verifies typography primitives that all 9 stage builders depend on.
 * Per docs/v3/CYCLE-27-RICH-STAGES.md typography rules.
 */
import assert from 'node:assert/strict';

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); failed++; }
}

console.log('cycle-27 · audit-stage-content helpers\n');

const m = await import('../../core/contracts/audit-stage-content.js');

// ─── T1 · constants ─────────────────────────────────────────────────
t('exports PLACEHOLDER = "—" (em-dash)', () => {
  assert.equal(m.PLACEHOLDER, '—');
});
t('exports MAX_MESSAGE_LENGTH = 2000', () => {
  assert.equal(m.MAX_MESSAGE_LENGTH, 2000);
});
t('STAGE_TITLES covers all 9 stages', () => {
  for (let i = 1; i <= 9; i++) {
    assert.ok(m.STAGE_TITLES[i], `stage ${i} missing`);
    assert.match(m.STAGE_TITLES[i], new RegExp(`Stage ${i}/9`));
  }
});

// ─── T2 · fmtVal · null-safe placeholders ─────────────────────────
t('fmtVal returns em-dash for null/undefined/empty', () => {
  assert.equal(m.fmtVal(null), '—');
  assert.equal(m.fmtVal(undefined), '—');
  assert.equal(m.fmtVal(''), '—');
});
t('fmtVal returns string for primitives', () => {
  assert.equal(m.fmtVal('hello'), 'hello');
  assert.equal(m.fmtVal(42), '42');
  assert.equal(m.fmtVal(true), '是');
  assert.equal(m.fmtVal(false), '否');
});

// ─── T3 · fmtRow ─────────────────────────────────────────────────────
t('fmtRow renders "- key: value" · em-dash for missing', () => {
  assert.equal(m.fmtRow('电话', '0449168985'), '- 电话: 0449168985');
  assert.equal(m.fmtRow('电话', null), '- 电话: —');
  assert.equal(m.fmtRow('email', ''), '- email: —');
});

t('fmtRows joins array of [key, value] pairs', () => {
  const out = m.fmtRows([['a', 1], ['b', null], ['c', 'x']]);
  assert.equal(out, '- a: 1\n- b: —\n- c: x');
});

// ─── T4 · fmtCode ────────────────────────────────────────────────────
t('fmtCode wraps in backticks · em-dash for missing', () => {
  assert.equal(m.fmtCode('WordPress'), '`WordPress`');
  assert.equal(m.fmtCode(null), '—');
});

// ─── T5 · fmtStageHeader ────────────────────────────────────────────
t('fmtStageHeader · stage 3 = "## Stage 3/9 · 网站审计"', () => {
  assert.equal(m.fmtStageHeader(3), '## Stage 3/9 · 网站审计');
});
t('fmtStageHeader · with suffix', () => {
  assert.equal(m.fmtStageHeader(3, '83s'), '## Stage 3/9 · 网站审计 · 83s');
});

// ─── T6 · fmtSubHeader ──────────────────────────────────────────────
t('fmtSubHeader · "__title__" with optional subtext', () => {
  assert.equal(m.fmtSubHeader('技术栈'), '__技术栈__');
  assert.equal(m.fmtSubHeader('速度', 'PageSpeed mobile'), '__速度__   -# PageSpeed mobile');
});

// ─── T7 · fmtTranslation (italic line) ──────────────────────────────
t('fmtTranslation wraps in *italic*', () => {
  assert.equal(m.fmtTranslation('用户打开等 4 秒'), '*用户打开等 4 秒*');
});

// ─── T8 · fmtBlockquote (impact / takeaway) ─────────────────────────
t('fmtBlockquote prefixes each line with "> "', () => {
  assert.equal(m.fmtBlockquote('one\ntwo'), '> one\n> two');
});
t('fmtBlockquote handles null/empty → em-dash', () => {
  assert.equal(m.fmtBlockquote(null), '> —');
  assert.equal(m.fmtBlockquote(''), '> —');
});

// ─── T9 · fmtSubtext ────────────────────────────────────────────────
t('fmtSubtext prefixes with "-# "', () => {
  assert.equal(m.fmtSubtext('evidence: link'), '-# evidence: link');
});

// ─── T10 · fmtLink ──────────────────────────────────────────────────
t('fmtLink renders markdown link · em-dash for null url', () => {
  assert.equal(m.fmtLink('desktop', 'https://example.com/d.png'), '[desktop](https://example.com/d.png)');
  assert.equal(m.fmtLink('x', null), '—');
});

// ─── T11 · fmtCriticalIssue ─────────────────────────────────────────
t('fmtCriticalIssue · full card with plain + impact + evidence', () => {
  const out = m.fmtCriticalIssue(1, {
    title: '电话号码第一屏看不到',
    plain: '电话号在 fold 下面',
    impact: '本地服务 60-70% 客户倾向打电话',
    evidence: 'https://x.com/p.png',
    evidenceLabel: 'evidence',
  });
  assert.match(out, /\*\*1 · 电话号码第一屏看不到\*\*/);
  assert.match(out, /\*电话号在 fold 下面\*/);
  assert.match(out, /^> 本地服务 60-70% 客户倾向打电话$/m);
  assert.match(out, /-# evidence: \[https:\/\/x\.com\/p\.png\]\(https:\/\/x\.com\/p\.png\)/);
});

t('fmtCriticalIssue · missing evidence renders em-dash', () => {
  const out = m.fmtCriticalIssue(2, { title: 'x', plain: 'y', impact: 'z' });
  assert.match(out, /-# evidence: —/);
});

// ─── T12 · joinSections + SEPARATOR ────────────────────────────────
t('joinSections joins with separator · skips empty', () => {
  const out = m.joinSections(['section 1', '', 'section 2', null, 'section 3']);
  assert.match(out, /section 1\n\n\n———\n\n\nsection 2\n\n\n———\n\n\nsection 3/);
});

// ─── T13 · safeTruncate ────────────────────────────────────────────
t('safeTruncate · no-op if under limit', () => {
  assert.equal(m.safeTruncate('hello', 100), 'hello');
});
t('safeTruncate · adds ellipsis if over limit', () => {
  const long = 'a'.repeat(3000);
  const out = m.safeTruncate(long);
  assert.ok(out.length <= m.MAX_MESSAGE_LENGTH);
  assert.match(out, /…/);
  assert.match(out, /-# 内容被截断/);
});

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed === 0 ? 0 : 1);
