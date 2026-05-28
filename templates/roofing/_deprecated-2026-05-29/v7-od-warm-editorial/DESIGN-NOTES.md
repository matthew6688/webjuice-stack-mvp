# V7 · OD warm-editorial · Vicwest Roofing

## Design system contract

This page renders the **Open Design `warm-editorial` design system** verbatim. The token block at `:root` in `preview.html` (lines under the `OD warm-editorial tokens.css — pasted VERBATIM` comment) is a **byte-for-byte copy** of `/tmp/open-design/design-systems/warm-editorial/tokens.css`. No hex was invented. No font family was substituted. Every spatial / radius / motion value resolves to a token.

DESIGN.md guidance applied:
- Cream canvas + serif display + calm publication rhythm
- One accent (`--accent: #9b5b32` terracotta) - used on H1 emphasis, primary CTAs, links, focus rings, sticky-call, process step numbers, review stars, quote rule, and area-note left-border only
- Title case on H1/H2, sentence case on H3 and below
- No gradients in chrome (only a soft warm-radial wash behind the hero, which is `surface-warm` mixed to transparent - no rainbow / blue glow)
- No emojis
- Cards on hover: 2px y-translate + `--elev-raised`; flat elsewhere
- Inputs in the dark contact section follow the underline-only rule
- One H1, every other section uses `<h2>`

## Direct comparison to V2 taste-skill-core (also "warm editorial" in vibe)

The taste-skill variant V2 also produced a "warm paper" aesthetic - so this V7 has to prove that **a curated OD design system imposes a fundamentally different feel even on the same brief**. The differences are specific and token-traceable, not vibes.

### Palette tokens

| Role | V2 taste-skill-core | V7 OD warm-editorial | Visible difference |
|---|---|---|---|
| Paper / bg | `#f4efe6` (warm bone, cooler) | `#fbf6ee` (creamier, warmer, higher L) | V7 reads more like uncoated book stock; V2 reads like recycled card |
| Foreground | `#1c1f24` (slate-ink, cool) | `#201914` (near-black warm-brown) | V7 type has noticeably warmer black; V2 type sits on a slate axis |
| Accent | `#b8492c` brick (red-leaning terracotta) | `#9b5b32` (orange-leaning terracotta, lower chroma) | V7 accent is muted/coppery; V2 accent is hotter brick |
| Secondary | `#2d3a2a` moss + `#e8e0d2` cloud | `#f1e3cf` surface-warm + `#fffdf8` surface | V2 has a forest secondary; V7 has NO secondary chroma - it leans on warm tints only |
| Border | implicit slate at low opacity | `#ded2c3` + `#eee4d7` paired tokens | V7 distinguishes `border` from `border-soft` for inner/outer rhythm |

V7 has **zero green**. V2's moss `#2d3a2a` was a deliberate second-accent decision. The OD system explicitly does NOT carry a forest token, so V7 commits harder to a single-axis warm palette - that monochromatic-warm discipline is what makes it read as "editorial publication" rather than "trade brand."

### Font tokens

| | V2 taste-skill-core | V7 OD warm-editorial |
|---|---|---|
| Display | Bricolage Grotesque (variable sans) | **Georgia / Times New Roman serif** |
| Body | IBM Plex Sans | Inter |
| Italic role | Bricolage italic for emphasis | Georgia italic for accent phrase + blockquote + reviews |
| Type scale | App-app rhythm (24, 32, 48, 64-ish) | Editorial scale: `12 · 14 · 17 · 20 · 28 · 42 · 64 · 88` - far steeper, with **88px hero** |

This is the loudest single difference. V2 went serif-free on purpose (taste-skill 4.1 "Serif Discipline" warns against auto-reach Fraunces/Instrument). V7 commits the **other** way: Georgia in the display slot because the OD system mandates it. The result is a magazine column rather than a trades landing.

### Spacing & radius

| | V2 | V7 OD |
|---|---|---|
| Section padding (desktop) | ~py-20 (80px) | **112px** desktop, 80 tablet, 56 phone |
| Container max | ~1200 | **1180px** with 36px gutters |
| Radius scale | 4 / 8 / pill | **10 / 16 / 24 / pill** (no value below 8, none above 24, matching DESIGN.md) |
| Hero | Asymmetric split, eyebrow + H1 + lead + 2 CTAs | Same split skeleton BUT 4/5 portrait figure + floating field-note caption block - explicitly editorial, not commercial |

OD's 112px desktop section padding is the single biggest "this is publication, not landing" tell. V2's ~80px reads "modern startup site."

### Component shape

- V7 services: 3-col uniform editorial cards with `01 / Replacement` mono numbering. V2 used an asymmetric bento (2 large + 4 small).
- V7 about: pull-quote with terracotta vertical rule + figure - lifted directly from magazine longform. V2 used 2-col about/process narrative.
- V7 process: 4 steps under a **top horizontal black rule** with oversized serif numerals - newspaper section-divider grammar. V2 had no equivalent.
- V7 reviews: serif italic body copy on `--surface-warm` band, attribution rule, mono-feel attribution. V2 used sans review cards.
- V7 contact: dark `--fg` background with underline-only inputs (DESIGN.md "underline only, no box"). V2 used boxed inputs on paper.

## Which is better and why

1. **V7 is better for the editorial / trust-first audience** the brief actually describes (older Ballarat homeowners, insurance-claim anxiety): the serif display + 112px rhythm + single warm accent make the page read calm and considered, which is exactly the emotional register a 22-year family-run roofer wants.
2. **V2 is better as a generic conversion landing**: Bricolage + asymmetric bento + tighter spacing means more density above the fold, slightly more "modern small business" energy, lower scroll depth to CTA.
3. **The point of the experiment lands**: both are "warm paper" in summary, but a curated design system with non-negotiable tokens (Georgia display, 88px hero, 112px sections, no secondary chroma, underline inputs) produces an output that is unmistakably distinct from a taste-skill freehand pass - even when the brief, data, and image library are identical. The OD contract is doing real work.
