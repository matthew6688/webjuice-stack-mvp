# Design System: Industrial Trade Credible

> Category: Local Service & Trade
> Australian roofing / building / metal trades. Honest, no-nonsense, sky-and-steel imagery. Logo-led brand identity with a single muted accent. Aimed at homeowners and builders who want competence, not advertising polish.


## 1. Visual Theme & Atmosphere

This system is built for **local Australian trade businesses where credibility comes from competence, not marketing polish**. It alternates two compositional states: **outdoor-photography sections** (sky, roof geometry, real materials) and **information-dense surfaces** (specs, warranties, pricing ranges, service areas).

The tone stays restrained. The customer's brand colors and logo carry identity; the interface stays out of the way. Marketing fluff and SaaS-style decoration are explicitly removed. The site reads like the kind of business a Ballarat tradesperson would actually run, not like an agency mockup of one.

Across pages, the rhythm is consistent and direct: **hero with real photo → trust strip with concrete signals → services as scannable cards → why-us with proof points → process steps → gallery of real projects → service areas → FAQ → contact**. No invented testimonials. No stock-photo handshakes. No vague taglines.

Typography stabilises the system. **One condensed geometric sans serves headings**, evoking the structural feel of a tradesperson's wordmark. **One neutral readable sans handles body**, matching what trade customers actually read on phones in a ute.

**Key Characteristics:**
- Two-mode rhythm: photographic hero/gallery sections alternate with white/muted-grey information surfaces
- Single customer-brand accent (e.g. brass `#C5A572`, copper `#B86A47`, safety yellow `#FBBF24`) used **only on primary CTAs and active links** — never as background wash
- Near-black + warm grey + white as the dominant palette; the accent is a controlled signal
- Sharp/squared geometry (≤4px radius) matching trade-tool/metal-panel language
- No drop shadows by default; depth via tonal contrast and surface change
- **Phone number is always visible above the fold** on every page (highest-converting element for trade)
- Real outdoor Australian-daylight photography only — no stock crew handshakes, no luxury real-estate styling
- Hard, declarative microcopy with numbers (years / km / warranty / rating) — never adjectives without numbers behind them
- Headings without trailing periods (this is a trade site, not an editorial magazine)

## 2. Color Palette & Roles

> Customer brand-spec.json provides exact hex values. The roles below define what each color does. The system is layered: this DESIGN.md sets roles; customer brand-pack overrides values.

### Primary
- **Brand Primary** (default `#0F1115` near-black, override per customer): Headers, anchors, body text on light surfaces, dark hero overlays, footer background.
- **Brand Secondary** (default `#6D6E71` warm grey): Secondary text, dividers, muted strokes, image captions.
- **Brand Accent** (default `#C5A572` muted brass / customer-specific): Primary CTA fills, active links, key icons, focus rings. **Never used as a section background wash.**

### Surface & Background
- **Surface** (`#FFFFFF`): Primary content canvas, card backgrounds, header.
- **Surface Muted** (`#F4F4F5`): Alternating section backgrounds, form fields, code blocks.
- **Surface Dark** (= Brand Primary): Hero overlays, footer, dark CTA bands.

### Text
- **Text Primary** (`#1B1D22`): Body copy on light surfaces.
- **Text Muted** (`#5A5C61`): Helper text, metadata, dates, captions.
- **Text Inverse** (`#FFFFFF` on dark surfaces).

### Borders & Dividers
- **Border** (`#E4E4E7`): Card outlines, form field borders, table rows, section dividers.
- **Border Strong** (= Text Primary): Emphasis dividers between major sections.

### Semantic
- **Success** (`#0E6B4F` forest): "Approved" badges, completed-project indicators. Used sparingly.
- **Warning** (`#D97706`): Storm-damage urgency indicators, "limited slots" framing. Used sparingly.
- **Error** (`#DC2626`): Form validation errors only.

