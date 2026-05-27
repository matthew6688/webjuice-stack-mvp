# Brand Assets

## Brand Summary

- Business name: Mark Squire Roof Restorations
- Short name/key word: Mark Squire
- Industry/niche: roof restoration (residential)
- Local area: Ballarat, Victoria (regional VIC)
- Brand personality: honest regional trade, owner-operator, restoration-specialist, workmanlike, heritage-credible (not luxury)
- Logo strategy: MS monogram with apex 'ridge-cap' detail in M's center valley + slab-serif wordmark below
- Output mode: website-ready brand kit

## Logo Assets

- `logo-light.svg`: Full stacked lockup (MS mark + MARK SQUIRE + ROOF RESTORATIONS) for light surfaces.
- `logo-dark.svg`: Full lockup for dark surfaces (MS → white, ridge cap → light blue #7FA6BD, wordmark → white).
- `logo-mark.svg`: MS monogram only · use for compact placements / favicon source / badge.
- `logo-wordmark.svg`: MARK SQUIRE + ROOF RESTORATIONS wordmark only.
- `logo-mono-dark.svg`: All-dark single color (ridge cap loses color but apex geometry remains via shape).
- `logo-mono-light.svg`: All-white single color version.
- `favicon.svg`: MS mark padded to 1:1 · ridge-cap blue retained at favicon size.
- `social-avatar.svg`: MS mark on warm cream #FAF6EE 1024×1024 — natural circle/square crop.

Clearspace: Reserve at least the M's vertical-column width (~100 SVG units / 1× cap-height) around the full lockup.
Minimum size: Full lockup: 140px wide minimum. Mark: 24px square. Favicon: 16px (M + S structure remains; ridge-cap softens to single tone).
Background restrictions: Light variant on #FFFFFF, #FAF6EE, and lighter pale stocks. Dark variant on surfaces darker than #2A2A2E. Do not place light logo on busy roofing photography without scrim. Ridge-cap blue must reach 3:1 contrast.
Small-size assets: Use logo-mark.svg or favicon.svg for header <56px or compact UI.
Visual style contract: See visual-style-contract.md.
Agent handoff: See agent-handoff.md.
QA checklist: Run logo-qa-checklist.md before delivery.



## Color System

```css
:root {
  --brand-primary: #1F232B;
  --brand-secondary: #3A5A6B;
  --brand-accent: #C68C3F;
  --surface: #FFFFFF;
  --surface-muted: #FAF6EE;
  --text: #1F232B;
  --text-muted: #5A5C61;
  --border: #E4DFD2;
}
```

## Typography

- Logo typography: Slab serif (Roboto Slab Bold 800 — open source). The M and S in the monogram are drawn as outlined paths with slab-serif terminal feet. Wordmark uses the same slab serif family at lower weight (Bold for primary line, Medium for subtitle).
- Heading font: Roboto Slab 800 / 600 — slab serif, trade-credible heritage feel.
- Body font: Inter 400/500 — clean sans body pairs with slab headings.
- Fallback stack: 'Roboto Slab', 'Rockwell', 'Georgia', serif (for headings); 'Inter', system-ui, sans-serif (for body)

## UI Direction

- Header: Light header (#FFFFFF) with logo-light.svg. Phone number top-right in brand-secondary blue. Sticky on scroll.
- Footer: Dark footer (#1F232B). logo-dark.svg + secondary text in #B5B5B7. Owner credentials, ABN, Ballarat service area below logo.
- Favicon/social: favicon.svg for tabs · social-avatar.svg (warm cream bg) for Google Business Profile.
- Buttons: Primary CTA: solid brand-primary #1F232B, white text, 3px corner radius (slightly softer than VIP's sharp corners — owner-friendly feel). Secondary: outlined steel-blue border. Hover: 10% darker.
- Links: Inline links use brand-secondary #3A5A6B with underline. Hover deepens to #2A4254.
- Section backgrounds: Alternate white #FFFFFF and warm cream #FAF6EE — that cream signals regional / honest / non-corporate. One hero section per page with overlay imagery.
- Cards/forms: Soft corners (4px). 1px #E4DFD2 border (warm beige border, not cold gray — matches cream surface). Drop shadow optional and very subtle.
- Icons: Slab-aligned line icons, 1.5–2px stroke, with optional rounded terminals (softer than VIP's). Restoration cues: ridge cap, paint roller, gutter, tile/metal sample, ladder.
- Imagery: Real Ballarat-area before/after restoration photography. Owner-on-site shots. Avoid stock crew handshakes; show actual work and the owner where appropriate.
- Avoid: No corporate-trade gradient/icon-pack cliché. No badges with 'EST. YEAR' unless the year is verified. No condensed italic display fonts. No luxury jewellery palette (no rich purples / golds beyond a quiet ochre).
- Website visual style: Regional honest trade. Slab serif headings + cream warmth + steel blue accent. Owner-operator voice in copy. Photo-heavy with real restoration work. Not luxury, not SaaS, not 'modern minimal'.

## AI Website Agent Prompt

```text
Use the supplied Mark Squire MS monogram with its steel-blue ridge-cap apex in the M's valley exactly as drawn — that ridge-cap is the brand's signature element. Brand reads as regional owner-operator, restoration-focused, slab-serif credible (think trade heritage, not luxury). Use #1F232B as primary, #3A5A6B as secondary (corrugated steel blue-gray — accent for ridge cap and supporting elements), and warm cream #FAF6EE as surface-muted alternative. Slab serif headings; sans body. Maintain owner-personal voice; no corporate-trade clichés.
```
