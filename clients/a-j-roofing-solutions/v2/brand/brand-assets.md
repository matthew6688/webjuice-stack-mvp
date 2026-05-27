# Brand Assets

## Brand Summary

- Business name: A & J Roofing Solutions
- Short name / key word: A & J
- Industry / niche: metal roofing, ceiling & wall cladding (residential + commercial)
- Local area: Cairns / Portsmith, Far North Queensland (tropical AU)
- Brand personality: long-serving tropical-coast roofer, plain-spoken, trade-credible, 18+ years local, weather-resilient specialist (not luxury, not corporate)
- Logo strategy: A&J initials rendered as roof-pitch geometry — the A is a literal steep gable with a teal ridge-cap notch at the apex, the ampersand collapses to a single coral dot connector, the J carries the column-and-hook of a downpipe.
- Output mode: website-ready brand kit
- Provenance: INTERNAL_INFERRED. The customer's existing site has no extractable logo. This kit is a placeholder pending onboarding confirmation.

## Logo Assets

- `logo-light.svg`: Full stacked lockup for light surfaces.
- `logo-dark.svg`: Full lockup for dark surfaces (white marks, bright teal ridge cap, lightened coral dot).
- `logo-horizontal.svg`: Mark + wordmark inline (wide header / email signature).
- `logo-mark.svg`: A&J monogram only.
- `logo-wordmark.svg`: A & J ROOFING + SOLUTIONS · CAIRNS FNQ wordmark only.
- `logo-mono-dark.svg`: All-dark single color.
- `logo-mono-light.svg`: All-white single color.
- `favicon.svg`: Mark padded to 1:1.
- `social-avatar.svg`: Mark on warm cream #F6F0E4 1024×1024 for Google Business Profile.

Clearspace: Reserve at least the A-gable base width (~170 SVG units / 1× cap-height) around the full lockup.
Minimum size: Full lockup 160px wide. Mark 28px square. Favicon 16px (coral & dot may disappear below 20px — by design).
Background restrictions: Light variant on #FFFFFF, #F6F0E4, pale sand stocks. Dark variant on surfaces darker than #1F2421. Never place light logo on tropical/sky photography without a 60% white scrim. Teal ridge-cap must reach 3:1 contrast.
Small-size assets: Use logo-mark.svg or favicon.svg for header <60px or compact UI.
Visual style contract: See `visual-style-contract.md`.
Agent handoff: See `agent-handoff.md`.
QA checklist: Run `logo-qa-checklist.md` before delivery.

## Color System

```css
:root {
  --brand-primary: #1B5E3F;       /* tropical roof green — anchors the audit-praised existing green CTA */
  --brand-secondary: #2A8C8C;     /* Coral Sea teal — Cairns water reference */
  --brand-accent: #D9744A;        /* sun-bleached terracotta — small accent only */
  --tropical-shade: #0F3D2A;      /* deep canopy green — dark footer surface */
  --surface: #FFFFFF;
  --surface-muted: #F6F0E4;       /* sand cream — warm tropical surface */
  --text: #1A2421;
  --text-muted: #5C645F;
  --border: #E1D9C7;
}
```

## Typography

- Logo typography: DM Sans 800 / 500 — open-source geometric sans. Slightly warmer than Inter, suited to a plain-spoken tropical-trade voice.
- Heading font: DM Sans 800 / 600.
- Body font: Inter 400 / 500.
- Fallback stack: `'DM Sans', 'Inter', system-ui, sans-serif`

## UI Direction

- Header: Light header (#FFFFFF) with logo-horizontal.svg on desktop, logo-mark.svg on mobile. Phone number 07 4035 6187 top-right as a tap-to-call button styled with brand-primary green. Sticky on scroll. Below header: proof chip strip showing "18+ years · Cairns & FNQ · Licensed QBCC 1161095 · ABN verified".
- Footer: Dark footer (#0F3D2A). logo-dark.svg + secondary text in #B8C5C0. Phone, email, address, ABN, QBCC licence.
- Favicon / social: favicon.svg for tabs · social-avatar.svg (sand background) for GBP.
- Buttons: Primary CTA solid #1B5E3F with white text, 4px radius (retains audit-praised green cue). Secondary outlined teal. Hover 10% darker. Phone CTAs always primary green.
- Links: Inline links #2A8C8C with underline. Hover #1F6E6E.
- Section backgrounds: Alternate #FFFFFF and #F6F0E4 (sand cream). One hero per page over real Cairns roof photography.
- Cards / forms: 6px corners. 1px #E1D9C7 sand border. No default shadow; subtle 4% on hover.
- Icons: Rounded line icons, 2px stroke. Roof-trade cues: gable, downpipe, gutter, metal sheet, cyclone tie, ladder. No sun/palm/beach icons.
- Imagery: Real Cairns / Portsmith / FNQ roof work. Metal roofing on Queenslanders, commercial cladding, weather-resilient details, the team on-site. No stock palm beaches, no stock handshakes.
- Avoid: No gold/navy luxury palette. No "EST. YEAR" badges (founding year not verified). No condensed display fonts. No beach-resort visual cues.
- Website visual style: Established tropical-coast roofer. Sans warm-modern + sand surface + tropical green + Coral Sea teal. Trade-capable voice. Photo-heavy with real local work. Not luxury, not SaaS, not minimal, not resort.

## AI Website Agent Prompt

```text
Use the A&J roof-pitch monogram as drawn: the green gable with the teal ridge-cap notch is the brand signature — it must remain readable at favicon size. Brand reads as established tropical-coast roofer with 18+ years in Cairns & Far North QLD: practical, weather-resilient, trade-credible, plain-spoken. NOT luxury. NOT corporate. NOT design-studio minimalism. Use #1B5E3F (tropical roof green — derived from existing site's green CTA that the audit praised) as primary, #2A8C8C (Coral Sea teal — Cairns water/sky reference) as secondary, #D9744A (sun-bleached terracotta) as small accent only, and #F6F0E4 (sand/cream surface) as warm muted surface. DM Sans or Inter for headings and body — no slab serif (this is FNQ tropical, not regional-VIC heritage).
```