### Forbidden
- No gradient backgrounds beyond a dark-overlay scrim on hero photos.
- No accent-color washes across entire sections (the accent is a CTA color, not a tonal field).
- No introduction of teal, cyan, or "SaaS blue" unless explicit in customer brand.

## 3. Typography Rules

### Font Family
- **Heading Family:** `Inter Tight, Eurostile Extended, Bank Gothic, Helvetica Neue Condensed, Arial Narrow, sans-serif`
  - Geometric, slightly condensed, structural. Matches metal/trade wordmark feel.
  - Customer brand-spec can override (e.g. `Barlow Condensed` for premium roofing, `Roboto Condensed` for utility trade).
- **Body Family:** `Inter, Source Sans 3, Helvetica Neue, Arial, sans-serif`
  - Neutral, readable at small sizes, performs well on mobile.
- **Mono Family:** `Inconsolata, JetBrains Mono, ui-monospace, Menlo, monospace`
  - Used for eyebrow labels, meta tags, phone numbers in trust strips, address blocks.

### Hierarchy

| Role | Size (desktop / mobile) | Weight | Line Height | Letter-Spacing | Notes |
|---|---|---|---|---|---|
| Display XL (hero) | `clamp(48px, 7vw, 88px)` | 700 | 0.94 | -0.035em | All-caps on dark heroes. Title case on light. No trailing period. |
| H1 (page) | `clamp(40px, 5.5vw, 64px)` | 700 | 0.98 | -0.03em | One per page. |
| H2 (section) | `clamp(28px, 3.6vw, 44px)` | 600 | 1.04 | -0.02em | |
| H3 (block/card) | `clamp(20px, 1.8vw, 24px)` | 700 | 1.12 | -0.015em | All-caps on chips/trust strips. |
| H4 | 18px | 600 | 1.22 | 0 | Form section headings. |
| Lead | 19px | 400 | 1.55 | 0 | Hero sub, section intro. Max 60ch. |
| Body | 16px | 400 | 1.55 | 0 | Standard paragraph. |
| Body Small | 14px | 400 | 1.48 | 0 | Cards, footer. |
| Meta / Eyebrow | 12px | 600 | 1.2 | 0.08em | Mono. ALL CAPS. Above heading. |
| Button | 13–14px | 700 | 1.2 | 0.04em | Mostly all-caps. |
| Footnote / Legal | 11px | 400 | 1.5 | 0 | Footer fine print. |

### Principles

- **Strong vertical rhythm**: each heading-to-body uses 1.4× line-height ratio.
- **No mixing of serif on the same page**: this system is sans-only.
- **All-caps reserved for**: hero displays, button labels, eyebrow metas, trust-strip chips. Never for body copy.
- **No trailing punctuation on display headings** unless it's a real complete sentence (`"Roof Replacement, Ballarat"` not `"Roof Replacement, Ballarat."`).
- **Tabular numerals** (`font-variant-numeric: tabular-nums`) on phone numbers, rating scores, year counts, prices.

### Substitutes when fonts unavailable

- If `Inter Tight` not available → `Barlow Condensed` → `Inter` with `font-stretch: 90%`.
- If body `Inter` not available → `system-ui` stack is acceptable.

## 4. Component Stylings

### Buttons

**Primary CTA** (highest-intent action, usually phone link)
- Background: `var(--brand-accent)` (e.g. brass `#C5A572`)
- Text: `var(--brand-primary)` (near-black)
- Padding: `14px 22px` (desktop) / `16px 24px` (mobile · larger tap target)
- Border-radius: `2px` (squared trade feel, NOT rounded SaaS pills)
- Font: button typography (uppercase, 13–14px, 700 weight, 0.04em tracking)
- Border: none
- Hover: `filter: brightness(0.92)`, no transform jump
- Focus: 2px outline in accent-soft (`color-mix(accent, transparent, 50%)`)
- Active: `filter: brightness(0.85)`
- Disabled: 50% opacity, no hover

**Secondary CTA**
- Background: transparent
- Text: `var(--text)`
- Border: `1px solid var(--text)`
- Same padding + radius + typography as primary
- Hover: background `var(--text)`, text `var(--surface)` (invert)

