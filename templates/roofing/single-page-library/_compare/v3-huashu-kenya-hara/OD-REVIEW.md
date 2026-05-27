# Design Review · v3-huashu-kenya-hara (Eastern minimal / MUJI)

## 5-Dim Scoresheet (each 0-10)
- Philosophy consistency: **10/10** · This is the most disciplined philosophy execution of the five. DESIGN-NOTES claims Kenya Hara / MUJI lineage and the HTML *literally* honours it: Noto Serif JP at weight 200 (zero bold weight anywhere on the page), ink expressed only as opacity rather than solid, warm paper `#FAFAF8` (not `#FFFFFF`), terracotta `#A8553E` used in exactly one location (the required-field asterisk), Japanese 「」brackets framing review quotes, 200px section gaps, photos globally desaturated `filter: saturate(0.85) contrast(0.95)`. Each anti-default choice is articulated and held. The DESIGN-NOTES even pre-emptively states the conversion cost — full intellectual honesty.
- Visual hierarchy: **8/10** · The restraint produces a calm hierarchy: H1 → lede → ghost CTA → footnote phone link. Section pattern (eyebrow + numbered title + lede + content) is consistent. Loses 2pts because the hierarchy between elements is so flat — everything sits at 38-82% ink opacity — that no element is obviously *the* primary CTA. By design, but a real cost.
- Detail execution: **10/10** · The level of consideration is uncommon: numbers in trust strip set in Noto Serif extralight at 56px ("they look like page numbers in an architecture book"), "No. 01 · Ballarat, Victoria" bibliographic marker on the hero, slim 14px black 94%-opacity sticky mobile bar instead of bright urgency-orange, global photo desaturation, no sticky bar on desktop at all. Every single decision in DESIGN-NOTES is provably in the CSS.
- Function (conversion path · CTA prominence · trust signals): **4/10** · This is the variant where DESIGN-NOTES explicitly says "this page will convert worse than v0". Ghost button + tracked uppercase 12px label + underlined "Or call" footnote is genuinely hard to find at a glance. Trust signals are present but soft (woven into prose at 62% ink opacity rather than badge-stamped). For the wrong customer this page reads as "are these people even open for business?" The score is honest, not punitive.
- Innovation (departure from AI default): **10/10** · No competitor in AU roofing space looks like this. The Japanese 「」brackets, the No. 01 marker, the single terracotta accent restricted to the asterisk glyph, the Noto Serif JP extralight, the 200px section gaps, the explicit "the page is 2× longer because restraint costs vertical real-estate" rationale — every choice is a real designer choosing, not a default emerging.
- **Total: 42/50**

## Top 3 strengths
- It is the only variant whose visual language *cannot* be replicated by a competitor inside 6 months. Anyone can copy navy + amber. Almost no one in AU trade will commit to Noto Serif JP extralight + 200px section gaps + monochrome-ink-via-opacity. The moat is real.
- Intellectual honesty in DESIGN-NOTES is exemplary — explicitly states the conversion-rate trade-off, names the buyer segment it's *for* (heritage / architect / slow-decision-maker) and the segment it's *against* (general suburban quote-comparison). Most designers won't make this trade explicit.
- The micro-typography is the best of the five: hairline rules between trust items, `var(--ink-trace)` 10% bracket glyphs, the bibliographic "No. 01" hero index. These are details that 1-in-50 trade-site designers reach for.
- The form-required-asterisk being the ONLY chromatic moment on the page is a genuinely poetic design idea. Colour as honest necessity, not decoration.

## Top 3 weaknesses
- Conversion will measurably suffer for the 70% suburban-homeowner audience. This is by design, but it must be matched with the right customer or it actively loses leads.
- The hero photograph (`hero-heritage-slate-detail.png` — a slate detail, not an aerial) reinforces "heritage" framing but actively excludes Vicwest's Colorbond / commercial / standard-tile work. The page silently re-positions the company toward heritage-only, which may not be the business strategy.
- The 200px section rhythm + 1442 LOC means the page is genuinely 2× the scroll-length of v0. Mobile users on 4G in Ballarat will bounce before reaching the contact form.

## Top 5 concrete fix recommendations
1. The single ghost CTA needs ONE concession to function: bump padding to `16px 28px` and font-size to 13px (was 12), so the click target reads as a button without breaking the visual restraint · selector `.btn-ghost`
2. Add a *second*, lower-stakes terracotta moment to make the accent feel intentional rather than accidental — e.g. the trust-strip hairlines could shift to `rgba(168, 85, 62, 0.18)` so the asterisk isn't orphaned · selector `.trust .trust__item + .trust__item`
3. Cap the section rhythm at 160px (currently 200px) to reduce total page height ~12% without losing the breathing fingerprint · `:root { --rhythm: clamp(120px, 14vw, 160px); }`
4. The desaturation filter is universal — exempt the hero photograph alone so it carries 5% more visual weight · `.hero img { filter: none; }` override
5. Swap hero photograph back to a wider aerial (`hero-golden-aerial-restored.png`) for the v3 default, with the heritage-slate as an alternate for heritage-positioning clients · `<img src="">` line in hero

## Audience fit
The architect / heritage-restoration / slow-decision-maker buyer. Owners of Federation, Victorian, and California-bungalow homes in Ballarat East / Lake Wendouree / Newington. Won't suit Vicwest's bread-and-butter Colorbond replacement buyer at all. This is a niche-positioning variant, not a default variant.

## Verdict
- Recommended ship lane: **YES-with-fixes**, deployed *only* for heritage-positioning clients
- Must-fix items: (1) CTA padding bump, (2) section rhythm cap to 160px, (3) hero photo swap depending on client positioning. Do NOT ship this for general suburban-roofer clients — it's a precision tool, not a default.
