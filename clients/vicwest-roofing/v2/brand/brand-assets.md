# Brand Assets

## Brand Summary

- Business name: Vicwest Roofing
- Short name/key word: VR
- Industry/niche: roofing and restoration
- Local area: Ballarat, Victoria
- Brand personality: industrial, straightforward, trade-credible, no-nonsense
- Logo strategy: monogram + bold geometric wordmark (stacked lockup; mark also works standalone)
- Output mode: website-ready brand kit

## Logo Assets

- `logo-light.svg`: Full stacked lockup for light backgrounds (default).
- `logo-dark.svg`: Full stacked lockup for dark backgrounds (V → white, R → light gray #B5B5B7, wordmark → white).
- `logo-mark.svg`: VR monogram only · use for compact headers, badges, watermark.
- `logo-wordmark.svg`: VICWEST ROOFING wordmark only · use when paired with separate mark or in narrow horizontal slots.
- `logo-mono-dark.svg`: Single-color black version for embossing, single-color print, fax.
- `logo-mono-light.svg`: Single-color white version for hot foil on dark stock or dark surfaces.
- `favicon.svg`: VR mark padded to 1:1 · works at 16/32/48px.
- `social-avatar.svg`: VR mark on warm-gray #F4F4F5 1024×1024 square · safe for circle crops.

Clearspace: Reserve at least the height of the V mark (1× cap height) around the full lockup. For the standalone mark, reserve 0.5× mark height.
Minimum size: Full lockup: 120px wide minimum on screen. Mark: 24px square. Favicon: 16px (the V/R remain readable at 16px).
Background restrictions: Light variant on surfaces between #FFFFFF and #E4E4E7. Dark variant on surfaces darker than #2A2A2E. Do not place light logo on warm beige photo without scrim. Do not invert the V↔R color relationship (gray V + black R is not approved).
Small-size assets: Use logo-mark.svg or favicon.svg for headers <48px tall, social icons, and any compact UI. Never squeeze the full stacked lockup into a square slot.
Visual style contract: See visual-style-contract.md in this folder.
Agent handoff: See agent-handoff.md in this folder.
QA checklist: Run logo-qa-checklist.md before delivery.


## Existing Logo Source Notes

- Source: https://lirp.cdn-website.com/4551ea6c/dms3rep/multi/opt/Vicwest+Roofing+Logo-1920w.png (1773×1179 PNG, fetched from live site)
- Source quality: high — clean flat raster, transparent background, 1920px wide
- Conversion tier: Tier 1 (Clean Flat Logo)
- Fidelity target: high
- Font approximation: Bold geometric extended sans (Eurostile Extended / Bank Gothic family). Exact font name not declared on site; closest open-source approximation is Inter Tight Bold or paid: Eurostile LT Std Bold Extended. Wordmark provided as outlined SVG path so exact font is not required at render.
- Outlined/path version needed: yes — wordmark shipped as path-outlined SVG for fidelity
Changes from source:
- Path-traced via potrace from PNG (no vector source was available).
- Color values normalized: V = #000000, R = #6D6E71 (was raster mean RGB 109,110,113), wordmark = #3A3A3C (was raster mean RGB 58,58,60).
- Wordmark recreated as outlined SVG paths — text not editable, ensures exact fidelity without licensed font.
- Created dark/light/mono variants and 1:1 favicon/social crops (not present in source).

Known limitations:
- Source is raster (PNG). True vector fidelity is path-traced approximation, not the original designer's curves — curves are visually faithful but not bezier-identical.
- Exact wordmark font is unverified. Visually consistent geometric sans family is documented but not licensed in this kit.
- Source has no documented brand color HEX — colors were extracted from raster pixel means.
- Source has no provided clearspace / minimum-size spec — values in this kit are best-practice recommendations, not client-approved.
- If client provides original AI/EPS/PDF source later, replace these SVGs with redrawn versions before final print use.


## Color System

```css
:root {
  --brand-primary: #0F1115;
  --brand-secondary: #6D6E71;
  --brand-accent: #C5A572;
  --surface: #FFFFFF;
  --surface-muted: #F4F4F5;
  --text: #1B1D22;
  --text-muted: #5A5C61;
  --border: #E4E4E7;
  --source-primary: #000000;
  --source-secondary: #6D6E71;
  --source-wordmark: #3A3A3C;
}
```

## Typography

- Logo typography: Bold geometric sans-serif with industrial flat-bottom bowls (the wordmark approximates Eurostile Bold Extended / Bank Gothic family). Letters are widened, monoline-leaning, with squared tops and softly cut bottoms.
- Heading font: Inter Tight 700 (or Eurostile if licensed) — geometric, slightly condensed, structural feel matching the wordmark.
- Body font: Inter 400/500 — neutral, readable, pairs cleanly with the heading sans.
- Fallback stack: 'Inter Tight', 'Eurostile Extended', 'Bank Gothic', 'Inter', 'Helvetica Neue', Arial, sans-serif

## UI Direction

- Header: Light header (#FFFFFF) with logo-light.svg. Phone number visible top-right with brass accent. Sticky on scroll, slight shadow.
- Footer: Dark footer (#0F1115) with logo-dark.svg. White text, secondary text in #B5B5B7. ABN + license sit under footer logo.
- Favicon/social: favicon.svg for browser tabs. social-avatar.svg for Google Business Profile, FB, IG. Never letterbox the full lockup.
- Buttons: Primary CTA: solid brass #C5A572 background, dark text #0F1115, no rounded corners (2px max). Secondary: outlined steel-gray border, dark text. Hover: 10% darker.
- Links: Inline links use #C5A572 with subtle underline; hover deepens to #A88A5C.
- Section backgrounds: Alternate between #FFFFFF and #F4F4F5 muted sections. One hero section per page on dark #0F1115 with imagery overlay.
- Cards/forms: Squared corners (2px). 1px #E4E4E7 border. No drop shadow — flat. Inner padding 32px. Heading + price/spec uses heading font; body text in Inter.
- Icons: Line icons, 1.5px stroke, no rounded ends. Industrial/utilitarian — wrench, roof tile, gutter section, ladder. Match the geometric character of the wordmark.
- Imagery: Real roofing project photography preferred. Drone shots of completed roofs (ridged metal, tile) work well. Avoid stock crew handshakes and generic 'happy family' shots.
- Avoid: No gradient logos. No drop shadow on the mark. No outline-only variants — always solid fill. No condensed-italic wordmark — keep upright geometric. No mixing of brass + steel-gray on the same CTA.
- Website visual style: Industrial trade-credible. Dense information layout with strong typographic hierarchy. Steel-gray + warm brass + white. Photo-heavy hero blocks. Avoid luxury, avoid SaaS gradient aesthetics, avoid 'modern minimal' with thin sans-serif everything.

## AI Website Agent Prompt

```text
Use the provided Vicwest Roofing VR monogram and VICWEST ROOFING wordmark exactly as supplied. Do not redesign, re-proportion, or recolor. Build a website that feels industrial, trade-credible, and direct — geared toward Ballarat homeowners and builders evaluating roofing work. Use #0F1115 as the primary brand color, #6D6E71 as supporting steel-gray, and #C5A572 (warm brass) only as a sparing accent for primary CTAs. Maintain very strong contrast. Lockup must remain legible at 32px tall in the header; favicon uses the VR mark only.
```