**Tertiary / Link CTA**
- Background: none
- Text: `var(--brand-accent)`
- Underline: 1px solid, offset 3px
- Used for "View all projects", "Read FAQ", inline reads.

### Cards

- Background: `var(--surface)`
- Border: `1px solid var(--border)`
- Border-radius: `2px` (squared)
- Padding: `24px` (default) or `32px` (large cards)
- Shadow: **none** (depth comes from border + alternating section bg)
- Hover (if clickable): border darkens to `var(--text)`, no transform

### Service Card (specific pattern)

- Top: 48px square icon container (`color: var(--brand-accent)`, stroke 1.5px)
- Middle: H3 service name + 2-line short description
- Bottom: text link "Learn more →" using accent color

### Form Fields

- Height: 48px (matches button tap-target)
- Padding: `12px 16px`
- Border: `1px solid var(--border)`
- Border-radius: `2px`
- Background: `var(--surface)`
- Focus: border `var(--brand-accent)` + 2px outline in accent-soft
- Error: border `var(--error)` + 11px error message below in error color
- Labels: 13px, weight 600, `color: var(--text-muted)`, 6px below

### Nav (header)

- Logo left (max-height 56px desktop, 40px mobile)
- Primary nav center/right (5–8 items, 14px, weight 600)
- Phone CTA + secondary CTA right (always visible)
- Background: `var(--surface)` light header
- Border-bottom: `1px solid var(--border)`
- Sticky on scroll with subtle shadow at scroll-y > 32px
- Mobile: hamburger drawer + **sticky bottom phone button** (44px tall, brass background)

### Footer

- Background: `var(--brand-primary)` (dark)
- Text: 14px white / 60% white
- Logo: `logo-dark.svg` variant
- 4 columns desktop: Services / About / Contact / Service Areas
- Trust strip above legal: VBA Licensed · 10-Year Warranty · Colorbond® · 4.1★ (concrete signals)
- Legal links: muted, 11px

### FAQ Accordion

- Question: H4-sized, 18px, weight 700, padding 20px 0
- Border-bottom: `1px solid var(--border)`
- Expand icon: + / − right-aligned, 18px, accent color when expanded
- Answer: body copy, max-width 65ch, padding-bottom 20px

### Trust Bar / Chip Strip

- Horizontal strip just under hero
- Each item: 12px icon + 14px text (weight 700)
- Separator: vertical line `var(--border)` between items on desktop, stacked on mobile
- Background: `var(--surface-muted)`

### Section Head (used by EVERY content section)
- 3-line composition: **eyebrow → h2 → lead**
- **Eyebrow**: `font-family: 'Inter', monospace; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--brand-accent); font-weight: 700; margin: 0 0 16px`
- **H2**: `font-family: var(--font-display); font-size: clamp(28px, 3.6vw, 38px); font-weight: 800; line-height: 1.15; color: var(--brand-primary); margin: 0 0 12px`
- **Lead** (optional): `font-size: 17px; line-height: 1.55; color: var(--text-muted); max-width: 60ch; margin: 0`
- Vertical rhythm: eyebrow→h2 = 16px · h2→lead = 12px · head→content = 48px
- Center-align on overview/hero sections · left-align inside content cards
- Heading text rule: NO trailing period · headline must contain at least one concrete number, name, or place

### Hero (cinematic full-bleed variant)
- Min-height 80vh desktop / 70vh mobile
- Background: `linear-gradient(180deg, rgba(15,17,21,0.4) 0%, rgba(15,17,21,0.55) 50%, rgba(15,17,21,0.85) 100%), url(...)`
- H1 size: `clamp(40px, 6vw, 72px)` · text-shadow `0 2px 8px rgba(0,0,0,0.4)`
- CTA row: primary (filled accent) + secondary (white underlined) · gap 16px
- Eyebrow + proof_chips both visible above the fold

