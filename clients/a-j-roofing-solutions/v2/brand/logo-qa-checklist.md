# Logo QA Checklist

Business: A & J Roofing Solutions

- [x] Expected assets exist or omissions are documented. — 9 SVG files present (mark, wordmark, horizontal, light, dark, mono-dark, mono-light, favicon, social-avatar).
- [x] SVG files validate. — All 9 SVGs are well-formed XML, single root `<svg>`, no unclosed tags.
- [x] SVG viewBox has export-safety padding. — viewBoxes provide 30-80 units of padding around glyph extremes; text overshoot accounted for in light/dark lockups (820 height for 720 baseline).
- [x] Logo is transparent unless a background was requested. — All marks transparent; only `social-avatar.svg` carries the documented #F6F0E4 cream fill.
- [x] Dark and light variants preserve contrast. — Light variant on white: green #1B5E3F vs white ≈ 7.5:1. Dark variant on tropical-shade #0F3D2A: white text + #5FD0C9 teal ridge-cap both ≥ 4.5:1.
- [x] No hidden rectangle is used to fake contrast. — Only social-avatar uses a visible declared background; others are transparent.
- [x] Existing-logo changes are documented as cleanup, adaptation, or optional redesign. — N/A: no existing logo. This is a NEW synthetic logo marked INTERNAL_INFERRED.
- [x] Exact-font uncertainty and fallback strategy are documented. — Wordmark uses live <text> with DM Sans → Inter → system-ui fallback. For print/PDF, outline first. Documented in brand-spec.json `limitations`.
- [x] Header-size logo remains readable. — At 160px wide (full lockup) all elements legible; at 28px (mark only) gable + J still readable; coral dot collapses below 20px by design.
- [x] Local phone/quote action has room when applicable. — Header spec reserves top-right tap-to-call slot; logo-mark.svg used on mobile to free width.
- [x] Footer logo remains visible and not overpowered. — Dark variant uses white + bright teal ridge cap that survive on #0F3D2A footer.
- [x] Favicon/social asset is not a squeezed full horizontal logo. — favicon.svg is the mark padded square; social-avatar.svg is mark centered on cream 1024×1024.
- [x] Visual style contract is direction and guardrails, not UI spec. — visual-style-contract.md describes color roles, typography, shape language, density — no fixed component layouts.
- [x] Agent handoff tells website agent what it may decide. — agent-handoff.md lists website-agent freedoms (layout, breakpoints, section order) and non-negotiables (logo, color tokens, no EST badges).
- [x] Final response mentions meaningful limitations. — brand-spec.json `limitations` array lists: live text in wordmark, INTERNAL_INFERRED origin, coral-dot disappearing below 20px, green-derived-from-audit-CTA.

## Notes

- This kit is **synthetic / INTERNAL_INFERRED**. The customer has no extractable existing logo and was a YELLOW data-checkpoint (4679-word brief, 14 real-signal units, but 0 testimonials and 3 of 10 suburbs). The kit is a placeholder to enable OD/design experiments and customer-conversation visuals. It must be replaced or confirmed during onboarding.
- The primary green #1B5E3F was chosen because the audit explicitly praised the existing site's green CTA as "works well for a roofing business (conveys reliability and nature)... retain as the brand primary." This is the strongest real brand cue available.
- The teal ridge-cap and coral ampersand-dot are inferred from Cairns tropical geography (Coral Sea + sun-bleached coast), not from any client data.
- No customer-facing materials should claim a founding year. The verified positioning is "18+ years serving Cairns & Far North Queensland", not a specific date.
