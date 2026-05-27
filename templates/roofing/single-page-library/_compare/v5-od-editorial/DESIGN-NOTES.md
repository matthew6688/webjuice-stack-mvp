# v5-od-editorial · design notes

Vicwest Roofing single-page · built on the **open-design `editorial`** design system as a hard brand contract.

Source: `/tmp/open-design/design-systems/editorial/`
- `tokens.css` (lines 6–63 = the `:root { ... }` block)
- `DESIGN.md` (warm paper, serif display, composed story cards)
- `components.html` (hero spread + metric strap + tiles as canonical shapes)

---

## 1 · tokens.css verbatim · YES

Pasted verbatim into the `<style>` block at the top of `preview.html`.

- Source: `/tmp/open-design/design-systems/editorial/tokens.css` lines **6–63** (the entire `:root { ... }` declaration).
- Target: `preview.html` lines roughly **66–124** — fenced with two banner comments `/* === EDITORIAL DESIGN SYSTEM · tokens.css VERBATIM ... === */` and `/* === END VERBATIM tokens.css === */`.
- Every declaration, value, and ordering preserved — no edits, no additions, no overrides via a second `:root` block.
- All downstream CSS references the tokens only via `var(--*)`. No hard-coded hex colours, no hard-coded font families, no hard-coded spacing — verified by visual scan of the file (only hex values that appear are inside the `:root` block itself).

## 2 · Custom properties actually used

Colour:
- `--bg` page background
- `--surface` cards, masthead chip, form, input fields, story cards
- `--surface-warm` review pull-quote cards, gallery image bg, hero frame bg
- `--fg`, `--fg-2`, `--muted` text hierarchy (display / body / meta)
- `--meta` eyebrows, folio numbers, drop-cap, stars, accents in mono labels
- `--accent`, `--accent-on`, `--accent-hover`, `--accent-active` primary CTA + focus ring
- `--border`, `--border-soft` card outlines, rules between strap cells, section dividers
- `--success` (kept available; not surfaced — single-page has no live status)
- `--danger`, `--warn` left available for future form-error states

Type:
- `--font-display` Georgia for H1–H4, brand mark, pull-quotes, drop-cap, contact dd values
- `--font-body` Source Serif Pro for paragraphs, leads, buttons, inputs
- `--font-mono` IBM Plex Mono for eyebrows, folio markers ("Section I…VI"), chips, captions, mobile CTA label, footer colophon, suburb pills
- All sizes `--text-xs` → `--text-4xl` mapped to the scale: xs for eyebrows/captions, sm for nav/buttons/inputs, base for body, lg for leads + contact values, xl for H3, 2xl for strap metrics, 3xl for H2, 4xl for H1
- `--leading-body 1.65`, `--leading-tight 1`, `--tracking-display -0.02em` applied at the global heading rule

Space + shape:
- `--space-1…12` for all gaps, padding, margins
- `--section-y-desktop / -tablet / -phone` drive responsive `section { padding-block }`
- `--container-max 1120px` + three `--container-gutter-*` breakpoints
- `--radius-sm` for inputs, `--radius-md` for buttons, `--radius-lg` for cards/panels, `--radius-pill` for chips/suburb pills/status dots

Effects:
- `--elev-ring` secondary button outline
- `--elev-raised` hero frame, about figure, form, story card hover
- `--focus-ring` every focusable element
- `--motion-fast`, `--motion-base`, `--ease-standard` on all transitions

## 3 · How DESIGN.md philosophy shows up in the output

The brief words from editorial DESIGN.md — "warm paper surfaces, serif display type, and composed story cards" plus "magazine-inspired editorial layout" — are taken literally as the brief, not as a loose vibe:

- **Magazine masthead.** The header reads `Vicwest Roofing — Ballarat · Est. 2003` with a hairline rule between the wordmark and the folio in mono caps. Sticky, paper-toned, subtle backdrop blur. No logo bug, no nav background fills — just type and rules, the way a magazine masthead is composed.

- **Folio numbering across sections.** Each section opens with a mono `Section I … Section VI` label + a small horizontal rule and a thematic eyebrow ("The Catalogue", "The Workshop", "From the letters page", "The Plates", "The Beat", "The Correspondence"). This is the editorial publishing tic — the page reads as a *bound issue*, not a SaaS landing page.

- **Story cards.** The 6 services use the components.html "story card" shape verbatim: surface card, photo top, body bottom, with a mono `01 / Replacement` numbering scheme. Hover lifts with `--elev-raised` over `--motion-base`. Card spacing comes from `--space-6` interior padding and `--space-8` grid gap — the components.html rhythm.

- **Hero as cover spread.** The hero is a magazine cover spread: 1.1fr text column, 0.9fr image column (matching components.html `.hero` grid exactly), Plate-numbered caption pinned to the image, a vol/issue eyebrow above the H1. Image is portrait 4:5 — the magazine-cover aspect, not the SaaS hero 16:9.

