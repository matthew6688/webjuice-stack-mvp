# Logo QA Checklist

Business: Vicwest Roofing

- [x] Expected assets exist or omissions are documented. — 9 SVGs present (mark, wordmark, horizontal, light, dark, mono-light, mono-dark, favicon, social-avatar). All 9 target variants delivered.
- [x] SVG files validate. — All 9 SVGs pass `xmllint --noout` with no errors (verified 2026-05-27).
- [x] SVG viewBox has export-safety padding. — Stacked lockups use 1653×1096 viewBox (≈100u headroom above 823 mark + 233 wordmark + 40u gap). Mark uses 1653×823 with no inner clipping. Favicon padded to 1653×1653 with 415u top offset. Social avatar uses 1024×1024 with 64px outer margin.
- [x] Logo is transparent unless a background was requested. — All except `social-avatar.svg` are transparent. Social avatar intentionally carries the `#F4F4F5` warm-gray background per spec (safe for circle crops).
- [x] Dark and light variants preserve contrast. — Light: black V (#000) + steel-gray R (#6D6E71) + dark wordmark (#3A3A3C) on white — high contrast. Dark: V → white, R → light gray (#B5B5B7), wordmark → white on `#0F1115`. Both variants meet WCAG AA at logo scales.
- [x] No hidden rectangle is used to fake contrast. — `social-avatar.svg` background is documented and intentional. No hidden rects in light/dark/mono variants.
- [x] Existing-logo changes are documented as cleanup, adaptation, or optional redesign. — Documented in `brand-assets.md` → "Existing Logo Source Notes": path-traced from PNG, normalized colors, derived dark/mono/horizontal variants.
- [x] Exact-font uncertainty and fallback strategy are documented. — Documented: original font undeclared on source site; closest match Eurostile Extended / Bank Gothic family. Wordmark shipped as outlined SVG paths so no live font required at render. Fallback stack documented in `brand-assets.md` typography section.
- [x] Header-size logo remains readable. — Full lockup readable at 32px header height (≈120px width minimum documented). Horizontal lockup designed for header use at 40-56px tall.
- [x] Local phone/quote action has room when applicable. — Header spec explicitly reserves top-right phone slot with brass accent. Documented in `visual-style-contract.md`.
- [x] Footer logo remains visible and not overpowered. — Dark footer spec uses `logo-dark.svg` on `#0F1115` with white text; logo remains the primary brand object.
- [x] Favicon/social asset is not a squeezed full horizontal logo. — `favicon.svg` is VR mark padded to 1:1 (1653×1653). `social-avatar.svg` is VR mark centered in 1024×1024 with warm-gray ground. Neither letterboxes the full stacked lockup.
- [x] Visual style contract is direction and guardrails, not UI spec. — `visual-style-contract.md` documents color roles, type, shape language, do/don't. Does not prescribe specific page structure or breakpoints.
- [x] Agent handoff tells website agent what it may decide. — `agent-handoff.md` lists what the website agent owns (layout, components, spacing, sections, breakpoints) and what it must not change (logo, colors, type personality).
- [x] Final response mentions meaningful limitations. — Documented in `brand-assets.md` "Known limitations": raster source → path-traced approximation, unverified original font, color values extracted from raster means, no client-approved clearspace, replace if AI/EPS source becomes available.

## Notes

- Horizontal lockup (`logo-horizontal.svg`) was derived 2026-05-27 by combining the existing VR mark (left) with the `VICWEST ROOFING` wordmark (right), wordmark vertically centered against mark cap-height. Paths are unchanged from source SVGs — no redraw, just composition.
- Brand-tokens.css extended from 11 to 13 CSS variables: added `--surface-dark: #111111` and niche-specific `--roof-shadow: rgba(15, 17, 21, 0.18)` for the industrial shadow treatment under roof-photo cards.
- Canonical source for this kit: `clients/vicwest-roofing/concept/open-design-v2/brand/` (identical to `od-rerun-with-patches/brand/` and `open-design-seed/brand/` — all three concept dirs carry byte-identical brand files).