### Hero (split-image-right variant · for services-overview)
- Grid `1.1fr 1fr` · gap 64px · padding clamp(56px,8vw,96px) 0
- H1 size: `clamp(36px, 5vw, 56px)` · brand-primary on light surface
- Proof chips inline below subhead (5-7 chips max)

### Hero (compact-banner variant · for about/contact/gallery/legal)
- Surface-muted background · centered text · max-width 880px
- H1 size: `clamp(40px, 6vw, 64px)` · brand-primary
- NO full-bleed image · NO form

### Hero (fullbleed-with-form variant · for home)
- Grid `1.2fr 0.8fr` · text-left + form-card-right
- Form card: surface white over dark hero overlay · radius 4px · shadow `0 8px 32px rgba(0,0,0,0.3)`
- Form fields stacked single column · CTA button full-width

### Stats Band
- Dark surface (brand-primary) · 4 columns desktop / 2 cols tablet / 1 col mobile
- Big number: `clamp(48px,6vw,72px)` display weight 800 in brand-accent
- Unit (yr/km/★): superscript 13px after number
- Label: 13px mono uppercase 0.1em letter-spacing on rgba(255,255,255,0.7)

### Process Steps
- 4 steps horizontal grid · stack on mobile <820px
- Each step: circle number (40px, brand-accent bg, white digit) + title (18px display weight 700) + body (15px line-height 1.6 text-muted)
- Connector line between steps on desktop (1px brand-accent at top-center of each card)

### Gallery Grid
- `grid-template-columns: repeat(auto-fit, minmax(280px, 1fr))` · gap 16px
- Each tile: `aspect-ratio: 4/3 · object-fit: cover · border-radius: 2px`
- Hover: `transform: scale(1.03)` over 0.3s · no border, no shadow
- CTA below grid links to `#lead-form` (not /our-work, which may not exist per customer)

### Case Study Card
- Grid `1fr 1fr` · alternating direction (every other flipped via `direction: rtl` reset on children)
- Media: `aspect-ratio: 4/3` · cover · radius 2px
- Body: suburb-eyebrow (mono 11px uppercase) → title (display 24-26px bold) → summary (16px / 1.6) → spec-list
- Spec-list: 2-col grid `110px 1fr`, mono labels uppercase 11px 0.1em / body 14px

### Before/After Slider
- Aspect 16:10 · border-radius 2px · cursor ew-resize
- Vertical divider 3px white · drop-shadow `0 0 12px rgba(0,0,0,0.5)`
- Handle: 48px circle accent bg, brand-primary chevrons
- Corner pills `BEFORE` (top-left) + `AFTER` (top-right): rgba(15,17,21,0.85) bg, white text, mono 11px 0.12em letter-spacing

### Comparison Table (Steel vs Tile)
- 3-col table inside `overflow-x: auto` wrapper
- Header row: display-font 16px bold brand-primary · 2px brand-primary border-bottom
- Row labels (tbody th): mono 11px uppercase 0.1em letter-spacing text-muted · width 200px
- Featured column: `rgba(0,0,0,0.02)` background · brand-primary text

### Spec Callout (profile trio)
- 3-col grid · gap 24px · middle card featured
- Featured card: `background: var(--brand-primary)` · accent text for name & visual
- SVG visual at top: 60px height · stroke-width 3 · brand-primary stroke
- Spec list: 2-col `100px 1fr` · mono uppercase labels

### Warranty Tiers
- 3-col grid · middle tier featured (brand-primary bg, accent text)
- Big number: display 72px bold · unit (yr) superscript 13px mono uppercase
- Title: display 18px bold · body 14px / 1.6 · issuer line at bottom (mono 10px uppercase, divider line above)

### Safety / Insurance Coverage
- 4-col grid <980px collapse to 2-col <520px collapse to 1-col
- Each card: surface white · border 1px · top-border 3px brand-primary
- Badge label (mono 11px uppercase) → amount (display 32px bold brand-primary) → body 13px / 1.6

