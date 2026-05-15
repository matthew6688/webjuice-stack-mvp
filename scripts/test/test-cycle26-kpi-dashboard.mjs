/**
 * cycle-26 · TDD test 23/?? · KPI Dashboard message.
 *
 * Replaces verbose per-entity batch thread events (🔄/🆕 spam) with single
 * comprehensive KPI dashboard at batch end. Same dashboard echoed to
 * #website-tasks parent thread.
 *
 * Function: buildKpiDashboard({ batchState, entities }) → string
 *
 * Sections:
 *   🏁 header (niche/city · duration · cost)
 *   📊 KPI counts (scraped/audit_done/graded/published/qa_pending/archived)
 *   🚀 Published list (links to live URLs)
 *   ⚠️ Needs operator (qa-pending + pre-gate fails)
 *   🗄 Archived (with reasons)
 */
import assert from 'node:assert/strict';
import { buildKpiDashboard } from '../../core/funnel/kpi-dashboard.js';

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); failed++; }
}

console.log('cycle-26 · test 23/?? · KPI dashboard\n');

// ─── Fixture: realistic batch (5 scraped · 3 published · 1 qa-pending · 1 archived) ─
const FIXTURE_BATCH_STATE = {
  batchId: 'pipe-roofer-sydney-202605151200',
  niche: 'roofer',
  city: 'sydney',
  started_at: '2026-05-15T12:00:00Z',
  finalized_at: '2026-05-15T12:13:00Z',
  query: 'roofer in sydney',
  cost_usd_total: 8.50,
};

const FIXTURE_ENTITIES = [
  {
    name: 'Ace Roofing Service',
    entityKey: 'domain_aceroofingservice.com.au',
    threadUrl: 'https://discord.com/channels/123/456',
    phase: 'outreach-active',
    grade: 'C',
    audit_score: 65,
    deploy_url: 'https://ace-roofing-service-dev.pages.dev',
    qualification_total: 72,
  },
  {
    name: 'Pro Build Roofing',
    entityKey: 'domain_probuildroofing.com.au',
    threadUrl: 'https://discord.com/channels/123/457',
    phase: 'outreach-active',
    grade: 'C',
    audit_score: 22,
    deploy_url: 'https://pro-build-roofing-dev.pages.dev',
    qualification_total: 63,
  },
  {
    name: 'Tekline Roofing',
    entityKey: 'domain_teklineroofing.com.au',
    threadUrl: 'https://discord.com/channels/123/458',
    phase: 'outreach-active',
    grade: 'C',
    audit_score: 37,
    deploy_url: 'https://tekline-roofing-dev.pages.dev',
    qualification_total: 68,
  },
  {
    name: 'VIP Roofing Brisbane',
    entityKey: 'domain_viproofing.com.au',
    threadUrl: 'https://discord.com/channels/123/459',
    phase: 'qa-pending',
    grade: 'C',
    audit_score: 23,
    qualification_total: 56,
    qualification_threshold: 60,
  },
  {
    name: 'Queensland Roofing Pty Ltd',
    entityKey: 'domain_queenslandroofing.com.au',
    threadUrl: 'https://discord.com/channels/123/460',
    phase: 'archived',
    grade: 'D',
    archive_reason: 'stage2_sitemap_too_large: sitemap 67 pages > 10',
  },
];

const dash = buildKpiDashboard({ batchState: FIXTURE_BATCH_STATE, entities: FIXTURE_ENTITIES });

// ─── Section presence ─────────────────────────────────────────────────────
t('header has 🏁 batch finalize emoji + niche/city', () => {
  assert.ok(dash.includes('🏁'));
  assert.ok(dash.includes('roofer') && dash.includes('sydney'));
});

t('duration shown (13m)', () => {
  assert.ok(/13\s*m/.test(dash) || /780\s*s/.test(dash),
    'must show 13min between started and finalized');
});

t('cost shown ($8.50 or $8.5)', () => {
  assert.ok(/\$8\.5/.test(dash));
});

// ─── KPI counts section ──────────────────────────────────────────────────
t('KPI section · counts for each outcome', () => {
  assert.ok(dash.includes('Scraped:'));
  assert.ok(/Published[^:]*:\s*3/.test(dash), `expected Published: 3 · got: ${dash.slice(0, 800)}`);
  assert.ok(/QA[ -]pending[^:]*:\s*1/i.test(dash));
  assert.ok(/Archived[^:]*:\s*1/.test(dash));
});

t('KPI · all 5 entities accounted for (3 + 1 + 1 = 5)', () => {
  const m = dash.match(/Scraped[^:]*:\s*(\d+)/);
  assert.ok(m, 'no Scraped line');
  assert.equal(Number(m[1]), 5);
});

// ─── Published list ───────────────────────────────────────────────────────
t('Published section · all 3 entities listed with live URL', () => {
  assert.ok(dash.includes('Ace Roofing Service'));
  assert.ok(dash.includes('https://ace-roofing-service-dev.pages.dev'));
  assert.ok(dash.includes('Pro Build Roofing'));
  assert.ok(dash.includes('Tekline Roofing'));
});

// ─── QA-pending list ─────────────────────────────────────────────────────
t('QA-pending section · entity with scorecard total', () => {
  assert.ok(dash.includes('VIP Roofing'));
  // shows scorecard score · 56/60 or 56
  assert.ok(/56/.test(dash));
});

// ─── Archived list ───────────────────────────────────────────────────────
t('Archived section · entity with reason', () => {
  assert.ok(dash.includes('Queensland Roofing'));
  assert.ok(/sitemap\s*67|sitemap.*太|sitemap.*large/i.test(dash));
});

// ─── No banned content ────────────────────────────────────────────────────
import { DEPRECATED_TERMS } from '../../core/contracts/discord-messages.js';
t('zero deprecated terms', () => {
  for (const term of DEPRECATED_TERMS) {
    assert.ok(!dash.includes(term), `deprecated term "${term}" leaked`);
  }
});

// ─── Edge case: all archived (0 published) ──────────────────────────────
const allArchived = buildKpiDashboard({
  batchState: FIXTURE_BATCH_STATE,
  entities: FIXTURE_ENTITIES.map((e) => ({ ...e, phase: 'archived', grade: 'D', archive_reason: 'rejected' })),
});
t('edge · all archived · no Published section · sane KPI', () => {
  assert.ok(/Published[^:]*:\s*0/.test(allArchived));
  assert.ok(allArchived.includes('Archived'));
  // No literal undefined / NaN
  assert.ok(!allArchived.match(/\bundefined\b/));
});

// ─── Edge case: 0 entities (empty batch) ────────────────────────────────
const empty = buildKpiDashboard({ batchState: FIXTURE_BATCH_STATE, entities: [] });
t('edge · empty batch · 0 across the board · no crash', () => {
  assert.ok(empty.length > 100, 'must still produce dashboard with zero counts');
  assert.ok(/Scraped[^:]*:\s*0/.test(empty));
});

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed === 0 ? 0 : 1);
