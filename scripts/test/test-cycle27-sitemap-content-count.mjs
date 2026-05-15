/**
 * cycle-27 · TDD test · sitemap content_url_count filters CMS noise
 *
 * Matthew (2026-05-15): "我在前端看到的链接和页面并不多 · 这个差距是为什么"
 *
 * Root cause: total_urls counts ALL sitemap URLs including:
 *   - WordPress /tag/* /category/* /author/* (taxonomy)
 *   - /page/N/ (pagination)
 *   - /wp-*  /feed/  /comments/  /?p=N  (WP internals)
 *   - /attachment/* (image/PDF embed pages)
 * Roofing site with 5 real service pages can have sitemap.total_urls = 200+
 * Front-end shows 5 pages · we report 200 · ❌ huge gap.
 *
 * Fix: new `countContentUrls(urls)` filter · returns count of likely-real
 * content pages (excludes the above). Use this for hard-gate threshold checks.
 */
import assert from 'node:assert/strict';

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); failed++; }
}

console.log('cycle-27 · sitemap content URL filter\n');

const mod = await import('../../core/audit/sitemap-analyzer.js');

t('countContentUrls is exported', () => {
  assert.equal(typeof mod.countContentUrls, 'function');
});

t('countContentUrls filters WordPress taxonomy paths', () => {
  const urls = [
    { loc: 'https://example.com/' },
    { loc: 'https://example.com/about/' },
    { loc: 'https://example.com/services/' },
    { loc: 'https://example.com/metal-roofing/' },
    { loc: 'https://example.com/contact/' },
    { loc: 'https://example.com/tag/roofing/' },         // skip
    { loc: 'https://example.com/category/news/' },        // skip
    { loc: 'https://example.com/author/admin/' },         // skip
    { loc: 'https://example.com/page/2/' },               // skip · pagination
    { loc: 'https://example.com/wp-content/upload.jpg' }, // skip · wp internal
    { loc: 'https://example.com/feed/' },                 // skip
    { loc: 'https://example.com/?p=123' },                // skip · WP preview query
    { loc: 'https://example.com/attachment/img-1/' },     // skip · attachment page
  ];
  const count = mod.countContentUrls(urls);
  assert.equal(count, 5, `expected 5 real content pages · got ${count}`);
});

t('countContentUrls collapses portfolio/project/blog detail pages', () => {
  const urls = [
    { loc: 'https://example.com/' },
    { loc: 'https://example.com/services/' },
    { loc: 'https://example.com/portfolio/' },
    { loc: 'https://example.com/portfolio-collections/residential/project-a' }, // skip · detail
    { loc: 'https://example.com/portfolio-collections/residential/project-b' }, // skip
    { loc: 'https://example.com/portfolio-collections/commercial/project-c' },  // skip
    { loc: 'https://example.com/projects/' },
    { loc: 'https://example.com/projects/2024/job-1' },  // skip
    { loc: 'https://example.com/blog/' },
    { loc: 'https://example.com/blog/category/seo-tips' }, // skip · blog detail nested
  ];
  // Real frontend menu: home / services / portfolio / projects / blog · 5 pages
  assert.equal(mod.countContentUrls(urls), 5);
});

t('countContentUrls keeps service/area pages', () => {
  const urls = [
    { loc: 'https://example.com/' },
    { loc: 'https://example.com/roofing-brisbane/' },
    { loc: 'https://example.com/service-areas/gold-coast/' },
    { loc: 'https://example.com/tile-roofing-services/' },
    { loc: 'https://example.com/category/news/' }, // skip
  ];
  assert.equal(mod.countContentUrls(urls), 4);
});

t('countContentUrls preserves empty array → 0', () => {
  assert.equal(mod.countContentUrls([]), 0);
});

await (async () => {
  const fs = await import('fs');
  const path = await import('path');
  const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
  t('analyzeSitemap result surfaces content_url_count alongside total_urls', () => {
    const src = fs.readFileSync(path.join(ROOT, 'core/audit/sitemap-analyzer.js'), 'utf8');
    assert.ok(/content_url_count/.test(src),
      'analyzeSitemap result must include content_url_count field');
  });
})();

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed === 0 ? 0 : 1);
