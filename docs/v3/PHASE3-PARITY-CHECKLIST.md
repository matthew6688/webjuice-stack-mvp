# Phase 3 Editorial Parity Checklist · 2026-05-28

> **Purpose**: define what "the new editorial-newsletter composer matches the Matthew-approved hand-rendered Phase 3" actually means. Step 1 (template extract) + Step 2 (composer CLI) cannot proceed past Step 3 (vicwest validation) until this checklist is 100% green.
>
> **Codex R23 EE-5 mandate**: define success conditions BEFORE coding so we don't "make it work" while losing editorial quality.
>
> **Reference output**: `templates/roofing/brand-grid-experiment/vicwest-roofing/editorial/preview.html` (722 lines · sub-agent hand-rendered · audit composite 89/A/SHIP · D2.5 brand_palette_honored 100/100)

---

## SOURCE INPUTS (what composer reads · single SSOT writer per input)

| Input | Path | Writer | Required |
|---|---|---|---|
| business facts | `clients/<slug>/v2/handoff/od-package/facts.json` `.locked_facts` | pl:enrich-handoff | YES |
| brief / claims | `clients/<slug>/v2/master.md` (YAML frontmatter + body) | pl:build-master-md | YES |
| readiness gate | `clients/<slug>/v2/checkpoint.json` | pl:data-checkpoint | YES (must be GREEN or YELLOW · RED blocked) |
| curated images | `clients/<slug>/v2/handoff/photos/selected.json` | core/handoff/classify-images.js (vision LLM) | YES |
| brand tokens | `clients/<slug>/v2/handoff/od-package/brand/brand-tokens.css` | pl:build-brand-kit | YES |
| brand logos SVG | `clients/<slug>/v2/handoff/od-package/brand/logo-*.svg` (≥ logo-mark.svg + logo-dark.svg) | brand-extract Phase 1 | YES |
| persona | `core/audit/personas/<primary_segment>.js` | static | derived from brief |
| voice rules | `skills/pl-au-trade-voice/pl-au-trade-voice.json` | skills:build | static |
| niche addendum | embedded in voice.json `forbidden_niche_claims_roofing` | skills:build | static |

**Single-writer SSOT**: any new field for editorial output MUST trace to one of the above. No composer-side fabrication. No "I'll just hardcode this for vicwest."

---

## REQUIRED RENDERED ELEMENTS (must appear in output HTML)

### Header

- [ ] **REQ-H1** Real brand logo SVG embedded (NOT generic house icon) · src must be one of `brand/logo-*.svg` and the file must exist
- [ ] **REQ-H2** Eyebrow line next to logo: `<city> · EST. <year_founded>` (e.g. "BALLARAT · EST. 2003")
- [ ] **REQ-H3** 5-item nav: Services · About · Work · Coverage · Contact · with working anchors (`#services` `#about` `#gallery` `#coverage` `#contact` matching section ids that EXIST in the page)
- [ ] **REQ-H4** Phone CTA in boxed style · `tel:` href correctly formatted as `tel:+61<rest>` for AU (NO `tel:tel:` double-prefix)

### Hero

- [ ] **REQ-HE1** Eyebrow: 3-segment editorial framing (e.g. `FILE NO. <N> · <CITY> ROOFING JOURNAL · VOL. <N>`) · all-caps · monospace-ish · brass dot separators
- [ ] **REQ-HE2** Serif headline · ≥ 8 words · contains em-dash OR period · written in declarative tradesman voice · ≤11 words IF owner-voice exception (mech-H-1)
- [ ] **REQ-HE3** Subhead: ≥ 40 words · contains ≥ 3 specific facts (license authority+number · materials named · years · suburb name)
- [ ] **REQ-HE4** ≥ 2 CTAs: primary brass-fill "Request a written quote" · secondary outline "Call <phone>"
- [ ] **REQ-HE5** ≥ 4 proof chips with brass dot bullets · MUST include license# (`VBA CDB-U <N>` for VIC), years (`<N>+ years local`), warranty (`<N>-year workmanship`), reviews (`<rating> · <N> Google reviews`)
- [ ] **REQ-HE6** Hero image · real customer roof work (NOT stock farm shot · NOT generic). `_source` in selected.json must be `customer-extract` OR `verified` (NOT `ai-placeholder`)

