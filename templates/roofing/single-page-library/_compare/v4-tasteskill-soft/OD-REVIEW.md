# Design Review · v4-tasteskill-soft (Editorial Luxury / Awwwards-tier)

## 5-Dim Scoresheet (each 0-10)
- Philosophy consistency: **7/10** · DESIGN-NOTES claims "Editorial Luxury × Editorial Split — Fraunces serif + copper italic accents + double-bezel cards + Button-in-Button + cubic-bezier motion vocabulary + ambient warm-ink shadows". The HTML delivers most of it: Fraunces (variable, opsz 144), copper `#8C5A2E`, italic-copper word on every H2 ("one", "2003", "neighbours", "archive", "your", "roof"), Plus Jakarta Sans for UI micro-copy, named `--ease-luxe` / `--ease-spring` / `--ease-haptic` curves. Loses 3pts because: (a) the italic-copper-word treatment on every section H2 starts to read as a tic rather than a system by section 4, (b) the "Editorial Luxury" promise is more Hawthorn-flat-white than Monocle-spread — it reads premium-craft, not actual luxury-magazine.
- Visual hierarchy: **8/10** · The asymmetric 6/3/3/3/3/6 services bento (Plate I and Plate VI wide) is the only variant that actually delivers a true editorial-bento layout. Section-head pattern (eyebrow + H2 + lede) is consistent. Hero meta strip (Established / Rating / Warranty / Region) below the CTAs is well-considered. Loses 2pts on H2 fatigue: every section H2 has an italic-copper word, so the italic-copper accent stops doing hierarchical work and becomes decoration.
- Detail execution: **9/10** · The most technically ambitious of the five. Custom inline-SVG thin-stroke (1.4) icons in Phosphor-Light family (no Lucide / FontAwesome). Named cubic-bezier curve tokens. Ambient warm-ink shadow recipe with 4 layered drops (inset highlight + sub-pixel grounding + mid-diffusion + long bloom). Double-bezel pattern (`padding:8px outer + calc(2rem - 8px) inner`) with mathematically concentric radii. Button-in-Button trailing-icon nested pattern. SVG-noise grain overlay at 4.5% opacity. The `clip-path: inset(0 0 0 50%)` before/after split is the cleanest gallery treatment in the set.
- Function (conversion path · CTA prominence · trust signals): **7/10** · Hero shows TWO buttons (Call + Request quote) plus a 4-cell meta strip plus a rotated review chip plus a trust strip below — high CTA density. Copper button + ink button create clear visual hierarchy. But the floating glass-pill nav (`mt-6 mx-auto w-max rounded-full`) demotes the persistent nav to a centred chip, losing the always-visible phone number that v0/v2 keep. Sticky mobile phone CTA does compensate below 720px.
- Innovation (departure from AI default): **8/10** · Distinctively different from v0; the double-bezel + Button-in-Button + named-cubic-bezier + Fraunces opsz 144 + grain overlay stack is uncommon in AU roofing. Loses 2pts because the *aesthetic itself* (cream paper + italic serif + copper accent + double-bezel cards) is the explicit 2024-2025 Awwwards / Framer-template / Cosmos-template current consensus — it's "premium AI" rather than "philosophy AI". v1 and v3 carry more original conviction.
- **Total: 39/50**

## Top 3 strengths
- The technical-craft layer is unmatched: cubic-bezier vocabulary, ambient shadow recipe, double-bezel concentric radii, Plus Jakarta + Geist + Fraunces 3-font hierarchy with deliberate weight/opsz tuning. A real front-end designer wrote this — not a default.
- The 6/3/3/3/3/6 services bento is the strongest structural innovation among the 5 variants and actually delivers the magazine-spread feel the others only promise.
- The custom thin-stroke 1.4 inline SVG icon set is the right level of restraint — no Lucide identity-leakage, no FontAwesome bloat, just a consistent thin-stroke vocabulary. Punches above its weight.

## Top 3 weaknesses
- The italic-copper-word-per-H2 fingerprint is overused. Hero (`roofing` + `&`), services (`one`), about (`2003`), reviews (`neighbours.`), gallery (`archive.`), suburbs (`your`), contact (`roof.`) — by section 4 the user sees the pattern and the rest stops being delightful. Use 3-4 times max.
- The "Editorial Luxury" claim oversells; what's actually delivered is "Premium Craft Café" — Linear product page meets ceramics-studio website. That's a good register, but it's not Monocle/Cereal/Bang & Olufsen. The DESIGN-NOTES self-rating ("printed Monocle / Cereal Magazine spread crossed with Linear") is generous.
- The floating glass-pill nav is a 2023-Framer-template move at this point — increasingly recognised as AI/template signature, which works *against* the "anti-AI-slop" thesis the variant is positioned around.

## Top 5 concrete fix recommendations
1. Restrict the italic-copper-word treatment to hero H1 + exactly TWO other H2s of your choosing (suggest: about "2003" + contact "roof"). Strip it from services, reviews, gallery, suburbs · selector `.display .serif[style*="italic"]`
2. Replace floating glass-pill nav with a slim full-width sticky nav at 56px height that keeps the phone number always visible · `header.nav` structural change
3. Drop one of the four hero meta cells — Region is redundant with the eyebrow "Ballarat · Since 2003 · VBA Licensed" already at the top · selector `.hero-meta .cell:nth-child(4)`
4. The first-letter-only monogram avatars on reviews are a smart touch but the copper gradient on a small circle reads orange-blob at small sizes — soften to a flat copper-soft `#B98A5C` solid at <40px · selector `.review .who .avatar`
5. The 4.5% SVG noise grain overlay is below the threshold of perception on most monitors — bump to 6-7% or remove and rely on the warm paper alone · selector `body::before` (the grain layer)

## Audience fit
The 35-50 design-aware buyer with disposable income. Lake Wendouree / Newington / Mount Pleasant homeowners renovating Federation or mid-century homes. Architect partners, interior-designer-adjacent clients, the buyer who would also commission a custom kitchen joiner. Same buyer as v3 but less austere — wants premium presentation *and* warmth.

## Verdict
- Recommended ship lane: **YES-with-fixes**
- Must-fix items: (1) cap italic-copper word treatment at 3 uses page-wide, (2) replace floating-pill nav with slim full-width, (3) decide between v3 (austere) and v4 (warm-premium) per client positioning — they overlap on buyer and the library shouldn't carry both at full weight.
