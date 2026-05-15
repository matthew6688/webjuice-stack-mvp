/**
 * cycle-26 · TDD test 11/11 · master.md asset integrity.
 *
 * Validates extractAssetRefs + verifyAssetsLocal + verifyAssetsRemote.
 * Catches:
 *   - master.md references file that doesn't exist on disk
 *   - missing master.md / master.report.html on deploy
 *   - broken inline image URL
 *   - missing video URL
 *
 * Per Matthew (2026-05-15): "MD 文档是完备的 · 在线的 · 素材图片视频都正常上传并且用到报告中"
 * → these tests guard that requirement.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { extractAssetRefs, verifyAssetsLocal, verifyAssetsRemote } from '../../core/reports/asset-integrity.js';

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); failed++; }
}
async function ta(name, fn) {
  try { await fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); failed++; }
}

console.log('cycle-26 · test 11/11 · master.md asset integrity\n');

// ─── Sample master.md with asset refs ──────────────────────────────────────
const SAMPLE_MD = `---
business_id: "fx_acme"
business_name: "Acme Roofing Co"
generated_at: "2026-05-15T00:00:00Z"
assets:
  cloudinary_folder: null
  video_url: "./video/mobile-throttled.webm"
  desktop_screenshot: "./screenshots/desktop.png"
  mobile_screenshot: "./screenshots/mobile.png"
---

# Acme Roofing Co · 现状审计与重构提议

## 二、客户访问时看到的页面

![Desktop screenshot](./screenshots/desktop.png)

![Mobile screenshot](./screenshots/mobile.png)

## 五、当前网站在哪里"漏水"

### 关键 · 手机端不可用
**对客户的影响**: 60% 流量直接流失

![hero dark evidence](./evidence/issue-hero-dark.png)

也可见这段录屏:
https://acme-roofing-co-dev.pages.dev/video/mobile-throttled.webm

## 附录 · 数据出处

- [internal-audit-report](./internal-audit-report.html)
- 联系: [info@acme.example](mailto:info@acme.example) · 电话 [0411](tel:0411)
`;

// ─── extractAssetRefs · structure ──────────────────────────────────────────
t('extractAssetRefs · returns images/links/videos/frontmatter_assets shape',
  () => {
    const r = extractAssetRefs(SAMPLE_MD);
    assert.ok(Array.isArray(r.images));
    assert.ok(Array.isArray(r.links));
    assert.ok(Array.isArray(r.videos));
    assert.ok(typeof r.frontmatter_assets === 'object');
  });

t('extractAssetRefs · finds 3 inline images',
  () => {
    const r = extractAssetRefs(SAMPLE_MD);
    assert.equal(r.images.length, 3, `expected 3 images · got ${r.images.length}: ${JSON.stringify(r.images.map((i) => i.url))}`);
    assert.ok(r.images.some((i) => i.url === './screenshots/desktop.png'));
    assert.ok(r.images.some((i) => i.url === './screenshots/mobile.png'));
    assert.ok(r.images.some((i) => i.url === './evidence/issue-hero-dark.png'));
  });

t('extractAssetRefs · finds video URL (https + .webm)',
  () => {
    const r = extractAssetRefs(SAMPLE_MD);
    assert.ok(r.videos.length >= 1, `expected ≥1 video URL · got ${r.videos.length}`);
    assert.ok(r.videos.some((v) => v.url.endsWith('.webm')));
  });

t('extractAssetRefs · frontmatter assets parsed',
  () => {
    const r = extractAssetRefs(SAMPLE_MD);
    assert.equal(r.frontmatter_assets.video_url, './video/mobile-throttled.webm');
    assert.equal(r.frontmatter_assets.desktop_screenshot, './screenshots/desktop.png');
    assert.equal(r.frontmatter_assets.mobile_screenshot, './screenshots/mobile.png');
  });

t('extractAssetRefs · skips mailto: + tel: links (not real assets)',
  () => {
    const r = extractAssetRefs(SAMPLE_MD);
    for (const l of r.links) {
      assert.ok(!l.url.startsWith('mailto:'), `should skip mailto: ${l.url}`);
      assert.ok(!l.url.startsWith('tel:'), `should skip tel: ${l.url}`);
    }
  });

t('extractAssetRefs · finds internal-audit hyperlink',
  () => {
    const r = extractAssetRefs(SAMPLE_MD);
    assert.ok(r.links.some((l) => l.url.includes('internal-audit-report.html')));
  });

// ─── verifyAssetsLocal · file existence check ──────────────────────────────
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cycle26-asset-'));
const CLIENT_V2 = path.join(TMP, 'clients/fx/v2');
fs.mkdirSync(path.join(CLIENT_V2, 'screenshots'), { recursive: true });
fs.mkdirSync(path.join(CLIENT_V2, 'evidence'), { recursive: true });
fs.mkdirSync(path.join(CLIENT_V2, 'video'), { recursive: true });

// Helper: write empty file
function touch(p) { fs.writeFileSync(p, ''); }

t('verifyAssetsLocal · all files present → ok=true · missing=[]',
  () => {
    touch(path.join(CLIENT_V2, 'screenshots/desktop.png'));
    touch(path.join(CLIENT_V2, 'screenshots/mobile.png'));
    touch(path.join(CLIENT_V2, 'evidence/issue-hero-dark.png'));
    touch(path.join(CLIENT_V2, 'video/mobile-throttled.webm'));
    const r = verifyAssetsLocal({ md: SAMPLE_MD, clientV2Dir: CLIENT_V2 });
    assert.ok(r.ok, `expected ok · got missing: ${JSON.stringify(r.missing)}`);
    assert.equal(r.missing.length, 0);
    assert.ok(r.checked >= 4, `expected ≥4 checks · got ${r.checked}`);
  });

t('verifyAssetsLocal · missing screenshot detected',
  () => {
    fs.unlinkSync(path.join(CLIENT_V2, 'screenshots/mobile.png'));
    const r = verifyAssetsLocal({ md: SAMPLE_MD, clientV2Dir: CLIENT_V2 });
    assert.ok(!r.ok, 'should detect missing file');
    assert.ok(r.missing.some((m) => m.ref.includes('mobile.png')));
  });

t('verifyAssetsLocal · missing evidence detected',
  () => {
    fs.unlinkSync(path.join(CLIENT_V2, 'evidence/issue-hero-dark.png'));
    const r = verifyAssetsLocal({ md: SAMPLE_MD, clientV2Dir: CLIENT_V2 });
    assert.ok(r.missing.some((m) => m.type === 'evidence'));
  });

t('verifyAssetsLocal · skips remote URLs',
  () => {
    // Add http URL in MD · should not be flagged by local check
    const md = SAMPLE_MD + '\n![remote](https://res.cloudinary.com/x.png)\n';
    const r = verifyAssetsLocal({ md, clientV2Dir: CLIENT_V2 });
    // remote refs not added to missing
    for (const m of r.missing) assert.ok(!m.ref.startsWith('https://'));
  });

// ─── verifyAssetsRemote · HTTP 200 check ───────────────────────────────────
await ta('verifyAssetsRemote · all 200 → ok=true',
  async () => {
    // Mock fetch that returns 200 for everything
    const calls = [];
    const fetchImpl = async (url) => { calls.push(url); return { ok: true, status: 200 }; };
    const r = await verifyAssetsRemote({ md: SAMPLE_MD, baseUrl: 'https://acme-dev.pages.dev', fetchImpl });
    assert.ok(r.ok);
    assert.equal(r.broken.length, 0);
    // Should have checked screenshots/evidence/video URLs + the 4 must-exist docs
    assert.ok(calls.some((u) => u.includes('master.md')));
    assert.ok(calls.some((u) => u.includes('master.report.html')));
    assert.ok(calls.some((u) => u.includes('internal-audit-report.html')));
    assert.ok(calls.some((u) => u.includes('customer-facing-audit.html')));
  });

await ta('verifyAssetsRemote · missing master.report.html detected (404)',
  async () => {
    const fetchImpl = async (url) => {
      if (url.endsWith('master.report.html')) return { ok: false, status: 404 };
      return { ok: true, status: 200 };
    };
    const r = await verifyAssetsRemote({ md: SAMPLE_MD, baseUrl: 'https://acme-dev.pages.dev', fetchImpl });
    assert.ok(!r.ok);
    assert.ok(r.broken.some((b) => b.url.endsWith('master.report.html') && b.status === 404));
  });

await ta('verifyAssetsRemote · network error captured · not thrown',
  async () => {
    const fetchImpl = async () => { throw new Error('ENOTFOUND'); };
    const r = await verifyAssetsRemote({ md: SAMPLE_MD, baseUrl: 'https://nonexistent.example', fetchImpl });
    assert.ok(!r.ok);
    assert.ok(r.broken.length > 0);
    assert.ok(r.broken[0].error?.includes('ENOTFOUND'));
  });

// ─── cleanup ────────────────────────────────────────────────────────────────
try { fs.rmSync(TMP, { recursive: true, force: true }); } catch {}

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed === 0 ? 0 : 1);