### Strap (at-a-glance band)

- [ ] **REQ-S1** 4-6 stat / proof tiles · derived from facts.json (licence, warranty years, suburbs covered count, reviews, services range)

### Services section (#services)

- [ ] **REQ-SV1** Section h2 with editorial number (e.g. "01 · Services")
- [ ] **REQ-SV2** ≥ 4 services from facts.json or core-extract.brief.services · each with specific material/method (NOT generic "we offer ...")
- [ ] **REQ-SV3** No "Learn more →" with `href=""` · every CTA either anchors to `#contact` form OR is removed

### About (#about)

- [ ] **REQ-AB1** Owner story: contains owner_name (e.g. "I'm Hayden") if `_source` says owner_name is `verified` · otherwise omit entirely (NO fabricated owner)
- [ ] **REQ-AB2** Specific year/anchor: "since 2003" or equivalent · sourced from facts
- [ ] **REQ-AB3** Real worker/owner photo · `_source: customer-extract` (NOT stock)

### Reviews (#reviews)

- [ ] **REQ-RV1** IF real Google reviews available in `selected.json` or `evidence/google-reviews.json` → show ≥3 real reviews with author + date
- [ ] **REQ-RV2** IF AI_PLACEHOLDER used → MUST emit visible PREVIEW banner "Sample testimonials shown · see all <N> verified Google reviews →" · NEVER in JSON-LD aggregateRating
- [ ] **REQ-RV3** Real rating + count (4.1 · 18) match Google source

### Gallery / Before-After (#gallery)

- [ ] **REQ-GA1** ≥ 1 draggable-slider before/after pair · DOM signature `.ba-slider` + `.ba-divider` + `.ba-handle` (R-BA-6 hard rule)
- [ ] **REQ-GA2** Image refs resolve · `_source: customer-extract` preferred · template fallback OK with caption "Stock photography · representative imagery"

### Coverage / Service Areas (#coverage)

- [ ] **REQ-CV1** ≥ 6 suburbs listed (NOT empty section) · sourced from facts.service_area OR brief.suburbs_covered
- [ ] **REQ-CV2** Distance/radius implied (e.g. "Free site visits within our area")

### Contact (#contact)

- [ ] **REQ-CT1** 3-field quote form (full name · phone · service select) · NOT 5+ (AS-trade-5)
- [ ] **REQ-CT2** Address full + Google Maps link (`href="https://maps.google.com/?cid=..."` or equivalent)
- [ ] **REQ-CT3** Phone in `tel:` AND email in `mailto:` for EVERY occurrence on the page (not just footer)

### Footer

- [ ] **REQ-F1** Real brand logo (small variant) · NAP block · ABN if present · social links if present
- [ ] **REQ-F2** Service links anchor to `#services` · NOT `href="#"`
- [ ] **REQ-F3** No `index.html` links (single-page output uses anchors not file paths)

### Head / SEO / structured data

- [ ] **REQ-SE1** `<title>` ≥ 50 chars · includes `<business_name>` + `<city>` + 2 service nouns
- [ ] **REQ-SE2** `<meta name="description">` 150-160 chars · contains license signal + service + city
- [ ] **REQ-SE3** LocalBusiness/RoofingContractor JSON-LD valid · aggregateRating present · hasOfferCatalog present
- [ ] **REQ-SE4** Brand logo `<link rel="icon">` derived from `brand/logo-mark.svg` or `favicon.svg`

---

## CLAIM GOVERNANCE (every fact-bearing field has a provenance level)

Composer reads `_source` sibling fields from core-extract.json / master.md / selected.json:

