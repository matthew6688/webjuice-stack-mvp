/**
 * cycle-26 · TDD test 12/14 · Pipeline-end summary checklist message.
 *
 * 核心需求 (Matthew 2026-05-15):
 *   Pipeline 跑完 (Stage 9 publish done) · post 一条 fix-of-record
 *   summary 到 thread · 包含:
 *     📄 报告完整性 (4 doc files · size · sectionCount)
 *     🖼  素材 (screenshots/video/evidence counts)
 *     🌐 在线链接 (5 hyperlinks · CF Pages live)
 *     ✅ Asset Integrity (HTTP 200 check N/N)
 *     💰 成本
 *     📊 Entity 当前态 (phase/grade/audit_score/qualification)
 *     🚀 下一步
 *
 * Tests:
 *   - buildPipelineSummary returns string with all 7 sections
 *   - All 5 deploy URLs present
 *   - Entity 当前态 reflects fixture phase + grade + audit_score
 *   - Asset integrity result rendered (X/Y reachable)
 *   - Cost breakdown sums correctly
 *   - Edge: missing data fields render as ⚠️ not crash
 */
import assert from 'node:assert/strict';
import { buildPipelineSummary } from '../../core/funnel/pipeline-summary.js';

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); failed++; }
}

console.log('cycle-26 · test 12/14 · pipeline summary checklist\n');

const FIXTURE_FULL = {
  entityKey: 'fx_full',
  phase: 'outreach-active',
  grade: { investment_level: 'C' },
  latest: { name: 'Acme Roofing Co', niche: 'roofer' },
  detailed_audit: { audit_score: 65, decision: 'moderate_candidate' },
  qualification: { scorecard: { total: 72, threshold: 60 }, verdict: 'ready-to-build' },
  deploy: {
    demo_url: 'https://acme-roofing-co-dev.pages.dev',
    audit_url: 'https://acme-roofing-co-dev.pages.dev/customer-facing-audit.html',
    internal_audit_url: 'https://acme-roofing-co-dev.pages.dev/internal-audit-report.html',
    master_md_url: 'https://acme-roofing-co-dev.pages.dev/master.md',
    master_report_url: 'https://acme-roofing-co-dev.pages.dev/master.report.html',
    deployed_at: '2026-05-15T03:00:00Z',
  },
};

const FIXTURE_FULL_CTX = {
  assets: {
    master_md_bytes: 19000,
    master_md_sections: 17,
    master_report_bytes: 42000,
    internal_audit_bytes: 94000,
    customer_audit_bytes: 12000,
    screenshot_count: 2,
    evidence_count: 6,
    video_present: true,
    cloudinary_upload_count: 9,
  },
  integrity: {
    ok: true,
    checked: 14,
    broken: [],
  },
  cost: {
    firecrawl_usd: 0.075,
    vision_llm_usd: 0.5,
    ai_brief_usd: 0.5,
  },
  duration_sec: 462, // 7m 42s
};

const summary = buildPipelineSummary({ entity: FIXTURE_FULL, ...FIXTURE_FULL_CTX });

// ─── Section presence ──────────────────────────────────────────────────────
t('summary contains 🏁 Pipeline 完成 header with entity name', () => {
  assert.ok(summary.startsWith('🏁') || summary.includes('🏁'), 'missing 🏁 header');
  assert.ok(summary.includes('Acme Roofing Co'), 'entity name not in header');
});

t('summary contains 📄 报告完整性 section', () => {
  assert.ok(summary.includes('报告完整性'), 'missing 报告完整性 section');
  assert.ok(summary.includes('master.md'), 'must reference master.md');
  assert.ok(summary.includes('17 sections'), 'must show sectionCount');
  assert.ok(/master\.md[^\n]*\d+(\.\d+)?\s*KB/.test(summary), 'must show master.md size in KB');
});

t('summary contains 🖼 素材 section with counts', () => {
  assert.ok(summary.includes('素材'), 'missing 素材 section');
  assert.ok(/截图.*2/.test(summary), 'must show 2 screenshots');
  assert.ok(/[Ee]vidence.*6|证据.*6/.test(summary), 'must show 6 evidence');
  assert.ok(summary.includes('录屏') || summary.includes('video'), 'must mention video');
});

t('summary contains 🌐 在线链接 with all 5 URLs', () => {
  assert.ok(summary.includes('https://acme-roofing-co-dev.pages.dev'), 'demo url missing');
  assert.ok(summary.includes('/customer-facing-audit.html'), 'customer url missing');
  assert.ok(summary.includes('/internal-audit-report.html'), 'internal url missing');
  assert.ok(summary.includes('/master.md'), 'master.md url missing');
  assert.ok(summary.includes('/master.report.html'), 'master.report.html url missing');
});

