# OD Review · 5-Variant Summary

Independent designer-who-codes review of 5 Vicwest Roofing single-page variants.
Scored on 5 dimensions (Philosophy / Hierarchy / Detail / Function / Innovation), 0-10 each, 50 total.

## Side-by-side scoresheet

| Dimension | v0 default | v1 Vignelli | v2 Editorial | v3 Kenya Hara | v4 Editorial Luxury |
|---|---:|---:|---:|---:|---:|
| Philosophy consistency | 6 | **9** | 7 | **10** | 7 |
| Visual hierarchy | 7 | 9 | 8 | 8 | 8 |
| Detail execution | 7 | 9 | 8 | **10** | 9 |
| Function (conversion) | **8** | 6 | **8** | 4 | 7 |
| Innovation (anti-AI-slop) | 2 | 9 | 6 | **10** | 8 |
| **Total** | **30** | **42** | **37** | **42** | **39** |

Two variants tie at the top (v1 and v3) for very different reasons: v1 wins on hierarchy + function balance, v3 wins on detail + innovation but knowingly sacrifices function.

## Strengths-weaknesses matrix

| Variant | Best thing | Worst thing | Replicable by competitor? |
|---|---|---|---|
| v0 default | Conversion machinery is honest and complete; best a11y baseline | Indistinguishable from the AI median for trade sites | Trivially — this *is* the median |
| v1 Vignelli | Numbered services as a spec-table; consistent Swiss-rationalist vocabulary across all 9 sections | Form field affordance hurts 55+ users; tiny mono CTA labels | Hard — requires real type discipline |
| v2 Editorial | Copy-and-visual marriage ("Roofs built to outlast a Ballarat *winter*"); honest em-dash sweep | Bento under-delivers vs DESIGN-NOTES promise; sits in saturated "warm cream Squarespace" lane | Moderate — many Framer templates approach it |
| v3 Kenya Hara | Single terracotta accent reserved for form asterisk; 「」review brackets; bibliographic register | Conversion-rate cost is real; mismatch for general suburban buyer | Almost impossible in AU trade — moat is huge |
| v4 Editorial Luxury | Double-bezel + Button-in-Button + cubic-bezier vocab; true 6/3/3/3/3/6 bento | Italic-copper-word tic on every H2; floating-pill nav is AI-template signature | Moderate — Framer/Awwwards crowd ships this monthly |

## Library curation — what stays, what goes

### Keep at full weight (3 variants)

- **v0 default** — the **safe baseline / T3 fallback**. Ship when client has no brand, no opinion, no budget for differentiation. Best conversion expected on the median suburban-comparison-shopper.
- **v1 Vignelli** — the **engineer / commercial / heritage-document register**. Ship for clients with commercial work, architect-buyer demographics, or anyone whose "premium" means "specification document" rather than "warm magazine". Highest ceiling for the right buyer.
- **v3 Kenya Hara** — the **heritage / slow-decision niche tool**. Ship only for clients positioning around heritage restoration, slate, copper, Federation/Victorian homes. NOT a default — a precision instrument. Carries the strongest competitive moat of any variant.

### Keep but consolidate (1 of 2)

v2 and v4 occupy overlapping warm-paper / serif-display / craft-editorial territory. Both score 37-39. **Recommend keeping v4 and retiring v2** because:
- v4 carries more technical innovation (cubic-bezier vocab, double-bezel, true bento)
- v2's "warm paper + brick + Bricolage" lane is now saturated by AI-generated Squarespace defaults — diminishing differentiation
- v4 with its italic-copper-word treatment capped at 3 uses (per recommended fix) becomes a clearer "premium-craft" anchor than v2

If both must stay: v2 is the *daily affordable premium* (single owner-operator, $4-6k website tier), v4 is the *premium-spec showcase* ($10k+ website tier).

## Recommended T1/T2/T3 mapping for the production template library

| Tier | Variant | When to deploy |
|---|---|---|
| **T1 — Showcase / premium** | v4 Editorial Luxury (post-fixes) | Heritage-aware clients with brand budget; agency-style positioning; portfolio pieces |
| **T1 — Specialist niche** | v3 Kenya Hara (post-fixes) | Heritage-restoration-only positioning; slow-decision buyers; architect-partner referrals |
| **T2 — Commercial / serious** | v1 Vignelli (post-fixes) | Commercial roofing, engineering-aware buyers, "spec document" register clients |
| **T2 — Craft default** | v2 Editorial-core (optional, only if v4 unavailable) | Owner-operator with warm brand voice, female-decision-maker households |
| **T3 — Safe fallback** | v0 default | No brand, fast turnaround, generic suburban comparison-shopper audience |

## Honest concluding notes

1. **v0 is not bad — it's median.** Don't retire it. Its conversion will beat v1/v3/v4 on the average suburban-roofing-quote-comparison customer. The library needs the floor as much as the ceiling.

2. **v1 and v3 are the keeper innovations.** They are the only two variants in this set that a competing AU roofer cannot photocopy by next quarter. The Vignelli spec-table and the Kenya Hara terracotta-asterisk are real moats.

3. **v2 vs v4 is a real choice.** Both score in the 37-39 band. The library should not ship both at the same tier — they confuse the offering. Pick v4 + retire v2, or run them as T2-craft-default vs T1-premium-showcase with explicit positioning briefs.

4. **The DESIGN-NOTES quality is itself a signal.** v3 has the most intellectually honest DESIGN-NOTES (explicit "this converts worse" + named buyer segment); v1's "I rejected huashu's 7-phase advisory" rationale is the most disciplined design reasoning; v4's self-rating ("Monocle spread crossed with Linear") is the most flattering and least accurate. Read DESIGN-NOTES skeptically when assessing future variants.

5. **No variant nailed all 5 dimensions.** The top score is 42/50. There's headroom — a future v5 that combines v1's spec-table services + v3's micro-typography restraint + v4's true bento + v0's conversion machinery would plausibly score 47-48. Worth attempting once.
