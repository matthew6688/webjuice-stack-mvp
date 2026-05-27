# Design Skill Comparison · Same Brief · 3 Variants

**Date**: 2026-05-27 evening
**Brief**: Vicwest Roofing single-page · identical data · identical 9 sections · identical SEO + a11y requirements
**Variants**:
- **V0** · Claude default (my hand-coded T1)
- **V1** · `huashu-design` skill → Vignelli Swiss rationalism
- **V2** · `taste-skill` core → warmpaper + terracotta workmanlike-editorial

---

## 1 · Design philosophy committed

| | V0 default | V1 huashu | V2 taste-skill |
|---|---|---|---|
| **Pick** | informal "Pentagram-ish" | **Massimo Vignelli** Unimark-AIGA (info-as-archive) | warm-paper + brick-clay editorial |
| **Anti-default reach** | weak (no explicit reject list) | **STRONG** — 2 fonts only, 0 rounded >2px, 0 gradients, 0 shadows | STRONG — anti-AI-purple, anti-Inter, anti-3-equal-cards, anti-glassmorphism |
| **Heuristic basis** | mine ("trade should feel solid") | huashu 5流派 catalog · picked "Information Architecture" 流派 | taste-skill Brief Inference + 3 Dials (DESIGN_VARIANCE 6 · MOTION 3 · DENSITY 5) |
| **Commitment level** | mid | extreme (could read as cold) | medium-high (warm but disciplined) |

---

## 2 · Concrete visual output diff (above-fold)

### V0 · Claude default
- Hero: large navy gradient overlay on aerial roof image, white H1 with amber accent word
- Right-side quote-card with shadow + rounded corners
- Eyebrow: "BALLARAT · VIC · VBA-LICENSED" (small)
- 2 CTAs: amber Primary + ghost outline "Or call X"
- **Net**: mid-trade conversion-optimized · familiar pattern · safe

### V1 · huashu-design (Vignelli)
- Hero: **PURE WHITE BACKGROUND** (no image overlay)
- Massive black headline + RED accent word ("next storm.")
- Header info row treats business as DOCUMENT: "FILE NO. VCW · 001 | DISCIPLINE: Roofing & Cladding | LOCALITY: Ballarat & District | OPERATING SINCE: 2003"
- Right form uses **UNDERLINE-only input fields** (Vignelli print → digital translation)
- "SEND ENQUIRY" with arrow on black button
- ALL CAPS mono labels for nav/eyebrows
- **Net**: looks like classified archive · trust through information density · serious

### V2 · taste-skill core
- Hero: warm cream-paper background with **small hero image in upper-right corner**, not full-bleed
- "Roofs built to outlast a Ballarat **winter**." with italic emphasis on "winter"
- Brick-clay (terracotta) Primary CTA
- "Get a 15-minute quote" eyebrow (micro-commitment language)
- Form uses pill-shaped buttons, slate-ink hairline borders
- **Net**: warm, editorial, NOT screaming for attention · feels artisan / craft

---

## 3 · Services section · same data, dramatically different treatment

| | V0 default | V1 huashu | V2 taste-skill |
|---|---|---|---|
| Layout | 3-column equal grid · 6 cards · 4:3 image top | **table** — `01 / 06 ROOF REPLACEMENT | description | thumbnail` rows | **asymmetric bento** — 1 large + 1 large + 4 small |
| Style | rounded white cards, shadow on hover | hairline-divided rows · zero decoration | warm-card cells · slate ink description |
| CTA per item | "Get a replacement quote →" amber link | no per-item CTA · spec-sheet only | subtle "Roof Replacement" headline · trust through arrangement |
| Anti-default | none flagged | "services rendered as numbered specification table, not cards" (V1 notes) | "1 large + 1 large + 4 small, not three-equal-card row" (V2 notes) |

V1 + V2 BOTH explicitly broke the "3-equal-card row" AI default. V0 didn't.

---

## 4 · Doc length + density signal

| | V0 default | V1 huashu | V2 taste-skill |
|---|---:|---:|---:|
| HTML LOC | 1058 | 1380 | unknown (~1100) |
| File size | 52KB | ~70KB est | ~55KB est |
| Total page height (desktop) | **8315px** | **10413px** | **6734px** |
| Information density | mid | high (numbered indexes everywhere) | mid-low (warm whitespace) |