t('summary contains ✅ Asset Integrity section · 14/14 reachable', () => {
  assert.ok(summary.includes('Asset Integrity') || summary.includes('Integrity'));
  assert.ok(summary.includes('14') && summary.includes('reach'),
    `must show "14 reachable" · got: ${summary.slice(0, 300)}`);
});

t('summary contains 💰 成本 with breakdown + total', () => {
  assert.ok(summary.includes('成本'), 'missing 成本 section');
  assert.ok(summary.includes('Firecrawl'), 'must show Firecrawl line');
  assert.ok(summary.includes('Vision') || summary.includes('vision'), 'must show vision LLM line');
  // Total = 0.075 + 0.5 + 0.5 = 1.075
  assert.ok(summary.includes('1.07') || summary.includes('1.08'), 'must show total ~$1.07');
});

t('summary contains 📊 Entity 当前态 section', () => {
  assert.ok(summary.includes('当前态') || summary.includes('Entity state'));
  assert.ok(summary.includes('outreach-active'), 'must show current phase');
  assert.ok(summary.includes('investment_level') || summary.includes('grade'), 'must show grade');
  assert.ok(summary.includes('65/100') || summary.includes('65'), 'must show audit_score');
  assert.ok(summary.includes('72/100') || summary.includes('72'), 'must show qualification score');
});

t('summary contains 🚀 下一步 section', () => {
  assert.ok(summary.includes('下一步'), 'missing 下一步 section');
});

t('summary duration formatted as Nm Ss', () => {
  assert.ok(summary.includes('7m 42s') || summary.includes('7分42秒') || /7\s*m\s*42/.test(summary),
    `must format 462s as "7m 42s" · got: ${summary.slice(0, 200)}`);
});

// ─── Broken assets surface as ❌ list ──────────────────────────────────────
const FIXTURE_BROKEN_CTX = {
  ...FIXTURE_FULL_CTX,
  integrity: {
    ok: false,
    checked: 14,
    broken: [
      { url: 'https://acme-roofing-co-dev.pages.dev/master.report.html', status: 404 },
      { url: 'https://acme-roofing-co-dev.pages.dev/evidence/issue-foo.png', status: 404 },
    ],
  },
};
const summaryBroken = buildPipelineSummary({ entity: FIXTURE_FULL, ...FIXTURE_BROKEN_CTX });

t('summary surfaces broken URLs · ❌ marker + list', () => {
  assert.ok(summaryBroken.includes('❌') || summaryBroken.includes('FAIL'), 'must mark fail');
  assert.ok(summaryBroken.includes('master.report.html'), 'must list broken URL');
  assert.ok(summaryBroken.includes('404'));
});

// ─── Edge: missing audit data (partial entity) ─────────────────────────────
const FIXTURE_PARTIAL = {
  entityKey: 'fx_partial',
  phase: 'qa-pending',
  grade: { investment_level: 'C' },
  latest: { name: 'Beta Plumbing' },
  // no detailed_audit · no qualification · no deploy
};
const summaryPartial = buildPipelineSummary({
  entity: FIXTURE_PARTIAL,
  assets: { master_md_bytes: 5000, master_md_sections: 5, screenshot_count: 0, evidence_count: 0, video_present: false },
  integrity: { ok: false, checked: 4, broken: [] },
  cost: { firecrawl_usd: 0, vision_llm_usd: 0, ai_brief_usd: 0 },
  duration_sec: 60,
});

t('summary handles missing audit_score gracefully (no "undefined")', () => {
  assert.ok(!summaryPartial.includes('undefined'), 'must not render literal undefined');
  assert.ok(!summaryPartial.includes('NaN'));
});

t('summary handles missing deploy gracefully (shows "未发布" / dash)', () => {
  // No deploy → can't show URLs
  assert.ok(!summaryPartial.includes('https://acme-roofing-co-dev.pages.dev'));
  // Should indicate not yet deployed
  assert.ok(summaryPartial.includes('未发布') || summaryPartial.includes('not deployed') || summaryPartial.includes('—'),
    'must indicate no deploy state');
});

// ─── Authoritative · contains no deprecated terms ──────────────────────────
import { DEPRECATED_TERMS } from '../../core/contracts/discord-messages.js';
t('summary contains zero deprecated terms', () => {
  for (const term of DEPRECATED_TERMS) {
    assert.ok(!summary.includes(term), `deprecated term "${term}" leaked into summary`);
  }
});

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed === 0 ? 0 : 1);