### Emergency Callout (storm-damage)
- Background `#B8261B` · top+bottom 4px `#7a1812` borders · color #fff
- Grid `60px 1fr auto` (icon · text · CTA)
- Icon: 48px ⚠ in `#FFD23F`
- CTA: `#FFD23F` background · `#1a0d0a` text · box-shadow `0 4px 0 #c89c1d`
- H2: display 24-34px · weight 800 · white

### Map Embed
- Grid `1.5fr 1fr` · iframe (4:3 aspect) + 1fr side-info column
- Side cards: surface white · border 1px · padding 20-24px · mono label + 15px text

### Team Grid
- `grid-template-columns: repeat(auto-fit, minmax(260px, 1fr))` · gap 32px
- Photo: `aspect-ratio: 4/5` · cover · surface-muted bg fallback
- Name: display 20px bold brand-primary · role: mono 11px uppercase text-muted · bio: 14px / 1.6 text-muted · credential: 12px brand-primary (with divider above)

### About Timeline (vertical)
- max-width 760px · centered
- Vertical guide line at left=18px (2px var(--border))
- Each item: grid `140px 1fr` · gap 32px · year (mono 12px uppercase 0.12em) + title (display 18px bold) + body (15px / 1.65 text-muted)
- Dot at year-line intersection: 14px accent fill, 2px brand-primary border, circular

### Reviews Card Grid
- 3-col desktop · stack on mobile · gap 24px
- Card: surface-muted bg · padding 28px · radius 2px · border 1px
- Quote-mark prefix (display 48px brand-accent) · review text 15px / 1.6 · attribution line below (name + suburb + rating)
- Disclaimer "Sample testimonials shown" if not verified real

### Stats / Proof Strip (logos row)
- 5-col grid · centered · padding 32px 0 · gap 24px
- Each tile: surface white · border 1px · radius 2px · padding 18px · centered
- Mono label below logo

### Lead Form (compact band)
- Grid `1fr 1.1fr` · gap 56px (mobile stack)
- Background: `var(--surface-muted)` · top-border 1px
- Text col: eyebrow → h2 → body → trust-list (3 items with ✓ prefix)
- Form col: surface white · border 1px · padding 28px · radius 4px
- Submit: full-width brand-primary · 16px font · weight 700 · hover translate-Y(-1)

### Financing Band (3-option)
- Centered text section-head (eyebrow + h2 + body 17px)
- 3-col `repeat(auto-fit, minmax(260px, 1fr))` · gap 24px · margin-top 0
- Each option: surface-muted bg · padding 28px · border 1px · radius 2px
- Title: display 18px bold brand-primary · body 14px / 1.6 text-muted
- Disclaimer at bottom: 12px italic text-muted

### Product Spotlight (single material)
- Grid `1.2fr 0.8fr` · gap 64px · alternating between alternate sections
- Visual col: photo or material card
- Text col: eyebrow → h2 → body 17px / 1.65 (max 60ch) → spec list (grid `120px 1fr`, mono labels)

### CTA Band (centered-dark)
- Background brand-primary · color #fff · centered max-width 720px · padding clamp(64px,9vw,120px) 0
- H2: display clamp(28px,3.6vw,38px) weight 800 line-height 1.15
- Body 17px rgba(255,255,255,0.85) · max-width 56ch
- Two CTAs row: primary accent fill + secondary white underlined

## 5. Layout Principles

### Spacing System (8-based)

Base unit `8px`. Available steps:

```
--space-xs:   4px   (icon gaps, badge padding)
--space-sm:   8px   (button gap, chip padding)
--space-md:   16px  (card internal, paragraph margins)
--space-lg:   32px  (section internal, card-to-card)
--space-xl:   64px  (heading-to-body, major component gaps)
--space-2xl:  96px  (between sections on desktop)
--space-3xl:  144px (hero padding, large surface breathing)
```

### Grid & Container

