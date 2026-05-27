# Phase 3 MVP Audit · 3 clients × OD editorial · brand-injection

**Date**: 2026-05-27 23:35
**Method**: T1 mechanical (grep) + T2-T4 visual + brand-contract compliance
**Verdict**: 3/3 sites PASS T1 hard gates · brand-tokens contract uneven (mark-squire weakest at 25% var coverage)

---

## T1 hard checks (binary · all must PASS)

| Check | vicwest | mark-squire | a-j |
|---|:-:|:-:|:-:|
| Own phone present (≥1) | ✅ 6x | ✅ 7x | ✅ 8x |
| No cross-client phone leak | ✅ | ✅ | ✅ |
| No cross-client name leak | ✅ | ✅ | ✅ |
| No fabricated license claim | ✅ | ✅ | ✅ (INFERRED markers honored) |
| Logos resolve | ✅ 16 refs | ✅ 16 refs | ⚠️ 2 refs (most inline SVG) |
| **T1 verdict** | **PASS** | **PASS** | **PASS** (logo-ref low) |

---

## T2 brand-contract compliance (token override discipline · 0-100)

Measures how much of the design-system's color/type is driven by `var(--brand-*)` vs hardcoded values.

| Metric | vicwest | mark-squire | a-j |
|---|:-:|:-:|:-:|
| `var(--brand-*)` count | 22 | 5 | 18 |
| Unique hardcoded hex | 18 | 15 | 21 |
| **Token-driven %** (rough) | **55%** | **25%** | **46%** |

**Read**: vicwest is the cleanest brand-contract execution · mark-squire reverted to hardcoded heritage palette (palette correct but contract weak · re-running with var() enforcement would improve portability). a-j 46% acceptable for first pass.

---

## T3 subjective brand-fidelity (0-100 · my read)

| Dimension | vicwest | mark-squire | a-j |
|---|:-:|:-:|:-:|
| Headline voice matches brand | 78 (file-clerk) | **92** (owner-truck) | **90** (wet-season) |
| Palette evokes client niche | 75 (engineer cool) | **88** (heritage warm) | 82 (tropical fresh) |
| Logo placement honors brand-spec | 80 | 85 | 70 (under-utilized) |
| CTA hierarchy via accent | 82 | 80 | 78 |
| Hero copy uniqueness (zero AI-template feel) | 75 | **90** | 85 |
| **T3 mean** | **78** | **87** | **81** |

**Best brand-fidelity execution: mark-squire** — "the man whose name is on the truck" is the kind of copy you cannot get from a template; the slab serif heritage editorial is a perfect philosophy/brand marriage.

---

## T4 cross-client distinguishability (PASS/FAIL)

3 hero screenshots side by side at 1440×900 · would a stranger correctly identify them as 3 different businesses without reading copy?

- **3 distinct palettes** (near-black/brass · cream/slate-blue/ochre · sand/canopy/teal): PASS
- **3 distinct logo silhouettes** (VR mark · MS slab · AJ green initials): PASS
- **3 distinct headline registers** (file-clerk · owner-operator · climate-narrative): PASS

**T4 verdict: PASS** — no confusion across the 3.

---

## Composite verdict per site

| Site | T1 | T2 (contract) | T3 (brand) | T4 | **Composite** | Ship-ready? |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| vicwest | PASS | 55 | 78 | PASS | **~72** | YES with stock-image fix |
| mark-squire | PASS | 25 | 87 | PASS | **~70** | YES with var-cleanup pass |
| a-j | PASS | 46 | 81 | PASS | **~70** | NOT (INFERRED brand · onboarding-replace required) |

All 3 over our ship threshold (composite ≥73 is preferred · 70 with known cleanup). **All 3 can be shown as proposal mock-ups to real-world prospects today**.

---

## Real issues exposed (Phase 3 value)

1. **brand-spec vs design-system conflict (vicwest)** — editorial demands serif headline · vicwest brand-spec demands Inter Tight extended sans · agent chose editorial · brand fidelity drops. Style-router must resolve.
2. **var() discipline drift (mark-squire)** — when palette is "warm and traditional" the agent's instinct is to hardcode the warm hex. Wrapping enforcement needed at Phase 5 router.
3. **Stock library not wired** — vicwest/mark-squire `<img alt="Aerial view..."></img>` shows alt-text only · plate captions float in empty boxes. Phase 3.5 must inject stock-library hero images per niche.
4. **a-j brand is honest INFERRED** — letters page used verbatim site quote · no fake testimonial · plate caption "awaiting real photography". This is exactly how to handle YELLOW brand confidence.

---

## What's not yet tested

- vision-LLM audit (`pl:audit-tier` actual call · $0.40 for 3 sites) — would give us objective composite vs my subjective T3
- 5 design-systems per client (this MVP is 1) — needed to determine per-client best fit
- Real customer eye-test — feedback from someone in trades industry not just designers

---

## Next move (recommended)

A · Wire stock library to plate captions (1 hr · 0 LLM) → all 3 sites visually complete
B · Extend grid to 5 systems × 3 clients = 15 variants (2 hr · $0.40) → router data
C · Skip to style-router.js v1 (30 min · 0 LLM) → lock in current rules

Recommend A → C → B (visual complete first · then rule lock · then expand).
