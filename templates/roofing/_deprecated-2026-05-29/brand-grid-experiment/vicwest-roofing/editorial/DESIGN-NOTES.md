# Editorial × Vicwest — Design Notes

## What changed from the V5 base

V5 ran the editorial design system on a generic sand-cream + rust-amber palette (#fbf7f0 / #9a5a2f) with Source Serif Pro for both display and body. This render keeps the editorial *structure* — magazine masthead, File-No. eyebrows, Section folios, plate captions, drop-cap on the about column, pull-quote reviews — but swaps the palette and typography to vicwest's brand contract.

## How vicwest's brand drove the changes

- **Palette flip**: sand-cream surface → pure white (`--surface #FFFFFF`) and muted gray (`#F4F4F5`). Body text and headlines now anchor in near-black `--brand-primary #0F1115`. The decorative rust accent retires; **brass `#C5A572`** takes over every accent role.
- **Typography rebalanced for an engineer brand**: headline kept in Source Serif Pro (editorial register, per experiment rules), but body, nav, labels and metric numbers moved to **Inter Tight / Inter** — vicwest is a no-nonsense trades brand, not a literary supplement. JetBrains Mono replaces IBM Plex for eyebrows so the typographic tone reads "tradesman's stamp," not "literary footnote."
- **No italic flourishes** (per brand spec): the review blockquote lost its italic; the about-column drop-cap stays serif but switches from rust to brass.
- **Squared corners** (brand: 2px max): radii pulled back from 8–12px to 2–4px on chips, suburb pills, gallery before/after badges, form inputs. Removes the soft "magazine card" feel and replaces it with a harder editorial-meets-trades register.
- **Dark footer + dark mobile CTA** in `--brand-primary` with `logo-mono-light.svg`, brass section labels, brass hover on links. The colophon now reads like a printer's mark, not a soft warm-gray credits block.
- **Brass at H2 underline + CTA + drop-cap + blockquote opener + review left-border + pair-caption badge** — accent strictly reserved for hierarchy emphasis, matching the editorial pattern.

## Net effect

The page still reads as an editorial spread — section folios, plate captions, File-No. eyebrows are all intact — but the palette/typography swap moves it from "Sunday literary supplement" to "trades journal / industrial annual report." That is the right destination for a VBA-licensed Ballarat roofer.
