# Infrastructure Map · ProfitsLocal V3

**Generated**: 2026-05-27 · for V4 planning
**Discovered by**: general-purpose agent · exhaustive read · no proposals
**Scope**: every file in search / scrape / extract / enrich / audit / handoff layers under `core/` + `scripts/`

> **Reading note** — this is a faithful catalog only. Behaviour claims cite file line numbers or JSDoc headers. Import counts come from a one-shot recursive scan of every `.js`/`.mjs` outside `node_modules`, `.git`, `experiments/`. Files marked `(header only)` had only their top docstring read.

---

## 0 · TL;DR ladder summary

Per `docs/v2/ENRICHMENT_ROUTING.md` (2026-05-10), the canonical fail-soft ladders are:

- **Search**: `Tinyfish search api.search.tinyfish.ai` → `DDGS python lib (.venv-ddgs)` → `Doko Search via dokobot read --local` → `Perplexity sonar-online (T2 rotation)`. T0 default, paid as last resort. Doc lines 13-39.
- **Fetch**: `Tinyfish fetch api.fetch.tinyfish.ai` → `Dokobot read --local` → `Firecrawl (key rotation)`. Doc lines 45-64.
- **Synthesis**: `Perplexity sonar` only — does not compete with retrieval. Doc lines 66-75.
- **Ledger**: every external call (incl. T0) writes one row to `data/finance/ledger.jsonl` with `category`, `tier`, `keyId`, `leadId`, `clientSlug`, `stage`, `purpose`, `requestHash`, `units`, `unitCost`, `amount`. Doc §"Ledger 必登记字段".

Doc-vs-code reality check (see §4): Tinyfish/DDG/Dokobot clients all exist (`core/extractors/tinyfish.js`, `core/scrape/ddg.js`, `core/scrape/dokobot.js`) and ledger via `core/finance/ledger.js`. **Perplexity client + `core/llm/key-rotation.js` mentioned at doc lines 99 + 140-141 are NOT present in `core/llm/`.** `core/leads/enrichment.js` exports the router used as the "Phase 1 implementation" row in the doc.

---

## 1 · Layer-by-layer file inventory

### 1.1 `core/scrape/` — search providers

