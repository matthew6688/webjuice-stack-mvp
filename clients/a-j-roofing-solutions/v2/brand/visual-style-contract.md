# A & J Roofing Solutions Website Visual Style Contract

## Boundary

This contract defines brand direction and visual guardrails. It does not design the final UI, page structure, component layouts, breakpoints, or frontend implementation.

## Brand Reading

Read the logo first: weight, typography, geometry, color, and personality should drive the website's visual system.

## Overall Style Direction

Style: established tropical-coast trade.

The website should feel like a long-serving Cairns roofer that finally has a website that matches its 18+ years of local work — plain-spoken, photo-heavy, weather-resilient, trade-credible.

Avoid: No corporate-trade gradient/icon-pack cliché. No 'EST. YEAR' badges (founding year not verified). No condensed display fonts. No luxury palette (no gold/navy/bronze). No beach-resort cues (no palm icons, surf imagery, aqua-gradient washes).

## Color Boundaries

```css
:root {
  --brand-primary: #1B5E3F;
  --brand-secondary: #2A8C8C;
  --brand-accent: #D9744A;
  --tropical-shade: #0F3D2A;
  --surface: #FFFFFF;
  --surface-muted: #F6F0E4;
  --surface-dark: #0F1A18;
  --text: #1A2421;
  --text-muted: #5C645F;
  --border: #E1D9C7;
}
```

Color rules:

- Use brand colors by role, not decoration.
- Green is the primary action color — phone CTAs and quote buttons. This anchors the audit-praised existing green CTA cue.
- Teal is a secondary accent — never use as full-page wash, never as a button fill at >50% screen width.
- Coral is a small accent only — proof chips, hover underlines, the ampersand dot.
- Cream sand surface signals tropical-coast warmth without being a beach resort.
- Maintain strong contrast for logo, text, nav, forms, and CTAs.

## Logo Usage Boundaries

- Light background logo: logo-light.svg
- Dark background logo: logo-dark.svg
- Horizontal lockup: logo-horizontal.svg
- Mark / compact logo: logo-mark.svg
- Header: Light header (#FFFFFF) with logo-horizontal.svg on desktop or logo-mark.svg on mobile. Phone number top-right as a tap-to-call button in brand-primary green.
- Footer: Dark footer (#0F3D2A). logo-dark.svg + secondary text in #B8C5C0.
- Minimum size: Full lockup 160px wide. Mark 28px. Favicon 16px (coral dot may disappear below 20px — by design).
- Local contact: Preserve room for visible phone CTA and proof chips. Do not oversize the logo in the header.
- Export safety: SVG viewBox padding preserves text overshoot and stroke ends.

## Typography

- Heading font: DM Sans 800 / 600 — geometric sans, warm but credible.
- Body font: Inter 400 / 500.
- Fallback stack: `'DM Sans', 'Inter', system-ui, sans-serif`
- Logo typography notes: DM Sans 800 / 500 in wordmark. Mark is custom hand-drawn paths.

## Layout Density

Density: medium / service-focused.

Pages should be scannable, practical, photo-heavy. The audit calls out the existing site for having no photography and no visible phone — the redesign must over-correct on both fronts.

## Shape Language

Roof-pitch geometry. 4-6px corners on cards, 4px on buttons. The A-gable in the logo is a steep triangle — echo that pitch in section dividers (diagonal cuts) sparingly.

## Header System

Protect logo visibility and avoid typography / color that competes with it. Do not prescribe exact header layout here.

Local business contact rule: Desktop header exposes phone CTA + proof chips. Mobile header prioritizes sticky tap-to-call button showing actual number "07 4035 6187", not "Call Us Today".

## Footer System

Dark tropical-shade footer. Logo dark variant, full contact block (phone, email, Portsmith address, ABN, QBCC licence), Cairns & FNQ service area, and a service navigation column.

## Buttons And CTA

Primary CTA: solid brand-primary #1B5E3F, white text, 4px radius. Secondary: outlined teal #2A8C8C, teal text. Hover: 10% darker. Phone CTAs always primary green.

## Cards And Forms

6px corners. 1px #E1D9C7 sand border. No drop shadow by default; subtle 4% shadow on hover only. Form fields use the same border with a focused state at brand-secondary teal.

## Imagery Direction

Real Cairns / Portsmith / FNQ roof photography: metal roofing on Queenslander houses, commercial cladding jobs, tropical-weather-resilient details (cyclone ties, ridge caps, valley flashing), the actual team on-site. Avoid stock palm-tree beach shots and stock crew handshakes — those signal resort, not roofer.

## Icon Style

Rounded line icons, 2px stroke. Tropical-roof cues: gable, downpipe, gutter, metal sheet, cyclone-tie strap, ladder. No suns, palms, beaches, surf.

## Section Backgrounds

Alternate #FFFFFF and #F6F0E4 (sand cream). One hero per page with real Cairns roof photography overlay. The sand surface carries tropical warmth without resort-cliché.

## Motion And Interaction

Subtle, purposeful interactions. No parallax tropical scrolls. No animated palm graphics. Hover transitions 150ms ease-out. Phone CTA may have a 1px lift on hover.

## Responsive Behavior

On mobile, switch from logo-horizontal.svg to logo-mark.svg. Sticky tap-to-call bar at top with brand-primary green background. Protect logo visibility in header / footer; never crop the gable.

## Do / Don't

Do:

- Keep the logo visible in header, hero, footer, and mobile.
- Use the brand token system consistently.
- Match typography, shape, imagery, and icons to the logo personality.
- Anchor the green CTA — that's the existing brand cue.

Do not:

- Recolor the logo outside documented variants.
- Place the logo on tropical sky / palm photography without scrim.
- Use generic SaaS templates or beach-resort visuals.
- Add gradients, shadows, or effects to the logo.
- Introduce "EST. YEAR" badges — the founding year is not verified.

## Website Agent Prompt

```text
Use the A&J roof-pitch monogram as drawn: the green gable with the teal ridge-cap notch is the brand signature — it must remain readable at favicon size. Brand reads as established tropical-coast roofer with 18+ years in Cairns & Far North QLD: practical, weather-resilient, trade-credible, plain-spoken. NOT luxury. NOT corporate. NOT design-studio minimalism. Use #1B5E3F (tropical roof green — derived from existing site's green CTA that the audit praised) as primary, #2A8C8C (Coral Sea teal — Cairns water/sky reference) as secondary, #D9744A (sun-bleached terracotta) as small accent only, and #F6F0E4 (sand/cream surface) as warm muted surface. DM Sans or Inter for headings and body — no slab serif (this is FNQ tropical, not regional-VIC heritage).
```