- **Max content width:** `1240px` (`var(--container)`)
- **Gutter:** `clamp(20px, 4vw, 32px)`
- **Grid columns:** 12-column responsive (CSS grid). Card grids use `repeat(auto-fit, minmax(280px, 1fr))` for fluid cards.
- **Section padding-block:** `clamp(80px, 10vw, 144px)` on desktop, `clamp(56px, 12vw, 96px)` on mobile.

### Whitespace Philosophy

- **Generous between sections** — `--space-2xl` minimum vertical gap.
- **Tight within information blocks** — service cards, faq rows use `--space-md`.
- **Section transitions** are visual: alternating `--surface` / `--surface-muted` backgrounds, OR full-bleed hero photo, NOT decorative dividers.

### Border Radius Scale

- **0px (sharp):** Buttons in some Vicwest-like brands (trade tool aesthetic). Section dividers. Image overlays.
- **2px (default):** Buttons, cards, form fields, chips. The trade-credible squared feel.
- **4px (max for cards):** Premium-roofer variants. Never higher than 8px in this system.
- **50% (circle):** Avatar images, logo-mark social profiles. ONLY for these.

### Sticky / Fixed

- **Header**: sticky top, surface background, border-bottom on scroll.
- **Mobile phone CTA**: sticky bottom-right, brass background, 44px tap target, z-index above content. Hidden on `/contact` (already shown in hero).

### Inner Wrappers (HARD RULE)

Every section's outer wrapper IS `.container` (max-width 1240px set in shared.css). Section-specific inner grids (`.case-study-list`, `.team-grid`, `.spec-callout-grid`, etc.) **MUST NOT** add their own `max-width`. The container is the single width authority — inner grids only set `display: grid`, `grid-template-columns`, and `gap`. Adding `max-width: 1100px` or `max-width: 1200px` to inner wrappers creates visible misalignment between section content and the header/footer (which span the full 1240px).

### Section Vertical Rhythm (HARD RULE)

Every section: `padding: clamp(64px, 9vw, 120px) 0`. No exceptions. The clamp gives consistent breathing on mobile (64px) and desktop (120px) with smooth scaling. Sections that need denser layout (e.g. cta-band, emergency-callout) may use `clamp(40px, 6vw, 64px)` for tighter bands but never custom px values.

### Section Head Spacing (HARD RULE)

Inside any section, the head pattern (eyebrow + h2 + lead) follows fixed gaps: **eyebrow→h2 = 16px · h2→lead = 12px · head→content = 48px**. Implement via `margin-bottom` on the relevant element. This makes every section read with the same visual rhythm regardless of which module it is.

## 6. Depth & Elevation

| Level | Treatment | Use |
|---|---|---|
| **Level 0** | Flat. `var(--surface)` or `var(--surface-muted)`. No shadow. | Page background, alternating sections, default cards. |
| **Level 1** | `1px solid var(--border)`. Still no shadow. | Default cards, form fields, table cells. |
| **Level 2** | Border darkens to `var(--text-muted)` + slight scale. Still no shadow. | Hover state on clickable cards. |
| **Level 3** | `0 2px 8px rgba(15, 17, 21, 0.06)`. Used rarely. | Sticky header on scroll, modals, mobile bottom CTA button. |
| **Focus** | `0 0 0 2px var(--accent-soft)` outline. | Keyboard focus, active form fields. |

### Decorative Depth

- **Photographic hero** uses real depth from the photograph itself + a `linear-gradient(to right, rgba(0,0,0,0.7), transparent 60%)` scrim for text legibility.
- **Cards never gain shadow on hover** — depth comes from border darkening + minimal `translateY(-2px)` (or no transform at all).
- **No glassmorphism, no gradients, no glow effects.** Trade brand reads honesty, not Apple Vision Pro.

## 7. Do's and Don'ts

### Do

