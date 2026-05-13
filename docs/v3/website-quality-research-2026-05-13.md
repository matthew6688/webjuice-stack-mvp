# 我们试过的 + 实测结果 + 当前 quality bottleneck

Updated: 2026-05-13
Scope: Inventory of what ProfitsLocal has actually run, with file refs, for the question "why don't we have a stable high-quality local-business website pipeline yet?"

---

## 1. Template experiments · 真做过的

Pipeline shape (绿色路径): 真有代码 + 真跑过.

### 1.1 Template Lab skill
- Skill: `skills/template-lab/SKILL.md` — defines the contract: reference ingest → family scaffold → DESIGN.md / brand-kit / section-patterns / open-design-prompt / qa-rubric.
- Scripts (实有): `scripts/template-lab/{init-family.js, extract-design-signals.js, generate-brand-kit.js, generate-design-md.js, generate-image-candidates.js, audit-template-copy.js, run-open-design-experiments.js, run-open-design-family.js, run-template-autoresearch.js}` (16 files in dir).
- Docs: `docs/NICHE_TEMPLATE_SYSTEM.md` (lines 1-200+), Updated 2026-05-10.

### 1.2 Roofing template families (only niche where lab actually ran)
`templates/roofing/families/` contains 4 families:

| Family | Status | Refs |
|---|---|---|
| `classic-premium-roftix` | manifest + DESIGN.md + qa-rubric + image-candidates (6 manual + 5 dry-run dirs) + `copy-audit.json` score=100 (`templates/roofing/families/classic-premium-roftix/copy-audit.json`) | scaffold complete |
| `editorial-bold-commercial` | manifest + family run-output | `data/template-experiments/roofing/editorial-bold-commercial/...` |
| `productized-modern-roofing` | manifest + score=96 (`data/template-experiments/roofing/productized-modern-roofing/home-live-medium-v1-...productized-modern-roofing-r1-medium-framework-no-llm/scoreboard.json:16`) | accepted |
| `lead-capture-restoration` | manifest only | scaffold |

`templates/restaurant/` does **NOT exist** as a directory — the only template family work that actually shipped is roofing.

### 1.3 Open Design × template autoresearch loop runs
- Driver: `scripts/template-lab/run-template-autoresearch.js` (target-score default 95, max-rounds default 1, families CSV input).
- Run directory: `data/template-experiments/roofing/` has 62 `autoresearch-*` summary runs + per-family run dirs.
- Sample summary `data/template-experiments/roofing/autoresearch-live-medium-v3-2026-05-09/summary.json:14-32`:
  - family=editorial-bold-commercial, runId=live-medium-v3-2026-05-09
  - score=95, accepted=true, completionMode=native, durationMs=937272 (~15 min)
  - variant=`medium-framework-no-llm` only
- Verdict in code: scoring system says "accepted" (score ≥ 95) but rubric is `qa-rubric.json` (10-criteria, weights summing to 100) — see §5.

### 1.4 Real-customer mockups using "match source website" (NOT template-driven)
3 hand-checked sites in `clients/`:

| Client | Source URL | Pages | Asset story |
|---|---|---|---|
| `opa-bar-mezze-restaurant` | opabar.com.au | index + menu + functions + contact (`concept-manifest.json:30-94`) | 4 real jpgs grabbed from source (logo + 3 dining shots), 16.9KB index.html |
| `rich-and-rare-restaurant` (older) | richandrare.com.au | index only, 5 webp assets (hero/logo/seafood/dining/location) | 6 sections (`grep -nE "<section"` on `index.html`) |
| `rich-and-rare-learn-smoke-1778629677` | richandrare.com.au | index only, 2 webp (hero + logo) | 5 sections, captured 2026-05-12 (`open-design-run-summary.md:8-12`, 8 min run) |

Verdict: All 3 are "Open Design crawls source URL + matches brand direction" — NO use of `templates/roofing/families/*` or any template adapter. Restaurant niche has no template families to match.

### 1.5 Template "好网站作为模板" experiment verdict
- Reference ingest path (screenshot-first) is documented but only 4 roofing families produced; no restaurant family.
- Autoresearch over families produces accepted scores (≥95 on internal rubric) but this is rubric-against-self, NOT customer "would buy this" gate. See §5.
- No comparison report found that proves "template-driven mockup beat a from-source mockup for the same lead". Bottleneck: the auto-rubric is a structural/compliance check.

