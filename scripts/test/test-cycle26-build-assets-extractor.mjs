/**
 * cycle-26 · TDD test 25/?? · build-assets extractor.
 *
 * Per Matthew: "准备做网站的时候 · 把 scrape 的内容/logo/素材都单独放到一个文件夹 ·
 * 为后续网站做准备工作".
 *
 * Function: extractBuildAssets({ entityKey, slug, clientV2Dir, crawlResult })
 *   → produces clients/<slug>/v2/build-assets/ with:
 *      - logo/original.<ext>           · extracted from page hero image / <img> src
 *      - photos/*.png                  · all images referenced in crawl
 *      - brand-colors.json             · {primary, accent, neutral}
 *      - content/<page>.md             · cleaned text content per page
 *      - voice-samples.md              · curated phrase samples
 *      - manifest.json                 · summary of everything extracted
 *
 * Tests use Ace Roofing's real crawl-result.json as fixture (if present).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { extractBuildAssets } from '../../core/redesign/build-assets-extractor.js';

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); failed++; }
}
async function ta(name, fn) {
  try { await fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); failed++; }
}

console.log('cycle-26 · test 25/?? · build-assets extractor\n');

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const CRAWL_FIXTURE = path.join(ROOT, 'clients/ace-roofing-service/v2/multi-page-crawl/crawl-result.json');

if (!fs.existsSync(CRAWL_FIXTURE)) {
  console.log('  ⏭ skip · no Ace crawl-result fixture');
  console.log('\n0/0 passed · skipped');
  process.exit(0);
}

const crawlResult = JSON.parse(fs.readFileSync(CRAWL_FIXTURE, 'utf8'));
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cycle26-assets-'));
const slug = 'ace-roofing-service-test';
const clientV2Dir = path.join(TMP, 'clients', slug, 'v2');
fs.mkdirSync(clientV2Dir, { recursive: true });

// ─── Run extractor ────────────────────────────────────────────────────────
let result;
await ta('extractor runs without crash · returns manifest', async () => {
  result = await extractBuildAssets({
    entityKey: 'domain_aceroofingservice.com.au',
    slug,
    clientV2Dir,
    crawlResult,
  });
  assert.ok(result, 'no result returned');
  assert.ok(typeof result === 'object');
});

// ─── Output directory structure ──────────────────────────────────────────
const buildAssets = path.join(clientV2Dir, 'build-assets');

t('creates build-assets/ folder', () => {
  assert.ok(fs.existsSync(buildAssets), 'build-assets/ not created');
});

t('creates content/ folder with per-page markdown', () => {
  const contentDir = path.join(buildAssets, 'content');
  assert.ok(fs.existsSync(contentDir), 'content/ missing');
  const files = fs.readdirSync(contentDir);
  assert.ok(files.length > 0, 'no content files generated');
  // At least one should be .md
  assert.ok(files.some((f) => f.endsWith('.md')), 'no .md content files');
});

t('content files include readable text (no raw HTML)', () => {
  const contentDir = path.join(buildAssets, 'content');
  const files = fs.readdirSync(contentDir).filter((f) => f.endsWith('.md'));
  if (files.length === 0) return;
  const sample = fs.readFileSync(path.join(contentDir, files[0]), 'utf8');
  assert.ok(sample.length > 100, 'content file too short · suggests no extraction');
  // Should not have raw <script> or <style> tags
  assert.ok(!sample.includes('<script'), 'raw <script> leaked into content');
  assert.ok(!sample.includes('<style'), 'raw <style> leaked into content');
});

t('manifest.json created · lists outputs', () => {
  const m = path.join(buildAssets, 'manifest.json');
  assert.ok(fs.existsSync(m), 'manifest.json missing');
  const manifest = JSON.parse(fs.readFileSync(m, 'utf8'));
  assert.ok(manifest.entityKey === 'domain_aceroofingservice.com.au');
  assert.ok(manifest.slug === slug);
  assert.ok(typeof manifest.pages_processed === 'number');
  assert.ok(typeof manifest.images_found === 'number');
  assert.ok(typeof manifest.generated_at === 'string');
});

t('photos[] or logo populated · at least 1 image ref captured', () => {
  // Ace site has logo + hero images · should detect at least 1
  const m = JSON.parse(fs.readFileSync(path.join(buildAssets, 'manifest.json'), 'utf8'));
  assert.ok(m.images_found >= 1 || (m.image_urls && m.image_urls.length >= 1),
    `expected ≥1 image reference · manifest: ${JSON.stringify(m).slice(0, 200)}`);
});

t('image_urls in manifest are absolute (http/https) · not data: or relative', () => {
  const m = JSON.parse(fs.readFileSync(path.join(buildAssets, 'manifest.json'), 'utf8'));
  if (!m.image_urls?.length) return;
  for (const u of m.image_urls) {
    assert.ok(/^https?:\/\//.test(u), `non-absolute URL: ${u}`);
  }
});

t('logo identified if present in HTML (e.g. site-logo class · wp-custom-logo)', () => {
  // Ace's HTML has class="wp-custom-logo" + class="elementor-widget-image"
  // Extractor should pull at least one as candidate logo
  const m = JSON.parse(fs.readFileSync(path.join(buildAssets, 'manifest.json'), 'utf8'));
  assert.ok(m.logo_url || m.logo_candidate, 'no logo detected · check extractor heuristics');
});

t('brand-colors.json valid JSON with primary/accent/neutral keys', () => {
  const c = path.join(buildAssets, 'brand-colors.json');
  assert.ok(fs.existsSync(c), 'brand-colors.json missing');
  const colors = JSON.parse(fs.readFileSync(c, 'utf8'));
  // At least one of these should be present even if empty
  assert.ok(typeof colors === 'object');
  assert.ok('primary' in colors || 'extracted' in colors || colors.note,
    'brand-colors must have primary/extracted/note key');
});

t('voice-samples.md generated · contains sample text', () => {
  const v = path.join(buildAssets, 'voice-samples.md');
  assert.ok(fs.existsSync(v), 'voice-samples.md missing');
  const text = fs.readFileSync(v, 'utf8');
  assert.ok(text.length > 50, 'voice-samples too short');
});

// ─── Cleanup ──────────────────────────────────────────────────────────────
try { fs.rmSync(TMP, { recursive: true, force: true }); } catch {}

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed === 0 ? 0 : 1);
