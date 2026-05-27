# Vicwest Roofing Website Visual Style Contract

## Boundary

This contract defines brand direction and visual guardrails. It does not design the final UI, page structure, component layouts, breakpoints, or frontend implementation.

## Brand Reading

Read the logo first: weight, typography, geometry, color, and personality should drive the website's visual system.

## Overall Style Direction

Style: clean local business

The website should feel industrial, straightforward, trade-credible, no-nonsense.

Avoid: No gradient logos. No drop shadow on the mark. No outline-only variants — always solid fill. No condensed-italic wordmark — keep upright geometric. No mixing of brass + steel-gray on the same CTA.

## Color Boundaries

```css
:root {
  --brand-primary: #0F1115;
  --brand-secondary: #6D6E71;
  --brand-accent: #C5A572;
  --surface: #FFFFFF;
  --surface-muted: #F4F4F5;
  --surface-dark: #111111;
  --text: #1B1D22;
  --text-muted: #5A5C61;
  --border: #E4E4E7;
  --source-primary: #000000;
  --source-secondary: #6D6E71;
  --source-wordmark: #3A3A3C;
}
```

Color rules:

- Use brand colors by role, not decoration.
- Maintain strong contrast for logo, text, nav, forms, and CTAs.
- Do not overuse the accent color as a full-page wash unless explicitly specified.

## Logo Usage Boundaries

- Light background logo: logo-light.svg
- Dark background logo: logo-dark.svg
- Mark/compact logo: logo-mark.svg
- Header: Light header (#FFFFFF) with logo-light.svg. Phone number visible top-right with brass accent. Sticky on scroll, slight shadow.
- Footer: Dark footer (#0F1115) with logo-dark.svg. White text, secondary text in #B5B5B7. ABN + license sit under footer logo.
- Minimum size: Full lockup: 120px wide minimum on screen. Mark: 24px square. Favicon: 16px (the V/R remain readable at 16px).
- Local contact: For local businesses, preserve room for phone number and quote/contact CTA; do not oversize the logo in the header.
- Export safety: check SVG viewBox padding so text, strokes, italic overshoots, and outlined paths are not clipped.

## Typography

- Heading font: Inter Tight 700 (or Eurostile if licensed) — geometric, slightly condensed, structural feel matching the wordmark.
- Body font: Inter 400/500 — neutral, readable, pairs cleanly with the heading sans.
- Fallback stack: 'Inter Tight', 'Eurostile Extended', 'Bank Gothic', 'Inter', 'Helvetica Neue', Arial, sans-serif
- Logo typography notes: Bold geometric sans-serif with industrial flat-bottom bowls (the wordmark approximates Eurostile Bold Extended / Bank Gothic family). Letters are widened, monoline-leaning, with squared tops and softly cut bottoms.

## Layout Density

Density: medium/service-focused

Keep pages scannable, practical, and aligned with the brand's level of polish.

## Shape Language

Use shapes, radius, borders, and line weights that match the logo geometry.

## Header System

Protect logo visibility and avoid typography/color choices that compete with it. Do not prescribe exact header layout here.

Local business contact rule: Desktop header should expose phone or primary contact action. Mobile header should prioritize call, quote, or menu based on conversion need.

## Footer System

Footer should preserve the logo as the primary brand object, with readable links and restrained CTA/contact treatment.

## Buttons And CTA

Primary CTA: solid brass #C5A572 background, dark text #0F1115, no rounded corners (2px max). Secondary: outlined steel-gray border, dark text. Hover: 10% darker.

## Cards And Forms

Squared corners (2px). 1px #E4E4E7 border. No drop shadow — flat. Inner padding 32px. Heading + price/spec uses heading font; body text in Inter.

## Imagery Direction

Real roofing project photography preferred. Drone shots of completed roofs (ridged metal, tile) work well. Avoid stock crew handshakes and generic 'happy family' shots.

## Icon Style

Line icons, 1.5px stroke, no rounded ends. Industrial/utilitarian — wrench, roof tile, gutter section, ladder. Match the geometric character of the wordmark.

## Section Backgrounds

Alternate between #FFFFFF and #F4F4F5 muted sections. One hero section per page on dark #0F1115 with imagery overlay.

## Motion And Interaction

Use subtle, purposeful interactions. Avoid animations that fight the brand tone or delay conversion actions.

## Responsive Behavior

Define when full logo switches to mark-only, and protect logo visibility in mobile header/footer.

## Do / Don't

Do:

- Keep the logo visible in header, hero, footer, and mobile.
- Use the brand token system consistently.
- Match typography, shape, imagery, and icons to the logo personality.

Do not:

- Recolor the logo outside documented variants.
- Place the logo on low-contrast or busy backgrounds.
- Use generic website templates that clash with the logo.
- Add effects, shadows, or gradients to the logo unless explicitly approved.

## Website Agent Prompt

```text
Use the provided Vicwest Roofing VR monogram and VICWEST ROOFING wordmark exactly as supplied. Do not redesign, re-proportion, or recolor. Build a website that feels industrial, trade-credible, and direct — geared toward Ballarat homeowners and builders evaluating roofing work. Use #0F1115 as the primary brand color, #6D6E71 as supporting steel-gray, and #C5A572 (warm brass) only as a sparing accent for primary CTAs. Maintain very strong contrast. Lockup must remain legible at 32px tall in the header; favicon uses the VR mark only.
```