---

## 2. Autoresearch loop · 报告用 vs 网站用?

**Confirmed: the canonical `runAutoresearchLoop` is for REPORT HTML, not website pages.**

- Implementation: `core/reports/autoresearch-loop.js:1-50` — imports `generator.js`, `critic.js`, `hallucination-detector.js`. Stop conditions: score≥excellent_threshold(95), plateau<3pts, budget, maxRounds=5. Input shape: `{ auditData, entity, reviews, audience }`.
- Caller: `scripts/cli/pl-report-optimize.js` (audit-report HTML only).
- Docs: `docs/v2/AUTORESEARCH_REPORT_OPTIMIZATION.md` — explicit "两份报告：internal audit + customer-facing"; never mentions web concept pages.

**Website-side autoresearch is shallower:**
- `scripts/template-lab/run-template-autoresearch.js` runs OD generations against a family + a static QA rubric file. The "critic" is `scripts/template-lab/audit-template-copy.js` (rule-based), NOT a critic LLM with hallucination detection.
- `scripts/open-design/audit-generated-concept.js` (`audit-generated-concept.js:1-80`) — runs after OD output, checks for internal-language leaks, image presence, phone/form CTAs, placeholder copy. Output: `concept-quality-audit.json`. Only 3 client folders have this file: `roofing-restoration-greg-sign`, `od-native-clean-roofer-smoke`, `od-native-clean-roofer-smoke-v2`.
- No generator→critic→improve loop on the rendered HTML for a real customer.

GAP: website autoresearch ≠ report autoresearch. Generator-critic loop is not wired to website HTML output. Currently website QA is a single-pass gate, not an iterative improver.

---

## 3. Image experiments

### 3.1 Stock photo / search providers
- `grep -rIE "unsplash|pexels|stock-photo"` over `core scripts` → **zero hits** for Unsplash/Pexels integration. There is no stock-photo source integration.

### 3.2 Google Places photo download
- Extractor: `core/extractors/google-places-photos.js` + CLI `scripts/cli/pl-download-places-photos.js`, smoke `scripts/extractors/google-places-photos.js`.
- Usage in lead profiles: 192 entities in `data/leads/entities/`. **Only 1 entity has `photo_urls`** (`data/leads/entities/place_chij-x_xdsdakwsrylte_xmln1q.json`). **4 entities have any `places_enrichment` block.** Downloaded photo files on disk: 6 files in `data/v2/fixtures/places-photos/place_chij-x_xdsdakwsrylte_xmln1q/`.
- Verdict: places-photos integration is wired but only 1 lead has photos available. Effectively unused at scale.

### 3.3 OpenAI gpt-image-1 / "image candidates per niche"
- Script: `scripts/template-lab/generate-image-candidates.js:14-19` — provider=openai, model=gpt-image-1, default `--quality low`, count≤4.
- Real runs in `templates/roofing/families/classic-premium-roftix/image-candidates/` — **5 dry-run dirs only** (`image-run.json:8` `"dryRun": true, "status": "dry_run"`). No actual API images generated via this path.

### 3.4 Manual ChatGPT Image
- Documented decision: `docs/IMAGE_GENERATION_AUTOMATION_NOTES.md:1-30` — "manual first, automate later".
- Prompt pack: `templates/roofing/image-prompts/chatgpt-image2-prompt-pack.md` (6 prompts: hero dusk, about roofer, install detail, repair flashing, before/after, blue-hour hero).
- Real outputs: `templates/roofing/families/classic-premium-roftix/image-candidates/manual-chatgpt-image/2026-05-09-family-1/` — 6 PNGs. Review file `manual-image-review.json` rated 3 approved (scores 90-92), 3 usable (82-86).
- Verdict: 1 successful manual run for 1 roofing family. Never re-ran. No restaurant images. No automation.

### 3.5 Brand asset extraction from source URL
- `core/extractors/brand-assets.js:11-36` — pulls logos/imageCandidates/colors/fonts from source HTML. Outputs into evidence pack.
- This is the only path that's actually feeding real images into customer concepts (see §4 — Opa logo + Rich&Rare logo/hero came from squarespace-cdn).

