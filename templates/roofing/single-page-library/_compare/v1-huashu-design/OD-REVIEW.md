# Design Review · v1-huashu-design (Vignelli / Swiss rationalism)

## 5-Dim Scoresheet (each 0-10)
- Philosophy consistency: **9/10** · The DESIGN-NOTES claim Vignelli/Unimark, and the HTML actually delivers it. 0 gradients, 0 box-shadows, 0 rounded cards >2px, IBM Plex Mono on every data label, hairline rules between rows, signal-red used as a single restrained accent. The 3-col `section-head` (meta + title + aux) is the literal Vignelli AIGA catalogue layout. The discipline holds across all 9 sections, not just the hero — which is the hard part.
- Visual hierarchy: **9/10** · Massive H1 with one red word is a textbook focal point; the eyebrow-number/title/meta tri-column section header is unambiguous; mono labels reliably mark data; the services-as-numbered-table is genuinely easier to scan than v0's card grid. Loses 1pt because at ≥1280px the 12-col grid leaves visible whitespace asymmetry that some viewers will read as "broken" rather than "intentional."
- Detail execution: **9/10** · `letter-spacing:-0.04em` on display, `0.18em` on mono eyebrows, hairline at `rgba(10,10,10,0.18)`, grayscaled map, "Plate 01 — Restored terracotta" caption — every detail belongs to the same vocabulary. The custom geometric "VR" mark (square within square) instead of an invented logo is the right call. The `::selection { background: var(--ink); color: var(--paper) }` is a 120% touch most designers skip.
- Function (conversion path · CTA prominence · trust signals): **6/10** · Trust signals are present and well-labelled (mono captions read like spec sheet). BUT: black uppercase Plex Mono CTA at `12px font-size` is hard to perceive as a button; the form sits in the hero column but uses underline-only fields which mid-50s homeowners will not recognise as inputs; "SEND ENQUIRY" reads as a noun, not an action. Conversion will measurably underperform v0.
- Innovation (departure from AI default): **9/10** · Genuinely uncommon in AU trade-site space. The Plate-01 image caption with `16:9 · 1672 × 941` dimensions printed underneath is the kind of detail that signals real designer intent. The numbered services spec-table is structurally distinct from every competitor.
- **Total: 42/50**

## Top 3 strengths
- The Vignelli vocabulary is internally complete — every component (header, hero, trust strip, services, reviews, gallery, suburbs index, contact, footer) speaks the same language. No drift, no "but on this one section I needed a rounded card."
- The numbered service table is a structural innovation: replaces 6 generic cards with 6 hairline-divided rows that read like a building-trade spec document. Mid-trade competitors literally cannot copy this without copying the whole system.
- The "File No. VCW · 001" hero meta strip and "Plate 01" image caption are the kind of editorial gestures that turn a service page into a *document* — homeowners read documents more carefully than ads.

## Top 3 weaknesses
- Form usability is the single biggest concession. Underline-only `border-bottom` inputs without visible box affordance, plus tiny mono labels, will hurt completion rates among the 55+ Ballarat demographic. Vignelli's print discipline doesn't translate perfectly to a transactional form.
- The H1 at `clamp(44px, 8.5vw, 132px)` will overflow / reflow awkwardly at the 880-1100px breakpoint range on landscape tablets. The "the next storm." line is the hero's load-bearing moment — needs a min-height clamp or font-size cap.
- The 12-col strict grid + 24px gutter is rigid: at 1480px max-width the page can feel "narrow" relative to the page-length. Vignelli would have used wider gutters or a wider canvas.

## Top 5 concrete fix recommendations
1. Add a visible `border-bottom: 2px solid var(--ink)` + 8px bottom padding on `.hero-form input` at rest (currently only on focus), so the field reads as a field · selector `.hero-form input, .hero-form select`
2. Cap the H1 line-height to prevent reflow at tablet break · `.hero-headline h1 { font-size: clamp(44px, 8.5vw, 110px); }` (cap was 132px)
3. Lift CTA font-size from 12px to 13px and reduce letter-spacing to `0.10em` — small bump, large legibility gain for 55+ readers · selector `.btn`
4. The submit button should say "Request quote" not "Send enquiry" — the action verb the user came to perform · `button[type="submit"]` text in hero form
5. Add a single hairline beneath every section's H2 to mirror the section-head top rule — current page reads strong at top but soft at bottom · structural pattern in `.section-head`

## Audience fit
Engineering / architect / heritage-buyer / commercial-property client. The 60-year-old who reads quotes line by line and trusts a "specification document" register over a "marketing site" register. Also the right register for Vicwest's commercial / school / industrial work, not just residential.

## Verdict
- Recommended ship lane: **YES-with-fixes**
- Must-fix items: (1) form field affordance, (2) H1 reflow cap, (3) submit button verb. Once those land, this is the highest-ceiling variant for the right buyer.
