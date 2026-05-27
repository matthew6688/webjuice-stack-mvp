# Agent Handoff — Vicwest Roofing

## Brand

- Business: Vicwest Roofing
- Industry: roofing and restoration
- Location: Ballarat, Victoria
- Output mode: website-ready brand kit (existing-logo conversion · path-traced from live raster)

## Read Order

1. `brand-assets.md` — palette, typography, UI direction summary
2. `visual-style-contract.md` — guardrails and do/don't
3. `brand-spec.json` — machine-readable canonical record
4. `brand-tokens.css` — drop into stylesheet as `:root` vars
5. `logo-qa-checklist.md` — verify before delivery
6. `logo-review.md` — context on source fidelity and limitations
7. SVG assets

## Logo Usage

- Light surfaces (#FFFFFF–#E4E4E7): `logo-light.svg` (stacked) or `logo-horizontal.svg` (header)
- Dark surfaces (darker than #2A2A2E): `logo-dark.svg` (stacked) or use horizontal with white wordmark on request
- Compact / icon slots <48px: `logo-mark.svg`
- Header at 40–56px tall: prefer `logo-horizontal.svg` so phone CTA fits top-right
- Footer (dark): `logo-dark.svg` over `#0F1115`
- Browser tab: `favicon.svg`
- Social profiles (Google Business Profile, FB, IG, circle crops): `social-avatar.svg`
- Single-color print, embossing, fax: `logo-mono-dark.svg` (black) or `logo-mono-light.svg` (white)
- Wordmark alone (very wide narrow slots): `logo-wordmark.svg`

## Non-Negotiables

- Keep the logo visible, uncropped, and on documented background ranges.
- Do not recolor, distort, condense, or rotate the logo.
- Do not invert the V↔R color relationship (gray V + black R is not approved).
- Do not add drop shadow, outline-only treatment, or gradient fills.
- Preserve local phone/quote/contact priority in header and mobile nav.
- If a client-supplied AI/EPS becomes available later, swap path-traced SVGs before any print job.

## Website Agent Freedom

The website agent owns:

- page layout, component design, spacing, section order
- responsive breakpoints, mobile nav pattern
- frontend implementation, animation, microcopy
- which photo sits in which slot (within imagery direction)

The website agent must not change:

- logo paths, colors, or proportions
- brand palette role assignments (primary / secondary / accent / surface / text / border)
- typography personality (geometric extended sans for headings, neutral sans for body)
- "no gradients, no luxury palette, no SaaS minimalism" guardrails

## Token Quick Reference

```css
--brand-primary: #0F1115;     /* near-black, primary brand color */
--brand-secondary: #6D6E71;   /* steel-gray, secondary */
--brand-accent: #C5A572;      /* warm brass, sparing CTA accent only */
--surface: #FFFFFF;
--surface-muted: #F4F4F5;
--surface-dark: #111111;      /* hero / footer */
--text: #1B1D22;
--text-muted: #5A5C61;
--border: #E4E4E7;
--roof-shadow: rgba(15,17,21,0.18); /* niche: card/photo lift shadow */
```

## Known Limitations

- Source was a 1920px raster PNG — vector fidelity is path-traced approximation, not original designer beziers.
- Original wordmark font is not declared on source site. Closest match: Eurostile Extended / Bank Gothic family. Wordmark shipped as outlined paths so no font license is needed at render time.
- Brand colors were extracted from raster pixel means (V #000000, R #6D6E71, wordmark #3A3A3C). No client-confirmed HEX.
- Clearspace and minimum-size values are best-practice recommendations, not client-approved.