- Use customer's real logo SVG with documented light/dark variants — never recolor.
- Apply the accent color **only** to: primary CTAs, active link states, key icons, focus rings.
- Lead with concrete numbers (years in business, service-area km, warranty years, real review count) — verifiable, copyable.
- Use real outdoor daylight Australian roof photography (or leave a placeholder with prompt).
- Headline at the top of every page within 5 seconds of scroll-zero. Phone CTA visible above the fold.
- Stack vertically on mobile, never compress side-by-side cards below 280px wide.
- Run the verbatim `requiredVerifiedFacts` list as a copy-paste search before declaring done.

### Don't

- Don't use marketing clichés: "trusted partner", "X years of excellence", "we protect your home", "your roofing experts", "quality service".
- Don't introduce gradient backgrounds (a hero scrim is the exception).
- Don't recolor the logo or place it on busy/low-contrast backgrounds.
- Don't put more than 5 items in the primary nav.
- Don't use serif fonts on this system.
- Don't add testimonials with full names, photos, or exact dollar quotes unless they're in the verified facts.
- Don't show pricing in exact dollars (use ranges or "free quote").
- Don't put SVG-only generic illustrations where a real photo should be.
- Don't use teal, cyan, "trustworthy SaaS blue", or pastel tints — they break the trade reading.
- Don't add carousels, sliders, or auto-rotating heroes (except before/after gallery sliders).

## 8. Responsive Behavior

### Breakpoints (semantic, not device-targeted)

| Name | Width | Layout shift |
|---|---|---|
| `mobile-compact` | 360px | 1-col, hamburger nav, sticky bottom phone, full-width buttons. |
| `mobile-standard` | 390px | Same as compact. Verify no horizontal overflow. |
| `mobile-large` | 430px | Same. Hero text may grow to clamp max. |
| `tablet-portrait` | 600–820px | 2-col grids, partial nav visible, no hamburger. |
| `tablet-landscape` | 1024px | 3-col card grids, full nav visible, no sticky bottom CTA. |
| `laptop` | 1366px | Default desktop layout, 4-col footer. |
| `desktop` | 1440px | Default desktop layout. |
| `wide` | 1920px+ | Max container width 1240px, extra outer gutter. |

### Hard rules

- **No horizontal scroll** at any of the 8 breakpoints.
- **Fluid type via clamp()** — never fixed px on headings.
- **Container query for cards** where possible: `@container (min-width: 320px)` instead of viewport.
- **Hero photo on mobile**: use `object-position: center right` so the visually-important roof stays in frame after the crop.
- **Tap targets ≥ 44 × 44 px** on every clickable element on mobile.

### Mobile-specific behaviors

- Phone CTA in sticky bottom bar (brass, full-width).
- Hamburger drawer slides from right; close button top-right.
- Form fields stack vertically with labels above (never inline-label-input).
- Service cards collapse to single column, image on top, copy below.
- Trust bar wraps to 2 rows max, chip text shortens (e.g. "VBA Licensed" → "VBA" if needed).

## 9. Agent Prompt Guide

Use this paragraph verbatim (or close to it) as the system instruction when invoking an AI agent (OD codex, claude, etc.) to design or build sites using this system:

```
Design a local Australian trade website using the industrial-trade-credible system.
Mandatory rules:
- Use the customer brand tokens for colors, fonts, and logo (see brand/brand-spec.json).
- The brand accent appears ONLY on primary CTAs and active links — never as a background wash.
- Heading family is condensed geometric sans (Inter Tight default); body is neutral sans (Inter default).
- All radii are ≤4px (squared trade feel). No drop shadows except on sticky elements.
- Phone CTA must be visible above the fold on every page, plus a sticky bottom phone button on mobile.
- Header and footer must be IDENTICAL on every page (same logo, same nav items, same CTAs, same footer columns).
- Real outdoor photography only (or empty slot with image prompt). No stock crew handshakes, no SVG-only heroes.
- Locked facts (business name, phone, email, address, city, state, licensing authority) appear verbatim — never paraphrased.
- Do not invent: license numbers, ABN, founding year, team size, awards, dollar prices, customer testimonial quotes.
- Forbidden phrases: "trusted partner", "we protect your home", "X years of excellence", "your roofing experts", "quality service", "innovative solutions", "tailored to your needs".
- Headings do NOT end with periods.
- Use VBA / NSW Fair Trading / DMIRS / CBS / etc. based on customer state — NEVER QBCC unless customer is QLD.
- No gradient backgrounds, no carousels, no glassmorphism, no SaaS-style rounded pills.
The customer brand-spec.json + content/*.json + facts.json are LOCKED inputs.
The handoff package (DESIGN-HANDOFF.md + DESIGN-MANIFEST.json) describes the screens to build.
```

