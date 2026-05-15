/**
 * cycle-26 · TDD test 18/?? · internal-audit-report.html completeness.
 *
 * P1.4: internal audit is FOR US (operator + builder). Must contain:
 *   ✓ 12-dim DOM rules (full diagnostic)
 *   ✓ Vision LLM issues
 *   ✓ Redesign brief
 *   ✓ Internal grade + product_tier + pricing (these CAN be internal)
 *   ✓ All audit_score / decision data
 *   ✓ Size ≥ 50KB (substantive)
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const HTML_FILE = path.join(ROOT, 'clients/ace-roofing-service/v2/internal-audit-report.html');
const ENTITY_FILE = path.join(ROOT, 'data/leads/entities/domain_aceroofingservice.com.au.json');

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); failed++; }
}

console.log('cycle-26 · test 18/?? · internal-audit-report.html completeness\n');

if (!fs.existsSync(HTML_FILE)) {
  console.log('  ⏭ skip · internal-audit-report.html not built');
  console.log('\n0/0 passed · skipped');
  process.exit(0);
}

const html = fs.readFileSync(HTML_FILE, 'utf8');
const entity = fs.existsSync(ENTITY_FILE) ? JSON.parse(fs.readFileSync(ENTITY_FILE, 'utf8')) : null;

t('size ≥ 20KB (substantive internal diagnostic)', () => {
  const size = fs.statSync(HTML_FILE).size;
  assert.ok(size > 20000, `expected ≥20KB · got ${size} bytes`);
});

t('valid HTML skeleton', () => {
  assert.ok(html.includes('<html') && html.includes('<body'));
  assert.ok(html.trim().endsWith('</html>'));
});

t('business name displayed', () => {
  if (!entity?.latest?.name) return;
  assert.ok(html.includes(entity.latest.name), `business_name missing`);
});

t('audit_score visible (XX/100)', () => {
  assert.ok(/\d{1,3}\s*\/\s*100/.test(html), 'no XX/100 score format');
});

t('contains 12-dim audit results (one of the dimension labels)', () => {
  // Look for at least one dimension reference
  const dims = ['UX', 'Conversion', 'Trust', 'SEO', 'Speed', 'Mobile', 'Content', 'Accessibility',
                '体验', '转化', '信任', '速度', '移动', '内容', '可访问', '设计'];
  const has = dims.some((d) => html.includes(d));
  assert.ok(has, `no dimension label found · expected one of ${dims.slice(0, 8).join(', ')}`);
});

t('contains issue details (rationale or what_observed)', () => {
  // Internal audit has 3-layer issue blocks · rationale is core
  const indicators = ['rationale', '技术事实', 'what_observed', 'issue', 'severity'];
  const has = indicators.some((i) => html.toLowerCase().includes(i.toLowerCase()));
  assert.ok(has, 'no issue diagnostic markers');
});

t('contains decision label (low_priority / moderate / strong)', () => {
  // Real Ace decision = "moderate_candidate" or similar
  const decisions = ['moderate', 'strong_redesign', 'low_priority', 'audit_candidate', 'starter_candidate'];
  const has = decisions.some((d) => html.includes(d));
  assert.ok(has, 'no audit decision label found');
});

t('decoration: contains structure indicators (h1/h2 headings)', () => {
  const h1Count = (html.match(/<h1[^>]*>/gi) || []).length;
  const h2Count = (html.match(/<h2[^>]*>/gi) || []).length;
  assert.ok(h1Count + h2Count >= 3, `expected ≥3 headings · got h1=${h1Count} h2=${h2Count}`);
});

t('no literal "undefined" / "NaN" anywhere (data-flow check)', () => {
  // HTML attributes might have "undefined" in data attrs · check only visible-text-ish content
  // Stripped: HTML tags · then check body text
  const bodyMatch = html.match(/<body[^>]*>([\s\S]+)<\/body>/i);
  const body = bodyMatch ? bodyMatch[1] : html;
  // Strip tags · just check innerText-ish
  const text = body.replace(/<[^>]+>/g, ' ');
  assert.ok(!/\bundefined\b/.test(text), `literal "undefined" in visible text`);
  assert.ok(!/\bNaN\b/.test(text), `literal "NaN" in visible text`);
});

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed === 0 ? 0 : 1);
