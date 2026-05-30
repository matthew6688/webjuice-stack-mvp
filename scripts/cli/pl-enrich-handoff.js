#!/usr/bin/env node
/**
 * SOP-3 Phase B orchestrator · enrich handoff with real LLM-extracted data.
 *
 * Reads Phase 0 signals (Tinyfish md / multi-page md / images / logo) and runs
 * B1 (services) · B2 (about) · B3 (hero) · B4 (page-map) · B5 (image classify) · B6 (bindings)
 * Writes updated handoff/* files with `_source` provenance tags throughout.
 *
 * Cost: ~$0.10-0.20 per customer (claude-sonnet · 4 LLM calls)
 * Time: ~60-90s per customer
 *
 * Usage:
 *   npm run pl:enrich-handoff -- --slug vicwest-roofing
 *   npm run pl:enrich-handoff -- --slug vicwest-roofing --skip B5  // skip vision
 *   npm run pl:enrich-handoff -- --slug vicwest-roofing --only B1,B4  // just these
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');

function parseArgs() {
  const out = { slug: null, skip: [], only: null, 'about-style': 'safe' };
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (a === '--slug') out.slug = process.argv[++i];
    else if (a === '--skip') out.skip = process.argv[++i].split(',').map((s) => s.trim());
    else if (a === '--only') out.only = process.argv[++i].split(',').map((s) => s.trim());
    else if (a === '--about-style') out['about-style'] = process.argv[++i];  // safe (default) | flagship · codex R103
  }
  return out;
}

const shouldRun = (task, args) => {
  if (args.only) return args.only.includes(task);
  return !args.skip.includes(task);
};

async function main() {
  const args = parseArgs();
  if (!args.slug) {
    console.error('Usage: pl:enrich-handoff -- --slug <customer-slug> [--skip B1,B5] [--only B4]');
    process.exit(1);
  }
  const slug = args.slug;

  // Load entity for facts
  const entityFiles = fs.readdirSync(path.join(REPO, 'data/leads/entities')).filter((f) => f.endsWith('.json'));
  let entity = null;
  for (const f of entityFiles) {
    const e = JSON.parse(fs.readFileSync(path.join(REPO, 'data/leads/entities', f), 'utf8'));
    if (e.promotedClientSlug === slug || (e.latest?.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').includes(slug.slice(0, 20))) {
      entity = e;
      break;
    }
  }
  // Fallback by slug match
  if (!entity) {
    for (const f of entityFiles) {
      const e = JSON.parse(fs.readFileSync(path.join(REPO, 'data/leads/entities', f), 'utf8'));
      const eslug = (e.latest?.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      if (eslug.startsWith(slug.split('-')[0]) && eslug.includes(slug.split('-')[1] || '')) { entity = e; break; }
    }
  }
  if (!entity) {
    console.error(`No entity found for slug ${slug}`);
    process.exit(1);
  }

  const facts = {
    business_name: entity.latest?.name,
    niche: entity.latest?.niche || 'local-business',
    city: entity.latest?.city || 'Australia',
    state: entity.latest?.state || (entity.latest?.address?.match(/\b(QLD|VIC|NSW|WA|SA|TAS|ACT|NT)\b/i)?.[1]?.toUpperCase()),
    address: entity.latest?.address,
    phone: entity.latest?.phone,
    rating: entity.latest?.rating,
    review_count: entity.latest?.userRatingsTotal || entity.latest?.review_count,
    domain_age_years: entity.enrichment?._derived?.domain_age_years,
    abn: entity.enrichment?.abn?.abn,
    entity_type: entity.enrichment?.abn?.entity_type,
    abn_registered_at: entity.enrichment?.abn?.registered_at,
  };
  const externalMentions = entity.enrichment?.tinyfish_search?.external_mentions || [];
  const gbpCategories = entity.latest?.places_enrichment?.categories || [];

  // Try to find audit fixture
  const possibleAuditPaths = [
    path.join(REPO, 'data/v2/fixtures/detailed-audit', `${entity.entityKey || ''}.json`),
    path.join(REPO, 'data/v2/fixtures/detailed-audit', `${entity.latest?.placeId || ''}.json`),
  ].filter(Boolean);
  let auditFixture = null;
  for (const p of possibleAuditPaths) {
    if (fs.existsSync(p)) { auditFixture = JSON.parse(fs.readFileSync(p, 'utf8')); break; }
  }
  const auditFindings = auditFixture?.detailed_audit?.findings || auditFixture?.findings || [];

  const clientDir = path.join(REPO, 'clients', slug, 'v2');
  const handoffDir = path.join(clientDir, 'handoff');
  const pagesDir = path.join(clientDir, 'multi-page-crawl/pages');
  const homepageMd = path.join(clientDir, 'enrichment/tinyfish-homepage.md');
  const photosDir = path.join(handoffDir, 'photos/source');

  // ── Phase 0 bootstrap · re-run A1/A2/A3/A4 if data missing ──
  const website = entity.latest?.website;
  if (website && shouldRun('A', args)) {
    const needsMultiPageMd = !fs.existsSync(pagesDir) || fs.readdirSync(pagesDir).filter((f) => f.endsWith('.md')).length === 0;
    const needsImages = !fs.existsSync(path.join(photosDir, '_manifest.json'));
    const needsLogo = !['png','svg','jpg','webp'].some((ext) => fs.existsSync(path.join(photosDir, `_existing-logo.${ext}`)));

    if (needsMultiPageMd) {
      console.log(`  [A2] multi-page crawl + Tinyfish md persistence...`);
      const { multiPageCrawl } = await import(path.join(REPO, 'core/audit/multi-page-crawl.js'));
      const crawl = await multiPageCrawl(website, { maxPages: 10, persistMarkdownDir: pagesDir });
      console.log(`     → ${crawl.pages_crawled} pages · ${crawl.pages_enriched_via_tinyfish} via Tinyfish · ${(crawl.duration_ms/1000).toFixed(1)}s`);
    }

    if (needsImages) {
      console.log(`  [A3] image harvest (max 20)...`);
      const { multiPageCrawl } = await import(path.join(REPO, 'core/audit/multi-page-crawl.js'));
      const { harvestImages } = await import(path.join(REPO, 'core/audit/image-harvester.js'));
      // Need fresh crawl for rawHtml (the persisted md doesn't keep rawHtml)
      const crawl = await multiPageCrawl(website, { maxPages: 8 });
      const harvest = await harvestImages(crawl, { outDir: photosDir, maxImages: 20 });
      console.log(`     → ${harvest.total_downloaded} images · ${harvest.total_skipped} skipped`);
    }

    if (needsLogo) {
      console.log(`  [A4] logo extract (3-layer fallback)...`);
      const { extractLogo } = await import(path.join(REPO, 'core/audit/logo-extractor.js'));
      const logo = await extractLogo({ homepageUrl: website, outDir: photosDir });
      console.log(`     → ${logo.ok ? `layer=${logo.layer_name} bytes=${logo.bytes}` : `FAIL: ${logo.reason}`}`);
    }
  }

  if (!fs.existsSync(handoffDir)) fs.mkdirSync(handoffDir, { recursive: true });
  if (!fs.existsSync(path.join(handoffDir, 'content'))) fs.mkdirSync(path.join(handoffDir, 'content'), { recursive: true });
  if (!fs.existsSync(path.join(handoffDir, 'structure'))) fs.mkdirSync(path.join(handoffDir, 'structure'), { recursive: true });

  console.log(`[pl:enrich-handoff] slug:    ${slug}`);
  console.log(`[pl:enrich-handoff] entity:  ${entity.entityKey}`);
  console.log(`[pl:enrich-handoff] facts:   ${facts.business_name} · ${facts.niche} · ${facts.city}`);
  console.log(`[pl:enrich-handoff] tasks:   ${args.only ? args.only.join(',') : `ALL minus [${args.skip.join(',')}]`}`);

  const summary = {};
  const totalStart = Date.now();

  // B4 · page-map (no LLM · fast)
  if (shouldRun('B4', args) && auditFixture?.sitemap_analysis) {
    const t0 = Date.now();
    const { derivePageMapFromSitemap } = await import(path.join(REPO, 'core/handoff/derive-page-map.js'));
    const pm = derivePageMapFromSitemap(auditFixture.sitemap_analysis, facts);
    if (pm) {
      const out = path.join(handoffDir, 'structure/page-map.json');
      fs.writeFileSync(out, JSON.stringify(pm, null, 2));
      console.log(`  [B4] page-map: ${pm.total_pages} pages (${pm.service_pages} svc + ${pm.area_pages} area) → ${path.relative(REPO, out)} · ${Date.now() - t0}ms`);
      summary.B4 = { ok: true, total_pages: pm.total_pages, latency_ms: Date.now() - t0 };
    } else {
      console.log(`  [B4] page-map: sitemap signals insufficient · keeping existing niche-typical`);
      summary.B4 = { ok: false, reason: 'insufficient sitemap signals' };
    }
  }

  // B1 · services
  if (shouldRun('B1', args)) {
    const { extractServices } = await import(path.join(REPO, 'core/handoff/extract-services.js'));
    const debugPathB1 = path.join(handoffDir, '_debug-B1-services.json');
    const res = await extractServices({
      pagesDir, homepageMdPath: homepageMd,
      businessName: facts.business_name, niche: facts.niche, city: facts.city, state: facts.state,
      gbpCategories,
      facts,
      debugPath: debugPathB1,
    });
    if (res.ok) {
      const out = path.join(handoffDir, 'content/services.json');
      fs.writeFileSync(out, JSON.stringify(res, null, 2));
      console.log(`  [B1] services: ${res.services.length} extracted via ${res._meta.tier_used} (${res._meta.tool}) → ${path.relative(REPO, out)} · ${res._meta.total_latency_ms}ms`);
      summary.B1 = { ok: true, count: res.services.length, tier: res._meta.tier_used, latency_ms: res._meta.total_latency_ms };
    } else {
      console.log(`  [B1] services FAIL: ${res.reason}`);
      summary.B1 = { ok: false, reason: res.reason };
    }
  }

  // B2 · about narrative
  if (shouldRun('B2', args)) {
    const { extractAbout } = await import(path.join(REPO, 'core/handoff/extract-about.js'));
    const aboutMd = ['about-us.md', 'about.md', 'about-the-company.md'].map((f) => path.join(pagesDir, f)).find(fs.existsSync);
    const res = await extractAbout({
      aboutMdPath: aboutMd,
      homepageMdPath: homepageMd,
      facts,
      externalMentions,
      style: args['about-style'] === 'flagship' ? 'flagship' : 'safe',  // codex R103: B-safe default · flagship opt-in
    });
    if (res.ok) {
      const out = path.join(handoffDir, 'content/about.md');
      fs.writeFileSync(out, res.markdown);
      console.log(`  [B2] about: 4 paragraphs via ${res._meta.tier_used} · "${res.summary_line.slice(0, 60)}..." · ${res._meta.total_latency_ms}ms`);
      summary.B2 = { ok: true, tone: res.tone_descriptor, latency_ms: res._meta.total_latency_ms };
    } else {
      console.log(`  [B2] about FAIL: ${res.reason}`);
      summary.B2 = { ok: false, reason: res.reason };
    }
  }

  // B5 · image classification (vision)
  if (shouldRun('B5', args)) {
    const { classifyImages } = await import(path.join(REPO, 'core/handoff/classify-images.js'));
    const photosDir = path.join(handoffDir, 'photos/source');
    if (!fs.existsSync(path.join(photosDir, '_manifest.json'))) {
      console.log(`  [B5] skip: no _manifest.json in ${path.relative(REPO, photosDir)} (run A3 first)`);
      summary.B5 = { ok: false, reason: 'no manifest' };
    } else {
      const res = await classifyImages({
        photosDir,
        businessName: facts.business_name, niche: facts.niche, city: facts.city,
      });
      if (res.ok) {
        const c = res.by_category_counts;
        console.log(`  [B5] images: ${res.total_classified} classified · hero=${c.hero} gallery=${c.gallery} service=${c.service} via ${res._meta.tier_used} · ${res._meta.total_latency_ms}ms`);
        summary.B5 = { ok: true, ...res.by_category_counts, latency_ms: res._meta.total_latency_ms };
      } else {
        console.log(`  [B5] images FAIL: ${res.reason}`);
        summary.B5 = { ok: false, reason: res.reason };
      }
    }
  }

  // B3 · hero copy (depends on B1 services if available)
  if (shouldRun('B3', args)) {
    const { extractHeroCopy } = await import(path.join(REPO, 'core/handoff/extract-hero-copy.js'));
    const servicesPath = path.join(handoffDir, 'content/services.json');
    let services = [];
    if (fs.existsSync(servicesPath)) {
      const s = JSON.parse(fs.readFileSync(servicesPath, 'utf8'));
      services = s.services || [];
    }
    const res = await extractHeroCopy({
      facts, services, auditFindings,
      currentHeroText: null,
    });
    if (res.ok) {
      const out = path.join(handoffDir, 'content/hero-copy.json');
      fs.writeFileSync(out, JSON.stringify(res, null, 2));
      console.log(`  [B3] hero: ${res.candidates.length} candidates · recommended=${res.recommended_index} · ${res._meta.total_latency_ms}ms`);
      summary.B3 = { ok: true, count: res.candidates.length, latency_ms: res._meta.total_latency_ms };
    } else {
      console.log(`  [B3] hero FAIL: ${res.reason}`);
      summary.B3 = { ok: false, reason: res.reason };
    }
  }

  // E3 · per-page section design (strictly follows page-map.json)
  if (shouldRun('E3', args)) {
    const pageMapPath = path.join(handoffDir, 'structure/page-map.json');
    const servicesPath = path.join(handoffDir, 'content/services.json');
    if (fs.existsSync(pageMapPath)) {
      const pageMap = JSON.parse(fs.readFileSync(pageMapPath, 'utf8'));
      let services = [];
      if (fs.existsSync(servicesPath)) services = JSON.parse(fs.readFileSync(servicesPath, 'utf8')).services || [];
      const { designPageSections } = await import(path.join(REPO, 'core/handoff/design-page-sections.js'));
      const scrapedPagesDir = path.join(clientDir, 'multi-page-crawl/pages');
      const res = await designPageSections({
        pageMap, facts, services, auditFindings, scrapedPagesDir, concurrency: 4,
      });
      const out = path.join(handoffDir, 'structure/page-sections.json');
      fs.writeFileSync(out, JSON.stringify(res, null, 2));
      console.log(`  [E3] page-sections: ${res._meta.total_pages} pages · ${res._meta.total_sections} sections · ${res._meta.error_count} errors · ${res._meta.total_latency_ms}ms`);
      summary.E3 = { ok: true, pages: res._meta.total_pages, sections: res._meta.total_sections, errors: res._meta.error_count, latency_ms: res._meta.total_latency_ms };
    } else {
      console.log(`  [E3] skip: no page-map.json`);
      summary.E3 = { ok: false, reason: 'no page-map' };
    }
  }

  // B7 · LLM-fill issue-fix-matrix (after B4 page-map exists)
  if (shouldRun('B7', args)) {
    const findingsPath = path.join(handoffDir, 'audit/findings.json');
    const pageMapPath = path.join(handoffDir, 'structure/page-map.json');
    const blockIndexPath = path.join(REPO, 'templates/roofing/families/classic-premium-roftix/blocks/index.json');
    if (fs.existsSync(findingsPath) && fs.existsSync(pageMapPath)) {
      const findings = JSON.parse(fs.readFileSync(findingsPath, 'utf8'));
      const pageMap = JSON.parse(fs.readFileSync(pageMapPath, 'utf8'));
      let blockIds = ['hero', 'trust-bar', 'services-grid', 'why-us', 'process', 'service-areas', 'gallery', 'faq', 'cta'];
      try { blockIds = JSON.parse(fs.readFileSync(blockIndexPath, 'utf8')).blocks.map((b) => b.id); } catch {}
      const { fillFixMatrix } = await import(path.join(REPO, 'core/handoff/fill-fix-matrix.js'));
      const res = await fillFixMatrix({ findings, pageMap, blockIds });
      if (res.ok) {
        const out = path.join(handoffDir, 'audit/issue-fix-matrix.json');
        fs.writeFileSync(out, JSON.stringify(res, null, 2));
        console.log(`  [B7] fix-matrix: ${res.matrix.length} rows · LLM filled ${res._meta.filled_by_llm} · ${res._meta.latency_ms}ms`);
        summary.B7 = { ok: true, rows: res.matrix.length, latency_ms: res._meta.latency_ms };
      } else {
        console.log(`  [B7] fix-matrix FAIL: ${res.reason}`);
        summary.B7 = { ok: false, reason: res.reason };
      }
    } else {
      console.log(`  [B7] skip: need findings.json + page-map.json`);
      summary.B7 = { ok: false, reason: 'missing prerequisites' };
    }
  }

  // B6 · image-to-page bindings (after B4 + B5)
  if (shouldRun('B6', args)) {
    const { bindImagesToPages } = await import(path.join(REPO, 'core/handoff/bind-images-to-pages.js'));
    const sel = path.join(handoffDir, 'photos/selected.json');
    const pm = path.join(handoffDir, 'structure/page-map.json');
    if (fs.existsSync(sel) && fs.existsSync(pm)) {
      const res = bindImagesToPages({ selectedPath: sel, pageMapPath: pm, outPath: path.join(handoffDir, 'photos/page-bindings.json') });
      console.log(`  [B6] bindings: ${res.ok ? `${res._meta.total_pages_with_bindings} pages bound · ${res._meta.total_unused} unused` : res.reason}`);
      summary.B6 = res.ok ? { ok: true, ...res._meta } : { ok: false, reason: res.reason };
    } else {
      console.log(`  [B6] skip: need both selected.json and page-map.json`);
      summary.B6 = { ok: false, reason: 'missing prerequisites' };
    }
  }

  // Write run summary
  const totalMs = Date.now() - totalStart;
  const runSummary = {
    slug, entityKey: entity.entityKey, generated_at: new Date().toISOString(),
    total_duration_ms: totalMs,
    tasks: summary,
  };
  fs.writeFileSync(path.join(handoffDir, '_enrich-handoff-run.json'), JSON.stringify(runSummary, null, 2));

  console.log(`\n[pl:enrich-handoff] done in ${(totalMs / 1000).toFixed(1)}s`);
  console.log(`  summary: ${JSON.stringify(runSummary.tasks)}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