---

## 4. 3 真客户 concept 实测

### 4.1 opa-bar-mezze-restaurant
- Files: `clients/opa-bar-mezze-restaurant/concept/open-design/{index,contact,functions,menu}.html` + 4 jpg assets (`concept-manifest.json:30-94`).
- index.html sections (line refs from `index.html`):
  - 238 hero-split (h1 + dining-room image)
  - 260 menu-highlights (3 images: table/bar/table)
  - 295 quote
  - 307 functions-private-room
  - 336 cta-strip
- Images: 4 real jpgs (logo 11KB, bar 264KB, table 127KB, dining 204KB). Source: opabar.com.au directly.
- Status: native clean finish, multi-page.
- "Low-quality" markers: none on a structural read. Same dining image reused at line 271 and 285 (`grep -n "<img"`). Image diversity = 3 unique business photos.

### 4.2 rich-and-rare-restaurant (older multi-page concept)
- index.html only + 5 webp assets (rich-rare-logo, rich-rare-hero[implicit], dining-room, dining-room-service, seafood-plate, location).
- 6 sections: home-hero (line 307), concept-pages (326), menus (357), experience (400), functions (414), contact (449), cta-strip (476).
- Note: contains `data-od-id="concept-pages"` and headers like "Four key pages, one clear booking path." — looks like a sales pitch *about* the concept, not a final restaurant homepage. Mixed audience leak.

### 4.3 rich-and-rare-learn-smoke-1778629677 (latest, 2026-05-12)
- index.html only + 2 webp (rich-rare-hero, rich-rare-logo). Captured logo from `images.squarespace-cdn.com` (`open-design-run-summary.md:27`).
- 5 sections: home-hero (232), home-promise (251), menu-page (286), experiences-page (322), private-dining-page (368), visit-page (396).
- Run duration 8min, native clean finish, 0 question forms (`open-design-run-summary.md:5-13`).

### 4.4 Cross-pattern observations
- All three relied on the source URL containing usable assets. None used `templates/roofing/families/*` or any restaurant family (because there is none).
- Restaurants WITHOUT a strong existing site would have no image fallback today — places-photos works for only 1 of 192 entities.
- "Hero image quality" = whatever is the largest jpg from the source site. There is no per-niche fallback image library.

---

## 5. 现有 "好网站" 定义

Three rubrics exist; they overlap but no single canonical one.

### 5.1 `qa-rubric.json` (template family level)
- File: `templates/roofing/families/classic-premium-roftix/qa-rubric.json`. passScore=85, 9 weighted criteria summing to 100:
  - referenceFidelity 15, firstViewportImpact 15, imageDensity 12, nicheFit 12, pageCompleteness 12, ctaHierarchy 10, trustProof 8, mobilePolish 8, copyCleanliness 8.
- Hard fails: internal workflow terms, missing primary visual, fake verified facts, no phone/form path.
- **But: there is no scoring function in code that reads this file and produces a numeric per-criterion score.** The "score: 95" in `summary.json` is the OD runner's self-report from `experiment-score.json`, not a rubric-driven critic.

### 5.2 `concept-quality-audit.json` (per-client gate)
- Driver: `scripts/open-design/audit-generated-concept.js`.
- Real checks (lines 32-80): internal-term leaks (28-pt penalty), no visual assets (18-pt), placeholder language (16-pt), weak conversion path (20-pt), weak service content (12-pt). Starts at 100, deducts.
- Verdict: this is a compliance/leak detector, NOT a design-quality judge. Score=100 means "didn't leak internal junk + has 1 image + has phone". Says nothing about whether it looks premium.

### 5.3 Internal audit-report rubric (different surface)
- `docs/v2/AUTORESEARCH_REPORT_OPTIMIZATION.md` §3 — 10 criteria × 10 = 100 for audit-REPORT quality (not website). Not applicable.

### GAP
- No rubric scores "does this look like a sellable industry-grade local-business website".
- No human-approval ledger of "passed website" vs "failed website" examples beyond ad-hoc.
- `docs/FINAL_WEBSITE_PRODUCTION_V2.md` lines 1-30 explicitly names the gap: "previous workflow could generate pages that passed basic checks but still failed Matthew's customer-delivery bar".

