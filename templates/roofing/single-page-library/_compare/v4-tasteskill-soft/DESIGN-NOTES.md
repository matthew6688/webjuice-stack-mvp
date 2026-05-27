# v4 · taste-skill / soft-skill — Vicwest Roofing

Variant generated under the `Vanguard_UI_Architect` protocol (Awwwards-tier).

## Variance Engine roll

- **Vibe Archetype:** **Editorial Luxury** — warm cream paper (`#FDFBF7` → `#F4EFE5`), deep espresso ink (`#1A1714`), copper accent (`#8C5A2E`), muted sage warm-vignette. Variable serif (Fraunces standing in for PP Editorial New, with optical-size 144 + italics) carrying every display heading. A 4.5%-opacity SVG fractal-noise grain is layered as a fixed `pointer-events:none` overlay (mix-blend multiply) so the page reads like printed paper, not pixel-perfect glass.
- **Layout Archetype:** **The Editorial Split** — hero is a 1.05fr/1fr split: massive type left ("Heritage-grade *roofing,* built &amp; warranted…") with copper-italic accents and an ampersand in muted italic; portrait-oriented bezel-framed plate on the right, anchored by a rotated floating review chip (-3deg) bleeding off the left edge. About section mirrors the split (1/1.15fr) with rule-divided stats. Services break the monotony with an asymmetric 12-col bento (6/3/3/3/3/6) — Plate I and Plate VI span double-wide.

## Banned elements absolutely avoided

- **Fonts:** no Inter / Roboto / Arial / Open Sans / Helvetica anywhere. Stack = `Fraunces` (variable serif, opsz 144) + `Geist` (body) + `Plus Jakarta Sans` (UI/eyebrow). All loaded via Google Fonts `<link>`.
- **Icons:** no Lucide / FontAwesome / Material. Every icon is hand-written inline SVG with `stroke-width:1.4` — phone, arrow, mail, pin, clock, chevron — uniformly thin-line in the Phosphor Light / Remix Line family.
- **Borders:** no 1px solid #ccc / #ddd / gray. Every divider is `rgba(26,23,20,0.08)` or `0.14` — warm-ink hairlines that sit on cream.
- **Shadows:** no `shadow-md`, no `rgba(0,0,0,0.3)`. Custom ambient recipe — see below.
- **Layouts:** no edge-to-edge sticky navbar (nav is a floating glass pill, `mt-6 mx-auto w-max rounded-full`). No symmetric 3-col Bootstrap grid — services use 6/3/3/3/3/6 asymmetry; about uses 1/1.15fr; contact uses 1.05/1.
- **Motion:** zero `linear` or `ease-in-out`. Every transition uses a tuned cubic-bezier (see below). No `window.scroll` listeners — reveals are `IntersectionObserver` only. No layout-trigger props — only `transform` + `opacity` (plus `filter:blur` on initial reveal, allowed because GPU-composited).

## Premium choices

### Font stack
- `font-family: "Fraunces", "PP Editorial New", "Times New Roman", serif;` with `font-variation-settings: "opsz" 144` and weight 340–400 — gives the thin, almost-stenciled high-display Editorial New feel.
- `font-family: "Geist"` for body and form controls (300/400/500/600).
- `font-family: "Plus Jakarta Sans"` for UI micro-copy, eyebrow pills, buttons (500/600).
- All italic accent words ("roofing," "neighbours," "archive," "your") use `font-style:italic` + copper color — a hard editorial fingerprint.

### Cubic-bezier transition vocabulary
- `--ease-luxe: cubic-bezier(0.32, 0.72, 0, 1)` — primary "Apple ease" for state changes (nav, buttons, image scale).
- `--ease-spring: cubic-bezier(0.16, 1, 0.3, 1)` — overshoot for hover-translates and menu reveal staggers.
- `--ease-haptic: cubic-bezier(0.6, 0.05, 0.01, 0.99)` — defined for any kinetic accents that need it.
- Durations: 350ms (micro) → 550ms (button/icon) → 700–900ms (reveal/image-zoom) → 1400–1600ms (hero/service image hover-zoom).

### Ambient shadow recipe (no harsh drops · never `rgba(0,0,0,0.3)`)
```
--shadow-ambient:
  0 1px 0 rgba(255,255,255,0.6) inset,      /* top inner highlight */
  0 1px 2px rgba(26,23,20,0.04),            /* sub-pixel grounding */
  0 12px 36px -18px rgba(26,23,20,0.18),    /* mid-depth diffusion */
  0 28px 80px -40px rgba(26,23,20,0.22);    /* long ambient bloom */
```
Warm ink (`#1A1714`) is used as the shadow color instead of pure black — keeps the page reading as paper, not screen. A `--shadow-floating` variant lifts hero/about/form cards with a heavier `-28px` and `-60px` spread.

