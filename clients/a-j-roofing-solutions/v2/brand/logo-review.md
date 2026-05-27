# Logo Review — A & J Roofing Solutions

## Brutal Honesty First

This logo is **synthetic**. It was designed without seeing a real customer logo, without onboarding input, without a single conversation with the owner. The customer's existing site (anjroof.com.au) is a template with a green CTA button — no extractable logomark exists. This kit is a **placeholder** to support OD design experiments and to give the brand kit pipeline parity across customers (vicwest, mark-squire, now a-j).

Treat every glyph here as a draft. The onboarding call should:

1. Confirm or reject the roof-pitch A and downpipe-J metaphor (concrete and roofing-relevant, but maybe too literal for the owner's taste).
2. Confirm or reject the green primary — the audit said "keep green", but the audit might be wrong about the owner's actual preference.
3. Confirm or reject the tropical-coast direction (teal + sand). FNQ businesses sometimes want to be specifically tropical, sometimes specifically not.
4. Verify the founding year (so we can decide whether an EST badge is honest).
5. Establish whether "A & J" should expand (whose initials? a person's name? a co-ownership?). The current logo treats the ampersand as a single coral connector dot because we don't know whose initials these are.

If any of those answers comes back negative, the entire mark is replaced. The brand-tokens.css and visual-style-contract.md may still survive as the website agent's starting palette.

## Brief

- Business: A & J Roofing Solutions
- Niche: metal roofing, ceiling & wall cladding (residential + commercial)
- Location: Cairns / Portsmith, Far North Queensland (tropical AU)
- Tone: established tropical-coast roofer, plain-spoken, 18+ years local, weather-resilient specialist
- Data quality: YELLOW checkpoint — 14 real-signal units, 4679-word brief, but 0 testimonials, only 3 confirmed suburbs, no owner name, no founding year, no real logo on existing site
- Assumptions: green primary derives from audit-praised existing CTA; teal + sand-cream are inferred from Cairns tropical geography; A and J are treated as initials without trying to invent what they stand for.

## Candidate Directions

1. **Roof-Pitch A&J Monogram** (selected) — A is rendered as a literal steep roof gable (the steep pitch is what FNQ houses run for cyclone-rated metal roofing), with a teal ridge-cap accent in the apex notch. Ampersand collapses to a single coral dot (a heat-shimmer, a sun spot, a deliberately minimal connector). J is rendered as a downpipe column with a curved hook foot — completing the gutter-and-downpipe roof-system metaphor.
   - Lockup: stacked mark + DM Sans wordmark + "SOLUTIONS · CAIRNS FNQ" subtitle.
   - Type: DM Sans 800 / 500.
   - Palette: tropical roof green + Coral Sea teal + sun-bleached terracotta + sand cream.
   - Strength: every element maps to a real roofing component (gable, ridge cap, downpipe). Not metaphorical — structural.
   - Risk: the metaphor is loud. Some owners will love it; some will find it too literal. The coral dot is the most subjective element and could be removed in a future revision.

2. **Circular Tropical-Roof Badge** — A circular badge with stylized palm fronds arching over a small gable silhouette, "A & J ROOFING" curved along the bottom arc, "EST. CAIRNS FNQ" along the top.
   - Rejected: the palm fronds drift into beach-resort territory, contradicting brand-spec rule "no palm icons". Circular badges are saturated in trade logos. "EST. CAIRNS FNQ" implies a verified founding year that doesn't exist.

3. **Signature Wordmark** — Handwritten "A & J Roofing" script over a thin metal-sheet underline.
   - Rejected: signature logos require a real signature (owner name unknown), age poorly, don't scale to favicon size, and would be inauthentic given we have no owner data. Owner authenticity should come from copy + on-site photography, not a faked signature.

## Selected Direction

**Roof-Pitch A&J Monogram**. Strongest because the gable + ridge-cap + downpipe geometry maps to actual roof systems (the work the business does) without falling into clip-art metaphor. The green primary anchors the audit-praised existing CTA cue. The teal ridge-cap is the ownable signature element. The coral dot is small enough to function or fail without breaking the mark — favicons collapse to A and J only.

## Rubric Scores (estimated, honest)

| Category | Score | Notes |
|---|---:|---|
| Industry fit | 5 | Gable + ridge cap + downpipe are literal roofing components |
| Distinctiveness | 3 | A-as-gable is a known move in roofer branding, but the teal ridge cap + coral dot combo is uncommon |
| Elegance and craft | 3 | Functional, not refined — paths are blocky, J curve is workmanlike, S-style finesse absent |
| Typography match | 4 | DM Sans 800 reads tropical-modern without being SaaS-clean |
| Small-size usability | 3 | Mark works at 28px; coral dot disappears below 20px (acceptable — the A and J carry it) |
| Color system | 4 | Tropical green + Coral Sea teal + sand differentiates from VIC heritage palettes |
| Versatility | 4 | Light/dark/mono/horizontal/favicon/social all build cleanly |
| Simplicity | 4 | Five mark elements total — the coral dot could arguably be removed |
| Mono usability | 3 | Mono variants work but the teal-and-coral color signals are lost |
| Website handoff quality | 5 | All required deliverables present, tokens documented, agent prompt written |

Total: 38 / 50
Acceptance: PASS as placeholder — replace or confirm at onboarding.

## Revision Notes

- Round 1: Designed inline, no iteration. Single pass.
- The coral ampersand-dot is the element most likely to be cut in a revision pass. It serves the lockup geometry but adds a third color the brand may not need.
- The downpipe-J is also revisable — a straight slab J would be quieter and still scan as roofer-adjacent.

## Mono Check

- Method: teal ridge-cap and coral dot collapse to the same color as the gable.
- Dark mono (`logo-mono-dark.svg`): PASS — A gable and J remain structurally clear; ridge-cap notch reads as inner V shape; coral dot reads as a connector beat.
- Light mono (`logo-mono-light.svg`): PASS — same behavior on dark surfaces.
- Note: full-color is meaningfully stronger. Mono is acceptable for print, fax, and embossing only.

## Synthetic-Origin Disclosure

- Provenance: `INTERNAL_INFERRED`.
- No customer logo was sighted or extracted.
- The primary green derives from the audit's note about the existing site's green CTA — not from a customer brand book.
- The teal and coral were chosen for Cairns geographic differentiation from vicwest (navy + amber) and mark-squire (steel blue + cream).
- Type choice (DM Sans, not Roboto Slab) was a deliberate move away from the VIC heritage slab-serif aesthetic.
- The mark must be replaced or confirmed at onboarding before any customer-facing publication beyond design experiments.

## Final Notes

- DM Sans is an open-source sans serif (Google Fonts) — free to deploy commercially.
- Wordmark uses live `<text>` elements; outline to paths for print fidelity.
- The mark should not be claimed in proposal copy as "designed for A & J Roofing Solutions" — it is a placeholder.
- If the green is replaced after onboarding, brand-tokens.css and the visual-style-contract carry forward with the new color swapped into `--brand-primary`. The teal and coral can be retained or replaced independently.
