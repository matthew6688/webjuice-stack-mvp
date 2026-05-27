# Mark Squire Roof Restorations Website Visual Style Contract

## Boundary

This contract defines brand direction and visual guardrails. It does not design the final UI, page structure, component layouts, breakpoints, or frontend implementation.

## Brand Reading

Read the logo first: weight, typography, geometry, color, and personality should drive the website's visual system.

## Overall Style Direction

Style: clean local business

The website should feel honest regional trade, owner-operator, restoration-specialist, workmanlike, heritage-credible (not luxury).

Avoid: No corporate-trade gradient/icon-pack cliché. No badges with 'EST. YEAR' unless the year is verified. No condensed italic display fonts. No luxury jewellery palette (no rich purples / golds beyond a quiet ochre).

## Color Boundaries

```css
:root {
  --brand-primary: #1F232B;
  --brand-secondary: #3A5A6B;
  --brand-accent: #C68C3F;
  --surface: #FFFFFF;
  --surface-muted: #FAF6EE;
  --surface-dark: #111111;
  --text: #1F232B;
  --text-muted: #5A5C61;
  --border: #E4DFD2;
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
- Header: Light header (#FFFFFF) with logo-light.svg. Phone number top-right in brand-secondary blue. Sticky on scroll.
- Footer: Dark footer (#1F232B). logo-dark.svg + secondary text in #B5B5B7. Owner credentials, ABN, Ballarat service area below logo.
- Minimum size: Full lockup: 140px wide minimum. Mark: 24px square. Favicon: 16px (M + S structure remains; ridge-cap softens to single tone).
- Local contact: For local businesses, preserve room for phone number and quote/contact CTA; do not oversize the logo in the header.
- Export safety: check SVG viewBox padding so text, strokes, italic overshoots, and outlined paths are not clipped.

## Typography

- Heading font: Roboto Slab 800 / 600 — slab serif, trade-credible heritage feel.
- Body font: Inter 400/500 — clean sans body pairs with slab headings.
- Fallback stack: 'Roboto Slab', 'Rockwell', 'Georgia', serif (for headings); 'Inter', system-ui, sans-serif (for body)
- Logo typography notes: Slab serif (Roboto Slab Bold 800 — open source). The M and S in the monogram are drawn as outlined paths with slab-serif terminal feet. Wordmark uses the same slab serif family at lower weight (Bold for primary line, Medium for subtitle).

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

Primary CTA: solid brand-primary #1F232B, white text, 3px corner radius (slightly softer than VIP's sharp corners — owner-friendly feel). Secondary: outlined steel-blue border. Hover: 10% darker.

## Cards And Forms

Soft corners (4px). 1px #E4DFD2 border (warm beige border, not cold gray — matches cream surface). Drop shadow optional and very subtle.

## Imagery Direction

Real Ballarat-area before/after restoration photography. Owner-on-site shots. Avoid stock crew handshakes; show actual work and the owner where appropriate.

## Icon Style

Slab-aligned line icons, 1.5–2px stroke, with optional rounded terminals (softer than VIP's). Restoration cues: ridge cap, paint roller, gutter, tile/metal sample, ladder.

## Section Backgrounds

Alternate white #FFFFFF and warm cream #FAF6EE — that cream signals regional / honest / non-corporate. One hero section per page with overlay imagery.

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
Use the supplied Mark Squire MS monogram with its steel-blue ridge-cap apex in the M's valley exactly as drawn — that ridge-cap is the brand's signature element. Brand reads as regional owner-operator, restoration-focused, slab-serif credible (think trade heritage, not luxury). Use #1F232B as primary, #3A5A6B as secondary (corrugated steel blue-gray — accent for ridge cap and supporting elements), and warm cream #FAF6EE as surface-muted alternative. Slab serif headings; sans body. Maintain owner-personal voice; no corporate-trade clichés.
```