### Double-Bezel architecture
Every primary card (hero plate, service tiles, about portrait, reviews, gallery, contact info, form) uses the doppelrand pattern:
- **Outer shell:** `padding:8px`, `border-radius:2rem`, subtle linear-gradient warm-ink tint, hairline `rgba(26,23,20,0.08)`.
- **Inner core:** distinct cream/cream-deep/espresso background, `border-radius: calc(2rem - 8px)` for concentric curves, inset highlight `inset 0 1px 1px rgba(255,255,255,0.55)`.
- Concentric radii are mathematically derived, never coincidental.

### Button-in-Button
All buttons (hero primary, hero ghost, about copper, nav CTA, form submit) ship the nested trailing icon pattern — `w-34 h-34 rounded-full bg-rgba(255,255,255,0.12)` flush with the inner padding. On hover the icon `translate(2px,-2px) scale(1.06)` — internal kinetic tension distinct from outer button lift.

### Eyebrow tags
Every section H2 is preceded by an eyebrow pill (`10.5px / 0.22em uppercase / Plus Jakarta 600`) with a 5px copper dot and a soft inset highlight. Subliminal but signature.

### Reviews avatar
First-letter-only monogram in `linear-gradient(135deg, copper → copper-soft)` — refuses to fake stock-photo headshots. Premium agencies do this on purpose.

### Gallery
True before/after via `clip-path: inset(0 0 0 50%)` on the after image — no slider library needed; the seam is rendered as a 1px cream divider with a sub-pixel ink ring. Hover scales both images together so the cut stays clean.

### Service grid asymmetry
`grid-template-columns: repeat(12, 1fr)` with deliberate spans `6 / 3 / 3 / 3 / 3 / 6` — Plate I (Replacement) and Plate VI (Colorbond) get wide cinematic 16:8.5 plates; restoration / gutters / storm / pointing get tighter 5:4 portrait-leaning plates. Reads like a magazine spread.

## Mobile collapse strategy (per the skill's universal override)

- All asymmetric `col-span` overrides reset to `span 12` (single column) under `640px`, and `span 6` under `980px` (paired) — matches the skill's "Asymmetrical Bento → grid-cols-1" rule.
- Hero `Editorial Split` collapses to a single-column stack under `980px`: typography block first, plate second, floating chip re-anchored to top-left of the plate (no rotated overlap that would create touch-target conflicts).
- About 1/1.15fr split collapses to `1fr` under `880px`; stats grid drops from 3-col to 2-col.
- Process sticky-left collapses to static flow under `880px`.
- Reviews / gallery move from 3-col → 1-col under `980px`.
- Suburbs 1/2fr collapses to `1fr` under `880px`.
- Contact 1.05/1 collapses to `1fr` under `980px`; form field-rows go single-column.
- Footer 4-col → 2-col under `880px` → 1-col under `520px`.
- Sections never use `100vh`; only `min-h` and proportional `clamp()` padding.
- **Sticky phone CTA** appears below `720px`, with extra `8rem` footer bottom-padding to prevent overlap.
- All `backdrop-blur` filters are restricted to fixed elements (`.nav`, `.menu-overlay`, hero stamp pills) — never on scrolling containers. Grain overlay is `position:fixed` per the skill's performance guardrails.

## Pre-output checklist · self-audit

- [x] No banned fonts (Fraunces / Geist / Plus Jakarta only)
- [x] No banned icons (custom thin-stroke 1.4 inline SVGs)
- [x] No 1px solid gray borders (warm-ink hairlines only)
- [x] No harsh shadows (custom diffused ambient recipe, warm-ink based)
- [x] No symmetric 3-col grids (every grid is asymmetric or fluid)
- [x] No linear / ease-in-out transitions (3 named cubic-beziers)
- [x] Variance Engine consciously rolled (Editorial Luxury + Editorial Split)
- [x] Double-Bezel on every primary card
- [x] Button-in-Button on every CTA
- [x] Section padding ≥ `clamp(80px, 12vw, 160px)` — heavy breathing
- [x] Scroll entry animations via IntersectionObserver — no `window.scroll`
- [x] Mobile collapses gracefully · sticky phone CTA below 720px
- [x] Animations on `transform` + `opacity` only · `backdrop-blur` only on fixed elements
- [x] Grain overlay is fixed + `pointer-events:none`
- [x] No invented prices, owner names, team size, or awards
- [x] All 6 services verbatim · all 3 reviews verbatim with author + suburb
- [x] LocalBusiness JSON-LD with VBA license CDB-U 65938
- [x] Single H1 · meta description 158 chars · canonical · hreflang en-AU · skip-link

## Final impression test

Reads as **printed Monocle / Cereal Magazine spread** crossed with the spatial rhythm of a Linear product page — heavy serif headlines with italic-copper accents, paper-grain texture, machined double-bezel components, copper-on-cream haptic feedback. Specifically NOT: Squarespace template, default Tailwind landing page, AI slop.
