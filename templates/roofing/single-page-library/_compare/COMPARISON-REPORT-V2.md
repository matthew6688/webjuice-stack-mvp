# OD Review · 8-Variant Final Analysis (V0-V7)

Independent designer-who-codes review across 8 Vicwest Roofing single-page variants. V0-V4 built earlier (Claude default + huashu/taste-skill paths); V5-V7 built on Open Design (OD) curated design systems (`editorial`, `bento`, `warm-editorial`).

Scored on 5 dimensions (Philosophy / Hierarchy / Detail / Function / Innovation), 0-10 each, 50 total.

## Side-by-side scoresheet · all 8 variants

| Dimension              | v0 default | v1 Vignelli | v2 Editorial | v3 Kenya Hara | v4 Editorial Luxury | **v5 OD-editorial** | **v6 OD-bento** | **v7 OD-warm-editorial** |
|---                     |---:        |---:         |---:          |---:           |---:                 |---:                 |---:             |---:                       |
| Philosophy consistency | 6          | 9           | 7            | **10**        | 7                   | 9                   | 8               | 9                         |
| Visual hierarchy       | 7          | 9           | 8            | 8             | 8                   | 8                   | 8               | **9**                     |
| Detail execution       | 7          | 9           | 8            | **10**        | 9                   | 9                   | 7               | 9                         |
| Function (conversion)  | **8**      | 6           | **8**        | 4             | 7                   | 7                   | **8**           | 6                         |
| Innovation (anti-slop) | 2          | 9           | 6            | **10**        | 8                   | 8                   | 5               | 7                         |
| **Total**              | **30**     | **42**      | **37**       | **42**        | **39**              | **41**              | **36**          | **40**                    |

Ranked top-to-bottom: **v1 = v3 (42) > v5 (41) > v7 (40) > v4 (39) > v2 (37) > v6 (36) > v0 (30)**.

The two existing top variants (v1, v3) hold the joint lead. Of the three OD variants: v5 lands one point off the top, v7 lands tied with v4 (one above, one below), v6 lands below v2 and is the weakest of the OD batch.

## Strengths-weaknesses matrix · 8 rows

| Variant | Best thing | Worst thing | Replicable by competitor? |
|---|---|---|---|
| v0 default | Conversion machinery honest and complete; best a11y baseline | Indistinguishable from the AI median for trade sites | Trivially — this *is* the median |
| v1 Vignelli | Numbered services as a spec-table; consistent Swiss-rationalist vocabulary across all 9 sections | Form field affordance hurts 55+ users; tiny mono CTA labels | Hard — requires real type discipline |
| v2 Editorial | Copy-and-visual marriage ("Roofs built to outlast a Ballarat *winter*"); honest em-dash sweep | Bento under-delivers vs DESIGN-NOTES promise; sits in saturated "warm cream Squarespace" lane | Moderate — many Framer templates approach it |
| v3 Kenya Hara | Single terracotta accent reserved for form asterisk; 「」review brackets; bibliographic register | Conversion-rate cost is real; mismatch for general suburban buyer | Almost impossible in AU trade — moat is huge |
| v4 Editorial Luxury | Double-bezel + Button-in-Button + cubic-bezier vocab; true 6/3/3/3/3/6 bento | Italic-copper-word tic on every H2; floating-pill nav is AI-template signature | Moderate — Framer/Awwwards crowd ships this monthly |
| **v5 OD-editorial** | Roman-numeral folio system across 6 sections + drop-cap + Plate-01 caption + dark colophon footer — turns nine content blocks into "Issue 03 of a publication" | Bookish micro-copy ("Send the brief", "From the letters page") will read as twee to half the Ballarat audience; single caramel accent overworked across 5 jobs | Hard — folio system + drop-cap + colophon is a structural commitment, not a style |
| **v6 OD-bento** | Best conversion infrastructure of the eight (always-visible nav phone CTA + sticky 2-col mobile bar + `Available this week` pill + elevated form tile) | Tailwind-blue + Inter + 24px-radius tiles + radial-gradient hero is the literal 2024-2025 AI-default for "modern SaaS landing" — zero moat | Trivially — every Framer template ships this in 2025 |
| **v7 OD-warm-editorial** | Process section (4 steps under 2px black rule with `01/02/03/04` in oversized terracotta Georgia) is the single best structural innovation across all 8 variants; clean dark-on-cream → cream-on-dark inversion at contact | Underline-only inputs on dark contact section + phone-number-replaced-by-button in nav + JSON-LD lists only 7 suburbs vs 16 in v0/v5/v6 | Moderate — process-section grammar is replicable but the warm-axis palette discipline is not trivial |

