# Design Review · v0-claude-default

## 5-Dim Scoresheet (each 0-10)
- Philosophy consistency: **6/10** · No stated philosophy, but it executes the implicit "safe mid-trade contractor template" with internal coherence — navy + amber + Inter Tight is one decision held all the way through.
- Visual hierarchy: **7/10** · Hero headline → eyebrow → CTA → quote card is clean and scannable; trust bar reads in one glance; service cards are uniform. Loses a point for the centred section-eyebrow + centred section-heading + left-aligned lede pattern flip-flopping subtly between sections.
- Detail execution: **7/10** · Thoughtful touches (`text-wrap: balance`, sticky mobile CTA, skip-link, contained 1200px gutter, hover-lift on cards, `aria-required`, JSON-LD, real Google Maps embed). Some sloppiness: inline `style=""` overrides on the about paragraphs, double-quote-card duplication, 6 service cards rendered as identical equal-weight tiles.
- Function (conversion path · CTA prominence · trust signals): **8/10** · Three CTA paths (hero form, hero phone, sticky mobile bar) all functional; quote form is above the fold; trust chips visible by scroll-2; reviews + before/after present. Honest 4.1★/18 reviews instead of fake 5.0/200. The strongest converter of the five.
- Innovation (departure from AI default): **2/10** · This *is* the AI default. Navy + amber, rounded cards, gradient hero overlay, 3-col service grid, sticky-blur header — every visual choice is the median Claude output for a trade landing. The "Pentagram-ish" claim is generous; it's competent generic.
- **Total: 30/50**

## Top 3 strengths
- The conversion machinery is the most honest and complete of all five: form lives in hero, phone appears 4 places, sticky mobile CTA, dual contact section, trust bar with real numbers (4.1, 18, 0 subs).
- Copy is the best of the five — "the person who quotes you climbs your roof", "It's sorted, mate", suburb-by-suburb specificity. The writing carries trust the visuals don't.
- Accessibility hygiene: skip-link, `aria-labels`, `aria-required`, semantic landmarks, focus rings on inputs, working tab order. None of the more "designed" variants beat it here.

## Top 3 weaknesses
- Zero philosophical commitment. Navy + amber on a hero gradient over Inter is the exact silhouette of every AI-generated trade site since 2023. Indistinguishable from 200 competitors.
- The 6-equal-card services grid is the explicit AI-slop pattern Taste-Skill §0.D bans. Visual rhythm dies at the services block.
- Inline `style="color: var(--slate); font-size: 1.05rem; line-height: 1.6;"` repeated on three about paragraphs is engineering debt that signals "Claude wrote this in one shot." A real designer would have hoisted a `.about__lead` class.

## Top 5 concrete fix recommendations
1. Break the symmetry of `.services-grid` — make replacement + Colorbond span 2 cols, others 1 col (6/3/3/3/3/6 bento) · `@media (min-width: 1080px) { .services-grid { grid-template-columns: repeat(6, 1fr); } .service-card:nth-child(1), .service-card:nth-child(6) { grid-column: span 2; } }`
2. Kill the hero gradient · replace with a single 30% navy flat overlay so the photo's actual roof reads · `.hero::after { background: rgba(15, 46, 76, 0.55); }`
3. Hoist inline styles into `.about__lead` and `.about__chip` — clean DOM and clean spec · selector `.about p[style]`
4. Drop the amber-on-navy "VR" brand mark and replace with a wordmark only, or a Colorbond-monument-toned mark · selector `.site-header__brand-mark`
5. Replace 6 generic service cards with a `services--featured` row of 2 hero services (Replacement / Restoration) + a denser 4-tile secondary row · structural HTML change in `<section id="services">`

## Audience fit
The 70th-percentile suburban Ballarat homeowner aged 45-65 evaluating 3 quotes on their phone — needs to see phone number, see a face, see "10-year warranty", and call. Doesn't care about brand. Will trust this site exactly as much as the other 8 sites in their browser tabs.

## Verdict
- Recommended ship lane: **YES** — but ship it as the **safe default** for unbranded mid-trade clients, not as a showcase. It's the floor, not the ceiling.
- Use as fallback when client has no brand assets, no opinion, and wants a working site by Friday.
