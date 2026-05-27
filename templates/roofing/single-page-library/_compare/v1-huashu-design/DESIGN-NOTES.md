# V1 · huashu-design · Design Notes

## Direction
- **流派**: Information Architecture (信息建筑派)
- **哲学**: **Massimo Vignelli / Unimark-AIGA Swiss rationalism**
  (Vignelli's signature system — strict grid, Helvetica/neogrotesque, hairline rules, two-typeface discipline, content-as-information, anti-decoration)

## 3-line rationale
1. Trade businesses earn trust through **competence signals** (license, years, warranties, real reviews like 4.1★ not 5★), not mood or imagery. Vignelli's system treats content as information first — exactly how a 55-year-old Ballarat homeowner evaluates a tradie.
2. Vignelli's discipline **structurally forbids** the AI-slop defaults that drag mid-trade websites into sameness: no gradients, no rounded cards with left-accent borders, no decorative icons per heading, no hero overlay vignettes. Anti-slop is enforced by the system, not by willpower.
3. Roofing's actual brand truth is **metal, rain, sky, mortar** — honest industrial materials. Honest typography (Inter Tight + IBM Plex Mono) plus a Colorbond-derived palette gives the page a register that matches the trade without going "blue-collar caricature."

## Key visual decisions

### Typography
- **Inter Tight** (display + body) — a precision neogrotesque, the contemporary cousin of Helvetica Neue. Two weights only: 700/800 for display, 400/500/600 for body.
- **IBM Plex Mono** — used exclusively for data chips, eyebrow labels, file numbers, captions, and section enumeration (01 / 06 etc.). Creates a "specification document" tonality.
- Three display sizes only (massive H1, mid H2, item H3). Aggressively tight letter-spacing (-0.035em) on display, neutral on body.

### Color
- **Paper** `#FFFFFF` — pure white, never warm cream (would soften the rationalism).
- **Ink** `#0A0A0A` — near-black, not pure black (prevents harsh banding on screens).
- **Monument** `#3D3D3B` — real BlueScope Colorbond Monument spec, used as secondary text.
- **Signal Red** `#C8161D` — Australian construction red, used **sparingly** for: phone link hover, the accent word in the H1 ("next storm."), required-field asterisks, the "by arrangement" indicator, and the primary "Send enquiry" CTA. About 8 instances total on the page.

### Layout pattern
- **12-column strict grid, 24px gutter**. Every section anchored to it.
- **Section headers** = 3-column eyebrow (number + label) + 6-column massive H2 + 3-column right-aligned monospace meta. This is the signature Vignelli/AIGA layout.
- **Services** rendered as a **numbered specification table** (04-column row: number / name / description / image), not as cards. Each row a hairline rule. Hover turns the service name signal-red.
- **Trust bar** = 4 cells with massive numerals + monospace caption + tiny note. Hairline dividers, no fills, no shadows.
- **Reviews** = three columns of testimony with hairline-divided attribution footers. Quotation marks rendered in signal-red as the only decorative gesture.
- **Service area** = a literal numbered index of suburbs (01-18) with hairline rules between rows, by-arrangement suburbs flagged in signal-red mono.
- **Forms** = label-only, no input boxes — fields are underlines (border-bottom) that darken on focus. This is the Vignelli treatment for inputs in print catalogue → digital translation.

### Anti-slop checklist (enforced)
- 0 gradients
- 0 rounded corners >2px (all sharp 90° terminals)
- 0 box-shadows
- 0 decorative emoji icons
- 0 SVG illustrations of humans/scenes
- 0 invented data (no fake awards, owner names, team size, prices)
- 0 of: "trusted partner / premium quality / years of excellence / one-stop shop / elevate / seamless / next-gen"
- The only icons on the page are the 5-point review stars (functional, not decorative)

### Signature details (the 120% touches)
- The hero **headline** combines a strict 3-line statement with one signal-red word and a tightly-letter-spaced secondary explainer — a literal Vignelli AIGA poster move.
- The hero **meta strip** ("File No. VCW · 001 · Discipline: Roofing & Cladding") is the precise Vignelli "catalogue header" treatment, also used in MoMA and Knoll printed materials.
- **Gallery before/after** is a 50/50 split with white tag on Before, inverted black tag on After — the Vignelli/Brand New treatment of "transformation diptychs."
- **Google Maps embed** is grayscaled (`filter:grayscale(1)`) to fit the monochrome system — no other element on the page introduces non-system color.

## Deviations from huashu-design's recommendation logic

1. **I did not run the Phase 1-7 advisory mode of huashu-design.** The brief was already fully locked (verbatim copy, hard data, fixed assets). Running a 3-direction advisory pass would have wasted user attention on questions they had already answered. I jumped straight to Phase 8 "selected direction execution" — committed to Vignelli, justified the rejection of 4 alternatives (Kenya Hara, Pentagram showroom, Brutalist, Field.io), and built.

2. **No Junior Designer "show placeholders first" pass.** Same reason — every asset, every word, every section was pre-specified. The Junior pass exists to validate direction before commitment; the brief itself **was** the validation.

3. **No 3 variations.** The brief explicitly said "V1 must NOT look the same as V0 (mid-trade default)" — i.e., the user wants ONE strongly-committed direction, not a menu. Giving 3 variants would have diluted the very thing being tested (whether a committed Vignelli direction beats a default mid-trade aesthetic).

4. **Brand asset protocol** (huashu-design §1.a) was followed in spirit: real photographs only (no CSS silhouettes), Colorbond Monument color drawn from BlueScope's actual spec, no invented logo (used a strict square mark + wordmark instead of guessing a brand identity Vicwest may not have). The "logo" here is a generative two-square geometric mark that fits the Vignelli system and can be trivially replaced when the real logo arrives.

5. **No video export, no audio, no animations.** Static page — the huashu-design Step 9 "default video export" is for animation outputs, not websites.

## What V1 should feel like (vs V0)

V0 (the user's baseline mid-trade aesthetic) likely uses: warm hero overlay, rounded cards with shadows, gradient CTA buttons, friendly emoji-adjacent icons per service, sans-serif everything-the-same, "trusted local roofers" copy.

V1 should feel: **like a Knoll furniture catalogue from 1972 that happens to be selling roof replacement in Ballarat.** Cold, confident, content-first, the opposite of "marketing." A 55-year-old Ballarat homeowner reading it should subconsciously think "these people are organised" rather than consciously think "this is good design."
