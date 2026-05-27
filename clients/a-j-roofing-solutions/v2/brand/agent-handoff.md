# Agent Handoff

## Brand

- Business: A & J Roofing Solutions
- Industry: metal roofing, ceiling & wall cladding (residential + commercial)
- Location: Cairns / Portsmith, Far North Queensland (tropical AU)
- Output mode: website-ready brand kit
- Provenance: INTERNAL_INFERRED — synthetic placeholder pending onboarding confirmation

## Read Order

1. `brand-assets.md`
2. `visual-style-contract.md`
3. `logo-qa-checklist.md`
4. `logo-review.md` (includes honest synthetic-origin disclosure)
5. SVG assets

## Logo Usage

- Light background: `logo-light.svg`
- Dark background: `logo-dark.svg`
- Horizontal lockup: `logo-horizontal.svg`
- Compact mark: `logo-mark.svg`
- Favicon / social: `favicon.svg` for tabs · `social-avatar.svg` (sand cream bg) for Google Business Profile.

## Non-Negotiables

- Keep logo visible and uncropped in header, hero, footer, mobile.
- Use documented dark / light / mono variants only.
- Do not recolor or distort the logo.
- Do not place light logo on tropical-sky or palm-frond photography without a 60% white scrim.
- Preserve local phone / quote / contact priority — phone CTA must be visible above the fold on every page (this fixes the audit's most expensive conversion issue).
- Use brand tokens by role: green for primary CTAs, teal for secondary / links, coral for small accents only.
- Follow `visual-style-contract.md` as direction and guardrails, not fixed UI.
- Never add an "EST. YEAR" badge — founding year is not verified.
- Never use beach-resort visual cues (palm icons, surf imagery, aqua washes).

## Website Agent Freedom

The website agent owns:

- page layout
- component design
- spacing
- section order
- responsive breakpoints
- frontend implementation
- hero composition and copy variants
- form length and field selection (within the audit-driven low-friction guidance)

## Constraints

- Color: Use brand tokens by role and preserve contrast. Green is the primary CTA color (audit-praised). Teal is secondary. Coral is small accent only.
- Typography: DM Sans 800/600 headings, Inter 400/500 body. No slab serifs (that's the mark-squire/heritage aesthetic, not FNQ tropical).
- Imagery: Real Cairns / Portsmith / FNQ roof photography. Metal roofing on Queenslanders, commercial cladding, weather-resilient details, on-site team shots. Avoid stock palm-tree beach shots and stock crew handshakes.
- Proof chips allowed: "18+ years serving Cairns & FNQ", "Licensed QBCC 1161095", "ABN 34 134 811 831", "Licensed and fully insured". Do not invent additional proof chips.
- Service taxonomy: metal roofing, ceiling cladding, wall cladding, residential roofing, commercial roofing. Five real services confirmed in handoff/content/services.json.
- Avoid: corporate-trade gradient/icon-pack cliché, EST badges, condensed display fonts, luxury palette, beach-resort cues.

## Known Limitations

- Wordmark uses live `<text>` elements rendered via DM Sans font family. For print/PDF use, outline to paths first.
- Logo is INTERNAL_INFERRED — no real customer logo was sighted. This brand kit is a placeholder until onboarding.
- Coral dot (the ampersand) is the smallest mark element and disappears below ~20px — by design. The A gable and J downpipe carry the logo at favicon size.
- Green primary derives from audit's praise of the existing site's green CTA — not from a customer brand book. If the owner names a different brand color at onboarding, swap `--brand-primary` while retaining teal + sand surface system.
- No testimonials, no owner name, no founding year. The site can confidently claim only what is in `checkpoint.json` hard fields.
