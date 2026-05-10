---
version: alpha
name: "Productized Modern Roofing"
description: "Productized Modern Roofing roofing template family design contract"
colors:
  primary: "#111827"
  secondary: "#64748B"
  tertiary: "#2F6F5E"
  neutral: "#F3F4F6"
  surface: "#FFFFFF"
  on-primary: "#FFFFFF"
  on-tertiary: "#FFFFFF"
typography:
  h1:
    fontFamily: "Inter"
    fontSize: 4rem
    fontWeight: 750
    lineHeight: 1
    letterSpacing: 0
  h2:
    fontFamily: "Inter"
    fontSize: 2.5rem
    fontWeight: 700
    lineHeight: 1.08
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

Modern productized roofing: precise, clean, consultative, and easy to compare, especially for businesses that sell materials, roofing systems, inspections, or quote packages.

## Colors

- **Primary (#111827):** clean charcoal for productized service clarity.
- **Secondary (#64748B):** muted UI labels, dividers, and secondary copy.
- **Tertiary (#2F6F5E):** subtle green for quote and action paths.
- **Neutral (#F3F4F6):** airy gray bands and product comparison areas.
- **Surface (#FFFFFF):** main content canvas.

## Typography

- Display: modern sans-serif with large clean shapes.
- Body: neutral sans-serif.
- UI labels: small, technical, understated.

## Layout

- hero: contained image hero with simple nav and stats.
- trust: muted logo/partner strip when demo-safe.
- materials: product grid with roof tile/material cards.
- services: accordion/list with one preview image.
- FAQ: centered accordion.
- CTA: premium roofing banner with image overlay.

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

- Keep spacing calm and readable.
- Make comparison/product structure clear.
- Use FAQ and materials as conversion tools.

### Don't

- Use busy collage layouts.
- Overdo luxury serif type.
- Invent prices or product brands unless provided.
