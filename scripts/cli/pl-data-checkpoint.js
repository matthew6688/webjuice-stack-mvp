#!/usr/bin/env node
/**
 * pl:data-checkpoint · OD-readiness gate.
 *
 * Reads:
 *   clients/<slug>/v2/core-extract.json
 *   clients/<slug>/v2/customer-brief.md
 *   clients/<slug>/v2/handoff/od-package/facts.json
 *   data/leads/entities/<business_id>.json (via master.md frontmatter)
 *
 * Writes:
 *   clients/<slug>/v2/checkpoint.json   (machine · canonical verdict)
 *
 * Verdict:
 *   GREEN  → all hard ✓ + all rich verified  → multi-page OD
 *   YELLOW → all hard ✓ + some rich need infer → single-page OD + banner
 *   RED    → any hard missing → BLOCK OD
 *
 * Exit:
 *   0 → GREEN or YELLOW (safe to proceed)
 *   1 → RED (must fix upstream)
 *
 * Usage:
 *   npm run pl:data-checkpoint -- --slug vicwest-roofing
 *
 * Spec: docs/v3/SOP-DATA-CHECKPOINT.md
 */
import fs from 'node:fs';
import path from 'node:path';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) args[process.argv[i].slice(2)] = process.argv[++i] ?? true;
}
const slug = args.slug;
if (!slug) { console.error('Usage: --slug <slug>'); process.exit(2); }

const REPO = process.cwd();
const v2 = path.join(REPO, 'clients', slug, 'v2');

function rj(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } }
function rt(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }

// ─── Load inputs ──────────────────────────────────────────────────────────
const coreFile = path.join(v2, 'core-extract.json');
const briefFile = path.join(v2, 'customer-brief.md');
const odFactsFile = path.join(v2, 'handoff/od-package/facts.json');

