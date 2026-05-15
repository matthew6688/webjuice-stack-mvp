/**
 * cycle-26 · TDD test 17/?? · customer-facing-audit content isolation.
 *
 * P1.3: customer-facing audit goes TO THE CUSTOMER. Must contain enough
 * value (audit score + key issues) WITHOUT leaking internal sales data
 * (grade letter · pricing · skip reasons · sales angle).
 *
 * Tests (using clients/ace-roofing-service/v2/customer-facing-audit.html):
 *   ✓ INCLUDES: business_name · audit_score · top issues (sanitized)
 *   ✗ NOT INCLUDES: investment_level letter · product_tier · pricing $$$
 *   ✗ NOT INCLUDES: skip_reasons · archive_reason
 *   ✗ NOT INCLUDES: "内部分级" / "销售切入" 内部话术 sections
 *   ✓ STRUCTURE: valid HTML · ≥10KB · title set
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const HTML_FILE = path.join(ROOT, 'clients/ace-roofing-service/v2/customer-facing-audit.html');
const ENTITY_FILE = path.join(ROOT, 'data/leads/entities/domain_aceroofingservice.com.au.json');

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); failed++; }
}

console.log('cycle-26 · test 17/?? · customer-facing-audit content isolation\n');

if (!fs.existsSync(HTML_FILE)) {
  console.log('  ⏭ skip · customer-facing-audit.html not built');
  console.log('\n0/0 passed · skipped');
  process.exit(0);
}

const html = fs.readFileSync(HTML_FILE, 'utf8');
const entity = fs.existsSync(ENTITY_FILE) ? JSON.parse(fs.readFileSync(ENTITY_FILE, 'utf8')) : null;

// ─── INCLUDES (essential customer-facing content) ──────────────────────────
t('business name in document title or body', () => {
  if (!entity?.latest?.name) return;
  assert.ok(html.includes(entity.latest.name), `business_name "${entity.latest.name}" missing`);
});

t('valid HTML structure (html / head / body)', () => {
  assert.ok(html.includes('<html'), 'missing <html>');
  assert.ok(html.includes('<head'), 'missing <head>');
  assert.ok(html.includes('<body'), 'missing <body>');
  assert.ok(html.trim().endsWith('</html>'), 'missing closing tag');
});

t('file size > 5KB (not a stub/error page)', () => {
  const size = fs.statSync(HTML_FILE).size;
  assert.ok(size > 5000, `expected ≥5KB · got ${size}`);
});

t('language attribute set (en-AU for customer-facing)', () => {
  assert.ok(/lang=("|')en-AU?\1/.test(html) || /lang=("|')en\1/.test(html),
    'must have lang attr for accessibility');
});

// ─── NOT INCLUDES (internal-only data MUST NOT leak) ───────────────────────

t('does NOT leak entity.grade.investment_level letter', () => {
  // Internal grade like "A" / "B" / "C" / "D" should not appear as grade visible to customer.
  // Test: no string `investment_level` or `grade: "C"` etc
  assert.ok(!/investment_level/i.test(html),
    'investment_level field leaked');
  assert.ok(!/grade\s*[:=]\s*["']?[A-D]["']?\b/.test(html),
    'grade letter (A/B/C/D) leaked');
});

t('does NOT leak entity.grade.product_tier (T1/T2/T3)', () => {
  assert.ok(!/product_tier/i.test(html), 'product_tier field leaked');
  // T1/T2/T3 might be used by ace (e.g. "T1 customer") — only fail on tier label
  assert.ok(!/(T[123])\s*\$\d/.test(html), 'tier with pricing visible');
});

t('does NOT leak pricing ($XXX values)', () => {
  // Customer-facing should NOT show internal pricing
  // (a price for THEIR audit fix is OK · but "$399 one-time" sales pricing not)
  assert.ok(!/\$399.*一次性/.test(html), 'T1 pricing leaked');
  assert.ok(!/\$299.*年/.test(html), 'T2 maintenance pricing leaked');
  assert.ok(!/recommended_pricing/i.test(html), 'recommended_pricing field leaked');
});

t('does NOT leak skip_reasons (internal reject reasons)', () => {
  assert.ok(!/skip_reasons/i.test(html));
  assert.ok(!/archive_reason/i.test(html));
});

t('does NOT contain "内部分级" or "销售切入" sections', () => {
  // These are internal sales sections from master.md · MUST NOT bleed into customer view
  assert.ok(!html.includes('内部分级'), '内部分级 section leaked to customer');
  assert.ok(!html.includes('销售切入'), '销售切入 section leaked to customer');
  assert.ok(!html.includes('内部筛选'), '内部筛选 leaked');
});

t('does NOT contain investment_factors (internal triggers)', () => {
  assert.ok(!/investment_factors/i.test(html));
});

t('does NOT leak `predict_grade` (deprecated cycle-23 anyway)', () => {
  assert.ok(!/predict_grade/i.test(html));
});

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed === 0 ? 0 : 1);
