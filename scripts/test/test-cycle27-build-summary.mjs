/**
 * cycle-27 · TDD test · Stage 8 build-summary.json
 *
 * stage6Message (Stage 8 · 建 demo) was emitting only index.html path + size ·
 * Matthew wanted "用哪个 reference 模板改的 / 哪些 section / 客户素材" detail.
 *
 * Contract:
 *   1. pl-build-from-reference.js writes `clients/<slug>/v2/build-summary.json`
 *      after the HTML is materialized · fields:
 *      { slug, entity_key, business_name, family, html_bytes, duration_sec,
 *        assets_copied, index_html_path, built_at }
 *   2. stage6Message reads build-summary.json (if present) and surfaces
 *      family + duration + assets_copied
 *   3. stage6Message accepts optional `deploy` (Stage 9 retro-edit) and
 *      appends live URLs section when deploy is set
 *   4. v2 typography unchanged: ## header · __sub__ · -# subtext · em-dash
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); failed++; }
}

console.log('cycle-27 · Stage 8 build-summary\n');

const { stage6Message } = await import('../../core/funnel/audit-stage-messages.js');

// ─── T1 · stage6Message reads build-summary.json when slug provided ────
t('stage6Message ingests build-summary.json from clients/<slug>/v2/', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cycle27-build-sum-'));
  const cwd = process.cwd();
  try {
    process.chdir(tmp);
    const slug = 'test-roofer-demo';
    fs.mkdirSync(path.join(tmp, 'clients', slug, 'v2'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'clients', slug, 'v2', 'build-summary.json'), JSON.stringify({
      slug, entity_key: 'place_test', business_name: 'Test Roofer',
      family: 'brisbane-roof-restoration-experts',
      html_bytes: 122880, duration_sec: 92,
      assets_copied: 14,
      index_html_path: `clients/${slug}/v2/concept/reference-adapter/index.html`,
      built_at: '2026-05-15T10:00:00Z',
    }, null, 2));

    const out = stage6Message({ slug, indexHtmlPath: `clients/${slug}/v2/concept/reference-adapter/index.html`, sizeBytes: 122880 });
    assert.match(out, /\*\*Build output\*\*|__Build output__/);
    assert.match(out, /Reference|family/i);
    assert.match(out, /brisbane-roof-restoration-experts/);
    assert.match(out, /14/); // assets count surfaced somewhere
    assert.match(out, /92s|92 s|`92`/); // duration surfaced
  } finally {
    process.chdir(cwd);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ─── T2 · stage6Message · em-dash when no build-summary.json ────────────
t('stage6Message · graceful em-dash when build-summary.json missing', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cycle27-no-sum-'));
  const cwd = process.cwd();
  try {
    process.chdir(tmp);
    const out = stage6Message({ slug: 'no-summary-slug', indexHtmlPath: 'a/b/index.html', sizeBytes: 100 });
    // Should not crash · em-dashes acceptable for missing fields
    assert.match(out, /## Stage 8\/9 · 建 demo/);
  } finally {
    process.chdir(cwd);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ─── T3 · stage6Message with deploy · live URL surfaced for retro-edit ─
t('stage6Message with deploy → appends live URL section (retro-edit form)', () => {
  const out = stage6Message({
    slug: 'qld-roof-solutions',
    indexHtmlPath: 'clients/qld-roof-solutions/v2/concept/reference-adapter/index.html',
    sizeBytes: 122880,
    deploy: { demo_url: 'https://qld-roof-solutions-dev.pages.dev', deployed_at: '2026-05-15T09:08:14Z' },
  });
  assert.match(out, /qld-roof-solutions-dev\.pages\.dev/);
  assert.match(out, /live|发布/i, 'must reference live deployment');
});

// ─── T4 · pl-build-from-reference.js writes build-summary.json ─────────
t('pl-build-from-reference.js writes build-summary.json after html cleaned', () => {
  const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
  const src = fs.readFileSync(path.join(ROOT, 'scripts/cli/pl-build-from-reference.js'), 'utf8');
  assert.ok(src.includes('build-summary.json'),
    'pl-build-from-reference must write build-summary.json');
  assert.ok(src.includes('family') && src.includes('html_bytes'),
    'build-summary.json must include family + html_bytes fields');
});

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed === 0 ? 0 : 1);