V1 has **+25% page length** because Vignelli philosophy demands more spec-sheet content per section. V2 is **20% shorter** — taste-skill's `VISUAL_DENSITY=5` dial kept it compact.

---

## 5 · Subjective taste scoring (5-dim · 10 each · 50 max)

| Dim | V0 | V1 | V2 |
|---|:---:|:---:|:---:|
| Philosophy consistency (committed to ONE direction?) | 6 | **10** | **9** |
| Visual hierarchy (eye knows where to look) | 8 | **9** | 8 |
| Detail execution (typography · spacing · color discipline) | 7 | **9** | **9** |
| Innovation / non-default-look | 5 | **10** | **9** |
| Commercial fit for AU roofing trade | **9** | 6 | 8 |
| **Total** | 35 | 44 | 43 |

**Caveat on "Commercial fit"**: V0 wins because it's the most "expected" by Australian homeowners. V1 (Vignelli) looks like an architect's portfolio · could WIN tech-savvy / premium customers · could LOSE conservative older homeowners who expect louder CTAs. V2 (taste-skill warm-editorial) is in between.

---

## 6 · Brand of trade business this fits best

| Variant | Best customer fit |
|---|---|
| **V0 default** | **Generic mid-market roofer · safe ship for 70% of leads** · easy customer recognition · low-risk conversion |
| **V1 huashu Vignelli** | **Premium roofing specialist** with serious credentials · architectural / heritage work · commercial · "we treat your roof like an engineering project" positioning |
| **V2 taste-skill warm-editorial** | **Owner-operator with strong craft positioning** · "warm family business with editorial polish" · Bunningham / countryside / heritage suburb feel · feels artisan |

---

## 7 · Hard gates · all 3 pass

All 3 variants meet the brief's required SEO + a11y + structure gates:

| Gate | V0 | V1 | V2 |
|---|:---:|:---:|:---:|
| Exactly 1 H1 | ✓ | ✓ | ✓ |
| `<meta description>` 150-160 chars | ✓ | ✓ | ✓ |
| JSON-LD `RoofingContractor` | ✓ | ✓ | ✓ |
| OG + Twitter Card metas | ✓ | ✓ | ✓ |
| canonical + hreflang en-AU | ✓ | ✓ | ✓ |
| skip-to-content link | ✓ | ✓ | ✓ |
| Form: name + email required · phone+others optional | ✓ | ✓ | ✓ |
| Sticky mobile bottom phone CTA | ✓ | ✓ | ✓ |
| All 9 sections present | ✓ | ✓ | ✓ |
| No emojis · no clichés · no invented facts | ✓ | ✓ | ✓ |
| Google Fonts properly loaded via `<link>` | ✓ | ✓ | ✓ |

---

## 8 · Where each variant SHINES

### V0 highlights
- 18 suburb pills with arrangement annotation
- Per-service "Get a X quote →" CTAs (best for conversion testing)
- 3-tier review block with "Read all 18 on Google →" link

### V1 highlights
- **"FILE NO. VCW-001"** treats the page like an archival document — very memorable
- Services as numbered spec table (no AI mid-trade has this)
- 12-col strict grid with hairline rules · zero rounded corners
- Suburbs as numbered index 01-18 with by-arrangement flagged in red mono

### V2 highlights
- Italic emphasis word in headline (anti-AI default move)
- Asymmetric bento grid (1 + 1 + 4 cells for 6 services)
- "15-minute quote" micro-commitment instead of generic "Free Quote"
- Brick-clay accent grounded in roofing material context (not generic CTA color)
- Em/en-dash sweep — agent converted every `—` and `–` to `-` per skill rule

---

## 9 · Keep / Optimize / Retire decisions

### 🟢 KEEP · these 3 deserve to be in our template library
- **V0** (my default) → keep as **T1 industrial-trade** · safe ship lane for most leads
- **V1** (huashu Vignelli) → keep as **T2 heritage-premium** · the editorial/info variant
- **V2** (taste-skill warm) → keep as **T3 warm-craft** · owner-operator variant