const coreRaw = rj(coreFile);
const core = coreRaw?.brief || {};
const realFacts = core.real_facts || {};
const sources = coreRaw?._meta?.sources_consumed || {};
const briefMd = rt(briefFile);
const briefWords = briefMd.trim() ? briefMd.trim().split(/\s+/).length : 0;
const briefSections = (briefMd.match(/^## /gm) || []).length;

const odFactsRaw = rj(odFactsFile) || {};
const odFacts = odFactsRaw.locked_facts ? { ...odFactsRaw.locked_facts, ...odFactsRaw } : odFactsRaw;

// ─── Service-content cross-check (Codex follow-up · 2026-05-27) ──────────
// The downstream handoff/content/services.json is what compose-site actually
// consumes. Cross-checking it here closes the gap where core-extract reports
// services but the extractor wrote an empty list because the scrape hit a
// parked domain or ad landing page (VIP defect 2026-05-27).
const handoffServicesFile = path.join(v2, 'handoff/content/services.json');
const odPackageServicesFile = path.join(v2, 'handoff/od-package/content/services.json');
const handoffServicesRaw = rj(handoffServicesFile);
const odPackageServicesRaw = rj(odPackageServicesFile);
const PARKED_DOMAIN_PATTERNS = [
  /parked\s+domain/i,
  /ad\s+landing/i,
  /not\s+the\s+actual\s+business\s+website/i,
  /unrelated\s+links/i,
  /book\s+your\s+own\s+appointment\s+online/i,
];
function evaluateHandoffServices(raw, label) {
  if (!raw) return { ok: null, present: false, count: 0, parked: false, label };
  const services = Array.isArray(raw.services) ? raw.services : [];
  const notes = String(raw.notes || '');
  const parked = PARKED_DOMAIN_PATTERNS.some(re => re.test(notes));
  return { ok: services.length >= 2 && !parked, present: true, count: services.length, parked, notes_excerpt: notes.slice(0, 200) || null, label };
}
const handoffServicesEval = evaluateHandoffServices(handoffServicesRaw, 'handoff/content/services.json');
const odPackageServicesEval = evaluateHandoffServices(odPackageServicesRaw, 'handoff/od-package/content/services.json');
// service_content gate passes if EITHER downstream services file is healthy.
// Fails (false) only when at least one is present AND none are healthy.
// Passes (true) when neither file exists yet (assemble-handoff not run yet → leave to handoff-audit).
const handoffServicesPresent = handoffServicesEval.present || odPackageServicesEval.present;
const handoffServicesHealthy = handoffServicesEval.ok === true || odPackageServicesEval.ok === true;
const handoffServicesParked = handoffServicesEval.parked || odPackageServicesEval.parked;

// ─── Normalisation helpers (matches pl-build-od-seed shape handling) ─────
function stringify(v) {
  if (v == null) return null;
  if (typeof v === 'string') return v.trim() || null;
  if (Array.isArray(v)) { for (const x of v) { const s = stringify(x); if (s) return s; } return null; }
  if (typeof v === 'object') {
    for (const k of ['display','displayed_as','formatted','raw','number','email','address','primary','value']) {
      if (typeof v[k] === 'string' && v[k].trim()) return v[k].trim();
    }
    return null;
  }
  return String(v).trim() || null;
}

const phone = stringify(realFacts.phone) || stringify(odFacts.phone);
const email = stringify(realFacts.email) || stringify(odFacts.email);
const address = realFacts.address || odFacts.address;
const businessName = realFacts.business_name || odFacts.business_name || slug;
const abnNumber = (realFacts.abn?.number) || odFacts.abn || null;
const abnEntity = realFacts.abn?.entity_name || null;
const ownerName = realFacts.owner_name || null;
const founded = (typeof realFacts.founded_year === 'object' ? realFacts.founded_year?.abn_effective_from?.slice(0,4) : realFacts.founded_year) || null;
const experienceClaim = (realFacts.founded_year?.public_claims || []).find(s => /year|experience|trading/i.test(s)) || null;
const rating = realFacts.google_rating || null;
const reviewCount = realFacts.google_review_count || null;

// Count REAL services (≥50 char brief, not meta-description prefixes)
const META_PREFIXES = [
  /^The (Google Business Profile|master audit|GBP|business)/i,
  /^Core business category/i,
  /^The verified service scope/i,
  /^Roofing contractor.*GBP/i,
  /categorise[sd] as a (roofing|trade)/i,
];
function isMetaBrief(s) {
  const t = String(s || '').trim();
  if (t.length < 50) return true;
  return META_PREFIXES.some(re => re.test(t));
}
const allServices = realFacts.service_list || [];
const realServices = allServices.filter(s => {
  const brief = typeof s === 'string' ? s : (s.brief || s.description || '');
  return !isMetaBrief(brief);
});

// Count REAL testimonials (≥40 char quote)
const allTestimonials = realFacts.testimonials || [];
const realTestimonials = allTestimonials.filter(t => {
  const quote = typeof t === 'string' ? t : (t.quote || t.text || '');
  return String(quote || '').trim().length >= 40;
});

const suburbs = realFacts.suburbs_served || [];

// ─── Real Business Signal Score (Matthew hard rule 2026-05-19) ───────────
// "数据不到单页内容门槛 → 直接 skip OD"
// Score = weighted real-source content units. Decides single/multi-lite/multi-full layout.
// Memory: feedback_od_hard_rules_data_threshold.md + feedback_layout_signal_threshold.md
const ownedCrawlPages = sources.owned_crawl_pages || 0;
const tinyfishSummarized = (() => {
  const facts = core.content_assets?.external_mention_facts || [];
  return Array.isArray(facts) ? facts.filter(x => typeof x === 'string' ? x.length > 50 : true).length : 0;
})();
const ownedCrawlSubstantive = ownedCrawlPages >= 3 ? 3 : (ownedCrawlPages >= 1 ? 1 : 0); // 1 page = likely parked → 1pt floor; 3+ = real site → 3pt cap

// Differentiation atoms
const namedPartnerships = (() => {
  const txt = JSON.stringify(realFacts).toLowerCase();
  const matches = txt.match(/\b(boral|bristile|colorbond|alice roof|monier|stratco|fielders|metroll)\b/gi) || [];
  return new Set(matches.map(m => m.toLowerCase())).size;
})();

// Weighted signal score (校准基于 11 个 OD 实测 · vicwest ~28 · wc ~16 · vip-v2 ~10 · vip-v1 ~3)
const signalBreakdown = {
  real_services: realServices.length,                              // 1pt each
  real_testimonials: realTestimonials.length,                      // 1pt each
  suburbs_div5: Math.floor(suburbs.length / 5),                    // 1pt per 5 suburbs
  owner: ownerName ? 2 : 0,                                        // 2pt
  founded: founded ? 2 : 0,                                        // 2pt
  experience_claim: experienceClaim ? 1 : 0,                       // 1pt
  abn: abnNumber ? 1 : 0,                                          // 1pt
  named_partnerships: namedPartnerships,                           // 1pt each (Boral/Bristile/etc)
  owned_crawl: ownedCrawlSubstantive,                              // 1-3pt
  tinyfish_summarized: tinyfishSummarized,                         // 1pt each
};
const realSignalUnits = Object.values(signalBreakdown).reduce((a, b) => a + b, 0);
const hasDifferentiation = !!(ownerName || founded || experienceClaim || abnNumber || namedPartnerships > 0);

// Layout decision · 实测校准 (vicwest 41 · vip 43 · wc 19)
// Total signal + per-component sub-thresholds (避免 wc 类无 testimonials 强上 multi-lite)
const layoutEligibility = {
  multi_full: realSignalUnits >= 25 && realTestimonials.length >= 5 && realServices.length >= 10,
  multi_lite: realSignalUnits >= 15 && realTestimonials.length >= 3 && realServices.length >= 5,
  single:     realSignalUnits >= 8  && realServices.length >= 3,
};
let recommendedLayout, recommendedPages;
if (!hasDifferentiation) {
  recommendedLayout = null; recommendedPages = null;
} else if (layoutEligibility.multi_full) {
  recommendedLayout = 'multi-full'; recommendedPages = 10;
} else if (layoutEligibility.multi_lite) {
  recommendedLayout = 'multi-lite'; recommendedPages = 5;
} else if (layoutEligibility.single) {
  recommendedLayout = 'single';     recommendedPages = 1;
} else {
  recommendedLayout = null; recommendedPages = null;
}

const signalThresholdMet = recommendedLayout !== null;

// ─── Evaluate Hard fields ─────────────────────────────────────────────────
// Hard fields = MUST exist to build any preview at all. Internal-preview standard.
// ABN moved to rich (can be inferred / "verification pending"). Same for google_signals.
const hard = {
  business_name: { ok: !!businessName, value: businessName, source: 'entity.latest / core-extract' },
  phone: { ok: !!phone, value: phone, source: 'entity.latest / GBP / core-extract' },
  address: { ok: !!address, value: address, source: 'GBP / core-extract' },
  customer_brief: { ok: briefWords >= 3000, words: briefWords, sections: briefSections, min_words: 3000, file: 'v2/customer-brief.md' },
  real_business_signal: {
    ok: signalThresholdMet,
    real_signal_units: realSignalUnits,
    min_units: 8,
    recommended_layout: recommendedLayout,
    recommended_pages: recommendedPages,
    components: signalBreakdown,
    differentiation_signal: hasDifferentiation,
    differentiation_sources: { owner: !!ownerName, founded: !!founded, experience: !!experienceClaim, abn: !!abnNumber, named_partnerships: namedPartnerships },
    note: 'Hard rule: need ≥5 real-source content units + ≥1 differentiation signal. Below = SKIP OD entirely.',
  },
  sources_consumed: {
    ok: !!(sources.gbp && (sources.owned_crawl_pages >= 1 || sources.tinyfish_mentions >= 3)),
    gbp: !!sources.gbp,
    owned_crawl_pages: sources.owned_crawl_pages || 0,
    tinyfish_mentions: sources.tinyfish_mentions || 0,
    abn: !!sources.abn,
    whois: !!sources.whois,
    wayback: !!sources.wayback,
  },
  service_content: {
    // Cross-check that the services file compose-site actually consumes is healthy.
    // If neither downstream file exists yet, leave it to handoff-audit (assemble not run).
    // If at least one exists, at least one must be healthy (≥2 services + no parked-domain signals).
    ok: !handoffServicesPresent || handoffServicesHealthy,
    handoff_services_present: handoffServicesPresent,
    handoff_services_healthy: handoffServicesHealthy,
    parked_domain_detected: handoffServicesParked,
    handoff_eval: handoffServicesEval,
    od_package_eval: odPackageServicesEval,
    note: 'Hard rule (2026-05-27): handoff/content/services.json is what compose-site consumes. If present but empty / parked-domain notes → RED. Closes VIP defect where core-extract reported services but extractor wrote 0 from parked landing page.',
  },
};

const hardOk = Object.values(hard).every(f => f.ok);

// ─── Evaluate Rich fields ─────────────────────────────────────────────────
// Rich fields = ideally verified, can be AI-filled (YELLOW) for internal preview.
// google_signals is OPTIONAL — doesn't count against GREEN (some businesses just have no public reviews).
const rich = {
  abn: {
    ok: !!abnNumber,
    value: abnNumber,
    entity: abnEntity,
    provenance: abnNumber ? 'verified' : 'needs-ai-inferred',
  },
  service_list: {
    ok: realServices.length >= 5,
    count_real: realServices.length,
    count_total: allServices.length,
    min: 5,
    provenance: realServices.length >= 5 ? 'verified' : 'needs-ai-completed',
  },
  testimonials: {
    ok: realTestimonials.length >= 3,
    count_real: realTestimonials.length,
    count_total: allTestimonials.length,
    min: 3,
    provenance: realTestimonials.length >= 3 ? 'verified' : 'needs-ai-fabricated',
  },
  suburbs_served: {
    ok: suburbs.length >= 10,
    count: suburbs.length,
    min: 10,
    provenance: suburbs.length >= 10 ? 'verified' : 'needs-radius-inferred',
  },
  owner_name: {
    ok: !!ownerName,
    value: ownerName,
    provenance: ownerName ? 'verified' : 'needs-ai-inferred',
  },
  experience: {
    ok: !!(experienceClaim || founded),
    value: experienceClaim || founded,
    provenance: (experienceClaim || founded) ? 'verified' : 'needs-ai-inferred',
  },
};
const optional = {
  google_signals: {
    ok: (rating >= 3.5) && (reviewCount >= 5),
    rating, review_count: reviewCount,
    provenance: 'verified-or-none',
    note: 'optional · doesn\'t block GREEN if absent',
  },
};

const richVerified = Object.values(rich).filter(f => f.ok).length;
const richTotal = Object.keys(rich).length;
const allRichOk = richVerified === richTotal;

// ─── Verdict ──────────────────────────────────────────────────────────────
// Verdict = hard-fields pass · Layout decided by signal score (single/multi-lite/multi-full)
let verdict, recommended_pages;
if (!hardOk) {
  verdict = 'RED'; recommended_pages = null;
} else if (recommendedLayout === 'multi-full' && allRichOk) {
  verdict = 'GREEN'; recommended_pages = 'multi';
} else if (recommendedLayout === 'multi-lite') {
  verdict = 'YELLOW'; recommended_pages = 'multi-lite';  // 5 pages
} else if (recommendedLayout === 'single') {
  verdict = 'YELLOW'; recommended_pages = 'single';
} else {
  verdict = 'GREEN'; recommended_pages = recommendedLayout === 'multi-full' ? 'multi' : 'single';
}

// Missing / inferred lists
const missing = [];
for (const [k, v] of Object.entries(hard)) {
  if (!v.ok) {
    const fixMap = {
      business_name: 'check entity in data/leads/entities/',
      phone: 'npm run pl:enrich-entity -- --slug ' + slug,
      address: 'npm run pl:enrich-entity -- --slug ' + slug,
      customer_brief: `npm run pl:llm-extract-core -- --slug ${slug} && npm run pl:render-customer-brief -- --slug ${slug}`,
      sources_consumed: `re-run upstream enrichment: gbp ${v.gbp?'✓':'✗'} · crawl ${v.owned_crawl_pages} · tinyfish ${v.tinyfish_mentions}`,
      service_content: v.parked_domain_detected
        ? `Scrape hit a parked / ad-landing page (not the actual business website). Re-intake against a real URL via \`npm run pl:scrape-docker -- --niche <niche> --city <city>\` or manually update entity \`existing_website\` then re-run \`npm run pl:enrich-handoff -- --slug ${slug}\`. NEVER AI-generate the service list.`
        : `Downstream services file is empty. Re-run \`npm run pl:enrich-handoff -- --slug ${slug}\` (B1 step extracts services). If the source website genuinely has no services, the lead should be RED-gated upstream, not patched here.`,
      real_business_signal: `Insufficient real business content (${v.real_signal_units}/${v.min_units} units · differentiation: ${v.differentiation_signal ? '✓' : '✗'}). Run \`npm run pl:summarize-external-mentions -- --slug ${slug}\` to fetch tinyfish-discovered third-party mentions (yelp/houzz/linkedin/weebly · dokobot local browser fallback). For thin clients, may need manual intake call before demo is viable.`,
    };
    missing.push({ field: k, detail: v, fix: fixMap[k] });
  }
}

const inferred = [];
for (const [k, v] of Object.entries(rich)) {
  if (!v.ok) {
    inferred.push({
      field: k,
      need: v.provenance,
      detail: v,
    });
  }
}

// ─── Write checkpoint.json ────────────────────────────────────────────────
const checkpoint = {
  slug,
  verdict,
  recommended_pages,
  generated_at: new Date().toISOString(),
  hard_fields: hard,
  rich_fields: rich,
  optional_fields: optional,
  missing,
  inferred,
  counts: {
    hard_ok: Object.values(hard).filter(f => f.ok).length,
    hard_total: Object.keys(hard).length,
    rich_ok: richVerified,
    rich_total: richTotal,
  },
};

const outFile = path.join(v2, 'checkpoint.json');
fs.mkdirSync(v2, { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(checkpoint, null, 2));

// ─── Stdout summary ───────────────────────────────────────────────────────
const colour = { GREEN: '\x1b[32m', YELLOW: '\x1b[33m', RED: '\x1b[31m', reset: '\x1b[0m' };
console.log(`\n${colour[verdict]}[checkpoint] ${slug} · ${verdict}${colour.reset}  · pages: ${recommended_pages || '—'}`);
console.log(`  Hard: ${checkpoint.counts.hard_ok}/${checkpoint.counts.hard_total} · Rich: ${richVerified}/${richTotal}`);
if (missing.length) {
  console.log(`  Missing (BLOCKING):`);
  for (const m of missing) console.log(`    - ${m.field} · fix: ${m.fix}`);
}
if (inferred.length) {
  console.log(`  Needs AI infer (YELLOW · run pl:llm-infer-thin-data):`);
  for (const i of inferred) console.log(`    - ${i.field} → ${i.need}`);
}
console.log(`  → ${path.relative(REPO, outFile)}\n`);

process.exit(verdict === 'RED' ? 1 : 0);