## 10. Page Compositions

Two supported page-type sets:

### One-page (cold outreach, low-info lead)

`index.html` contains in order:
1. Hero (full-bleed photo with overlay) — H1 + lead + 2 CTAs
2. Trust bar (4–6 concrete signals)
3. Services preview (3–4 cards · short descriptions · links would-be sub-pages even if not built)
4. Why-us / differentiators (3–5 items with numbers)
5. Gallery teaser (3 project photos)
6. FAQ (4–6 mandatory questions per niche-spec)
7. Contact form + footer-CTA

### Multi-page (standard delivery)

Required routes:
- `/` (home) — sections per above
- `/about` — narrative + team + warranties
- `/services` (overview hub) — links to detail pages
- `/services/<service-id>` (one per real service) — hero · process · proof · faq · cta
- `/our-work` (gallery) — filterable grid, before/after sliders where pairs exist
- `/contact` — form + map + service area + hours

Optional:
- `/blog` only if customer has actual blog content; otherwise skip
- `/careers` only if customer has hiring data; otherwise skip
- `/privacy` + `/terms` (always include — required legal)

### Section composition per page-type

| Section | home | service | service_detail | about | gallery | contact |
|---|---|---|---|---|---|---|
| hero (with optional quick-quote-form) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **quick-quote-form (in hero)** | **✓** | **✓** | **✓** | – | – | – |
| trust-bar | ✓ | – | – | ✓ | – | – |
| services-grid | ✓ | ✓ | – | – | – | – |
| why-us | ✓ | – | ✓ | ✓ | – | – |
| process | ✓ | – | ✓ | – | – | – |
| gallery | ✓ | – | ✓ | ✓ | ✓ | – |
| service-areas | ✓ | – | – | – | – | ✓ |
| faq | ✓ | – | ✓ | – | – | ✓ |
| cta-band | ✓ | ✓ | ✓ | ✓ | ✓ | – |
| **contact-form (full)** | **✓** | – | – | – | – | ✓ |
| footer | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

### Contact form patterns (trade-industry standard)

**Quick-quote-form** (in hero · right column on desktop · stacked below on mobile)
- 4 fields max: Name · Phone · Suburb · Service interest (dropdown)
- One brass CTA: "Get Free Quote"
- Tagline above: "No-obligation · written quote in 24 hours"
- Compact · meant to NOT distract from hero photo on mobile
- Required on: home + every service detail page

**Full contact-form** (on /contact page)
- 5-7 fields: Name · Phone · Email · Suburb · Service · Message · (optional: best time to call)
- Brass primary CTA: "Request a Quote"
- Trust signal next to form: "We respond within 24 hours · VBA licensed"
- Service area visualization adjacent (map or suburb list)

Forms must send to the customer's primary email (from `facts.locked_facts.email`) AND log a notification (e.g. webhook to Discord / Slack / CRM). Forms are MANDATORY · trade customers expect a way to request a quote without calling.

### Cross-page consistency (MUST)

- **Header** is byte-identical (same logo, same nav, same CTA, same sticky behavior) on every page.
- **Footer** is byte-identical (same 4 columns, same trust strip, same legal) on every page.
- **CTA system** (primary phone + secondary form) appears with identical styling site-wide.
- **Typography scale** is identical site-wide.
- **Section padding rhythm** is identical site-wide.

If a page deviates from header/footer, the build fails post-build audit.
