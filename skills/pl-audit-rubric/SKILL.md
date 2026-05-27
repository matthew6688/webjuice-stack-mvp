---
name: pl-audit-rubric
description: Pointer rubric — 60-80 rule ID → CLI + module + threshold lookup table for ProfitsLocal single-page audit. Maps page-spec rule IDs (R-* / D-H-* / C-H-* / R-XX-* · audit IDs mech-X-N / vis-X-N) to T1-T5 framework checks in core/audit/*.js + pl-audit-tier/pl-audit-v4 CLIs. Includes inline §Anti-slop catalog (AS-trade-1..8 detection prompts · per codex R9 D3 collapse). Composes ship gate formula. Does NOT re-implement audit logic — owners are CLIs + core/audit/* modules.
metadata:
  version: 1.0.0
---

# ProfitsLocal · Audit Rubric (Pointer Index)

> **Rule of source**: page-spec defines structure · voice defines tone · personas define WHO · this rubric is the **lookup table**. Each row points to the canonical owner (CLI + module). We do NOT re-implement audit logic here.

This is a readable contract and rule index. Audit execution lives in `scripts/cli/pl-audit-tier.js` (T1-T4 composite) and `scripts/cli/pl-audit-v4.js` (T1+T2 brand contract · T3-T5 stubs). Rule definitions live in upstream owners: `pl-local-trade-page-spec` (structure rules · ~80) · `pl-au-trade-voice` (voice rules AV-1..6) · `core/audit/personas/*.js` (per-segment deterministic checks) · `docs/v3/SOP-AUDIT-STANDARD.md` (T1-T4 framework) · `docs/v3/SOP-SINGLE-PAGE-LOCAL-TRADE-STANDARD.md` (T5 + LBP-1..14 + AS-trade-1..8).

---

## §1 · Purpose & scope

The rubric answers ONE question per rule: **"which CLI runs it · which module implements it · what threshold passes."**

| Owner layer | File | This rubric's role |
|---|---|---|
| T1-T4 framework | `docs/v3/SOP-AUDIT-STANDARD.md` v3 | reference only · don't restate dimensions |
| Single-page T5 + LBP + AS-trade | `docs/v3/SOP-SINGLE-PAGE-LOCAL-TRADE-STANDARD.md` v2.0 | reference only · index rule IDs |
| Page-spec rule IDs (R-* / D-H-* / C-H-* / R-XX-*) | `skills/pl-local-trade-page-spec/SKILL.md` v1.0 | lookup column in §3-§7 tables |
| Voice rule IDs (AV-1..6) | `skills/pl-au-trade-voice/SKILL.md` v1.0 | lookup column in §4 |
| Per-segment deterministic checks | `core/audit/personas/{urgent-repair,planned-upgrade,commercial-maintenance,guided-first-time-buyer}.js` | source of T5 §7.1 gates |
| T1-T4 composite scorer | `scripts/cli/pl-audit-tier.js` v3 (733 lines) | enforced_by_cli column |
| Brand-contract diagnostic | `scripts/cli/pl-audit-v4.js` v0.1 (EXPERIMENTAL · T1+T2 wired · T3/T4/T5 stubs) | enforced_by_cli column |
| Audit modules | `core/audit/*.js` (15+ modules) | enforced_by_module column |

This skill is documentation-only. Zero new audit logic.

---

## §2 · Composite & ship gate formula

Per SOP-AUDIT-STANDARD §5 + SOP-SINGLE-PAGE §13.2:

```
ship_ok = (T1 == PASS)
       && (composite_T2T3T4 >= 73)
       && (T5_primary_segment >= 75)
       && (all declared T5_secondary_segments >= 50)

composite_T2T3T4 = round( 0.35 * T2 + 0.35 * T3 + 0.30 * T4 )
```

- **T1** · Factual / Brand consistency · PASS/FAIL (any single fail → page blocked regardless of T2-T5)
- **T2** · Copy Depth & Brand Contract · 0-100 · target ≥70
- **T3** · Visual Design · 0-100 · target ≥75
- **T4** · Tech / SEO / Performance · 0-100 · target ≥70
- **T5** · Per-Segment Serviceability · NEW · primary_segment ≥75 + each secondary ≥50

Fix loop (max 3 iterations per `feedback_audit_feedback_loop.md`) tunes ±5-10pt. Larger gaps = upstream fix (§10).

---

## §3 · Tier 1 · Factual / Brand · PASS/FAIL

| T-id | Description (1-line · from SOP §1) | enforced_by_cli | enforced_by_module | page-spec / voice IDs |
|---|---|---|---|---|
| T1.1 | NAP consistency (name · address · phone match across page + GBP + schema) | `pl-audit-tier` | `core/audit/trust-signals/generic.js` · `multi-page-crawl.js` | R-AUD-1 · LBP-1 |
| T1.2 | Phone format AU + clickable tel: links | `pl-audit-tier` | `core/audit/form-audit.js` | LBP-2 · R-UNI-1 |
| T1.3 | License authority matches state (no cross-state) | `pl-audit-tier` | `core/audit/trust-signals/roofing-au.js` (niche-overlay) | AV-5 · R-AUD-2 |
| T1.4 | ABN format (11-digit · spaces optional) | `pl-audit-tier` | `core/audit/trust-signals/generic.js` | AV-5 · LBP-3 |
| T1.5 | Cross-state license mention = zero-tolerance | `pl-audit-tier` | `core/audit/trust-signals/<niche>.js` | AV-5 |
| T1.6 | Hero H1 ≤10 words (≤11 if owner-voice exception fires) | `pl-audit-tier` · `pl-audit-v4` | `core/audit/content-validator.js` (TODO 3.3) | D-H-1 · AV-2 · `mech-H-1` |
| T1.7 | Primary CTA ≤5 words | `pl-audit-tier` | `core/audit/content-validator.js` | C-H-1 · `mech-H-3` |
| T1.8 | Suburb-chip count ≥8 + matches areaServed schema | `pl-audit-tier` | `core/audit/multi-page-crawl.js` | R-SA-1..3 · LBP-4 |
| T1.9 | Forbidden legal claims absent ("lifetime guarantee" etc.) | `pl-audit-tier` | `core/audit/content-validator.js` | AV-6 · R-AUD-4 |

T1 owner: `docs/v3/SOP-AUDIT-STANDARD.md §1` · DO NOT restate dimensions here. **TODO 3.3** · content-validator forbidden-phrase extension wires to `pl-au-trade-voice`.

---

## §4 · Tier 2 · Copy Depth & Brand Contract · 0-100 · ≥70 pass

| Dim ID | Weight | Description | enforced_by_cli | enforced_by_module | page-spec / voice IDs |
|---|---|---|---|---|---|
| D2.1 | 10 | Total word count 1000-1400 | `pl-audit-tier` | `core/audit/content-validator.js` | R-UNI-2 |
| D2.2 | 10 | Paragraph ≤4 sentences · sentence ≤24 words | `pl-audit-tier` | `core/audit/content-validator.js` | R-UNI-2 |
| D2.3 | 10 | Hero subhead 14-25 words + specific outcome | `pl-audit-tier` | `core/audit/content-validator.js` | D-H-2 · `mech-H-2` |
| D2.4 | 10 | Trust-bar 5 chips with specific proof (not vague) | `pl-audit-tier` | `core/audit/trust-signals/<niche>.js` | R-TB-1..5 |
| D2.5 | 10 | Service-list 6-10 items · ≤15 word descriptions · active verb | `pl-audit-tier` | `core/audit/content-validator.js` | R-SL-1..5 |
| D2.6 | 10 | About-story has founding year + specific person + place | `pl-audit-tier` | `core/audit/content-validator.js` | R-AS-1..5 |
| D2.7 | 10 | Reviews ≥3 with reviewer first name + suburb + date | `pl-audit-tier` | `core/audit/content-validator.js` | R-RV-1..5 |
| D2.8 | 10 | FAQ 5-8 entries · pre-empts top objections | `pl-audit-tier` | `core/audit/content-validator.js` | R-FAQ-1..5 |
| D2.9 | 10 | Footer NAP + license + ABN + insurance + hours visible | `pl-audit-tier` | `core/audit/trust-signals/generic.js` | R-FT-1..7 · LBP-5..7 |
| D2.S1 | +5 | Banned genericisms absent (~69 phrases) | `pl-audit-tier` · `pl-audit-v4` | `core/audit/content-validator.js` (FORBIDDEN_PHRASES) | AV-4 · AS-trade-1..8 |
| D2.S2 | +5 | AU spelling strict (colour/centre/realise) | `pl-audit-tier` | `core/audit/content-validator.js` (au_spelling · TODO 3.3) | AV-1 |
| D2.S3 | +5 | No-obligation pattern present (not SaaS "free trial") | `pl-audit-tier` | `core/audit/content-validator.js` | C-H-5 · R-CTA-3 |
| D2.S4 | +5 | Per-segment voice match (urgent/planned/commercial/first-buyer) | `pl-audit-v4` (TODO Phase A.2 LLM) | `core/audit/personas/*.js` voice_modifiers | AV-3 · `vis-H-2` |
| D2.BC1 | +5 | Brand contract: tone consistent with brand-tokens.css | `pl-audit-v4` | `core/audit/brand-contract.js` (stub) | TODO Phase A.2 |
| D2.BC2 | +5 | Brand contract: color/typography references match library | `pl-audit-v4` | `core/audit/brand-contract.js` (stub) | TODO Phase A.2 |

T2 owner: `docs/v3/SOP-AUDIT-STANDARD.md §2` + `docs/v3/SOP-SINGLE-PAGE-LOCAL-TRADE-STANDARD.md §7`. **TODO Phase A.2** · D2.S4 / D2.BC1-2 await LLM tier wiring in `pl-audit-v4`.

---

## §5 · Tier 3 · Visual Design · 0-100 · ≥75 pass

| Dim ID | Weight | Description | enforced_by_cli | enforced_by_module | page-spec audit IDs |
|---|---|---|---|---|---|
| D3.1 | 15 | Hero composition: H1 + subhead + CTA + trust hierarchy clean | `pl-audit-vision` (TODO Phase A.2) | `core/audit/image-optimization.js` · vision LLM | `vis-H-1` · D-H-3 |
| D3.2 | 10 | Hero photo: real trade work · not stock · faces visible | `pl-audit-vision` (TODO) | vision LLM | `vis-H-3` · D-H-4 |
| D3.3 | 10 | Typography scale: clear h1/h2/h3 + body legible | `pl-audit-vision` (TODO) | vision LLM | `vis-H-4` · `mech-H-5` |
| D3.4 | 10 | Color contrast WCAG AA · brand-token palette respected | `pl-audit-tier` · `pl-audit-vision` | `core/audit/image-optimization.js` | `mech-H-6` |
| D3.5 | 10 | Spacing rhythm · vertical baseline consistent | `pl-audit-vision` (TODO) | vision LLM | `vis-H-5` · `mech-H-7` |
| D3.6 | 10 | Section transitions clear · no wall-of-text | `pl-audit-vision` (TODO) | vision LLM | `mech-H-8` |
| D3.7 | 10 | Trust-bar visual weight matches importance (above-fold dense) | `pl-audit-vision` (TODO) | vision LLM | R-TB-3 |
| D3.8 | 10 | Mobile rendering: phone-first · CTA thumb-reachable | `pl-audit-tier` | `core/audit/pagespeed-insights.js` | LBP-8 |
| D3.9 | 15 | Anti-slop visual: no AI-default patterns (see §8) | `pl-audit-vision` (TODO) | vision LLM | AS-trade-1..8 |

T3 owner: `docs/v3/SOP-AUDIT-STANDARD.md §3`. **TODO Phase A.2** · vision LLM dispatcher pending · `pl-audit-vision` CLI to be built.

---

## §6 · Tier 4 · Tech / SEO / Performance · 0-100 · ≥70 pass

| Dim ID | Weight | Description | enforced_by_cli | enforced_by_module | page-spec / LBP IDs |
|---|---|---|---|---|---|
| D4.1 | 20 | PageSpeed mobile ≥85 · LCP <2.5s · CLS <0.1 | `pl-audit-tier` | `core/audit/pagespeed-insights.js` | LBP-9 |
| D4.2 | 15 | Schema JSON-LD valid · LocalBusiness subtype matches niche | `pl-audit-tier` | `core/audit/ai-geo-checks.js` | LBP-10 · R-SMB-1..5 |
| D4.3 | 15 | Sitemap + robots + meta tags clean | `pl-audit-tier` | `core/audit/sitemap-analyzer.js` | LBP-11 |
| D4.4 | 15 | Image optimization: AVIF/WebP + alt text + lazy-load | `pl-audit-tier` | `core/audit/image-optimization.js` | LBP-12 |
| D4.5 | 10 | Third-party weight ≤30% of total bytes | `pl-audit-tier` | `core/audit/third-party-weight.js` | LBP-13 |
| D4.6 | 15 | GBP-website consistency (hours/phone/address/category) | `pl-audit-tier` | `core/audit/multi-page-crawl.js` | LBP-14 |
| D4.7 | 10 | Tech stack appropriate (no React for static · CSP headers) | `pl-audit-tier` | `core/audit/tech-stack-detector.js` | LBP-13 |

T4 owner: `docs/v3/SOP-AUDIT-STANDARD.md §4`. LBP-1..14 owner: `docs/v3/SOP-SINGLE-PAGE-LOCAL-TRADE-STANDARD.md §15`.

---

## §7 · Tier 5 · Per-Segment Serviceability · NEW · primary ≥75 + secondaries ≥50

Owner: `docs/v3/SOP-SINGLE-PAGE-LOCAL-TRADE-STANDARD.md §13`. Hybrid: deterministic gates (§7.1) + vision LLM scoring (§7.2).

### §7.1 · Deterministic gates (per-segment)

Each persona file `core/audit/personas/<segment>.js` defines `critical_signals_5_second.deterministic_check` regex/DOM probe. Rubric mirrors:

| primary_segment | Gate spec | enforced_by | Source field |
|---|---|---|---|
| `urgent-repair` | Hero shows response SLA (hours · same-day / 2hr / 4hr) + storm/leak verb in H1 | DOM regex · `core/audit/personas/urgent-repair.js` | `critical_signals_5_second.deterministic_check` |
| `planned-upgrade` | Hero shows warranty years (10/15/20/25) + craft/material specificity (Colorbond/heritage) | DOM regex · `core/audit/personas/planned-upgrade.js` | `critical_signals_5_second.deterministic_check` |
| `commercial-maintenance` | Hero shows ABN + public liability $ amount + B2B language (procurement/NET-30/strata) | DOM regex · `core/audit/personas/commercial-maintenance.js` | `critical_signals_5_second.deterministic_check` |
| `guided-first-time-buyer` | Hero shows "free inspection" + indicative price band + plain-English explanation | DOM regex · `core/audit/personas/guided-first-time-buyer.js` | `critical_signals_5_second.deterministic_check` |

Deterministic gate fail = T5 primary score capped at 60 (regardless of vision LLM).

### §7.2 · Vision LLM scoring (per-segment)

Each persona file exposes `secondary_representation` LLM prompt template. Rubric defines composite:

```
T5_composite = 0.50 * primary_segment_score
            + 0.15 * each_declared_secondary_segment_score  (×N secondaries)
            + 0.05 * each_unrepresented_segment_penalty_floor

Per-segment LLM prompt (delegated to persona file):
  "Looking at the hero only · does a [SEGMENT_PERSONA_NAME] see what they need
   in 5 seconds? Score 0-100. Reference: persona.critical_signals_5_second.
   List 3 specific reasons + 3 specific fixes."
```

- **enforced_by_cli** · `pl-audit-vision` (TODO Phase A.2 · not yet built)
- **enforced_by_module** · `core/audit/personas/*.js` (prompt templates already present)
- **threshold** · primary ≥75 · each declared secondary ≥50 · unrepresented contributes 5% floor

**TODO Phase A.2** · `pl-audit-vision` CLI dispatcher pending. Until built · T5 returns deterministic-only (caps + warnings).

---

## §8 · Anti-slop catalog (AS-trade-1..8 inline · codex R9 D3 collapse · R15 Q-X-2 confirm)

Source: `docs/v3/SOP-SINGLE-PAGE-LOCAL-TRADE-STANDARD.md §16`. Inline here per codex R9 D3 (not a separate skill). Each pattern has vision LLM prompt + grep regex for dispatch by `pl-audit-vision` / `pl-audit-tier`.

| ID | Pattern | Visual signature | Detection method | Severity | Replace with |
|---|---|---|---|---|---|
| **AS-trade-1** | Generic stock-hero (cleaning-supply-shelf · suited handshake · pixel-perfect house) | Stock photo · no real trade work · no faces · staged perfect | Vision LLM: "Is this a real trade work-site photo or stock?" | P0 hard fail | Real on-job photo · crew visible · actual job site |
| **AS-trade-2** | "Solutions" / "Services" hero tile grid (4-up generic cards) | 4-column icon+title+blurb grid · interchangeable across niches | Grep: `/(solutions\|services)\s*[\|·]\s*(solutions\|services)/i` in nav/hero · Vision: "Could this hero work for any trade?" | P1 deduction | Specific service taxonomy · niche material names · before/after thumb |
| **AS-trade-3** | Niche cliché tagline ("above your head specialists" · "we go the extra mile") | Cliché in H1/subhead · puffery · no proof | Grep regex from `pl-au-trade-voice §1.5` banned list | P0 hard fail | Specific number / year / outcome (e.g. "22 years · 84 Ballarat roofs · 4.7★") |
| **AS-trade-4** | Carousel hero (auto-rotating slides) | First-render shows carousel dots · slide transitions · multiple H1s | DOM: `[class*="carousel"], [class*="slider"]` in hero · Vision: "Does hero use auto-rotating slides?" | P1 deduction | Static single-hero · one H1 · one CTA · no auto-motion |
| **AS-trade-5** | Decorative-only "trust" badges (FB / Instagram logos as "trust") | Social-media logo strip masquerading as authority signals | Grep alt-text: facebook/instagram/twitter logos in trust-bar position · Vision: "Are trust badges actually authority signals?" | P1 deduction | License # · ABN · insurance $ · industry body (HIA/MBA) · review-star count |
| **AS-trade-6** | "Why choose us" 4-up generic value tiles ("Quality · Experience · Reliability · Service") | 4-column abstract noun grid · zero proof · interchangeable | Grep: `/(quality\|experience\|reliability\|service)\s*[\|·]/i` in section heading | P1 deduction | Specific guarantees with numbers (warranty years · response SLA · review count · founding year) |
| **AS-trade-7** | "Competitive pricing" / "Affordable rates" without anchor | Pricing claim with no $ band · no indication of cost | Grep: `/(competitive\|affordable\|best)\s+(pricing\|prices\|rates)/i` | P1 deduction | Indicative price band (e.g. "Restoration $4-12k") · or "Free written quote · no surprises" |
| **AS-trade-8** | AI-generated stock illustration (vector tradies · cartoon icons in hero) | Flat vector illustration · cartoon characters · no real photography | Vision LLM: "Is this hero illustration cartoon/vector or real photo?" | P0 hard fail | Real photography · same crew visible across page · no vector mascots |

Severity legend:
- **P0 hard fail** · contributes to T1 fail (page blocked regardless of composite)
- **P1 deduction** · -8 to -15 from T2 or T3 score
- **P2 warning** · logged but no score impact (e.g. minor pattern · context-dependent)

---

## §9 · Audit check ID → T-number alias table

Page-spec uses section-prefix IDs (`mech-H-1` · `vis-H-2` etc.). Rubric maps to T-numbered scheme for SOP cross-reference.

| Page-spec ID | T-number alias | What it checks |
|---|---|---|
| `mech-H-1` | T1.6 | Hero H1 word count |
| `mech-H-2` | D2.3 | Hero subhead word count + outcome specificity |
| `mech-H-3` | T1.7 | Primary CTA word count |
| `mech-H-5` | D3.3 | Typography scale (mechanical: h1 font-size > h2 > h3) |
| `mech-H-6` | D3.4 | Color contrast WCAG (mechanical computed) |
| `mech-H-7` | D3.5 | Spacing rhythm (mechanical: margin/padding consistency) |
| `mech-H-8` | D3.6 | Section transitions (mechanical: detectable section breaks) |
| `vis-H-1` | D3.1 | Hero composition (vision LLM) |
| `vis-H-2` | D2.S4 | Per-segment voice match (vision LLM) |
| `vis-H-3` | D3.2 | Hero photo authenticity (vision LLM) |
| `vis-H-4` | D3.3 | Typography subjective quality (vision LLM · supplements mechanical) |
| `vis-H-5` | D3.5 | Spacing rhythm subjective (vision LLM · supplements mechanical) |
| `mech-TB-1..5` | D2.4 | Trust-bar mechanical (5 chips · phone-clickable · etc.) |
| `mech-FT-1..7` | D2.9 | Footer mechanical (NAP visible · license # · ABN · etc.) |
| `mech-SMB-1..5` | D4.2 | Schema JSON-LD mechanical |

Bi-directional: any T-number can be looked up back to its page-spec audit IDs via this table.

---

## §10 · Failure mode → upstream fix table

When the rubric scores below threshold · the FIX lives upstream · not in the rubric itself.

| Tier failed | Symptom | Upstream fix layer | File / skill to edit |
|---|---|---|---|
| T1 | Wrong phone / ABN / license # / NAP mismatch | Data layer | `clients/<slug>/v2/handoff/facts.json` · `enrich-handoff/*` · `llm-extract-core.js` |
| T2 (copy) | Word count off · banned phrases · weak hero | Brief or voice skill | `clients/<slug>/v2/handoff/single-page-brief.json` · `skills/pl-au-trade-voice/SKILL.md` §1.5 |
| T2 (brand contract D2.BC*) | Tone drift from brand-tokens | Brand layer | `clients/<slug>/v2/handoff/od-package/brand/brand-tokens.css` · modules library |
| T3 | Visual design weak · AI-default look | DESIGN.md or LLM render prompt | `clients/<slug>/v2/handoff/od-package/DESIGN.md` · OD references library · render LLM system prompt |
| T4 | Schema invalid · PageSpeed low · GBP mismatch | Publish pipeline / templates | `core/handoff/build-handoff.js` schema templates · meta-tag templates · GBP sync |
| T5 (primary < 75) | Wrong primary_segment OR rendered surface doesn't serve it | Brief or renderer | `single-page-brief.json` primary_segment field · `pl-llm-page-copywriter-site` hero-variant per segment |
| T5 (secondary < 50) | Renderer didn't include surface for declared secondary | Renderer | `pl-llm-page-copywriter-site` secondary-segment surfaces (FAQ entry · service tile · review pull-quote per §14 mixed-segment hierarchy) |
| AS-trade-* P0 | AI-default stock/cliché/cartoon present | DESIGN.md OR data layer | Real photos in `facts.json.media[]` · DESIGN.md anti-slop guardrails · LLM negative-example list |

Fix loop max 3 iterations per `feedback_audit_feedback_loop.md`. Base fixes (DESIGN / brief / voice / personas) · not score-tuning · per `feedback_audit_4tier_standard.md`.

---

## §11 · Build artifact

`skills:build` (Step 2 · `scripts/cli/skills-build.js`) extracts the JSON below to `skills/pl-audit-rubric/pl-audit-rubric.json`. Codex R15 Q-X-5 (b): audit_rubric is its OWN extractor (not generic).

```json
{
  "name": "pl-audit-rubric",
  "version": "1.0.0",
  "kind": "audit_rubric",
  "contract": {
    "inputs_required": [
      "rendered page HTML (single-page · trade niche)",
      "clients/<slug>/v2/handoff/facts.json (for T1 comparison)",
      "clients/<slug>/v2/handoff/single-page-brief.json (primary + secondary segments)",
      "core/audit/personas/<segment>.js (T5 prompts + deterministic checks)"
    ],
    "outputs_expected": [
      "T1 PASS/FAIL with failing dim list",
      "T2/T3/T4 0-100 scores + composite",
      "T5 primary + secondary per-segment scores",
      "ship_ok boolean + failing rule IDs + upstream-fix pointers (§10)"
    ],
    "runtime_consumers": [
      "scripts/cli/pl-audit-tier.js (T1-T4 · current)",
      "scripts/cli/pl-audit-v4.js (T1+T2 brand contract · EXPERIMENTAL)",
      "scripts/cli/pl-audit-vision.js (T3 visual + T5 LLM · TODO Phase A.2)",
      "pl:iterate-site (fix-instructions builder · loops audit → OD → audit)"
    ]
  },
  "constants": {
    "ship_gate_t1": "PASS",
    "ship_gate_composite_min": 73,
    "ship_gate_t5_primary_min": 75,
    "ship_gate_t5_secondary_min": 50,
    "composite_formula": "round(0.35*T2 + 0.35*T3 + 0.30*T4)",
    "t5_composite_formula": "0.50*primary + 0.15*each_secondary + 0.05*unrepresented_floor",
    "fix_loop_max_iterations": 3,
    "p0_severity": "hard_fail_blocks_ship",
    "p1_severity": "deduction_8_to_15",
    "p2_severity": "warning_no_score_impact"
  },
  "rules": [
    { "id": "T1.1", "severity": "hard", "description": "NAP consistency across page + GBP + schema", "enforced_by": ["pl-audit-tier", "core/audit/trust-signals/generic.js", "core/audit/multi-page-crawl.js"] },
    { "id": "T1.2", "severity": "hard", "description": "Phone format AU + clickable tel: links", "enforced_by": ["pl-audit-tier", "core/audit/form-audit.js"] },
    { "id": "T1.3", "severity": "hard", "description": "License authority matches state (no cross-state)", "enforced_by": ["pl-audit-tier", "core/audit/trust-signals/roofing-au.js"] },
    { "id": "T1.4", "severity": "hard", "description": "ABN format 11-digit", "enforced_by": ["pl-audit-tier", "core/audit/trust-signals/generic.js"] },
    { "id": "T1.5", "severity": "hard", "description": "Cross-state license = zero-tolerance fail", "enforced_by": ["pl-audit-tier", "core/audit/trust-signals/<niche>.js"] },
    { "id": "T1.6", "severity": "hard", "description": "Hero H1 ≤10 words (≤11 owner-voice exception)", "enforced_by": ["pl-audit-tier", "pl-audit-v4", "core/audit/content-validator.js"] },
    { "id": "T1.7", "severity": "hard", "description": "Primary CTA ≤5 words", "enforced_by": ["pl-audit-tier", "core/audit/content-validator.js"] },
    { "id": "T1.8", "severity": "hard", "description": "Suburb-chip count ≥8 + matches areaServed schema", "enforced_by": ["pl-audit-tier", "core/audit/multi-page-crawl.js"] },
    { "id": "T1.9", "severity": "hard", "description": "Forbidden legal claims absent", "enforced_by": ["pl-audit-tier", "core/audit/content-validator.js"] },
    { "id": "D2.1", "severity": "scored", "description": "Total word count 1000-1400", "enforced_by": ["pl-audit-tier", "core/audit/content-validator.js"] },
    { "id": "D2.2", "severity": "scored", "description": "Paragraph ≤4 sentences · sentence ≤24 words", "enforced_by": ["pl-audit-tier", "core/audit/content-validator.js"] },
    { "id": "D2.3", "severity": "scored", "description": "Hero subhead 14-25 words + specific outcome", "enforced_by": ["pl-audit-tier", "core/audit/content-validator.js"] },
    { "id": "D2.4", "severity": "scored", "description": "Trust-bar 5 chips with specific proof", "enforced_by": ["pl-audit-tier", "core/audit/trust-signals/<niche>.js"] },
    { "id": "D2.5", "severity": "scored", "description": "Service-list 6-10 items · ≤15 word descriptions · active verb", "enforced_by": ["pl-audit-tier", "core/audit/content-validator.js"] },
    { "id": "D2.6", "severity": "scored", "description": "About-story has founding year + specific person + place", "enforced_by": ["pl-audit-tier", "core/audit/content-validator.js"] },
    { "id": "D2.7", "severity": "scored", "description": "Reviews ≥3 with reviewer first name + suburb + date", "enforced_by": ["pl-audit-tier", "core/audit/content-validator.js"] },
    { "id": "D2.8", "severity": "scored", "description": "FAQ 5-8 entries · pre-empts top objections", "enforced_by": ["pl-audit-tier", "core/audit/content-validator.js"] },
    { "id": "D2.9", "severity": "scored", "description": "Footer NAP + license + ABN + insurance + hours visible", "enforced_by": ["pl-audit-tier", "core/audit/trust-signals/generic.js"] },
    { "id": "D2.S1", "severity": "scored", "description": "Banned genericisms absent (~69 phrases)", "enforced_by": ["pl-audit-tier", "pl-audit-v4", "core/audit/content-validator.js"] },
    { "id": "D2.S2", "severity": "scored", "description": "AU spelling strict", "enforced_by": ["pl-audit-tier", "core/audit/content-validator.js"] },
    { "id": "D2.S3", "severity": "scored", "description": "No-obligation pattern present", "enforced_by": ["pl-audit-tier", "core/audit/content-validator.js"] },
    { "id": "D2.S4", "severity": "scored", "description": "Per-segment voice match", "enforced_by": ["pl-audit-v4", "core/audit/personas/*.js"], "todo": "Phase A.2 LLM wiring" },
    { "id": "D2.BC1", "severity": "scored", "description": "Brand contract: tone consistent with brand-tokens.css", "enforced_by": ["pl-audit-v4", "core/audit/brand-contract.js"], "todo": "Phase A.2" },
    { "id": "D2.BC2", "severity": "scored", "description": "Brand contract: color/typography references match library", "enforced_by": ["pl-audit-v4", "core/audit/brand-contract.js"], "todo": "Phase A.2" },
    { "id": "D3.1", "severity": "scored", "description": "Hero composition: H1 + subhead + CTA + trust hierarchy clean", "enforced_by": ["pl-audit-vision"], "todo": "Phase A.2" },
    { "id": "D3.2", "severity": "scored", "description": "Hero photo: real trade work · not stock · faces visible", "enforced_by": ["pl-audit-vision"], "todo": "Phase A.2" },
    { "id": "D3.3", "severity": "scored", "description": "Typography scale: clear h1/h2/h3 + body legible", "enforced_by": ["pl-audit-vision"], "todo": "Phase A.2" },
    { "id": "D3.4", "severity": "scored", "description": "Color contrast WCAG AA · brand-token palette respected", "enforced_by": ["pl-audit-tier", "pl-audit-vision", "core/audit/image-optimization.js"] },
    { "id": "D3.5", "severity": "scored", "description": "Spacing rhythm · vertical baseline consistent", "enforced_by": ["pl-audit-vision"], "todo": "Phase A.2" },
    { "id": "D3.6", "severity": "scored", "description": "Section transitions clear · no wall-of-text", "enforced_by": ["pl-audit-vision"], "todo": "Phase A.2" },
    { "id": "D3.7", "severity": "scored", "description": "Trust-bar visual weight matches importance", "enforced_by": ["pl-audit-vision"], "todo": "Phase A.2" },
    { "id": "D3.8", "severity": "scored", "description": "Mobile rendering: phone-first · CTA thumb-reachable", "enforced_by": ["pl-audit-tier", "core/audit/pagespeed-insights.js"] },
    { "id": "D3.9", "severity": "scored", "description": "Anti-slop visual: no AI-default patterns", "enforced_by": ["pl-audit-vision"], "todo": "Phase A.2" },
    { "id": "D4.1", "severity": "scored", "description": "PageSpeed mobile ≥85 · LCP <2.5s · CLS <0.1", "enforced_by": ["pl-audit-tier", "core/audit/pagespeed-insights.js"] },
    { "id": "D4.2", "severity": "scored", "description": "Schema JSON-LD valid · LocalBusiness subtype matches niche", "enforced_by": ["pl-audit-tier", "core/audit/ai-geo-checks.js"] },
    { "id": "D4.3", "severity": "scored", "description": "Sitemap + robots + meta tags clean", "enforced_by": ["pl-audit-tier", "core/audit/sitemap-analyzer.js"] },
    { "id": "D4.4", "severity": "scored", "description": "Image optimization: AVIF/WebP + alt text + lazy-load", "enforced_by": ["pl-audit-tier", "core/audit/image-optimization.js"] },
    { "id": "D4.5", "severity": "scored", "description": "Third-party weight ≤30% of total bytes", "enforced_by": ["pl-audit-tier", "core/audit/third-party-weight.js"] },
    { "id": "D4.6", "severity": "scored", "description": "GBP-website consistency (hours/phone/address/category)", "enforced_by": ["pl-audit-tier", "core/audit/multi-page-crawl.js"] },
    { "id": "D4.7", "severity": "scored", "description": "Tech stack appropriate · CSP headers", "enforced_by": ["pl-audit-tier", "core/audit/tech-stack-detector.js"] },
    { "id": "T5.urgent-repair", "severity": "scored", "description": "Urgent-repair deterministic gate + LLM score", "enforced_by": ["pl-audit-vision", "core/audit/personas/urgent-repair.js"], "todo": "Phase A.2 vision dispatcher" },
    { "id": "T5.planned-upgrade", "severity": "scored", "description": "Planned-upgrade deterministic gate + LLM score", "enforced_by": ["pl-audit-vision", "core/audit/personas/planned-upgrade.js"], "todo": "Phase A.2" },
    { "id": "T5.commercial-maintenance", "severity": "scored", "description": "Commercial-maintenance deterministic gate + LLM score", "enforced_by": ["pl-audit-vision", "core/audit/personas/commercial-maintenance.js"], "todo": "Phase A.2" },
    { "id": "T5.guided-first-time-buyer", "severity": "scored", "description": "Guided-first-time-buyer deterministic gate + LLM score", "enforced_by": ["pl-audit-vision", "core/audit/personas/guided-first-time-buyer.js"], "todo": "Phase A.2" },
    { "id": "MAP.mech-H-1", "severity": "alias", "description": "page-spec mech-H-1 → T1.6", "enforced_by": ["alias-table-§9"] },
    { "id": "MAP.mech-H-2", "severity": "alias", "description": "page-spec mech-H-2 → D2.3", "enforced_by": ["alias-table-§9"] },
    { "id": "MAP.mech-H-3", "severity": "alias", "description": "page-spec mech-H-3 → T1.7", "enforced_by": ["alias-table-§9"] },
    { "id": "MAP.vis-H-1", "severity": "alias", "description": "page-spec vis-H-1 → D3.1", "enforced_by": ["alias-table-§9"] },
    { "id": "MAP.vis-H-2", "severity": "alias", "description": "page-spec vis-H-2 → D2.S4", "enforced_by": ["alias-table-§9"] },
    { "id": "MAP.vis-H-3", "severity": "alias", "description": "page-spec vis-H-3 → D3.2", "enforced_by": ["alias-table-§9"] },
    { "id": "MAP.mech-TB-1", "severity": "alias", "description": "page-spec mech-TB-1..5 → D2.4", "enforced_by": ["alias-table-§9"] },
    { "id": "MAP.mech-FT-1", "severity": "alias", "description": "page-spec mech-FT-1..7 → D2.9", "enforced_by": ["alias-table-§9"] },
    { "id": "MAP.mech-SMB-1", "severity": "alias", "description": "page-spec mech-SMB-1..5 → D4.2", "enforced_by": ["alias-table-§9"] },
    { "id": "FIX.T1", "severity": "upstream", "description": "T1 fail → fix data layer (facts.json · enrich-handoff · llm-extract-core)", "enforced_by": ["pl:iterate-site"] },
    { "id": "FIX.T2-copy", "severity": "upstream", "description": "T2 copy fail → fix brief OR pl-au-trade-voice §1.5", "enforced_by": ["pl:iterate-site"] },
    { "id": "FIX.T2-brand", "severity": "upstream", "description": "T2 brand-contract fail → fix brand-tokens.css OR modules", "enforced_by": ["pl:iterate-site"] },
    { "id": "FIX.T3", "severity": "upstream", "description": "T3 fail → fix DESIGN.md OR LLM render prompt", "enforced_by": ["pl:iterate-site"] },
    { "id": "FIX.T4", "severity": "upstream", "description": "T4 fail → fix publish pipeline / schema templates", "enforced_by": ["pl:iterate-site"] },
    { "id": "FIX.T5-primary", "severity": "upstream", "description": "T5 primary fail → fix brief primary_segment OR renderer hero variant", "enforced_by": ["pl:iterate-site"] },
    { "id": "FIX.T5-secondary", "severity": "upstream", "description": "T5 secondary fail → renderer adds secondary-segment surface", "enforced_by": ["pl:iterate-site"] },
    { "id": "FIX.AS-trade", "severity": "upstream", "description": "AS-trade P0 fail → DESIGN.md anti-slop guardrails + real photos in facts.json.media[]", "enforced_by": ["pl:iterate-site"] }
  ],
  "sections": [
    { "id": "tier-1-factual", "name": "Tier 1 · Factual / Brand · PASS/FAIL", "purpose": "Zero-tolerance gates on facts (NAP/license/phone/forbidden claims)", "hard_rules": ["T1.1","T1.2","T1.3","T1.4","T1.5","T1.6","T1.7","T1.8","T1.9"], "audit_check_ids": ["mech-H-1","mech-H-3"], "anti_patterns": ["AS-trade-3"] },
    { "id": "tier-2-copy-brand-contract", "name": "Tier 2 · Copy Depth & Brand Contract · ≥70", "purpose": "Word budgets · section depth · voice match · banned genericisms · brand contract", "hard_rules": ["D2.1","D2.2","D2.3","D2.4","D2.5","D2.6","D2.7","D2.8","D2.9","D2.S1","D2.S2","D2.S3","D2.S4","D2.BC1","D2.BC2"], "audit_check_ids": ["mech-H-2","vis-H-2"], "anti_patterns": ["AS-trade-3","AS-trade-6","AS-trade-7"] },
    { "id": "tier-3-visual", "name": "Tier 3 · Visual Design · ≥75", "purpose": "Hero composition · typography · spacing · anti-slop visual", "hard_rules": ["D3.1","D3.2","D3.3","D3.4","D3.5","D3.6","D3.7","D3.8","D3.9"], "audit_check_ids": ["vis-H-1","vis-H-3","vis-H-4","vis-H-5","mech-H-5","mech-H-6","mech-H-7","mech-H-8"], "anti_patterns": ["AS-trade-1","AS-trade-2","AS-trade-4","AS-trade-5","AS-trade-8"] },
    { "id": "tier-4-tech-seo", "name": "Tier 4 · Tech / SEO / Performance · ≥70", "purpose": "PageSpeed · schema · sitemap · image opt · third-party weight · GBP consistency", "hard_rules": ["D4.1","D4.2","D4.3","D4.4","D4.5","D4.6","D4.7"], "audit_check_ids": ["mech-SMB-1","mech-FT-1"], "anti_patterns": [] },
    { "id": "tier-5-per-segment", "name": "Tier 5 · Per-Segment Serviceability · primary ≥75 + secondaries ≥50", "purpose": "Deterministic gates + vision LLM per-segment scoring (hybrid)", "hard_rules": ["T5.urgent-repair","T5.planned-upgrade","T5.commercial-maintenance","T5.guided-first-time-buyer"], "audit_check_ids": ["vis-H-2"], "anti_patterns": [] },
    { "id": "anti-slop-catalog", "name": "Anti-slop Catalog (AS-trade-1..8 inline)", "purpose": "AI-default detection prompts + replace-with guidance for vision LLM dispatch", "hard_rules": [], "audit_check_ids": [], "anti_patterns": ["AS-trade-1","AS-trade-2","AS-trade-3","AS-trade-4","AS-trade-5","AS-trade-6","AS-trade-7","AS-trade-8"] },
    { "id": "check-id-alias", "name": "Audit Check ID → T-number Alias Table", "purpose": "Bi-directional lookup between page-spec section-prefix IDs and T-numbered scheme", "hard_rules": ["MAP.mech-H-1","MAP.mech-H-2","MAP.mech-H-3","MAP.vis-H-1","MAP.vis-H-2","MAP.vis-H-3","MAP.mech-TB-1","MAP.mech-FT-1","MAP.mech-SMB-1"], "audit_check_ids": [], "anti_patterns": [] },
    { "id": "failure-mode-upstream-fix", "name": "Failure Mode → Upstream Fix Table", "purpose": "Which tier fail tells what layer to repair (data/brief/voice/brand/design/render)", "hard_rules": ["FIX.T1","FIX.T2-copy","FIX.T2-brand","FIX.T3","FIX.T4","FIX.T5-primary","FIX.T5-secondary","FIX.AS-trade"], "audit_check_ids": [], "anti_patterns": [] },
    { "id": "composite-ship-gate", "name": "Composite & Ship Gate Formula", "purpose": "T1 PASS + composite(T2/T3/T4) ≥73 + T5 primary ≥75 + T5 secondaries ≥50", "hard_rules": [], "audit_check_ids": [], "anti_patterns": [] },
    { "id": "purpose-scope", "name": "Purpose & Scope · Owner Pointers", "purpose": "Rubric is a lookup table · CLIs + core/audit/* modules are the executors", "hard_rules": [], "audit_check_ids": [], "anti_patterns": [] }
  ],
  "anti_patterns": [
    { "id": "AS-trade-1", "summary": "Generic stock-hero (no real trade work · staged perfect)", "catalog_pointer": "self-§8", "severity": "P0", "detection": "vision-llm", "replace_with": "Real on-job photo · crew visible · actual job site" },
    { "id": "AS-trade-2", "summary": "Solutions/Services hero tile grid (interchangeable across niches)", "catalog_pointer": "self-§8", "severity": "P1", "detection": "grep+vision", "replace_with": "Specific service taxonomy · niche material names · before/after thumb" },
    { "id": "AS-trade-3", "summary": "Niche cliché tagline (above your head specialists · extra mile)", "catalog_pointer": "self-§8", "severity": "P0", "detection": "grep", "replace_with": "Specific number/year/outcome" },
    { "id": "AS-trade-4", "summary": "Carousel hero (auto-rotating slides)", "catalog_pointer": "self-§8", "severity": "P1", "detection": "dom+vision", "replace_with": "Static single hero · one H1 · one CTA" },
    { "id": "AS-trade-5", "summary": "Decorative-only trust badges (FB/Insta logos as trust)", "catalog_pointer": "self-§8", "severity": "P1", "detection": "grep+vision", "replace_with": "License # · ABN · insurance $ · industry body · review-star count" },
    { "id": "AS-trade-6", "summary": "Why choose us 4-up generic value tiles (Quality/Experience/Reliability/Service)", "catalog_pointer": "self-§8", "severity": "P1", "detection": "grep", "replace_with": "Specific guarantees with numbers" },
    { "id": "AS-trade-7", "summary": "Competitive pricing/Affordable rates without anchor", "catalog_pointer": "self-§8", "severity": "P1", "detection": "grep", "replace_with": "Indicative price band OR 'Free written quote · no surprises'" },
    { "id": "AS-trade-8", "summary": "AI-generated stock illustration (vector tradies · cartoon icons)", "catalog_pointer": "self-§8", "severity": "P0", "detection": "vision-llm", "replace_with": "Real photography · same crew across page · no vector mascots" }
  ]
}
```

---

## §12 · TODO markers

- **TODO Phase A.2** · `pl-audit-vision` CLI dispatcher (T3 visual + T5 LLM per-segment scoring). Until built · T3 returns mechanical-only · T5 returns deterministic-only.
- **TODO Phase A.2** · `pl-audit-v4.js` LLM tier wiring (D2.S4 voice-match · D2.BC1-2 brand contract).
- **TODO Step 3.3** · `core/eval/content-validator.js` imports `pl-au-trade-voice` extended forbidden phrases + au_spelling check.
- **TODO Step 4** · brief-schema integration · `core/handoff/single-page-brief-schema.js` declares primary + secondary segments consumed by T5.
- **TODO Phase B** · multi-niche extension · plumber / electrician / landscape personas + niche-overlay trust-signals modules + niche addendum sections in `pl-au-trade-voice`.

---

## §13 · Verification after `skills:build`

1. `pl-audit-rubric/pl-audit-rubric.json` exists
2. JSON has `kind: "audit_rubric"`
3. ≥60 rules · ≥10 sections · 8 anti_patterns
4. `npm run skills:check` returns clean
5. Rule IDs cited (R-AUD-* · R-UNI-* · D-H-* · C-H-* · R-XX-* · AV-* · LBP-* · AS-trade-*) all resolve to upstream owners (no fabrications)