- **Composed strap.** The 4-up metric strap (22+, 10yr, VBA, 4.1/5) is the exact `.metric-grid` shape from components.html — surface band, hairline rules between cells, display-serif numerals, mono meta below.

- **Pull-quote reviews.** Reviews drop the avatar-card pattern in favour of editorial pull quotes: warm-paper `--surface-warm` block, oversized opening curly-quote glyph in `--meta` caramel, italic display serif body, author + suburb in body + mono meta beneath. This is "letters to the editor", not "testimonial card".

- **Drop-cap on the about block.** First paragraph of the about section opens with an 88px Georgia drop-cap in `--meta` caramel — straight out of the magazine-feature playbook.

- **Captioned figures.** Hero image, about image, and gallery before/after pairs all have proper `<figcaption>` blocks with mono caps captions — never naked images.

- **Coverage as a labelled index.** Suburbs are a wrapped row of pill-labelled mono caps inside a bordered `--surface` panel, framed as a "Section V — The Beat" index of where the publication's reporters work.

- **Colophon, not "footer".** The footer is dark-on-paper (`--fg` background, `--bg` text) and explicitly typed in the bottom bar as "Set in Source Serif Pro & Georgia · VBA · CDB-U 65938" — a real colophon line.

- **Spacing rhythm.** `--section-y-desktop: 112px` is enormous for a service-business site; we keep it. White space *is* the design here. Hairline `--border-soft` rules between sections enforce the editorial feeling without ever needing big coloured panels.

- **No decorative effects beyond the system.** Per Anti-patterns §9 of DESIGN.md: no gradients beyond the warm paper bg, no shadows other than `--elev-raised`, no off-palette colour, no flattened hierarchy (display-serif H1 92px → H2 66px → H3 30px → body 18px → meta 12px is a real five-step ladder).

## 4 · How this differs from V2 (taste-skill core · also "warm-editorial")

Both target a "warm editorial" register, but v5 is a **specific committed system** while V2 is a **flexible taste protocol**. The differences are stylistic and structural, not vibes:

| Axis | V2 taste-skill core | v5 open-design `editorial` |
|---|---|---|
| **Body type** | IBM Plex Sans (sans-serif) | Source Serif Pro (serif) |
| **Display type** | IBM Plex Sans heavy weights | Georgia (true text-face serif) |
| **Mono accent** | Plex Mono | IBM Plex Mono (same family — but used much more aggressively for folios, captions, chips) |
| **Page bg** | `#f4efe6` paper | `#fbf7f0` warmer cream |
| **Card bg** | `#ebe4d4` cloud | `#fffdf8` near-white surface + `#f1e6d6` warm-paper for pull-quotes |
| **Accent** | `#b8492c` brick red (terracotta) | `#9a5a2f` darker caramel/copper |
| **Card radius** | 8px | 12px (`--radius-lg`) for cards, 4px (`--radius-sm`) for inputs |
| **Body line-height** | 1.55 | 1.65 (`--leading-body`) — looser, more print-like |
| **H1 scale** | clamp around 56–72px | 92px desktop (`--text-4xl`) — magazine cover scale |
| **Section padding** | ~96px desktop | 112px desktop (`--section-y-desktop`) — even more air |
| **Hero shape** | wide editorial banner, landscape image | 1.1fr / 0.9fr split with portrait 4:5 image · captioned "Plate 01" |
| **Section heads** | eyebrow + H2 + lead | folio "Section I" + mono divider rule + thematic eyebrow + H2 + lead — page reads as bound issue |
| **Service cards** | clean editorial card with eyebrow | story-card pattern from components.html: photo top + numbered `01 / Replacement` mono label + display-serif H3 |
| **Reviews** | testimonial card with star count | warm-paper pull-quote block · large opening curly-quote in caramel · italic display-serif body |
| **About** | two-column with figure | identical layout — but adds an 88px Georgia drop-cap on the opening paragraph (V2 doesn't) |
| **Footer** | paper-on-paper | dark colophon (`--fg` bg, paper text) with type-credit line — the editorial publishing convention |
| **Voice on micro-copy** | "Get a free quote" | "Request a written quote" · "Send the brief" — bookish register |
| **Folio numbering** | none | Roman numerals Section I → VI across all major sections |
| **Drop-cap, plate captions, colophon line** | none | all present — the magazine-feature touches that DESIGN.md asks for |
| **Image aspect** | 16:9 landscape | 4:5 portrait + 1:1 gallery — print ratios, not screen ratios |

In short: V2 is "warm editorial as a sensibility". v5 is "warm editorial as a publication" — a specific design system has been adopted as the brand contract, and the page reads as Issue 03 of *The Ballarat Roofing Journal* rather than a website. Same business, same data, recognisably different artefact.
