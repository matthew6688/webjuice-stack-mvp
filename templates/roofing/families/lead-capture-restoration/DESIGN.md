---
version: alpha
name: "Lead Capture Restoration"
description: "Lead Capture Restoration roofing template family design contract"
colors:
  primary: "#1D2328"
  secondary: "#6B6258"
  tertiary: "#C9472A"
  neutral: "#FAF3E8"
  surface: "#FFFDF8"
  on-primary: "#FFFFFF"
  on-tertiary: "#FFFFFF"
typography:
  h1:
    fontFamily: "Inter"
    fontSize: 3.8rem
    fontWeight: 850
    lineHeight: 0.98
    letterSpacing: 0
  h2:
    fontFamily: "Inter"
    fontSize: 2.4rem
    fontWeight: 800
    lineHeight: 1.05
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

Local roofing lead capture: immediately says what they do, why to call, and how to request a free inspection, with enough visual substance to avoid looking like a text flyer.

## Colors

- **Primary (#1D2328):** dark trade contrast for footer and phone-first bands.
- **Secondary (#6B6258):** warm gray local-business support copy.
- **Tertiary (#C9472A):** roof-red/orange quote and phone actions.
- **Neutral (#FAF3E8):** warm flyer-like background without feeling cheap.
- **Surface (#FFFDF8):** main content canvas.

## Typography

- Display: confident sans-serif or sturdy serif, not delicate.
- Body: plain readable sans-serif.
- Labels: strong chips for services and trust points.

## Layout

- hero: phone-first, service area, free inspection CTA.
- services: clear bullet/service grid from provided lead copy.
- why us: common-sense benefits, clearly marked as positioning not verified claims.
- process: inspect, quote, restore, cleanup.
- contact: simple form and big phone number.
- footer: compact with contact links.

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

- Show phone and contact path above the fold.
- Use provided services exactly when available.
- Use dummy copy only to make modules complete, not to fake proof.

### Don't

- Build a huge multi-page site from very little info.
- Invent email, address, reviews, project count, or exact service area.
- Use internal audit language in customer-facing copy.