| File | Purpose (verbatim header) | Key exports | Imports | Called by | Cost | Notes |
|---|---|---|---|---|---|---|
| `ddg.js` | DuckDuckGo SERP via the `ddgs` Python library, bridged via `scripts/scrape/ddgs-runner.py` | `searchDdg`, `DdgBlockedError` | `child_process`, `../finance/ledger.js`, `../util/token-bucket.js` | `scripts/scrape/test-ddg-smoke.js`, `scripts/scrape/test-search-providers-compare.js` | T0 (free) | Replaces Playwright html.duckduckgo.com scrape (HTTP 202 anti-bot); needs `.venv-ddgs` (gitignored) |
| `dokobot.js` | Dokobot local-Chrome read wrapper; JS-heavy / login-walled fetch fallback | `dokobotRead`, `DokobotUnavailableError` | `execFileSync`, `../finance/ledger.js`, `../util/token-bucket.js` | `scripts/scrape/test-search-providers-compare.js`, `scripts/cli/pl-summarize-external-mentions.js` | T0 (uses user's own Chrome) | Default rate 30/min via `DOKOBOT_RATE_PER_MIN` |

### 1.2 `core/extractors/` — fetch / extract providers

| File | Purpose | Key exports | Imports | Called by (top) | Cost | Notes |
|---|---|---|---|---|---|---|
| `tinyfish.js` | T0 search + fetch via `api.search.tinyfish.ai` + `api.fetch.tinyfish.ai`; token-bucket gated | `tinyfishSearch`, `tinyfishFetchUrls`, `TinyFishExtractor.fetchPages`, `TinyFishRateLimitedError` | ledger, evidence, token-bucket | 9 importers incl. `core/leads/enrichment.js`, `core/enrichment/tinyfish-summary.js`, `scripts/extractors/tinyfish-fetch.js`, `scripts/cli/pl-summarize-external-mentions.js` | T0 (free) | Rate limit default 30/min env `TINYFISH_RATE_PER_MIN` (L286). Search endpoint L284, fetch endpoint L285 |
| `firecrawl.js` | Firecrawl scrape extractor class | `FirecrawlExtractor` | ledger, evidence | 4 importers (test scripts + `menu-document.js` + `firecrawl-parse.js`) | T1 paid quota → T2 | unitCost env `FIRECRAWL_SCRAPE_UNIT_COST` |
| `firecrawl-parse.js` | Firecrawl parse-file endpoint | `FirecrawlParseExtractor.parseFile` | ledger, `./menu.js` | `scripts/extractors/menu-document.js`, `scripts/extractors/firecrawl-parse.js` | T2 paid | Wraps `parseFile` for PDF/doc menus |
| `google-places.js` | Google Places textsearch + details | `GooglePlacesExtractor`, `googlePlacesUnitCostsFromEnv`, `writeJson` | ledger, evidence | `pl-places-search-intake.js`, `core/leads/search-runner.js` + 3 more | $0.017/call (textsearch+details) | Quota-guarded |
| `google-places-photos.js` | Photo download via Places photoreference | `GooglePlacesPhotoExtractor` | ledger, evidence, `./google-places.js` | `scripts/cli/pl-download-places-photos.js` | Places pricing | Dry-run uses inline 1x1 PNG L148 |
| `places-quota-guard.js` | Monthly $200 quota guard, multi-key rotation (G-12) | `PlacesQuotaGuard`, `PlacesQuotaCapExceeded` | (stdlib) | `pl-places-search-intake.js`, `pl-places-enrich.js`, `pl-download-places-photos.js` | quota=11000/key/month | Per-key state in `data/finance/places-quota.json` |
| `brand-assets.js` | Extract logo/colors/icons/og-images from HTML | `extractBrandAssetsFromHtml` | evidence | only `scripts/extractors/test-url-normalization.js` (test) | T0 (pure) | Header has no JSDoc |
| `menu.js` | Heuristic menu-section extractor for restaurants | (functions exporting `writeMenuEvidenceFromText`) | evidence | only `scripts/extractors/menu-document.js` | T0 | Section hints list L229+ |
| `menu-document.js` | OCR/Firecrawl pipeline for PDF menu docs | `extractMenuDocument` | `../ocr/ocrmypdf.js`, `../ocr/paddleocr.js`, `./menu.js` | only `scripts/extractors/menu-document.js` | depends on tier | MIN_MENU_ITEMS=3 |

### 1.3 `core/enrichment/` — SOP-1 entity-level enrichment

| File | Purpose | Key exports | Imports | Called by | Cost | Notes |
|---|---|---|---|---|---|---|
| `index.js` | Orchestrator: 4-route parallel enrichment writing `entity.enrichment.*` | `enrichEntity` | `./whois-rdap.js`, `./wayback.js`, `./abr-abn.js`, `./tinyfish-summary.js` | `scripts/cli/pl-enrich-entity.js`, `scripts/leads/run-audit-pipeline.js`, smoke test | T0 (all free) | Spec: `docs/v3/V3-ENRICHMENT-PLAN.md` §3.3 |
| `abr-abn.js` | ABN lookup via ABR Web Services (free, JSONP) | (`abnLookupByName`, etc.) | (none) | `core/enrichment/index.js` only | T0 free | ENV `ABR_GUID`, 10s timeout |
| `wayback.js` | Wayback first/last snapshot probe | (`waybackLookup`) | (none) | `core/enrichment/index.js` only | T0 free | 10s timeout |
| `whois-rdap.js` | RDAP lookup (.au cctld, fallback rdap.org) | `whoisLookup` | (none) | `core/enrichment/index.js` only | T0 free | SSL-insecure retry on cert err |
| `tinyfish-summary.js` | AU-filtered search summary + homepage summary | `tinyfishSearchSummary`, `tinyfishHomepageSummary` | `../extractors/tinyfish.js` | `core/enrichment/index.js` only | T0 free | Pure regex on markdown |

### 1.4 `core/audit/` — SOP-2 + SOP-3 audit suite (22 files)

| File | Purpose | Key exports | Imports | Called by | Cost | Notes |
|---|---|---|---|---|---|---|
| `multi-page-crawl.js` | Sitemap-aware multi-page crawl, Tinyfish + Direct HTTP parallel, Firecrawl last resort (V3 D39 Plan B 2026-05-18) | (`crawlSite`) | (header only) | `pl-enrich-handoff.js`, `pl-check-qualification.js` | T0 + Firecrawl $0.015/page rare | Output schema L256-263 |
| `redesign-brief-builder.js` | "不要预定义 extractor, json 全抓回来给 AI 分析" (V3 D39); core-extract builder | `buildCoreExtract`, `saveCoreExtract` | child_process, fs | `pl-llm-extract-core.js`, `pl-check-qualification.js`, `qa/test-brief-builder.mjs` | ~$1-2/customer (claude_cli sonnet) | Cascade codex→claude→ollama |
| `site-fetch-full.js` | Playwright headless fetch (rawHtml + perf + screenshots) | (header only) | (header only) | `scripts/leads/run-audit-pipeline.js`, `scoring/test-detailed-audit.js` | T0 local | Returns shape L343-349 |
| `tech-stack-detector.js` | Pure regex on rawHtml: CMS/builder/trackers/pixels | (functions) | (header only) | **0 importers** | T0 pure | Header lists sales angles |
| `sitemap-analyzer.js` | sitemap.xml + robots.txt analyzer, redirect plan | (functions) | (header only) | only `scripts/test/test-cycle27-sitemap-content-count.mjs` | T0 | Output shape L364-371 |
| `pagespeed-insights.js` | PSI API client (mobile+desktop, CRUX) | `pagespeedInsights` (etc.) | ledger | **0 importers** | Free w/ key, ledgered T0 | Quota 25k/day |
| `ai-geo-checks.js` | 12 GEO/LLMs.txt/schema checks | (functions) | (none) | **0 importers** | T0 | Output: dimension_score 0-100 |
| `activity-audit.js` | Freshness (last-modified, sitemap, blog) | (functions) | (none) | **0 importers** | T0 HEAD/sitemap | header L1-20 |
| `domain-history.js` | WHOIS + Wayback + DNS (SPF/DKIM/DMARC) | (functions) | child_process whois, dns | **0 importers** | T0 | Note: separate from `core/enrichment/whois-rdap.js` |
| `form-audit.js` | Form fields + captcha detection | (functions) | (none) | **0 importers** | T0 on Playwright page | CAPTCHA_PATTERNS L130 |
| `image-optimization.js` | rawHtml `<img>`/`<picture>` audit | (functions) | (none) | **0 importers** | T0 pure | Output shape L191-197 |
| `image-harvester.js` | Phase A3 image download (max 20/customer) | (functions) | (none) | `pl-enrich-handoff.js` only | T0 | MAIN_PAGE_PATTERNS L174 |
| `logo-extractor.js` | 3-layer logo fallback (icon → header → og) | (functions) | (none) | `pl-enrich-handoff.js` only | T0 | Output `_existing-logo.{ext}` |
| `contact-extraction.js` | V3 D37 email/contact/social from rawHtml | (functions) | (none) | `scripts/leads/run-audit-pipeline.js` only | T0 | SOCIAL_PATTERNS L58-65 |
| `contact-page-fetch.js` | V3 D38 fetch /contact/ for email backfill | (functions) | (none) | `scripts/leads/run-audit-pipeline.js` only | T0 (direct fetch, no Playwright) | Future P2: multi-page helper note L78 |
| `gbp-extras.js` | Playwright scrape of Maps Posts/Q&A | (functions) | (none) | `scripts/leads/build-internal-report.js` only | T0 Playwright (15-25s/lead) | Not in Places API |
| `third-party-weight.js` | 3rd-party JS/tracker classifier via Playwright network events | `attachThirdPartyWeightInterceptor` | (none) | **0 importers** | T0 | TRACKER_DOMAINS L416 |
| `issue-evidence.js` | Per-issue cropped screenshot mapper | (functions) | fs, path | `scripts/leads/build-internal-report.js` only | T0 | Heuristic selector mapping |
| `restaurant-local-llm.js` | Ollama audit for restaurant niche | `auditRestaurantWithLocalLlm` | fs, path | only `scripts/audit/restaurant-local-llm.js` | T0 Ollama | Model default `qwen3.5:9b` |
| `trust-signals/index.js` | Industry-aware dispatcher | (functions) | `./roofing-au.js` | (header only) | T0 | Adapter contract L455-459 |
| `trust-signals/generic.js` | Generic trust-signal audit | `auditTrustSignalsGeneric` | (none) | (header only) | T0 | 7 signals, weights L429 |
| `trust-signals/roofing-au.js` | QLD roofing-specific (QBCC etc.) | `auditTrustSignalsRoofingAU` | (none) | `trust-signals/index.js` | T0 | QBCC/ABN/PL/years |

### 1.5 `core/handoff/` — SOP-3 handoff enrichment B1-B7 + composer support

| File | Phase | Purpose | Imports | Called by | Cost | Notes |
|---|---|---|---|---|---|---|
| `extract-services.js` | B1 | Service list extraction from /services* + homepage md | `../autoresearch/llm-cascade.js`, `./niche-spec-loader.js`, `./scrape-cleaner.js` | `pl-enrich-handoff.js` only | LLM 1 call | `_source = verified:scraped:<page>` |
| `extract-about.js` | B2 | Owner/business narrative from about + enrichment | `../autoresearch/llm-cascade.js`, `./niche-spec-loader.js`, `./scrape-cleaner.js` | `pl-enrich-handoff.js` only | LLM 1 call | Outputs `_meta.sources_used` |
| `extract-hero-copy.js` | B3 | 3 hero candidates from services + audit findings | `../autoresearch/llm-cascade.js`, `./niche-spec-loader.js` | `pl-enrich-handoff.js` only | LLM 1 call | — |
| `derive-page-map.js` | B4 | Structural page-map.json from sitemap_analysis | (none) | `pl-build-handoff.js`, `pl-enrich-handoff.js` | T0 pure | Returns null on noise |
| `classify-images.js` | B5 | Contact-sheet vision classification (1 call vs N) | `child_process`, `../autoresearch/llm-cascade.js` | `pl-enrich-handoff.js` only | $0.05 single vision | Per Matthew 2026-05-17 |
| `bind-images-to-pages.js` | B6 | Heuristic image→page map (no LLM) | fs | `pl-enrich-handoff.js` only | T0 | 1-3 images/page |
| `fill-fix-matrix.js` | B7 | Map audit findings → pages + section blocks | `../autoresearch/llm-cascade.js` | `pl-enrich-handoff.js` only | LLM 1 call | — |
| `design-page-sections.js` | E3 | Per-page section-by-section design spec | `../autoresearch/per-task-lab.js`, `../autoresearch/llm-cascade.js`, `./niche-spec-loader.js`, `./scrape-cleaner.js` | `pl-enrich-handoff.js` only | LLM (lab-tuned) | Locks winner to `config/autoresearch/locked-combos.json` |
| `design-header-footer-cta.js` | E4-E6 | Header/Footer/CTA system design (3 sub-tasks) | `../autoresearch/per-task-lab.js`, `../autoresearch/llm-cascade.js`, `./niche-spec-loader.js` | **0 importers** | LLM 3 calls | — |
| `build-design-handoff-doc.js` | — | Consolidate Phase A+B outputs into single `design-handoff.md` | fs | `pl-build-design-handoff.js` only | T0 (assembler) | 9-section template L516-525 |
| `eval-handoff-quality.js` | — | claude-opus 10-dim rubric judge of `design-handoff.md` | (header only) | `pl-eval-handoff.js` only | LLM 1 call (opus) | 10 dims L623-633 |
| `niche-spec-loader.js` | — | Loads `templates/<niche>/niche-spec.md` for prompt injection | fs, path | `pl-audit-tier.js`, `pl-build-handoff.js` + 8 handoff modules above | T0 | `STATE_AUTHORITY_MAP` L761 |
| `gbp-sources.js` | — | Schema + merge for `_gbp-sources.json` sidecar | (none) | `pl-download-places-photos.js`, test | T0 | profitslocal.gbp-sources.v1 |
| `scrape-cleaner.js` | — | Strip scripts/styles/parked-domain junk from scraped md | (none) | **0 importers via core/handoff path** (used inside extract-* modules though all via `import`) — wait: re-check shows scrape-cleaner imported by `core/handoff/extract-services.js`, `extract-about.js`, `design-page-sections.js` (counted under their files) | — | T0 | PARKED_DOMAIN_PATTERNS L787 |
| `schema-v2.json` | — | JSON Schema for handoff v2-spec | n/a | `pl-validate-handoff.js` | n/a | — |

### 1.6 `core/leads/` — qualification, grading, routing (43 files)

Concise table (status hints in `Notes`):

| File | Purpose | Importers | Notes |
|---|---|---|---|
| `discovery-store.js` | Entity store CRUD + 4-channel intake unifier + master.md refresh hook | **28** (top importer in repo) | SOP-1 P5 spawn-enrich logic L165+ |
| `intake.js` | LEAD_SOURCE_TYPES + `createLeadIntake` flow | 8 | Sources include `paid_intake`, `maps_scraper`, `referral` |
| `research.js` | `createLeadResearch` (evidence + restaurant adapter + redesign preservation) | 6 | Niche default = restaurant if `intake.project.industry` says so |
| `enrichment.js` | 5-route Stage 0.5 + pre-audit router (Tinyfish all routes) | 5 | "Lead enrichment router" — V2 contract |
| `qualification.js` | `qualifyLead`, LEAD_TYPES, RECOMMENDED_ACTIONS | 2 | Uses canonical `core/utils/slug.js` |
| `cheap-audit-queue.js` | Throttled in-process queue · cheap-audit-v2 + predictGrade + chain detailed | 4 (incl. `pl-task-listener.js`) | V3 D43 |
| `detailed-audit-queue.js` | Throttled priority queue (predict-A > predict-B) | 1 (`pl-task-listener.js`) | V3 D43 30s gap |
| `grade-router.js` | Persist grade + Discord thread + cold-outreach queue (A/B/C/D) | 2 (v3 e2e tests) | M2-D3, M3 auto demo |
| `single-enrich-resolver.js` | SOP-0 v1.3 Q5 partial signals → Places resolution | (used inside single-enrich CLI) | Cheap→expensive 4-step |
| `image-enrich.js` | V3 D40 image OCR multi-angle Places search + AI judgment | **0 importers** | Imports `single-enrich-resolver.js` |
| `image-lead-discovery-v2.js` | image_lead sourceType peer of maps-scraper | — | V2 image-lead |
| `maps-scraper-discovery.js` | gosom docker output normalizer; WEBSITE_STATUS enum | many (via scripts) | RECOMMENDED_DISCOVERY_ACTION L407 |
| `dedup-detector.js` | 3-key dedup scan (place_id/phone/domain) | 1 (`pl-dedup-audit.js`) | v1 exact-match only |
| `dedup-scorer.js` | 5-key weighted score + verdict | (test scripts) | Weights L120 |
| `dedup-llm-decider.js` | Ollama auto-decider with `uncertain` fallback | (used by `pl-dedup-decide.js`) | think:false per qwen rule |
| `exclusion-filter.js` | V3 D43 cycle-23 3-layer rejection (replaces score gates) | **0 importers** | LEAD-FILTERING-DESIGN.md |
| `entity-schema.js` | Pre-persist validation (validateEntity) | — | V3 D43 |
| `terminal-archive.js` | Atomic terminal D-grade archive helper | — | cycle-26 |
| `thin-contact.js` | predicate isThinContact | — | SOP-1 §3.6.1 |
| `enrichment-gate.js` | `selected-enrichment-gates.json` persistence | — | 4 statuses planned/approved/executed/ingested |
| `geocode.js` | Google Geocoding wrapper, cache to `data/geocode-cache.json` | `pl-scrape-docker.js` | $0.005/call |
| `discovery-score.js` | Unified 0-100 score across all 4 intake sources | called by `discovery-store.js` | M1-D2 |
| `niche-cohort.js` | Logical niche-city shards `data/leads/niches/<niche>/<city>.entityKeys.json` | — | SOP-1 §6 |
| `locale.js` | `deriveLocale` from city/address/state → tz | — | AU-only default, intl later |
| `intake-channels.js` | Loader for `data/sop1/intake-channels.json` | sop-1.astro | Single source of truth |
| `master-md-refresh.js` | fire-and-forget createTask kind=ops cli=leads:build-master-md | many writers | dedupes pending |
| `audit-stage1.js` | M2-D5 fixture staleness check (default 30d) | — | AUDIT_STALENESS_DAYS env |
| `reviews-adapter.js` | M2-D2 docker→places review cascade (only A/B) | — | 5-min timeout guard |
| `sales-contact-time.js` | Places weekday_text → contact window | — | SOP-1 G-14 |
| `asset-manifest.js` | per-client `assets/manifest.json` | — | DISCORD_OUTREACH_PRD §6.2 |
| `template-match.js` | Match niche/lead to template families | `copy-brief.js`, `open-design-handoff.js` | — |
| `copy-brief.js` | createLeadCopyBrief | `open-design-handoff.js` | — |
| `open-design-handoff.js` | `createTemplateOpenDesignHandoff` | — | (legacy OD prompt shape) |
| `reference-adapter-handoff.js` | Reference-HTML adapter (M3 default 2026-05-13) | — | **superseded** — see deprecation in `pl-build-from-reference.js` |
| `website-build-handoff.js` | (legacy freeform OD prompt) | — | header explicitly marks `renderOpenDesignPrompt` deprecated; module kept for scorecard metadata |
| `outreach-brief.js` | createOutreachBrief | scripts/leads/outreach-brief.js | — |
| `redesign-check.js` | createRedesignCheck | scripts/leads/redesign-check.js | — |
| `ready-to-build.js` | BUILD_READY_STATUS + `buildWebsiteReady` integration | — | — |
| `build-ready.js` | `export * from './ready-to-build.js'` | — | Pure alias |
| `site-audit.js` | `createSiteAudit` (record/facts/artifacts) | — | Legacy V1 scoring |
| `search-runner.js` | `buildLeadSearchRun` | scripts/leads/search-runner.js | — |
| `lead-ops.js` | `runLeadOps` orchestrator (intake+research+redesign+ready+outreach) | scripts/leads/lead-ops.js | — |
| `document-model-comparison.js` | Reference fixture/expectations | tests | — |

### 1.7 `core/scoring/` — scoring rules + grading

| File | Purpose | Importers | Notes |
|---|---|---|---|
| `cheap-audit-v2.js` | Stage 1 GBP triage + Stage 2 site quick-scan + final scoring; reads `cheap-audit-config.json` | 3 (incl. `build-internal-report.js`) | Pure function, no network |
| `cheap-audit-config.json` | Rules / thresholds / hard-triggers data | (loaded by cheap-audit-v2.js) | Mirrored to `/admin/scoring` |
| `detailed-audit.js` | 6-dim × 39-rule audit driven by `detailed-audit-config.json` | 2 (test + run-audit-pipeline) | Visual dim stubbed (Block E fills) |
| `detailed-audit-config.json` | Rules data | (loaded) | — |
| `lead-grading.js` | Investment level (A/B/C/D) + product tier (T1/T2/T3) | 4 | Pipeline order: investment first |
| `qualification-scorecard.js` | Qualification scoring | 1 (`pl-check-qualification.js`) | — |
| `site-quick-scan.js` | Stage 2 quick scan used by cheap-audit-v2 | 1 (test) | — |
| `rule-narrations.js` | Per-rule narration text | **0 importers** | Used internally by detailed-audit via narrate() import (counted there) |

### 1.8 `core/contracts/`

| File | Purpose | Importers |
|---|---|---|
| `discord-messages.js` | Single SoT for all Discord strings (`CONTRACT_VERSION = '26.0.0'`) | 13 |
| `audit-stage-content.js` | cycle-27 typography contract + markdown helpers | 1 (test) |
| `button-actions.js` | cycle-27 Discord button actions for operator override | 3 |
| `lead-to-research-validator.js` | `profitslocal.lead-to-research.v1` validator | 2 (`pl-research-pack.js` + test) |

### 1.9 `core/reports/`

| File | Purpose | Importers | Notes |
|---|---|---|---|
| `master-md-builder.js` | master.md synthesizer from audit+visual+reviews+manifest | 5 (incl. v3 e2e + cycle26 tests) | SSOT for downstream HTML/video |
| `internal-audit-html.js` | Self-contained HTML internal audit renderer | 1 (`build-internal-report.js`) | — |
| `asset-integrity.js` | cycle-26 master.md asset link verifier (local+remote) | 3 | — |
| `autoresearch-loop.js` | M2-D9 multi-round gen→critic→improve loop (≤5 rounds, $2 budget, score≥95) | 1 (`build-internal-report.js`) | — |
| `generator.js` | M2-D9 preambles (internal vs customer audience) | 2 (`pl-build-customer-audit.js`, `pl-optimize-internal-report.js`) | V3 D26: customer audit must be English |

### 1.10 `core/utils/`

| File | Purpose | Importers |
|---|---|---|
| `slug.js` | Canonical `slugify` / `safeId` / `slugFromEntity` | 3 explicit + many implicit incl. `core/leads/qualification.js`, `core/leads/search-runner.js`, `core/leads/grade-router.js`, `pl-download-places-photos.js`, `funnel/record-paid-intake-update.js` (per header L545-549) |

### 1.11 `core/composer/`

**MISSING** — no such directory. The composer entry point is `scripts/cli/pl-compose-site.js` (template-library module substitution; see §2).

### 1.12 `core/llm/`

| File | Purpose | Importers |
|---|---|---|
| `vision-adapter.js` | Dispatcher: claude_cli → codex_cli → ollama | 1 (`run-audit-pipeline.js`) |
| `vision-claude-cli.js` | claude CLI subprocess + token-ledger | (used by adapter) |
| `vision-codex-cli.js` | codex CLI subprocess + token-ledger | (used by adapter) |
| `vision-ollama.js` | local Ollama /api/generate with images | (used by adapter); also exports `tryExtractJson` reused by all text/vision-* siblings |
| `visual-audit-prompt.js` | Strict-JSON output schema for visual audit | (used by callers) |
| `text-adapter.js` | T0→T1→T3 cascade dispatcher | **0 importers** |
| `text-claude-cli.js` | Claude CLI text (haiku default) | (used by text-adapter) |
| `text-codex-cli.js` | Codex CLI text | (used by text-adapter) |
| `text-ollama.js` | Local Ollama text | (used by text-adapter) |
| `match-judge.js` | V3 D43 LLM verifier (proceed/human-gate/reject) for freestyle inputs | 4 (`pl-single-enrich.js`, `pl-check-qualification.js`, `pl-places-search-intake.js`, test) |
| `reply-classifier.js` | 12-class reply classifier (regex first + claude haiku fallback) | 4 |

**Note**: `core/llm/key-rotation.js` and `core/llm/perplexity.js` referenced in `ENRICHMENT_ROUTING.md` lines 99 + 140-141 are **not present** in the repo (see §4).

### 1.13 `core/autoresearch/`

| File | Purpose | Importers |
|---|---|---|
| `llm-cascade.js` | SOP-3 §4 production cascade (codex_cli → claude_cli → ollama backup); `runTask`, `extractJson` | 4 (`pl-classify-images.js`, `pl-audit-vision.js`, test scripts) + transitive via handoff/* modules above |
| `per-task-lab.js` | Cartesian (model × prompt) lab, locks winner to `config/autoresearch/locked-combos.json` | **0 importers** (only `design-page-sections.js` + `design-header-footer-cta.js` import it transitively) |

### 1.14 `core/finance/`

| File | Purpose | Importers |
|---|---|---|
| `ledger.js` | append/read JSONL ledger at `data/finance/ledger.jsonl`; LEDGER_CATEGORIES incl. V2 tinyfish/perplexity/dokobot (L590+) | **14** explicit, plus transitive via every provider |
| `openai-usage.js` | `openAiUsageLedgerInput` helper | (importers via ledger callers) |
| `service-costs.js` | `resendEmailLedgerInput` etc. | (importers via ledger callers) |

### 1.15 `core/funnel/` (39 files — operational layer)

Headers cataloged. Highlights relevant to enrichment/audit pipeline:

| File | Purpose |
|---|---|
| `pipeline-batch-thread.js` | Batch forum thread state + tags lifecycle (in-progress → completed/partial-failed/paused) |
| `batch-progress.js` | Per-entity progress emitter to batch thread |
| `batch-thread-messages.js` | cycle-27 typography for batch messages |
| `audit-stage-messages.js` | cycle-27 per-entity stage-1..9 messages |
| `pipeline-summary.js` | cycle-26 final pipeline-end checklist (post-Stage 9) |
| `kpi-dashboard.js` | cycle-26 P5 batch-finalize KPI board |
| `card-refresh-scheduler.js` | cycle-26 500ms debounced profile-card upsert hook |
| `display-vocab.js` | V3 D35 / cycle-26 phase→tag mapping |
| `discord-emit.js` | V3 D43 unified Discord notif + audit log emitter |
| `discord.js`, `discord-workspace.js` | Discord HTTP wrappers + forum workspace builder |
| `lead-thread-sync.js` | Forum post lifecycle + pinned profile card editor |
| `profile-card.js` | V3 D35 pinned card renderer |
| `hermes-cron.js` | Hermes cron registration helper (paused-by-default per D3) |
| `stage-config.js`, `tab-routing.js` | 17-stage labels + admin tab routing |
| `submission-router.js` | inbound submission → forum + ledger + customer email |
| `customer-email.js`, `email-template.js` | Resend email send + branded template |
| `tally.js`, `tally-api.js`, `tally-payment-form.js`, `tally-feedback-form.js`, `tally-validation.js` | Tally form ingest + form-builder JSON |
| `stripe.js`, `checkout.js`, `entitlements.js` | Stripe checkout normalizer + tier pricing + entitlement record |
| `paid-intake-actions.js`, `paid-intake-index.js`, `paid-intake-ops.js`, `paid-intake-readiness.js` | Paid intake admin actions + index views + readiness gate |
| `outreach-provider-event.js`, `outreach-provider-state.js` | Outbound email provider event normalizer |
| `lead-registry.js`, `lead-outreach-index.js`, `lead-notes.js`, `lead-thread-helpers.js` | Lead admin index + per-lead notes |
| `queue-operations.js` | `data/leads/queue-operations.jsonl` logger |
| `stable-uuid.js` | Deterministic seeded UUID factory (used by tally form builders) |

---

## 2 · NPM command catalog

The package.json exposes **188** `pl:` / `leads:` / `scrape:` / `extract:` commands. Concise grouping (full list in `package.json`):

| Group | Commands | Backing files |
|---|---|---|
| **Search/Fetch tests** | `scrape:test-dokobot-smoke`, `scrape:test-ddg-smoke`, `scrape:test-search-compare` | `scripts/scrape/*` |
| **Extractors (direct)** | `extract:tinyfish`, `extract:firecrawl`, `extract:firecrawl-parse`, `extract:google-places`, `extract:google-places-photos`, `extract:brand-assets`, `extract:content-page`, `extract:menu`, `extract:menu-document` + tests | `scripts/extractors/*` |
| **SOP-1 intake** | `pl:scrape-docker`, `pl:places-search-intake`, `pl:single-enrich`, `pl:ingest-image`, `pl:ingest-inbox`, `pl:pipeline-batch-start`, `pl:pipeline-batch-step`, `leads:maps-scrape`, `leads:maps-promote` | `core/leads/discovery-store.js` + various |
| **SOP-1 enrichment** | `pl:run-enrichment-batch`, `pl:enrich-entity`, `pl:summarize-external-mentions`, `pl:download-places-photos`, `pl:places-enrich` | `core/enrichment/index.js`, `core/leads/enrichment.js` |
| **Dedup** | `pl:dedup-audit`, `pl:dedup-decide`, `pl:dedup-merge`, `pl:merge-dup-entities` | `core/leads/dedup-*` |
| **SOP-2 cheap audit** | `leads:run-pipeline` (`run-audit-pipeline.js`), `pl:audit-doctor`, `pl:audit-tier`, `pl:audit-vision`, `pl:codex-audit` | `core/scoring/cheap-audit-v2.js`, `core/scoring/detailed-audit.js`, `core/llm/vision-adapter.js` |
| **Reports** | `leads:build-master-md`, `leads:build-internal-report`, `pl:build-customer-audit`, `pl:optimize-internal-report`, `pl:asset-integrity-doctor` | `core/reports/*` |
| **SOP-3 handoff (Phase A+B)** | `pl:build-handoff`, `pl:enrich-handoff` (B1-B7), `pl:build-design-handoff`, `pl:eval-handoff`, `pl:assemble-handoff`, `pl:validate-handoff`, `pl:audit-handoff`, `pl:reconcile-handoff`, `pl:migrate-handoff-v1-to-v2` | `core/handoff/*` |
| **Customer brief / extract / architecture** | `pl:llm-extract-core`, `pl:compare-core-extracts`, `pl:core-extract-to-md`, `pl:llm-customer-brief`, `pl:render-customer-brief`, `pl:llm-site-architect`, `pl:llm-design-site`, `pl:llm-wireframe-page`, `pl:llm-wireframe-site`, `pl:llm-page-copywriter`, `pl:llm-page-copywriter-site`, `pl:llm-infer-thin-data`, `pl:wireframe-to-spec` | `core/audit/redesign-brief-builder.js` + LLM cascade |
| **Pipeline gates** | `pl:data-checkpoint` (GREEN/YELLOW/RED gate), `pl:report-data-coverage`, `pl:brief-quality-gate`, `pl:experiment-data-inventory`, `pl:experiment-handoff-truthfulness`, `pl:preflight`, `pl:check-qualification` | various |
| **Build / compose / publish** | `pl:compose-site`, `pl:template-remix`, `pl:dissect-template`, `pl:gen-narrative-content`, `pl:rewrite-narrative`, `pl:generate-shared-components`, `pl:enforce-shared-components`, `pl:rebuild-header-footer`, `pl:preview-composed`, `pl:gen-customer-images`, `pl:audit-website-output`, `pl:audit-reference-parity`, `pl:walk-site`, `pl:iterate-site`, `pl:publish-demo`, `pl:publish-dir`, `pl:publish-pipeline`, `pl:build-pipeline-tracker` | templates + composer |
| **OD experiments** | `pl:build-od-seed`, `pl:od-run`, `pl:od-image-experiment`, `pl:od-overnight`, `pl:od-overnight-master`, `pl:od-cross-client`, `pl:phase3-od-variants`, `pl:od-invoke-prep`, `pl:od-postprocess-chrome`, `pl:od-postprocess-hero` | OD daemon IPC at `/tmp/open-design/ipc/release-stable/daemon.sock` |
| **Customer (image) tooling** | `pl:classify-images`, `pl:extract-crawl-images`, `pl:ingest-image` | `core/handoff/classify-images.js`, `core/audit/image-harvester.js` |
| **E2E orchestrators** | `pl:e2e` (data-checkpoint → enrich-handoff → assemble → validate → compose), `pl:pipeline-all` (per-client checkpoint+tracker), `pl:research-pack` (Skill B canonical 6-step), `pl:e2e-audit`, `pl:e2e-smoke` | chains npm subprocesses |
| **Doctors / health** | `pl:system-doctor`, `pl:audit-doctor`, `pl:publish-doctor`, `pl:daemon-doctor`, `pl:cascade-doctor`, `pl:cost-doctor`, `pl:goals-doctor`, `pl:cycle-doctor`, `pl:sop0-doctor`, `pl:intake-doctor`, `pl:lead-journey-doctor`, `pl:asset-integrity-doctor`, `pl:profile-card-heartbeat`, `pl:ops-health-check` | various |
| **Daemons / launchd** | `pl:task-listener`, `pl:task-dispatcher`, `pl:task-api`, `pl:task-retention` (4 corresponding `.launchd.plist` siblings) | `core/tasks/task-store.js` + `core/leads/cheap-audit-queue.js` |
| **Outreach / sales** | `pl:email-draft`, `pl:email-send`, `pl:reply-poll`, `pl:reply-handle`, `pl:thread`, `pl:thread-append`, `pl:c-grade-batch-send`, `pl:variant`, `leads:autoresearch-document-models`, `leads:compare-document-models`, `leads:build-discovery-outreach-briefs`, `leads:build-outreach-email-draft` | `core/funnel/*`, `core/llm/reply-classifier.js` |
| **Discord ops** | `pl:discord-snapshot`, `pl:rearchive-zombies`, `pl:cleanup-archived-threads`, `pl:rename-stale-thread-titles`, `pl:rename-keepers-titles`, `pl:migrate-to-projects-channel`, `pl:archive-non-customer-entities`, `pl:bulk-archive`, `pl:clean-slate`, `pl:dedup-audit` | Discord HTTP |
| **Deprecated** | `pl:build-from-reference` (DEPRECATED 2026-05-18, header lines 597-614) | exits with code 2 |

---

## 3 · Data flow diagrams

### 3.1 Search ladder (per `docs/v2/ENRICHMENT_ROUTING.md`; code matches)

```
search query
   │
   ▼
core/leads/enrichment.js  ─►  tinyfishSearch (core/extractors/tinyfish.js)              T0
                              │ insufficient/fail
                              ▼
                              searchDdg     (core/scrape/ddg.js → ddgs-runner.py)        T0
                              │ fail
                              ▼
                              dokobotRead   (core/scrape/dokobot.js, Doko SERP pattern) T0
                              │ fail
                              ▼
                              Perplexity sonar-online                                    T2
                              (client NOT present in core/llm/ — see §4)
```

### 3.2 Fetch ladder

```
url
   │
   ▼
TinyFishExtractor.fetchPages  (core/extractors/tinyfish.js)               T0
   │ blocked/empty
   ▼
dokobotRead                   (core/scrape/dokobot.js)                    T0
   │ fail
   ▼
FirecrawlExtractor            (core/extractors/firecrawl.js)              T1→T2 (multi-key rotation called for in doc; current code is single-key constructor reading FIRECRAWL_API_KEY)
```

### 3.3 SOP-1 intake (4 entry paths)

```
pl:scrape-docker          ─┐                       core/extractors/google-places.js
pl:places-search-intake   ─┤                       │
pl:single-enrich          ─┤──► single-enrich-resolver.js / image-enrich.js
pl:ingest-image           ─┘                       │
                                                    ▼
                                  core/leads/discovery-store.js
                                  └─ upsertDiscoveryRun → entity-schema.validate
                                  └─ maybeSpawnEnrichTask (debounced)
                                  └─ writes data/leads/entities/<key>.json
                                  └─ schedules master-md refresh task
                                                    │
                                                    ▼
                                  core/leads/cheap-audit-queue.enqueueCheapAudit
```

### 3.4 SOP-2 audit (cheap → detailed → findings)

```
cheap-audit-queue (throttled 2.5s) ─► core/scoring/cheap-audit-v2.cheapAuditV2()
                                       (Stage 1 GBP + Stage 2 site quick-scan; pure)
                                       │
                                       ▼ predictGradePreaudit
                                       │
            ┌──── predict-D ───► terminal-archive (archive_reason)
            │
            └──── predict-A/B/C ─► detailed-audit-queue
                                   │
                                   ▼
                       scripts/leads/run-audit-pipeline.js  (Block G)
                       ├─ site-fetch-full (Playwright + screenshots)
                       ├─ contact-extraction + contact-page-fetch
                       ├─ core/enrichment/index.js (4-route parallel)
                       ├─ core/scoring/detailed-audit.js (6 dim × ~40 rule)
                       ├─ core/llm/vision-adapter (visual dim)
                       ├─ optional reviews-adapter (A/B only)
                       └─ core/scoring/lead-grading.js → investment+tier
                                   │
                                   ▼
                       core/leads/grade-router.persistLeadGrade
                       (Discord thread + cold-outreach queue + demo_build task for A/B)
```

### 3.5 SOP-3 handoff enrichment (B1-B7)

```
pl:build-handoff   ─► MVP scaffold clients/<slug>/v2/handoff/ (14 files)
       │             core-facts.json (LOCKED verbatim) + niche/template defaults
       ▼
pl:enrich-handoff  (core/handoff/* B-modules; ~$0.10-0.20 LLM/customer)
       │
       ├─ B1 extract-services.js       (services.json)
       ├─ B2 extract-about.js          (about.md)
       ├─ B3 extract-hero-copy.js      (hero-candidates.json)
       ├─ B4 derive-page-map.js        (page-map.json from sitemap_analysis)
       ├─ B5 classify-images.js        (contact-sheet + selected.json — single vision call)
       ├─ B6 bind-images-to-pages.js   (page-bindings.json — heuristic, no LLM)
       └─ B7 fill-fix-matrix.js        (issue-fix-matrix)
       │
       ▼
pl:assemble-handoff  ─► canonical photos/source manifest (19/19 utilization)
pl:validate-handoff  ─► JSON Schema + cross-ref gate (`core/handoff/schema-v2.json`)
pl:build-design-handoff ─► consolidate into design-handoff.md
pl:eval-handoff      ─► claude-opus 10-dim rubric → eval-quality.json
```

### 3.6 Audit → fix loop

```
pl:iterate-site (max --max-loops, target --target ≥ 90)
   │
   loop:
   1. pl:audit-handoff           (P1-P7 input gate)
   2. build (OD codex / OD codex+ref / template remix; --mode A|B|C)
   3. pl:audit-website-output    (L1 locked-facts grep, L2 content-validator, L3 build sanity)
   4. pl:audit-vision            (10-dim per home + 2 inner; cross-page DOM consistency)
   5. pl:audit-tier              (T1 PASS/FAIL gate · T2 copy · T3 visual · T4 tech · composite)
   6. if composite ≥ TARGET → publish · else write fix-instructions.md into handoff/
   7. next iteration's prompt reads fix-instructions.md
```

---

## 4 · Known gaps (evidence-based)

1. **`core/llm/key-rotation.js` MISSING** — `ENRICHMENT_ROUTING.md` line 99 + table line 140-141 call for `core/llm/key-rotation.js` ("通用 least-loaded 选 key"). Directory listing of `core/llm/` shows no such file. `FirecrawlExtractor` constructor (`core/extractors/firecrawl.js` L122-131) still reads a single `apiKey = process.env.FIRECRAWL_API_KEY`.

2. **`core/llm/perplexity.js` MISSING** — same doc lines 36-38 + 140-141 call for a Perplexity client. None in `core/llm/`. No grep hit for "perplexity" in `core/llm/`. The whole T2 synthesis fallback referenced in the ladder is not wired in code.

3. **`core/composer/` MISSING** — referenced indirectly by Module Library work, but no such dir. Composition lives in `scripts/cli/pl-compose-site.js` reading `templates/<niche>/modules/<type>/<variant>.html`.

4. **`core/leads/website-build-handoff.js` header L703-714** explicitly states the freeform OD prompt portion is deprecated; canonical M3 path is `core/leads/reference-adapter-handoff.js` (V3 2026-05-13). However `scripts/cli/pl-build-from-reference.js` (the canonical caller of that module) was itself **DEPRECATED 2026-05-18** (header L598-614) in favour of `pl:compose-site`. **`core/leads/reference-adapter-handoff.js` therefore has no live caller** — orphaned.

5. **`scripts/cli/pl-build-from-reference.js` is a stub** — `process.exit(2)` on line 614 before any original import runs.

6. **Unreferenced `core/audit/` files** (0 importers in scanned `.js`/`.mjs` outside experiments):
   - `audit/form-audit.js`
   - `audit/pagespeed-insights.js`
   - `audit/tech-stack-detector.js`
   - `audit/third-party-weight.js`
   - `audit/ai-geo-checks.js`
   - `audit/activity-audit.js`
   - `audit/domain-history.js`
   - `audit/image-optimization.js`
   These each implement a documented audit dimension but no current pipeline imports them. Some may be imported only inside `scripts/leads/run-audit-pipeline.js` via dynamic patterns I didn't catch — verify with manual read before retiring.

7. **`core/handoff/design-header-footer-cta.js` has 0 importers.** Phase E4+E5+E6 module not wired into any CLI; `pl-enrich-handoff.js` calls B1-B7 + (per `npm run pl:enrich-handoff` header) B1-B7 only. E-phase handoff appears unwired.

8. **`core/leads/image-enrich.js` has 0 importers** (V3 D40 module). It imports `single-enrich-resolver.js` which IS used, but nobody calls `image-enrich.js` directly.

9. **`core/leads/exclusion-filter.js` has 0 importers** despite header claim "取代旧硬阈值评分逻辑". Replacement not actually wired in.

10. **`core/llm/text-adapter.js` has 0 importers** — the unified text dispatcher. Callers reach `text-claude-cli.js` / `text-codex-cli.js` / `text-ollama.js` either directly or via `core/autoresearch/llm-cascade.js`.

11. **`core/autoresearch/per-task-lab.js` has 0 direct importers** outside `core/handoff/design-page-sections.js` and `core/handoff/design-header-footer-cta.js`. Since the latter is itself unwired (gap #7), only `design-page-sections.js` (called by `pl-enrich-handoff.js`) exercises the lab path.

12. **WHOIS duplication** — both `core/enrichment/whois-rdap.js` (RDAP HTTP API) and `core/audit/domain-history.js` (shells out to `whois` CLI) exist. Header of the audit version L102-104 documents using `whois` command. They overlap conceptually but use different mechanisms.

13. **Tinyfish summary "external mentions"** — `core/enrichment/tinyfish-summary.js` provides AU-filter helpers; only caller is `core/enrichment/index.js`. `scripts/cli/pl-summarize-external-mentions.js` (per npm command) presumably uses the same lower-level Tinyfish + Dokobot — confirmed by importer list for `core/scrape/dokobot.js`.

14. **Restaurant audit isolated** — `core/audit/restaurant-local-llm.js` imported only by `scripts/audit/restaurant-local-llm.js` (CLI wrapper), not by `run-audit-pipeline.js`. Niche-specific path may be inert outside its own CLI.

15. **`core/scoring/rule-narrations.js`** — appears as 0 importers in my scan; `core/scoring/detailed-audit.js` L1185 does `import { narrate } from './rule-narrations.js'` (relative import inside same dir, picked up by my scan as 0 because I matched on `core/scoring/rule-narrations`). Real usage: 1 importer (detailed-audit). False-positive in the orphan list.

---

## 5 · Cross-references to existing docs

- Routing & ladders: `docs/v2/ENRICHMENT_ROUTING.md`
- Pipeline & SOPs: `docs/v3/SOP-1-FLOW.md`, `docs/v3/SOP-2-FLOW.md`, `docs/v3/SOP-3-FLOW.md`, `docs/v3/SOP-0-DOCTOR.md` (referenced in code)
- Enrichment plan: `docs/v3/V3-ENRICHMENT-PLAN.md` (entity.enrichment.* schema cited by `core/enrichment/index.js`)
- Audit standard (4-tier): `docs/v3/SOP-AUDIT-STANDARD.md`
- Master MD lineage: `docs/v3/SOP-MASTER-MD-DATA-LINEAGE.md`
- Data checkpoint: `docs/v3/SOP-DATA-CHECKPOINT.md`
- Handoff structure: `docs/v3/HANDOFF-STRUCTURE.md`
- Discord display rules: `docs/v3/SOP-DISCORD-DISPLAY.md`, `SOP-AUDIT-STAGE-NOTIFICATIONS.md`, `SOP-VERIFICATION-VIA-DISCORD-API.md`
- Customer brief / typography: `docs/v3/MASTER-MD-AUDIT-2026-05-13.md`, `MASTER-MD-AUDIT-V2-2026-05-13.md`
- Build & audit loop: `docs/v3/V3-BUILD-AUDIT-LOOP-PLAN.md`
- Bulk pipeline plan: `docs/v3/BULK-PIPELINE-PLAN.md`
- Locked baseline: `docs/v3/SOP-LOCKED-BASELINE-V1.md`
- Cycle 26-27: `docs/v3/CYCLE-27-RICH-STAGES.md`, `docs/v3/CYCLE_TEST_PLAN.md`
- Contracts: `docs/contracts/lead-to-research.md` (v1)
- Filtering design: `docs/v3/LEAD-FILTERING-DESIGN.md`
- M2-D9 customer audience: `docs/v3/M2-D9-CUSTOMER-AUDIENCE-REPORT.md`
- OD research: `docs/v3/OD-HANDOFF-RESEARCH.md`, `docs/v3/open-design-upstream-research-2026-05-13.md`
- Decisions: `docs/v3/DECISIONS-LOG.md`
- Tool stack PRD: `docs/v3/TOOL-STACK-PRD.md`

---

**END · faithful map · no proposals.**
