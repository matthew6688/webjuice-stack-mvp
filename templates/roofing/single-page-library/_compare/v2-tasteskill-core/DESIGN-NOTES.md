# V2 · Taste-Skill Core · Vicwest Roofing

## Design Read (Section 0.B)
Reading this as: a trust-first local roofing landing for suburban Ballarat homeowners (storm/insurance anxieties, older skew), with a workmanlike-editorial language, leaning toward warm-paper + slate-ink + brick-clay accent — asymmetric but restrained, never agency-flashy.

## Dials (Section 1)
- **DESIGN_VARIANCE: 6** — Trust-first wants 3-4, but a suburban-consumer landing benefits from 7. Settled at 6: asymmetric hero split, asymmetric services bento (2+4), but conventional reading order through the page. Not chaotic, not symmetric-boring.
- **MOTION_INTENSITY: 3** — Older Ballarat audience, slow rural mobile connections, trust-first context. CSS-only `:hover` lifts, one quiet scroll-reveal on services, no infinite loops, no parallax. Honors `prefers-reduced-motion` even at 3.
- **VISUAL_DENSITY: 5** — 9 sections + 6 services + 16 suburbs + 3 reviews + 3 before/after pairs need to land without art-gallery padding. Standard daily-app spacing (`py-16` to `py-20` equivalent), tighter on mobile.

## Key Visual Decisions
- **Font stack:** `Bricolage Grotesque` (display, variable weight 500/700) + `IBM Plex Sans` (body, 400/500/600). Deliberately not Inter, not Geist (those would also be defaults). Bricolage's tighter counters read tradesman-honest, not tech-startup.
- **Color palette (Terracotta + Slate family, per Section 4.2):**
  - Paper `#f4efe6` (warm bone, not banned cream `#f5f1ea` family — slightly cooler, lower saturation)
  - Ink `#1c1f24` (off-black, not pure)
  - Brick `#b8492c` (single accent, used identically across all CTAs, stars, links, focus rings)
  - Moss `#2d3a2a` (secondary deep-green for the trust bar background and review attribution)
  - Cloud `#e8e0d2` (subtle section tint, same palette family)
- **Layout archetype:** Asymmetric Split Hero (text 7-col / quote-form aside 5-col). Asymmetric bento for services (cell 1 + cell 2 large, then 4 standard cells). Standard 2-col for about/process, reviews, before-after pairs. Service area = suburb pill cloud + map embed split.
- **Motion patterns:** `transform: translateY` on CTA `:active`, `transform` lift on service cards, IntersectionObserver-driven `data-reveal` fade-up (single observer, GPU-only transforms). Hard reduced-motion override.
- **Shape Consistency Lock:** Radius scale = 4px on inputs, 8px on cards, full-pill on CTAs and suburb chips. One rule, applied everywhere.

## Taste-Skill Rules Applied Most Heavily
- **Section 0.D anti-defaults:** rejected Inter + slate-900, rejected centered hero, rejected 3-equal feature cards (services is a 2-up + 4 bento), rejected glassmorphism, rejected purple/blue glow.
- **Section 4.1 Serif Discipline:** zero serif. Bricolage Grotesque is a sans display with personality, not the auto-reach Fraunces/Instrument_Serif (both banned in checklist).
- **Section 4.2 Color Consistency Lock + Premium-Consumer Palette Ban:** explicitly avoided beige+brass+oxblood+espresso. Terracotta + slate is one of the named alternatives.
- **Section 4.3 Anti-Center:** hero is split (copy left / form right), not centered over a dark mesh.
- **Section 4.7 Hero Layout Discipline:** 4 text elements max (eyebrow, H1, 1-line subhead, 2 CTAs). No tagline under CTAs, no trust micro-strip inside hero — trust bar is a dedicated section below. `pt-20` cap. Headline fits 2 lines desktop.
- **Section 4.7 Eyebrow Restraint:** 9 sections → max 3 eyebrows. Used on hero, services, contact. Reviews/process/gallery/service-area carry plain headlines.
- **Section 4.7 Zigzag Cap:** about-and-process uses 2-col; reviews uses card row; gallery uses pair grid; service-area is split. No three consecutive image+text alternations.
- **Section 4.8 Real Images:** every service card carries a real photo, hero has real aerial, gallery uses 6 real before/after files, about uses real worker survey shot. Zero hand-rolled decorative SVG, zero div-fake-screenshots.
- **Section 4.10 Quotes:** all 3 reviews ≤ 3 lines, attribution name + suburb, real typographic quotes, no em-dash, no decorative pills overlaid.
- **Section 9.G EM-DASH BAN:** swept the entire brief (`Done in 3-5 days`, `Adds 10-15 years`, `terracotta or cement-tile roof`, every dash in service copy and reviews) — converted ALL en/em dashes to regular hyphen `-`. Zero `—` or `–` anywhere visible.
- **Section 6.B Reduced Motion:** every transition gated under `@media (prefers-reduced-motion: no-preference)`.

## Anti-Default Choices Made Deliberately
1. **Bricolage Grotesque, not Inter/Geist.** Variable display weight at hero, used italic for the subhead emphasis (same family italic, not mixed-family).
2. **Terracotta + slate palette, not cream/brass.** Single brick accent on every CTA, star, focus ring, suburb-chip hover.
3. **Asymmetric services bento (1 large + 1 large + 4 small), not 3+3 equal grid.** First two services get visual weight; the rest are standard tiles. 6 cells for 6 services, no empty cells.
4. **Quote form embedded into hero as right-column aside, not modal/below-fold.** Density 5 lets the hero do two jobs without overflowing.
5. **No "Trusted by" logo wall.** Vicwest has no national brand partners — inventing one would violate "no fake data." Trust bar uses real numbers (22+ years, 4.1★, 15+ suburbs, 0 subcontractors) as the credibility instead.
6. **No section-numbering eyebrows.** Eyebrows on hero/services/contact are topic words (`ROOF SPECIALISTS · BALLARAT`, `OUR WORK`, `GET IN TOUCH`), not `01 / SERVICES`.
7. **Mobile bottom sticky phone CTA** in brick accent, dismissable visually by scroll position — appears only on small viewports per requirement.
8. **No marquees, no scroll cues, no decorative dots, no version stamps, no locale/weather strips, no photo-credit captions.**
9. **Form labels above inputs**, name/email asterisked + `required` + `aria-required="true"`, phone/suburb/service explicitly optional in HTML.
10. **One H1 only** (hero). Every other section uses `<h2>`.