---

## 6. niche adapter 模式 vs master.md 模式

Two distinct patterns coexist:

### Pattern A — niche adapter (restaurant only)
- `niches/restaurant/{adapter.js, schema.js}` (255 + 62 lines).
- `buildRestaurantContentFromEvidence` (`adapter.js:16-75`) takes an evidence pack → produces a structured `restaurant content.json` with: hero, contact, cta, booking, menu (with sections), gallery, brand, evidenceSummary, fallbackLevel (A/B/C/D).
- Fallback levels (`schema.js:3-8`): A=official_site_menu, B=pdf_menu, C=google_places+ocr, D=starter_no_menu_claims.
- Output: `clients/<slug>/content.restaurant.json`. This is the structured-content pipeline.
- `niches/roofing/` does NOT exist. Restaurant is the only niche-adapter implementation.

### Pattern B — master.md (canonical, used for roofing)
- `core/reports/master-md-builder.js` (1089 lines) `buildMasterMd(...)` — synthesizes a single `clients/<slug>/v2/master.md` from audit data, places, reviews, etc.
- 12 client dirs have `v2/master.md`, ALL roofing (e.g. `fix-my-roof-total-roof-restorations`, `queensland-roofing-pty-ltd`, `acacia-plumbing` etc.).
- master.md is per-MEMORY.md a "source of truth for HTML/video/slides via huashu-md-html + hyperframes".

### Real differences
| Axis | Pattern A (restaurant adapter) | Pattern B (master.md, roofing) |
|---|---|---|
| Input | Evidence pack JSON | Audit + entity + reviews |
| Output | Typed content JSON (`content.restaurant.json`) | Markdown narrative + frontmatter |
| Used by | Restaurant production templates (planned) | Internal audit reports, master HTML, downstream HFR |
| Niches | restaurant | roofing (12 leads) |
| Customer-facing website? | Was the plan, but no template adapter consumed it for a paid customer site found | Drives reports, not concept pages directly |

The customer-facing Open Design concepts in `clients/*/concept/open-design/` use NEITHER pattern. OD reads the source URL fresh and produces HTML inline. The adapters and master.md exist parallel to OD, not feeding it.

---

## 7. Image 数据真实可用度

| Source | Code | Real coverage |
|---|---|---|
| Google Places photos | `core/extractors/google-places-photos.js` + `scripts/cli/pl-download-places-photos.js` | 1/192 entities have `photo_urls`; 6 photo files on disk for 1 place_id |
| Brand asset extract from source URL | `core/extractors/brand-assets.js:11-36` | Effective when source URL has usable imagery — Opa got 4, Rich&Rare got 5 then 2 |
| Issue-evidence per-issue screenshots | `core/audit/issue-evidence.js` | Used by audit pipeline, not by website concept generator |
| Manual ChatGPT Image | `templates/roofing/image-prompts/chatgpt-image2-prompt-pack.md` | 6 PNGs for 1 family, 1 run, ~50% scored ≥90 |
| OpenAI gpt-image-1 (programmatic) | `scripts/template-lab/generate-image-candidates.js` | 5 dry-run dirs, 0 real generations |
| Unsplash/Pexels | none | 0 |

Realistic statement: today's image story for a new lead is "hope the source website has good photos; otherwise nothing". For leads with no website, there is no image pipeline.

---

## 主要发现 (Matthew 不知道的事 / 容易忽视的事)

