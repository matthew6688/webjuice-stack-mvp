---
version: alpha
name: "Editorial Bold Commercial"
description: "Editorial Bold Commercial roofing template family design contract"
colors:
  primary: "#050505"
  secondary: "#6D6D6D"
  tertiary: "#F25A1D"
  neutral: "#F7F7F4"
  surface: "#FFFFFF"
  on-primary: "#FFFFFF"
  on-tertiary: "#111111"
typography:
  h1:
    fontFamily: "Inter"
    fontSize: 6rem
    fontWeight: 900
    lineHeight: 0.88
    letterSpacing: 0
  h2:
    fontFamily: "Inter"
    fontSize: 3.4rem
    fontWeight: 850
    lineHeight: 0.96
  body-md:
    fontFamily: "Inter"
    fontSize: 1rem
    fontWeight: "400"
    lineHeight: "1.6"
  label-caps:
    fontFamily: "Inter"
    fontSize: "0.75rem"
    fontWeight: "800"
    lineHeight: "1.2"
rounded:
  sm: 4px
  md: 8px
  lg: 16px
spacing:
  sm: 8px
  md: 16px
  lg: 32px
  xl: 64px
components:
  button-primary:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.on-tertiary}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.md}"
    padding: 14px
  hero-surface:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.lg}"
---

## Overview

Bold commercial roofing energy: big type, sharp orange accents, documentary roof work photography, and confident proof blocks for companies that want to look bigger than a one-person operation.

## Colors

- **Primary (#050505):** black poster blocks and high-contrast commercial authority.
- **Secondary (#6D6D6D):** industrial gray support text and rules.
- **Tertiary (#F25A1D):** construction-orange emphasis, actions, and stats.
- **Neutral (#F7F7F4):** white editorial space around bold typography.
- **Surface (#FFFFFF):** main content canvas.

## Typography

- Display: oversized geometric sans-serif, tight but readable.
- Body: clean sans-serif.
- Labels: small uppercase category labels.

## Layout

- hero: poster-scale headline layered with roof image and contractor figure.
- service band: horizontal marquee-like service categories.
- story: black block with overlapping photos and big stats.
- services list: numbered service rows with arrow actions.
- featured work: asymmetric editorial image grid.
- CTA: short, memorable, slightly playful but still professional.

## Elevation & Depth

Use depth only when it supports hierarchy. Photo-heavy families should rely on image composition, contrast, and section rhythm before decorative shadows.

## Shapes

Default to restrained corners. Use larger radii only for image containers and CTA panels when the reference style supports it.

## Components

- **Hero:** must clearly communicate the niche in the first viewport.
- **Primary CTA:** uses the tertiary token and must be visually obvious.
- **Service modules:** should match the family layout direction, not a generic card grid.
- **Footer:** must feel complete and credible, even when demo-safe content is used.

## Do's and Don'ts

### Do

- Use big visual hierarchy and fewer words.
- Make statistics visually prominent only when demo-safe or verified.
- Keep orange as accent, not background everywhere.

### Don't

- Make it cute or pastel.
- Use tiny service cards.
- Claim exact project counts, countries, awards, or years unless verified.
