# DESIGN.md - profitslocal Design System

> Source of truth for `profitslocal.com`. The main site uses a warm, poster-like local-business visual system: cream paper, coral action, bold black rules, editorial serif type, and layered local website preview imagery.

## Brand Sentence

Beautiful, research-backed local-business websites, pre-built before the customer pays.

## Visual Direction

**Local Intelligence Collage**

- Warm light-mode only: cream and paper surfaces carry the page.
- Coral is reserved for primary CTAs, logo mark, stamps, and headline emphasis.
- Black 2px rules, simple shadows, and paper-like panels make the site feel tangible.
- Large editorial serif headlines do the emotional work.
- Real/generated preview imagery should show local-business websites, storefronts, maps, search notes, or launch workflows.
- Avoid dark AI dashboards, generic SaaS card grids, purple gradients, sterile stock photography, and vague abstract decoration.

## Tokens

| Token | Value | Usage |
| --- | --- | --- |
| `--pl-cream` | `#FFF6EC` | Main warm background |
| `--pl-paper` | `#FFFCF7` | Cards, form panels, section frames |
| `--pl-ink` | `#17191C` | Text, borders, shadows |
| `--pl-muted` | `#5E6268` | Body copy and secondary text |
| `--pl-coral` | `#FF5A3D` | Primary CTA, logo, emphasis |
| `--pl-coral-soft` | `#FFB39F` | Footer/accent text |
| `--pl-peach` | `#FFE1CE` | Warm visual panels |
| `--pl-citrus` | `#FFD45A` | Pricing note, growth cues |
| `--pl-mint` | `#CDECCF` | Trust/process panels |
| `--pl-green` | `#47B86A` | Positive checks |
| `--pl-sky` | `#8BD3F7` | Preview collage panels |
| `--pl-blue` | `#327BEA` | Search/SEO accent only |

## Typography

- Display: `Georgia, Times New Roman, serif`
- Body/UI: system sans
- H1/H2 should be very large, serif, tight line-height, and use italic coral emphasis sparingly.
- UI labels are uppercase, compact, and heavy.
- Letter spacing stays at `0` except small uppercase labels.

## Layout

- Sections use full-width `poster-section` bands.
- Primary content is framed with 2px black borders.
- Desktop sections often split into copy and visual panels.
- Mobile stacks sections into one column, preserving the framed poster character.
- Cards are used for repeated items only: steps, pricing tiers, FAQ items, listing cards, and form fields.

## Components

- Primary button: coral background, white text, 2px black border, black offset shadow.
- Secondary button: paper background, black text, same border/shadow.
- Pricing cards: three clear tiers, with the yearly plan highlighted in mint.
- Brief form: dense but legible, built around actual business intake fields.

## QA Checklist

- First viewport must show the brand, offer, and CTA without waiting for JavaScript.
- No overlapping text on mobile.
- No nested cards or generic SaaS feature-card sprawl.
- No emoji-as-icon UI.
- Images must render and be relevant to local-business website previews.
- Build must pass with Astro.
