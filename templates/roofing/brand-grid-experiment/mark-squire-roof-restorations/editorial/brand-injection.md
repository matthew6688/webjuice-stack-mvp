# Brand-token → editorial-var mapping

`clients/mark-squire-roof-restorations/v2/brand/brand-tokens.css` is linked verbatim. The editorial design-system's local vars are then re-pointed to those brand values:

| Editorial var | Brand source | Value | Used by |
|---|---|---|---|
| `--bg` | `surface-muted` | `#FAF6EE` | page wash, chips, suburb pills |
| `--surface` (from brand-tokens) | `surface` | `#FFFFFF` | hero, strap, story cards, form, review cards |
| `--surface-warm` | derived from cream | `#F2EADA` | image-frame backstop, story-img placeholder |
| `--fg` | `brand-primary` | `#1F232B` | headings, body, footer bg |
| `--muted` | `text-muted` | `#5A5C61` | captions, fine print |
| `--meta` / `--accent` | `brand-accent` | `#C68C3F` | H2 underline, story numerals, stars, CTA, drop-cap |
| `--brand-blue` | `brand-secondary` | `#3A5A6B` | links, masthead phone, secondary-btn border |
| `--border` (from brand-tokens) | `border` | `#E4DFD2` | card edges, form fields, dividers |

Fonts: `Roboto Slab` (display, 500/600/700/800) + `Inter` (body, 400/500/600/700) loaded via Google Fonts, per `brand-spec.json#heading_font` and `body_font`.

Logos: header `logo-horizontal.svg` (44px), footer `logo-mono-light.svg` (48px) on charcoal, favicon `favicon.svg`.