| Provenance level | Behavior |
|---|---|
| `verified` (GBP / website / register hit) | Render normally |
| `ai-inferred` (LLM completion · explainable) | Render normally · log to site-report under "inferred" |
| `ai-completed` (LLM gap-fill) | Render normally · log to site-report |
| `ai-placeholder` (sample · no source) | MUST trigger visible PREVIEW banner · NEVER in JSON-LD facts · NEVER in headline H1/H2 |
| `needed-client-supplied` (e.g. license_number missing for VIC) | Hide field entirely · log to site-report "client must provide" |
| `forbidden` (e.g. lifetime guarantee · per pl-au-trade-voice §3.6) | Strip from output · log AV-6 violation |

---

## AUDIT THRESHOLDS (Vicwest gate · Step 3 hard stop)

After composer renders Vicwest editorial-newsletter:

- [ ] **AUD-1** `pl:audit-v4 --tier fast` composite ≥ **89** (Phase 3 hand-rendered baseline)
- [ ] **AUD-2** T1 PASS all mechanical
- [ ] **AUD-3** T2 D2.5 brand_palette_honored ≥ **90** (Phase 3 hit 100)
- [ ] **AUD-4** T4d voice ≥ 90 (no AV-1/4/6 violations)
- [ ] **AUD-5** All 12 fixture assertions PASS (extend fixture to include editorial-newsletter)

---

## VISUAL PARITY (subjective · Matthew approval)

The 5 specific regressions codex flagged that Step 3 must NOT lose:

- [ ] **VIS-1** Logo: real `brand/logo-dark.svg` (VR wordmark · NOT generic house icon)
- [ ] **VIS-2** Palette: D2.5 score ≥90 (Phase 3 used brand-spec hex correctly · V2 used wrong copper #b86a47)
- [ ] **VIS-3** License # visible: "VBA CDB-U 65938" must render in proof chips (V2 missed it)
- [ ] **VIS-4** Subhead density: ≥40 words specific (V2 had 10 words generic)
- [ ] **VIS-5** Audit score ≥89

---

## LINKS / ACCESSIBILITY (close all the broken-link bugs Matthew caught today)

- [ ] **LNK-1** All anchor targets (`#X`) match existing section ids on page (0 broken anchors)
- [ ] **LNK-2** No `href=""` placeholders (kill or anchor to `#contact`)
- [ ] **LNK-3** No `href="#"` placeholders
- [ ] **LNK-4** No `index.html` redirects on single-page (use anchors)
- [ ] **LNK-5** No `contact.html` / `about.html` (no multi-page paths leaked into single-page mode)
- [ ] **LNK-6** Every phone text instance wrapped in `<a href="tel:...">`
- [ ] **LNK-7** Every email text instance wrapped in `<a href="mailto:...">`
- [ ] **LNK-8** No `tel:tel:` double-prefix
- [ ] **LNK-9** Address linked to Google Maps `<a href="https://maps.google.com/?cid=...">`

---

## SITE REPORT (Step 4 follow-up · documented here for ref)

After every render, composer MUST emit `clients/<slug>/v2/editorial-output/site-report.{html,json}` covering:

- Business snapshot (NAP · ABN · license · rating)
- Audit results (T1+T2+T4d composite + grade + ship verdict)
- Content provenance (per-field: verified / ai-inferred / ai-placeholder · counts)
- Asset provenance (customer / template / fallback · counts)
- Skills applied (pl-au-trade-voice version · persona id · audit rubric refs · brand kit version)
- LBP-1..14 compliance (NAP consistency · clickable phone/email · Google Map · etc.)
- Regression fixture status (X / Y assertions PASS)
- Known gaps before live (license# missing · etc.)

Report design covered separately in Step 5+ · this checklist is the gate for Step 1+2+3 only.

---

## Sign-off

This checklist is the contract. Codex R23 EE-5: "Step 1 can 'work' while still losing the editorial quality Matthew liked" — this checklist makes that impossible. Every box must check before Step 4 (a-j) starts.

Approved by: codex R23 · committed 2026-05-28.