1. **Website autoresearch is a different loop from report autoresearch.** The generator→critic→improve loop with hallucination detection in `core/reports/autoresearch-loop.js:1-50` only runs over REPORT HTML. Website QA is a single-pass `audit-generated-concept.js` compliance gate. Iterative improvement on rendered website HTML does not exist in code. (Bottleneck: quality is bounded by one OD attempt.)
2. **All 3 hand-checked customer concepts (Opa, Rich&Rare ×2) bypass the template library entirely.** They use the "Open Design crawl source URL + match brand" prompt at `clients/<slug>/concept/open-design/prompt.txt`. Templates exist for roofing only and were never the path for the 3 real restaurants.
3. **`templates/restaurant/` does not exist.** Niche-template work shipped for roofing only (4 families). Restaurant has the `niches/restaurant/adapter.js` typed content pipeline, but no template family scaffolds, no design-languages, no qa-rubrics, no image candidates.
4. **The "95 score accepted" in template-autoresearch summaries is OD self-reporting, not rubric-driven.** `qa-rubric.json` exists with 9 weighted criteria but no code reads it to compute weighted score. `concept-quality-audit.json` is a leak/compliance gate (100 = "no leaks + ≥1 image"), not a quality scorer. (`scripts/open-design/audit-generated-concept.js:32-80`.)
5. **Image fallback is the hard ceiling.** OpenAI image runs are 100% dry-run; manual ChatGPT Image ran once for 1 family in 2026-05-09; Google Places photos cover 1/192 entities (`grep -l '"photo_urls"' data/leads/entities/*.json`). For a lead with no source-URL imagery, there is currently no path to good photos.
6. **Restaurant adapter (Pattern A) is decoupled from OD concept generation.** `niches/restaurant/adapter.js:16-75` produces `content.restaurant.json` but the 3 restaurant concepts I checked do not consume it. OD reads the source URL directly. The structured content pipeline is "ready but unused" for website generation.

## 我没找到的东西

- A scoring function that actually reads `templates/<niche>/families/<family>/qa-rubric.json` and computes a weighted critic score against rendered HTML. (Only the rubric file exists.)
- Any restaurant template family directory. `templates/restaurant/` does not exist; `niches/roofing/` does not exist either. The two pipelines are split per niche with no overlap.
- A decision log entry that says "template approach failed, switched to source-URL approach" (Matthew's spoken history). Closest written evidence: `docs/FINAL_WEBSITE_PRODUCTION_V2.md` lines 5-15 admits previous workflow was failing customer-bar, but does not declare template approach abandoned.
- Any A/B comparison report of "template-driven mockup vs source-URL-driven mockup for the same lead". None of the 62 autoresearch run dirs contain such a comparison.
- An image library per niche or per service. There is `templates/roofing/families/classic-premium-roftix/image-candidates/manual-chatgpt-image/2026-05-09-family-1/` with 6 assets — that is the entire library.
- A `runAutoresearchLoop` caller that targets website index.html (no website-autoresearch script exists; all callers target report HTML).
- A persisted "good website example" corpus. We saw 4 design-direction families for roofing, but no labelled "this is the bar we beat" set.

---

(END — 30 lines tail follows for coordinator)

主要发现 tail:
1. Website autoresearch loop does NOT exist; only report autoresearch loop exists (`core/reports/autoresearch-loop.js`). Website QA is single-pass compliance gate (`scripts/open-design/audit-generated-concept.js`).
2. All 3 real restaurant concepts (opa, rich&rare ×2) bypass `templates/` entirely — they use Open Design crawl-source-URL prompt.
3. `templates/restaurant/` directory does not exist. Roofing has 4 families; restaurant has only a content adapter (`niches/restaurant/adapter.js`), no template scaffolds.
4. The "score=95 accepted" in template-autoresearch summaries is OD self-report, NOT rubric-driven. `qa-rubric.json` exists but no code computes weighted score from it.
5. Image pipeline ceiling: gpt-image-1 runs all dry-run; manual ChatGPT Image ran once 2026-05-09 for 1 roofing family (6 imgs, 3 approved); Google Places photos cover 1/192 entities. No stock-photo integration. For leads without source-URL imagery there is no path to good photos.
6. Pattern A (`niches/restaurant/adapter.js` → `content.restaurant.json`) and Pattern B (`core/reports/master-md-builder.js` → `master.md`) are structured-content pipelines that exist but are NOT feeding the OD concept generator today. OD reads source URLs directly.

What I did NOT find:
- A scoring function that actually consumes qa-rubric.json against rendered HTML.
- Any A/B comparison of template-driven vs source-URL-driven mockups.
- A persisted "good website" labelled corpus.
- A `runAutoresearchLoop` caller targeting website pages (only report HTML callers exist).
- A per-niche image library beyond 1 roofing family's 6 manual PNGs.
- A written decision log declaring the template approach abandoned (the closest signal is `docs/FINAL_WEBSITE_PRODUCTION_V2.md` admitting the prior workflow missed Matthew's bar).
