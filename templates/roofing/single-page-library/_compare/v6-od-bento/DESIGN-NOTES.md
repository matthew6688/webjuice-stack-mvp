# V6 · OD Bento — Design Notes

Single-page Vicwest Roofing site built on the Open Design `bento` system. The brand contract is `/tmp/open-design/design-systems/bento/{tokens.css, DESIGN.md, components.html}`.

## Bento philosophy across the whole page

Every section is a tile composition on a shared 12-column grid (not just services). The page reads as Notion / Linear / Apple Notes stat tiles, with asymmetric spans and soft borders.

### Tile sizes / ratios per section

| Section  | Grid                                                                                  | Notes                                                                        |
| -------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Hero     | 12-col, 4 tiles: headline(7) + image(5, row-span 2) + metrics(7) + area mini(5)       | Asymmetric — image is the tall right column, two short tiles stack at right |
| Services | 12-col, 6 tiles: feature(7) + side(5) + 4× half(6,6,6,6)                              | Replacement is the hero tile (16:9 thumb); others 16:10                      |
| About    | 12-col: photo(5) + copy(7) + 4 facts(3 each)                                          | Photo tile is `media` variant (image fills); facts are mini-cards            |
| Reviews  | 12-col: hero review(7) + stack of 2(5)                                                | Karen S. featured (warm surface); Mark + Janine stacked                      |
| Gallery  | 12-col: 3× pair(4), each pair is a sub-grid (before/after side-by-side + caption row) | Each card is its own bento (mini-bento)                                      |
| Areas    | 12-col: chips tile(8) + by-arrangement tile(4, warm)                                  | 16 chips + 2 chips                                                           |
| Contact  | 12-col: form(7, raised) + side-stack with reach tile + hours tile(5)                  | Form is the elevated tile; side is two stacked mini-tiles                    |
| Nav      | Tile-shaped sticky pill with backdrop blur and `--elev-raised`                        | Nav itself is a bento tile, not a flat bar                                   |
| Sticky CTA | 2-col tile floating at bottom, same border/radius/shadow as nav                      | Mobile only                                                                  |

## How "modular bento" is achieved beyond services

1. **Nav is a tile** — rounded `--radius-lg`, `--elev-raised` shadow, backdrop-blur, sits inside container with margin. Not a flat full-width bar.
2. **Hero is 4 tiles, not a banner** — headline, image, metrics, and service-area chips are independent tiles on the same grid. Image tile spans 2 rows so it feels like a tall product card.
3. **About splits photo from copy as separate tiles** + a 4-tile fact row below. Same shared border + radius vocabulary.
4. **Reviews is 1-large + 2-stacked tiles**, not a 3-up carousel. The featured review uses the warm surface token to signal hierarchy without adding new color.
5. **Gallery cards are mini-bentos** — each pair is a 3-cell sub-grid (before / after / caption). Same `--radius-lg` wrapper, 4px gutters between the before/after photos to keep them paired but distinct.
6. **Contact is form-tile + 2 side-tiles** (reach details + hours), each with its own eyebrow. Hours tile uses the warm surface to differentiate without color drift.
7. **Sticky mobile CTA** is itself a floating tile (same border, radius, blur, shadow as the nav) — keeps the bento metaphor on phones.

## Mobile collapse strategy

Bento grids break ungracefully if you just `grid-template-columns: 1fr`. Strategy used:

- **Single shared 12-col grid** everywhere, with each tile setting `grid-column: span N` at breakpoints.
- **At 980px** (tablet): every tile becomes `grid-column: span 12` (full width, stacked). Hero image loses `row-span` and gets a min-height of 280px so it stays photographic, not strip-thin.
- **At 640px** (phone): metric grid collapses 3→1; gallery pairs collapse 3→1; fields collapse 2→1. Container gutter drops to 16px via token.
- **About facts** specifically: 4→2→1 (extra breakpoint at 540px) — 4 narrow facts look cramped on tablet.
- **Nav links hide** below 860px; brand + phone CTA remain.
- **Sticky bottom CTA** activates ≤720px (Call + Quote, 2-col tile).
- All tiles keep their `--radius-lg`, `--border`, and padding on mobile — the visual language doesn't degrade into flat stacked cards.

## Tokens used verbatim from bento system

`:root` in the HTML is a byte-for-byte paste of `tokens.css` (lines 6-63 of the source).

Tokens actually consumed by the page (no invented colors, no invented fonts):

- **Color**: `--bg`, `--surface`, `--surface-warm`, `--fg`, `--fg-2`, `--muted`, `--meta`, `--border`, `--border-soft`, `--accent`, `--accent-on`, `--accent-hover`, `--success`, `--warn`, `--danger`
- **Font**: `--font-display`, `--font-body`, `--font-mono` (Inter + SF Mono via Google Fonts link)
- **Type scale**: `--text-xs` through `--text-4xl` (h1 uses `clamp(40px, 6vw, --text-4xl)` to keep responsive)
- **Spacing**: `--space-1` through `--space-12`, plus `--section-y-desktop/tablet/phone`
- **Radii**: `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-pill`
- **Elevation**: `--elev-ring`, `--elev-raised`, `--focus-ring`
- **Motion**: `--motion-fast`, `--motion-base`, `--ease-standard`
- **Container**: `--container-max`, `--container-gutter-{desktop,tablet,phone}`

The hero page background uses the same `radial-gradient(circle at 80% 6%, rgba(37,99,235,0.16), transparent 38%)` motif as `components.html` so the bento atmosphere reads instantly.

## SEO / a11y

- Single H1; H2 per major section.
- Meta description 158 chars.
- Canonical, hreflang `en-AU`, OG, Twitter card.
- LocalBusiness JSON-LD as `RoofingContractor` with VBA CDB-U 65938 identifier, opening hours, areaServed array, aggregateRating 4.1 / 18.
- Skip link, semantic landmarks (`header`, `main`, `footer`, `nav`, `section[aria-labelledby]`), aria-required on Name + Email.
- All images have descriptive alt text (no decorative empty alts on content imagery).
- Focus ring via `--focus-ring` on all interactive elements.
- No emojis, no clichés, no invented data — all reviews verbatim, all services verbatim.