## Library curation · what stays, what goes after V5/V6/V7

### Keep at full weight (now 4 variants, was 3)

- **v0 default** — the **safe baseline / T3 fallback**. Unchanged: ships when client has no brand, no opinion, no budget for differentiation.
- **v1 Vignelli** — the **engineer / commercial / heritage-document register**. Unchanged: still the highest ceiling for the right buyer; structurally distinct from the OD batch.
- **v3 Kenya Hara** — the **heritage / slow-decision niche tool**. Unchanged: still the strongest competitive moat in the library; not displaced by any OD variant.
- **v5 OD-editorial (NEW · post-fixes)** — the **bookish-publication register**. The folio system + drop-cap + Plate caption + colophon footer make it structurally distinct from v2/v4/v7 in the warm-editorial lane. **Displaces v2 outright** (v5 41 vs v2 37; v2 was already pencilled for retirement vs v4). **Sits next to v4** in T1-craft but with a different conceit (v4 = "premium-craft café"; v5 = "bound issue of a publication"). The library can carry both; if forced to pick one of v4/v5, **pick v5** because the folio system is harder to photocopy than the double-bezel.

### Retire (now 2 variants, was 1)

- **v2 Editorial** — **retire**. Was already on the chopping block in the V1 comparison report (kept-vs-v4 question). v5 settles it: a curated OD `editorial` system delivers v2's "warm editorial" conceit with more structural conviction (folios, drop-cap, colophon) and the same data. v2's "warm paper Squarespace" lane is saturated; v5 commits harder and scores higher.
- **v6 OD-bento** — **do NOT integrate as a default**. 36/50 puts it below v2 (which is itself being retired). The bento aesthetic is the dominant AI-default in 2025 (Tailwind blue + Inter + rounded tiles + radial hero gradient). Innovation score 5/10 is the lowest of the 8 variants for innovation — strictly worse than v0 on differentiation while not measurably better on conversion. Either drop entirely, or keep as a **niche option for tech-buyer clients only**, with explicit positioning ("we ship this when the client is a software product manager renovating their Alfredton 2018-build"). Default answer: drop.

### New entrant on the bubble

- **v7 OD-warm-editorial (post-fixes)** — **add as T1-broad-audience-editorial**. 40/50 puts it ahead of v4 (39) and below v5 (41). The process-section grammar is the single best structural innovation in the set. After fixes (phone in nav, drop H1 accent phrase, lighten dark inputs), v7 covers more of the addressable Ballarat market than v3 (less austere) and more than v5 (less bookish). **Replaces v4** in the T1-craft slot if forced to choose between them; v4's double-bezel + italic-copper-word are 2024-Awwwards-template fingerprints, v7's process-rule + warm-axis palette + dark-form inversion are structurally more original.

## Updated T1/T2/T3 mapping · production template library

| Tier | Variant | When to deploy |
|---|---|---|
| **T1 — Specialist niche (heritage)** | v3 Kenya Hara (post-fixes) | Heritage-restoration-only positioning; slow-decision buyers; architect-partner referrals. Unchanged. |
| **T1 — Editorial publication (literate-warm)** | v5 OD-editorial (post-fixes) | Clients positioning around craft / heritage / Federation+Victorian housing stock with some design literacy. Replaces v2 (retire) and outranks v4 on structural moat. |
| **T1 — Broad-audience editorial (process-led)** | v7 OD-warm-editorial (post-fixes) | The default T1 for the majority of Ballarat clients who want "considered" without "bookish". Replaces v4 in this slot. |
| **T2 — Commercial / engineer-buyer** | v1 Vignelli (post-fixes) | Commercial roofing, engineering-aware buyers, "spec document" register. Unchanged. |
| **T2 — Tech-buyer niche (optional)** | v6 OD-bento (post-fixes, niche only) | 30-45 software/product/professional-services homeowner renovating a 2010s+ build. Default answer: drop; only carry if a specific client demands it. |
| **T3 — Safe fallback** | v0 default | No brand, fast turnaround, generic suburban comparison-shopper. Unchanged. |