This solves 60-80% of our 5-template library plan **in one comparison session**.

### 🔄 OPTIMIZE
- V0 has weakest "philosophy commitment" score (6/10) — could rerun V0 with explicit anti-default rules (huashu-design's 反 AI slop checklist) to push commitment higher
- V1's red accent might be too aggressive for conservative homeowners — softer red or burgundy could work
- V2's "15-minute quote" is brilliant copy · should backport to all variants
- V1 + V2 both rejected 3-equal-card services — V0 should adopt asymmetric or row-spec layout

### 🔴 RETIRE / DON'T USE
- **Nothing yet.** All 3 skills produced shippable output. The earlier OD freestyle path (lessons #1-#14 · which produces 56-89 wildly variable composite) is the one to retire — it competes for the same task slot but is empirically worse.
- **frontend-design / design / web-prototype / saas-landing** — not tested in this round, low priority to test (huashu-design and taste-skill already cover the design-language slot well)

### Strong learnings about the SKILL TOOLS themselves

| Skill | Verdict | Why |
|---|---|---|
| `huashu-design` | **KEEP** | Strongest commitment to design direction · 5 流派 × 20 哲学 catalog forces deliberate philosophy pick · Vignelli rendering was genuinely Vignelli, not AI-Vignelli |
| `taste-skill` (core) | **KEEP** | Brief Inference + 3 Dials methodology is brilliant for getting LLM to NOT default · explicit anti-AI-default list is enforced visible |
| Hand-coded by me (Claude default) | **WEAK BASELINE** | safe but unaspirational · doesn't commit to a flavor · 35/50 vs 43-44/50 |

---

## 10 · Recommended next moves

1. **Adopt V0 as T1 · V1 as T2 · V2 as T3** in our template library (skip planned T4/T5 unless we get real demand for emergency/storm-only customers)
2. **Backport asymmetric services layout** from V1/V2 into V0 — that's the strongest single-fix lift
3. **Run audit-tier vision on all 3** ($0.15 total) to get an objective composite score per variant
4. **Test V1 on a different customer** (cross-client transfer · the memory lesson #10) — Vignelli might fail on a 5-review owner-operator but work great for 50-review established firm
5. **Build slot-filler that generates ALL 3** for a given customer, then matches customer profile → best template:
   - 30+ reviews + established + suburban → V0
   - 10+ reviews + heritage/premium + commercial work → V1
   - <30 reviews + owner-operator + warm community → V2

---

## 11 · Cost summary

| Item | Cost |
|---|---:|
| V0 (my time) | already done |
| V1 sub-agent (huashu) | ~50k tokens · ~$0.15 LLM equiv |
| V2 sub-agent (taste-skill) | ~50k tokens · ~$0.15 LLM equiv |
| Screenshots | 0 (local Playwright) |
| Total | ~$0.30 for 3 fully different design directions on identical data |

vs. OD pipeline which was $7 + 9.6 min for ONE variant that scored 56 multi-page.

**This comparison architecture is 20× cheaper and 5-10× faster than the OD freestyle path.**

---

## 12 · Files

| Path | Content |
|---|---|
| `_compare/v0-claude-default/preview.html` | V0 baseline (copy of T1) |
| `_compare/v1-huashu-design/preview.html` | V1 Vignelli |
| `_compare/v1-huashu-design/DESIGN-NOTES.md` | V1 design rationale + 流派 choice |
| `_compare/v2-tasteskill-core/preview.html` | V2 warm-editorial |
| `_compare/v2-tasteskill-core/DESIGN-NOTES.md` | V2 Design Read + 3 dials |
| `_compare/COMPARISON-REPORT.md` | this file |
| Screenshots: `/tmp/compare-screenshots/v0,v1,v2/d1.png..d5.png` | desktop scroll segments |

Open all 3:
```bash
open templates/roofing/single-page-library/_compare/v0-claude-default/preview.html
open templates/roofing/single-page-library/_compare/v1-huashu-design/preview.html
open templates/roofing/single-page-library/_compare/v2-tasteskill-core/preview.html
```
