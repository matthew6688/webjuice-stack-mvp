/**
 * cycle-27 · TDD test · profile card shows live URLs when entity.deploy.demo_url
 * exists · regardless of whether audit chain completed.
 *
 * Matthew (2026-05-15 thread 1504878217448657029 Brisbane Roof Restoration):
 *   "profile card 为什么没有更新"
 *
 * Root cause: renderProfileCard gated 在线资源 section on `thisEntityAudited`
 * (require entity.grade.investment_level || detailed_audit). Manually published
 * V2-era entities (Brisbane Roof Restoration, Ace, etc) have deploy.demo_url
 * but no grade/audit · card never showed live URLs · operator saw "stale" card.
 *
 * Fix: gate only on `deploy?.demo_url` existence. If it's published · show it.
 */
import assert from 'node:assert/strict';

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); failed++; }
}

console.log('cycle-27 · profile card live URLs (no audit-gate)\n');

const { renderProfileCard } = await import('../../core/funnel/profile-card.js');

// ─── T1 · entity with deploy but NO audit → still renders 在线资源 ──
t('renderProfileCard · entity.deploy without grade still shows 在线资源 section', () => {
  const entity = {
    entityKey: 'demo',
    phase: 'outreach-active',
    grade: null,  // manually published · never audited
    latest: { name: 'Test Roofer', city: 'Brisbane', niche: 'roofer', rating: 4.8, review_count: 10 },
    deploy: {
      demo_url: 'https://test-roofer-dev.pages.dev',
      audit_url: 'https://test-roofer-dev.pages.dev/customer-facing-audit.html',
      internal_audit_url: 'https://test-roofer-dev.pages.dev/internal-audit-report.html',
      master_md_url: 'https://test-roofer-dev.pages.dev/master.md',
      master_report_url: 'https://test-roofer-dev.pages.dev/master.report.html',
      deployed_at: '2026-05-15T10:00:00Z',
    },
  };
  const embed = renderProfileCard(entity, { audit: null, channel: 'projects' });
  const desc = embed.description || '';
  assert.ok(/在线资源|已发布|Demo:/.test(desc),
    `must surface 在线资源 / Demo URL · got desc: ${desc.slice(0, 200)}`);
  assert.ok(desc.includes('test-roofer-dev.pages.dev'),
    'must include the live demo URL in card');
  assert.ok(desc.includes('customer-facing-audit') || desc.includes('客户 audit'),
    'must surface customer-facing audit URL');
});

// ─── T2 · entity WITH audit also still shows 在线资源 (no regression) ──
t('renderProfileCard · audited entity still shows 在线资源 (no regression)', () => {
  const entity = {
    entityKey: 'audited',
    phase: 'outreach-active',
    grade: { investment_level: 'B', product_tier: 'T2' },
    latest: { name: 'Audited Co', city: 'Sydney', niche: 'roofer', rating: 4.5, review_count: 20 },
    detailed_audit: { at: '2026-05-15T08:00:00Z' },
    deploy: { demo_url: 'https://audited-co-dev.pages.dev', deployed_at: '2026-05-15T09:00:00Z' },
  };
  const embed = renderProfileCard(entity, { audit: null, channel: 'projects' });
  const desc = embed.description || '';
  assert.ok(desc.includes('audited-co-dev.pages.dev'), 'audited entity must also show URL');
});

// ─── T3 · entity WITHOUT deploy still skips 在线资源 (pre-publish) ──
t('renderProfileCard · no deploy.demo_url still skips 在线资源 (pre-publish state)', () => {
  const entity = {
    entityKey: 'pre',
    phase: 'audit-ready',
    grade: { investment_level: 'C' },
    latest: { name: 'Pre Co', city: 'Melbourne', niche: 'roofer' },
    // no deploy
  };
  const embed = renderProfileCard(entity, { audit: null, channel: 'projects' });
  const desc = embed.description || '';
  // Pre-publish · either shows "现状证据 (本地·等发布)" or counts · NOT live URLs
  assert.ok(!desc.includes('-dev.pages.dev'), 'pre-publish entity must not show live URL');
});

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed === 0 ? 0 : 1);