Variants retired vs. previous mapping: **v2 (replaced by v5)**, **v4 (replaced by v7)**.
The library net-net moves from 5 active variants to 5 active variants — the OD batch contributes 2 keepers (v5, v7) that displace 2 incumbents (v2, v4), and 1 reject (v6).

## Is OD's library worth integrating? · verdict

**Yes — but selectively, not wholesale.** OD `editorial` (v5 → 41) and OD `warm-editorial` (v7 → 40) both score above the median of the existing library and both displace existing variants (v2, v4). OD `bento` (v6 → 36) is below median and adds nothing the library doesn't already have via v0+v4.

Two variants out of three landed as keepers. That's a strong batting average for an experiment.

Critically: the keepers' strengths are *structural* (folio system, process-rule grammar, drop-cap, dark-form inversion) — exactly the kind of moves that survive a competitor's photocopy attempt. The reject's weakness is also structural: bento is the AI-default aesthetic of 2025, and a curated system that commits to it imports the AI-default with it.

### Recommendation · OD as a first-class library tier

Promote OD design systems from "experiment" to **"first-class brand contract" in the template skill library**, with two non-negotiable rules:

1. **Curate which OD systems we adopt.** OD `editorial` and OD `warm-editorial` graduate. OD `bento` is benched (carry the tokens for future evaluation, don't ship to clients). Future OD systems get the same 5-dim review treatment before promotion.
2. **OD is a brand-contract layer, not a generator.** The wins in v5 and v7 came from token discipline + structural commitment (folio system, process-rule), not from the OD system "writing the page". A taste-skill or huashu skill still drives copy, image selection, and structural decisions; OD enforces palette / type / radius / spacing as a hard contract. That layering (skill above, OD contract below) is what produced the V5/V7 scores — abandoning either layer drops the result.

The headroom call from the V1 report still stands ("a future v5 that combines v1's spec-table + v3's micro-typography + v4's true bento + v0's conversion machinery would plausibly score 47-48"). V5 and V7 are the first credible steps toward that headroom — they prove a curated design-system contract on top of a real taste skill is the cheapest path to consistent 40+ output. Worth integrating.

## Honest concluding notes (carry-forward + new)

1. **v0 is still not bad — it's still median.** Don't retire it. Its conversion will beat v1/v3/v5/v7 on the average suburban-roofing-quote-comparison customer. The library needs the floor as much as the ceiling.

2. **v1 and v3 remain the strongest single moats.** No OD variant displaced them. The Vignelli spec-table and the Kenya Hara terracotta-asterisk are still the two designs in the library that a competing AU roofer cannot photocopy by next quarter.

3. **The OD batch settles the v2-vs-v4 question in the V1 report.** Both got displaced. v5 replaces v2 (better warm-editorial conviction via folio system); v7 replaces v4 (cleaner process grammar + cleaner accent discipline without the italic-copper-word tic).

4. **v6 is the cautionary data point.** A curated design system that commits to a saturated AI-default aesthetic produces a result that is *less* differentiated than v0, despite scoring higher on every individual craft dimension. Aesthetic-current matters: bento was novel in 2022, was the default by 2024, and is now strictly worse than the median Squarespace template for trade businesses. The OD library needs an active curation policy or it will accumulate v6-class variants over time.

5. **No variant nailed all 5 dimensions; ceiling is still 42/50.** v3 maxed Philosophy + Detail + Innovation but scored 4/10 on Function. v6 maxed Function but scored 5/10 on Innovation. The headroom variant (v1 spec-table + v3 micro-type + v4 bento + v0 conversion + v5 folio + v7 process-rule, all in one page) plausibly clears 45/50. Worth attempting once OD is integrated as a contract layer.

6. **DESIGN-NOTES quality is itself a signal — and the OD batch raised the floor.** v5/v6/v7's DESIGN-NOTES are all token-traceable, all show explicit deltas vs v2/v4, all name the buyer segment. The OD process forces this honesty — which is itself an argument for integration. The V1 report flagged v3's DESIGN-NOTES as exemplary and v4's as self-flattering; the OD-batch DESIGN-NOTES all sit at v3-level rigour. That's a real artefact-quality lift, independent of the page output.
