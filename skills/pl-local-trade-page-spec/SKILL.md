---
name: pl-local-trade-page-spec
description: Canonical standard for ProfitsLocal single-page websites for AU local trades. Audience-first (4 buying-intent segments · primary_segment required) · renderer-agnostic · niche-agnostic at structure level (vocab/voice/signals layer separately). Defines 11 numbered content sections + chrome (sticky-header) + overlay (sticky-mobile-bar) · each with purpose · hard rules · audit IDs · anti-pattern IDs. Sample-deep Hero (§1) · stub spec for sections 2-11 per codex Round 14 architecture-first guardrail. NOT for SaaS · restaurants · portfolios. Use BEFORE renderer · audit AFTER compose. Cross-refs SOP-SINGLE-PAGE-LOCAL-TRADE-STANDARD.md (canonical) · personas/*.js (segment data) · pl-au-trade-voice (Step 3 · language) · pl-anti-slop-catalog (Step 3 · failure modes) · pl-audit-rubric (Step 3 · checks).
metadata:
  version: 1.0.0
---

# ProfitsLocal · Local-Trade Single-Page Spec

> **Canonical insight** (Codex Round 11 · verbatim):
> **Template quality is judged by the trade owner · website performance is judged by the trade owner's customer.** Both judgements must pass · they are NOT the same audit.

The renderer-agnostic page contract: every renderer (modules library · LLM-gen · hand-write · hybrid) must produce HTML that satisfies these rules · or it fails audit regardless of implementation.

## When to invoke

- BEFORE renderer selection · know the contract
- BEFORE brief writing · know what each section requires
- DURING audit · `pl-audit-rubric` reads section/rule IDs from here

Use ONLY for **AU local trades** (roofer · plumber · electrician · landscaper · pest · cleaning · concrete · gutter · brickwork · tiling). NOT SaaS · restaurants · portfolios · agencies.

## Owner & sources (single-source rule · this file does NOT redefine)

| Concept | Owner (don't restate) | This skill references via |
|---|---|---|
| 4-tier audit framework | `docs/v3/SOP-AUDIT-STANDARD.md` v3 (Matthew-signed) | T1/T2/T3/T4 reference |
| Single-page canonical SOP | `docs/v3/SOP-SINGLE-PAGE-LOCAL-TRADE-STANDARD.md` v2.0 | §1 · §3 · §4 · §6 · §13 · §14 · §15 · §16 |
| Per-segment buyer data | `core/audit/personas/{urgent-repair,planned-upgrade,commercial-maintenance,guided-first-time-buyer}.js` | segment ID + critical_signals_5_second + secondary_representation |
| Niche-specific vocab + tone | `skills/pl-au-trade-voice` + `skills/pl-trade-vocab-roofing` | `TODO Step 3` · skill not built yet |
| Niche-specific anti-patterns | `skills/pl-anti-slop-catalog` | `TODO Step 3` · catalog not built yet |
| Audit rule execution | `skills/pl-audit-rubric` | `TODO Step 3` · rubric not built yet |
| Trust signal detection | `core/audit/trust-signals/<niche>.js` (router · existing) | regex pattern source |
| Brief schema | `core/handoff/single-page-brief-schema.js` | `TODO Step 4` · validator not built yet |

**This file's job**: declare the page contract · point at owners · never duplicate. Per codex Round 14: every new rule below MUST point to SOP / persona / future Step 3 catalog/rubric · NOT establish a second rule source.

---

## Architecture · 11 numbered content sections + chrome + overlay

Per SOP §2 (canonical sequence). Section IDs are stable · audit references them by ID.

| # | Section | Required? | Word budget | Type | Persona-driven? |
|---|---|---|---|---|---|
| 0 | `sticky-header` | yes | ≤30 words | chrome (shared) | no (constant) |
| 1 | `hero` | yes | 60-100 words | content | **yes** (primary_segment) |
| 2 | `trust-bar` | yes | 30-60 words | content | partial (commercial needs ABN visible) |
| 3 | `service-list` | yes | 120-200 words | content | partial (commercial signal) |
| 4 | `about-story` | yes | 90-150 words | content | partial (owner photo present_or_absent) |
| 5 | `reviews` | conditional* | 80-200 words | content | yes (review wording per segment) |
| 6 | `before-after` | conditional* | 30-80 words | content | partial (planned-upgrade weight) |
| 7 | `service-area` | yes | 50-120 words | content | yes (radius + suburb density) |
| 8 | `process` | yes | 80-130 words | content | yes (urgent vs planned step tone) |
| 9 | `faq` | yes | 150-300 words | content | yes (segment-specific Q+A) |
| 10 | `cta-band` | yes | 40-100 words | content | yes (CTA copy per segment) |
| 11 | `footer` | yes | 60-120 words | chrome | partial (commercial NET-X) |
| OVR | `sticky-mobile-bar` | yes | ≤10 words | overlay | yes (neutral · urgent · etc.) |

\*Conditional sections (per Codex Round 5 Q-F-5 fallback-with-banner): `reviews` may use AI-placeholder when `entity.review_count < 5` · `before-after` may use stock library when no real pairs · BOTH require visible PREVIEW banner + provenance markers (SOP §11 banner protocol).

**Total content word budget**: 1000-1400 (Codex Q-A-6 sweet spot · 900 floor for thin niches · 1500 mobile-fatigue ceiling).

---

## Page-level non-negotiable rules

These layer across all sections · enforced by `pl-audit-rubric` T1 + T2.

### Audience contract (SOP §1 + persona files)

- **R-AUD-1** · `primary_segment` declared (no `mixed-not-allowed` in brief) · enum: `urgent-repair | planned-upgrade | commercial-maintenance | guided-first-time-buyer`
- **R-AUD-2** · Hero copy matches `primary_segment` voice (see SOP §3.1 H-seg-1 · enforced by `pl-au-trade-voice` Step 3)
- **R-AUD-3** · Emergency-availability chip above-fold when `urgency_mix` ∈ {emergency-heavy, mixed} · regardless of primary segment (see SOP §3.1 H-seg-2)
- **R-AUD-4** · Per-segment `critical_signals_5_second` deterministic gates must pass (see persona file · enforced by T5 hard gate · SOP §13.1)

### Universal cross-segment (SOP §1.2)

- **R-UNI-1** · Visible working `tel:` link inside the first 100vh on mobile 390px viewport (5-second contact path)
- **R-UNI-2** · Proof of real local legitimate contractor visible: city/suburb + ABN + state-licence + insurance + real reviews + real job photos (NAP consistency + LBP-1..14 stack · see SOP §15)

### `present_or_absent` convention (anti-fabrication · Codex Round 8)

For fields where falsy data exists (no owner photo · no founding year · no radius km · no insurance amount):

```
present_or_absent  =  { populated_AND_verified } OR { explicitly_absent_in_brief }
                   ≠  { fabricated_to_pass_audit }
```

Renderer MUST NOT invent data to fill these fields. If the brief marks `owner_photo_url: null`, the render either:
- omits the owner-photo subsection entirely (preferred when whole section becomes thin), OR
- shows the rest of about-story without owner-photo block (no placeholder face · no stock photo)

Fields under this convention: `owner_photo_url` · `owner_full_name` · `year_founded` · `service_radius_km` · `insurance_amount_aud` · `emergency_response_sla_hours` · `gbp_review_count_recent` · `before_after_pair_count`.

### Mixed-segment hierarchy (SOP §14 · Codex Q-P-5)

When `secondary_segments[]` is non-empty:
- **Primary dominates hero** · no tabbed hero · no segment switcher
- **Restrained fold chip per secondary** (e.g. "Emergency leak repairs available") · from persona file `secondary_representation.fold_chip`
- **Neutral mobile sticky** (e.g. "Call roofer") · NOT urgency-coded · from `secondary_representation.mobile_sticky`
- **Below-fold dedicated band** for each secondary · from `secondary_representation.below_fold_band`
- All 3 surfaces · hierarchy-controlled · never multiple hero variants

### Niche interface contract (Codex Round 6 Q-N-3)

Every niche vocab skill (e.g. `pl-trade-vocab-roofing`) MUST define these 8 fields. Page-spec rules below reference them by name; the page-spec stays niche-agnostic.

| Field | What it gives | Used by |
|---|---|---|
| `services` | Niche service taxonomy (e.g. roofing: restoration · replacement · repair · gutter · storm) | service-list section · brief schema |
| `emergency_posture` | Niche urgency default (emergency-heavy · mixed · scheduled-heavy) | urgency_mix default · H-seg-2 enablement |
| `license_signals` | State authority + license number format regex (e.g. roofing: VBA/QBCC/NSW-FT) | trust-bar · footer · T1.5 cross-state ban |
| `trust_proof` | Niche-specific authority signals (e.g. roofing: HIA member · Master Builders · 10-year warranty) | trust-bar · about-story · LBP-4 |
| `objections` | Top 4-6 customer objections (e.g. roofing: cost · timeline · warranty · damage during work) | faq · about-story |
| `forbidden_claims` | Niche-specific illegal/risky claims (e.g. roofing: "lifetime guarantee" without product backing · "insurance approved" without specific insurer) | content-validator extension |
| `local_modifiers` | Niche-specific local language (e.g. roofing: "Colorbond" · "ridge cap" · "valley sarking" · "BlueScope-supplied") | service-list · process · faq |
| `schema_expectations` | LocalBusiness JSON-LD subtype + required fields per niche (e.g. roofing: RoofingContractor + areaServed + aggregateRating) | T4.5 schema check |

Page-spec rules consume these fields as `{{niche.services}}` style template variables · NEVER inline roofing-specific vocab into page-spec content.

---

## Section 1 · Hero (FULLY EXPANDED · sample format · stays niche-agnostic with `[example: roofing niche]` annotations)

### Purpose

Convert an 8-second mobile scan into one of three outcomes: (a) tap to call · (b) start quote-form · (c) scroll for proof. Failure mode: visitor reads · bounces · doesn't return. Hero is the ONLY section that gets the visitor's full attention; every later section is at 50% attention.

### Required content (factual · enforced by `pl-audit-rubric` T1)

- `business_name` exactly as in `handoff/od-package/facts.json`
- `phone` displayed (formatted) + `tel:` link (E.164)
- ONE primary CTA (form) + ONE secondary CTA (phone) · both above-fold on 1440px desktop AND 390px mobile
- ≥1 trust signal (license number OR years-in-trade OR rating+count) — visible without scroll
- Headline (H1) · 4-10 words · contains city OR niche keyword
- Subheadline · 14-25 words · expands H1 specificity
- Optional: hero image (real customer work or representative trade photo · NOT lifestyle stock · LBP-12)
- `[example: roofing niche]` H1: "A Ballarat roof, done properly — and signed off in writing." subhead: "VBA-licensed roofers covering Colorbond replacements, terracotta restorations across Ballarat since 2003."

### Design rules (hard · machine-testable · point to owners)

| ID | Rule | Owner / enforced_by |
|---|---|---|
| **D-H-1** | H1 font-size ≥ 36px desktop · ≥ 28px mobile | `pl-audit-rubric` T2 (TODO Step 3) |
| **D-H-2** | H1 : body font-size ratio ≥ 1.6× | same |
| **D-H-3** | Primary CTA button height ≥ 44px (WCAG 2.5.5 tap target) | `pl-audit-rubric` T4 a11y |
| **D-H-4** | Secondary CTA opens `tel:` · not "Call us" plain text | content-validator + T2 |
| **D-H-5** | Trust signal visible above 100vh on 1440×900 viewport | T5 deterministic gate (per primary_segment · persona file) |
| **D-H-6** | Color contrast H1 vs background ≥ 4.5:1 (WCAG AA) | T4 D4.3 |
| **D-H-7** | Hero uses `var(--brand-primary)` and `var(--brand-accent)` from brand-tokens.css · ZERO hardcoded hex | `pl-audit-v4` D2.1 (existing · cross-link) |
| **D-H-8** | Hero image alt text describes actual content (NOT "hero image") | T1 LBP-12 + T4.4 |
| **D-H-9** | (segment-driven) For `primary_segment = planned-upgrade`: hero MUST contain genuine completed-work photo (LBP-12 + T5 gate · see persona file `critical_signals_5_second[1]`) | T5 hard gate |

### Copy rules (hard · enforced)

| ID | Rule | Owner / enforced_by |
|---|---|---|
| **C-H-1** | H1 ≤ 10 words strict · ≤ 11 only if owner-operator voice exception (regex against `pl-au-trade-voice` owner-voice patterns · TODO Step 3) | content-validator · pl-au-trade-voice |
| **C-H-2** | H1 contains ONE of: city · suburb · niche · service-type · trade-credential (passes `local_seo_present` from content-validator) | content-validator (existing) |
| **C-H-3** | Subheadline 14-25 words · max 1 comma OR 1 em-dash · NO semicolon | content-validator (`subhead_punctuation_max` · TODO add) |
| **C-H-4** | Primary CTA text follows formula `[Verb] + [What They Get]` · NEVER "Submit" / "Sign Up" / "Learn More" / "Get Started" / "Contact Us" (AS-trade-8 banned regex) | content-validator `cta_not_banned` (TODO add) + SOP §16 catalog |
| **C-H-5** | Secondary CTA text `Call <phone-display>` · phone visible as digits not hidden | content-validator |
| **C-H-6** | NO forbidden phrases from `pl-au-trade-voice` blacklist (TODO Step 3) | content-validator + pl-au-trade-voice |
| **C-H-7** | ≥1 specific number (year · review count · warranty years · suburbs served) in hero · NOT generic claims | content-validator (`specific_number_present` · TODO add) |
| **C-H-8** | Hero copy voice matches `primary_segment` (H-seg-1 · SOP §3.1) | T5 vision LLM + persona `voice_modifiers.tone` |
| **C-H-9** | (segment-driven) `primary_segment = guided-first-time-buyer` requires `pricing_disclosure_mode = indicative_range` rendered in fold (per SOP §4.4) | T5 deterministic + brief-validator |

### Audit check IDs (executed by `pl-audit-rubric` · TODO Step 3 maps these to T-numbers)

**Mechanical** (0 LLM · section-prefix IDs · rubric maps to T1/T2):
- `mech-H-1` H1 word count ≤10 (owner-voice exception via regex against persona owner_voice_patterns)
- `mech-H-2` Subheadline word count 14-25
- `mech-H-3` ≥1 `<a href="tel:">` link inside `<section class="hero">`
- `mech-H-4` ≥1 CTA with non-banned text · banned regex from SOP §16 AS-trade-8
- `mech-H-5` phone digit string appears ≥1 time within hero
- `mech-H-6` alt text non-empty on any `<img>` in hero
- `mech-H-7` H1 font-size declarations resolve to ≥36px (D-H-1)
- `mech-H-8` brand-tokens.css var(--brand-*) usage in hero CSS ≥70% (D-H-7)

**Vision** (LLM · ~$0.02/page · rubric maps to T3/T5):
- `vis-H-1` Trust signal visible in first 100vh of rendered desktop screenshot · 0-10
- `vis-H-2` Hero copy specific to this business or could belong to any contractor · 0-10 (10 = unmistakably this business)
- `vis-H-3` Hero color hierarchy: does primary CTA dominate over secondary · 0-10
- `vis-H-4` AI-slop detection: soft gradient · rounded card · purple/blue cliché (cross-ref SOP §16 + pl-anti-slop-catalog · TODO Step 3) · 0-10 (10 = no slop)
- `vis-H-5` Per-segment 5-second fold serviceability (matches persona JTBD) · 0-10 · drives T5 primary score

### Top-3 anti-patterns (inline · per Codex Round 4 Q-F-2 hybrid)

| ID | Inline summary | Catalog (TODO Step 3 · pl-anti-slop-catalog) |
|---|---|---|
| **AS-trade-1** | Hero copy = business name only (e.g. "iFix Roofing") · zero value prop | full detection prompt in catalog |
| **AS-trade-2** | "Your company for [niche] [city]" SEO keyword-stuff hero | catalog |
| **AS-trade-7** | "Competitive prices" anywhere in hero copy · vague-fluff banned | catalog · content-validator FORBIDDEN_PHRASES append |

Full anti-pattern catalog: SOP §16 + `pl-anti-slop-catalog` (Step 3).

### Examples (Codex Q-F-3 inline · 2 per major section · annotated niche)

✅ **GOOD · `[example: roofing niche]` mark-squire (T3 brand-fidelity 87 in 8-variant test)**:
- H1: "Ballarat roof restoration, done by the man whose name is on the truck."
- Owner-voice exception fires (contains "name is on the truck") · 11 words allowed
- Subhead: "Tile and metal restoration, leak repairs, Colorbond gutter replacement — across Ballarat and the Central Highlands. Family-operated. Same..."
- Trust: "20+ years · 5★ Google · Owner-operated"
- CTA primary: "Request a Quote" · secondary: "Call 0400 058 842"

✅ **GOOD · `[example: roofing niche]` vicwest (T3 78)**:
- H1: "A Ballarat roof, done properly — and signed off in writing."
- 10 words exact · file-clerk register (planned-upgrade voice)
- Subhead: "VBA-licensed roofers covering Colorbond replacements, terracotta restorations, gutters and storm repairs across Ballarat since 2003." (17 words ✓)
- Trust: "VBA-licensed · CDB-U 65938 · 22+ years"

❌ **BAD · `[example: roofing niche]` default V0 (T3 35)**:
- H1: "Vicwest Roofing — Trusted Ballarat Roofers" — generic · trust-word abuse · zero specificity
- Subhead: "Quality roofing services with over 20 years experience" — "quality" forbidden · "over" hedging

---

## Sections 2-11 · stub format (per Codex R10/R14 architecture-first · no conversion-tuning prose)

Each stub: id · 1-line purpose · 3-5 hard rules · audit IDs · top-1 anti-pattern. Owner pointers · NOT inline definitions. Deepen ONLY when audit reveals segment-specific failure during Step 5 stress-test.

### Section 2 · `trust-bar`

- **Purpose**: stack credibility chips (years · rating+count · license · ABN · warranty) immediately after hero · before visitor scrolls past
- **R-TB-1** · 3-6 chips · each ≤5 words (D-H-2 ratio applies to chip text)
- **R-TB-2** · Chip mix MUST include ≥3 of: license# · years · rating · ABN · warranty years · suburb count
- **R-TB-3** · `primary_segment = commercial-maintenance` → ABN chip MUST be present (LBP-1 + persona deterministic gate)
- **R-TB-4** · LBP-3 hours of operation (visible OR linked to GBP) · openingHoursSpecification JSON-LD
- **R-TB-5** · LBP-11 supplier logo wall `present_or_absent` (3-6 logos when applicable per niche · NOT fabricated)
- **Audit IDs**: `mech-TB-1..5` (rubric TODO Step 3) · `vis-TB-1` chip visual clutter · `vis-TB-2` chip specificity vs generic
- **Top anti-pattern**: AS-trade-7 "competitive prices" leaking into trust chip · forbidden
- **Owner**: SOP §15 LBP-3 + LBP-11 · niche-vocab license_signals + trust_proof

### Section 3 · `service-list`

- **Purpose**: visitor scans 4-8 services to confirm "they do what I need"
- **R-SL-1** · 4-8 service tiles · each ≤15 words description
- **R-SL-2** · Service names from `{{niche.services}}` taxonomy · NOT generic ("Repair · Replace · Restore")
- **R-SL-3** · `primary_segment = commercial-maintenance` → ≥1 service tile labelled commercial/strata/body-corporate
- **R-SL-4** · Service tile image authentic trade context (LBP-12 · no lifestyle stock · no guy-with-bucket AS-trade-4)
- **R-SL-5** · NO "we do everything" / "all your X needs" vague claims (forbidden phrase set · pl-au-trade-voice)
- **Audit IDs**: `mech-SL-1..5` · `vis-SL-1` photo authenticity · `vis-SL-2` taxonomy specificity
- **Top anti-pattern**: AS-trade-4 dramatic lifestyle stock photo (guy-with-bucket caught-leak shot)
- **Owner**: niche-vocab `services` field + niche-vocab `local_modifiers`

### Section 4 · `about-story`

- **Purpose**: humanise the contractor · build owner-trade-craft trust before scrolling to reviews
- **R-AS-1** · 90-150 words · owner name + year founded specific (LBP-7 + LBP-8 · `present_or_absent`)
- **R-AS-2** · Owner photo `present_or_absent` · NOT stock face · NOT AI-generated
- **R-AS-3** · `primary_segment = planned-upgrade` → mention warranty years + workmanship explanation
- **R-AS-4** · NO "we pride ourselves" / "we have a passion for" (forbidden · pl-au-trade-voice)
- **R-AS-5** · `primary_segment = commercial-maintenance` → mention commercial / property-manager / strata experience explicitly
- **Audit IDs**: `mech-AS-1..5` · `vis-AS-1` owner-photo authenticity
- **Top anti-pattern**: AS-trade-6 "Operated by [parent company]" subtitle leak
- **Owner**: persona `trust_levers_top_3` · niche-vocab `trust_proof`

### Section 5 · `reviews` (conditional · SOP §11 banner protocol)

- **Purpose**: social proof · third-party validation · segment-tuned review selection
- **R-RV-1** · 3-5 reviews · each with attribution (name + suburb + service + date · LBP-10 + LBP-13)
- **R-RV-2** · ≥1 review mentions location (suburb)
- **R-RV-3** · ≥1 review mentions specific service from `{{niche.services}}`
- **R-RV-4** · If `entity.review_count < 5` AND fallback enabled (preview mode): AI-placeholder reviews allowed BUT must carry PREVIEW badge + provenance `_provenance: "AI_PLACEHOLDER"` + NEVER in JSON-LD/Google review schema (SOP §11 + Codex Q-F-5-rev)
- **R-RV-5** · AI-placeholder reviews must pass `pl-au-trade-voice` (AU spelling · trade vocab) + ≥1 mild critique (3/3 perfect = AI-default tell · banned)
- **Audit IDs**: `mech-RV-1..5` · `vis-RV-1` review authenticity feel
- **Top anti-pattern**: AS-trade-X review-without-date / review-without-suburb (failed LBP-10 + LBP-13)
- **Owner**: SOP §11 banner protocol · LBP-10 + LBP-13 · persona forbidden_signals

### Section 6 · `before-after` (conditional · SOP §11 banner)

- **Purpose**: visual transformation proof · planned-upgrade primary's strongest persuasion
- **R-BA-1** · ≥1 real pair (before + after of same property)
- **R-BA-2** · Caption includes suburb + service-type + completion date
- **R-BA-3** · Stock library fallback allowed in preview mode WITH PREVIEW badge ("Stock photography · representative imagery")
- **R-BA-4** · `primary_segment = planned-upgrade` → ≥2 pairs strongly preferred (T5 weight 25%)
- **R-BA-5** · NO AI-generated before/after composites · fabrication ban
- **Audit IDs**: `mech-BA-1..3` (pair count + caption fields) · `vis-BA-1` photo authenticity
- **Top anti-pattern**: AS-trade-4 lifestyle stock vs real trade photo
- **Owner**: LBP-12 real trade photo · LBP-13 date · SOP §11 banner

### Section 7 · `service-area`

- **Purpose**: visitor confirms "they cover my suburb" · local SEO authority
- **R-SA-1** · ≥8 suburb chips listed (SOP §4.3 hard rule)
- **R-SA-2** · `service_radius_km` OR map embed (LBP-2 + LBP-9 · `present_or_absent` for radius)
- **R-SA-3** · NO "all of <state>" / "anywhere in <city>" vague claims (forbidden)
- **R-SA-4** · LBP-2 Google Maps embed in this section OR footer (one of two acceptable locations)
- **R-SA-5** · If brief has empty `suburbs_covered[]` → hard FAIL · don't render section (cannot fabricate suburbs per Codex Q-Y-3)
- **Audit IDs**: `mech-SA-1..3` (chip count · radius_or_map presence · no-fabrication) · `vis-SA-1` map quality
- **Top anti-pattern**: AS-trade-X "all of VIC" / "anywhere in Brisbane" generic claim
- **Owner**: LBP-2 + LBP-9 · brief schema hard gate · niche-vocab `local_modifiers`

### Section 8 · `process`

- **Purpose**: reduce buyer anxiety by exposing 3-4 step workflow · address objection "what happens when I call"
- **R-PR-1** · 3-4 steps · each ≤12 words
- **R-PR-2** · ≥1 step mentions trade-specific action from `{{niche.local_modifiers}}` (NOT generic "consultation")
- **R-PR-3** · `primary_segment = urgent-repair` → process tone emphasises speed (e.g. "we arrive within 4 hours")
- **R-PR-4** · `primary_segment = guided-first-time-buyer` → process tone emphasises education (e.g. "we explain everything before quoting")
- **R-PR-5** · NO generic step language ("Step 1: Get in Touch" · forbidden CTA leak)
- **Audit IDs**: `mech-PR-1..4` · `vis-PR-1` step concreteness
- **Top anti-pattern**: generic "Step 1 / 2 / 3 / 4" labels with no trade-specific content
- **Owner**: persona `decision_triggers` · niche-vocab `local_modifiers`

### Section 9 · `faq`

- **Purpose**: pre-empt buyer objections · segment-tuned Q+A · last-mile trust before CTA-band
- **R-FAQ-1** · 4-6 questions · each answer ≤40 words
- **R-FAQ-2** · ≥1 Q addresses cost · ≥1 addresses timeline · ≥1 addresses warranty
- **R-FAQ-3** · `primary_segment` Qs drawn from persona `risk_concerns` (urgent → "what if it rains again before you arrive?" · planned → "transferable warranty when I sell?")
- **R-FAQ-4** · NO "Q: Why choose us? A: Because we're the best" self-praise pattern
- **R-FAQ-5** · FAQPage JSON-LD MUST include all Q+A (T4.6 ai-geo check)
- **Audit IDs**: `mech-FAQ-1..3` (count · length · JSON-LD presence) · `vis-FAQ-1` Q+A specificity
- **Top anti-pattern**: AS-trade-X self-praise / leading question pattern
- **Owner**: persona `risk_concerns` · niche-vocab `objections` · T4.6 schema

### Section 10 · `cta-band`

- **Purpose**: last-section conversion push · primary CTA + secondary phone CTA · "no obligation" friction-reduce
- **R-CTA-1** · Primary CTA text `[Verb] + [What They Get]` formula (same as hero · C-H-4 banned list applies)
- **R-CTA-2** · Secondary phone CTA visible as digits + `tel:` link
- **R-CTA-3** · "No obligation" or "Free quote" callout in copy (SOP §4.4 · required when `pricing_disclosure_mode ≠ hidden`)
- **R-CTA-4** · `primary_segment = guided-first-time-buyer` → "free site inspection" or "no surprise costs" copy
- **R-CTA-5** · `primary_segment = commercial-maintenance` → secondary "send PO / job sheet" pathway · email visible
- **Audit IDs**: `mech-CTA-1..5` · `vis-CTA-1` CTA hierarchy · `vis-CTA-2` friction-reduce copy presence
- **Top anti-pattern**: AS-trade-8 "Contact Us" / "Get in Touch" as primary CTA
- **Owner**: SOP §4.4 + persona `decision_triggers`

### Section 11 · `footer`

- **Purpose**: NAP repeat · legal/compliance stack · GBP-website hours consistency · last-fold trust
- **R-FT-1** · NAP consistency with header (business_name · phone · address verbatim · LBP-1 T1)
- **R-FT-2** · ABN visible (T1.4 zero-tolerance · pre-existing rule)
- **R-FT-3** · State license# + authority visible (T1.5 zero-tolerance)
- **R-FT-4** · Insurance disclosure visible (LBP-4 · "public liability $X")
- **R-FT-5** · Hours of operation visible + matches GBP openingHoursSpecification JSON-LD (LBP-3 + LBP-14)
- **R-FT-6** · Suburb list (full · vs §7 chips which may be condensed)
- **R-FT-7** · Privacy + terms links present
- **Audit IDs**: `mech-FT-1..7` (deterministic regex checks) · existing T1.1-T1.9 already cover most
- **Top anti-pattern**: ABN-missing-in-footer (real failure in Phase 3 vicwest spike · composite drop)
- **Owner**: SOP T1 + LBP-1 · LBP-3 · LBP-4 · LBP-14

### Overlay · `sticky-mobile-bar`

- **Purpose**: persistent contact path on mobile · appears after 200vh scroll
- **R-SMB-1** · 2 buttons side-by-side (phone + quote-form) · each tap target ≥44px
- **R-SMB-2** · Reveal condition: `window.scrollY > 200` (CSS-only OR minimal JS)
- **R-SMB-3** · `primary_segment = urgent-repair` → label "Call now" · OTHERS → neutral "Call <business>" (per Codex Q-P-5 hierarchy-controlled)
- **R-SMB-4** · Mobile-only (max-width 720px) · NEVER on desktop
- **R-SMB-5** · `safe-area-inset-bottom` honored (notch devices)
- **Audit IDs**: `mech-SMB-1..5` · `vis-SMB-1` mobile-only enforcement
- **Top anti-pattern**: sticky-bar urgent-label on planned-upgrade primary (segment mismatch · violates §14 hierarchy)
- **Owner**: SOP §14 mixed-segment hierarchy · persona `secondary_representation.mobile_sticky`

---

## Renderer integration (renderer-agnostic)

Any renderer producing HTML must:

1. Read brand-tokens.css from `clients/<slug>/v2/handoff/od-package/brand/` (build snapshot · NOT authoring source · per Codex Q-A-1)
2. Render mandatory sections in canonical order (§2 sequence) · skip conditional sections cleanly when data thin (no fallback unless preview mode + banner)
3. Inject `primary_segment` voice modifiers from persona file
4. Pass `pl-audit-rubric` T5 deterministic gates BEFORE shipping
5. Honor `present_or_absent` · NEVER fabricate to fill blanks

Compatible renderers (any of):
- `pl:compose-site --single-page` (modules library · requires module audit per Codex spike result · TODO module-fix)
- `pl-llm-page-copywriter-site` (LLM-gen · loads voice + vocab + slop into prompt)
- Hand-write (Phase 3 brand-grid-experiment proved possible · slow · benchmark only)
- Hybrid (LLM-gen sections + module fallback)

---

## TODO Step 3 markers (per Codex Round 14 Q-W-5)

These references point to skills that don't exist yet. `skill:build` JSON output must preserve them as TODO links · NOT pretend implementation exists:

- `pl-au-trade-voice` (voice modifiers · owner-voice patterns · forbidden phrase blacklist · niche tone variants)
- `pl-trade-vocab-roofing` (niche interface contract 8-field implementation · roofing-specific services/objections/local_modifiers/etc.)
- `pl-anti-slop-catalog` (full AS-trade-1..8 + AI-default visual pattern detection prompts)
- `pl-audit-rubric` (T-numbered rule registry · mech-X-N → T1.X · vis-X-N → T3/T5 mapping)
- `core/handoff/single-page-brief-schema.js` (Step 4 · brief validator · primary_segment + secondary_segments + pricing_disclosure_mode + emergency_response_sla_hours)
- `core/eval/content-validator.js` extensions (`cta_not_banned` · `subhead_punctuation_max` · `specific_number_present`)

---

## Build artifact (Step 2 · skills:build)

Per Codex Round 8 R3: this SKILL.md is the human-authored canonical source. The build script `skills:build` extracts a JSON artifact at `skills/pl-local-trade-page-spec/pl-local-trade-page-spec.json` for runtime consumers:
- `pl:compose-site` reads sections + section requirements + audit IDs
- `pl-validate-single-page-brief` reads brief schema fields from §6 reference
- `pl-audit-rubric` reads rule IDs + thresholds

JSON schema (per Codex R10 canonical shape):
```json
{
  "name": "pl-local-trade-page-spec",
  "version": "1.0.0",
  "kind": "page_spec",
  "contract": { "inputs_required": [...], "outputs_expected": [...], "runtime_consumers": [...] },
  "constants": { "total_words_min": 1000, "total_words_max": 1400, "hero_h1_max_words": 10, ... },
  "rules": [{ "id": "R-AUD-1", "severity": "hard", "description": "...", "enforced_by": [...] }, ...],
  "sections": [{ "id": "hero", "name": "Hero", "purpose": "...", "hard_rules": ["D-H-1", "C-H-1", ...], "anti_patterns": ["AS-trade-1", "AS-trade-2", "AS-trade-7"], "audit_check_ids": ["mech-H-1", "vis-H-1", ...] }, ...],
  "anti_patterns": [{ "id": "AS-trade-1", "summary": "...", "catalog_pointer": "pl-anti-slop-catalog" /* TODO Step 3 */ }, ...]
}
```

`skills:build` is `TODO Step 2` (next step).

---

## Validation plan (Step 5 · architecture stress-test against vicwest)

After Steps 1-4 land · run vicwest through:
1. Brief-validator (Step 4) · primary_segment must be set (vicwest = planned-upgrade per Codex Q-Z-1)
2. Render (`pl:compose-site --single-page` OR hand path)
3. `pl-audit-rubric` (Step 3) · T1 + T2 deterministic + T5 deterministic gates
4. Vision LLM tier (T3 + T5 vision · later phase)
5. Output: gap report identifying where v1.0 spec missed real-world failure modes

Phase A done = vicwest produces a gap report against this spec · NOT vicwest scores ≥73 (per Codex Q-X-4 (a)).

---

## Open questions (housekeeping · resolved during Step 1)

All 6 Codex Round 4 open questions ANSWERED:
- Q-F-1 section depth tiered (hero deep · 2-11 stub) ✓
- Q-F-2 anti-pattern citation hybrid (inline top-3 + catalog ID) ✓
- Q-F-3 examples inline with `[example: roofing niche]` annotation ✓
- Q-F-4 audit ID namespace `mech-X-N` / `vis-X-N` · rubric maps to T-numbers ✓
- Q-F-5 conditional sections fallback-with-banner (Codex Q-F-5-rev) ✓
- Q-F-6 word budget audited at both pre-compose (brief schema) + compose-time (HTML parse) ✓

All 14 rounds of Codex consensus integrated.
