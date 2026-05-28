---
version: alpha
name: "Classic Premium Roftix"
description: "Classic Premium Roftix roofing template family design contract"
colors:
  primary: "#0B2F57"
  secondary: "#51606F"
  tertiary: "#0E6B4F"
  neutral: "#F7F5F0"
  surface: "#FFFFFF"
  on-primary: "#FFFFFF"
  on-tertiary: "#FFFFFF"
typography:
  h1:
    fontFamily: "Playfair Display"
    fontSize: 4.75rem
    fontWeight: 700
    lineHeight: 0.95
    letterSpacing: 0
  h2:
    fontFamily: "Playfair Display"
    fontSize: 3rem
    fontWeight: 700
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

Premium residential roofing with cinematic trust: dramatic roof photography, refined editorial typography, and practical conversion sections that feel established rather than flashy.

## Colors

- **Primary (#0B2F57):** cinematic navy for hero overlays and premium roof photography.
- **Secondary (#51606F):** slate captions, borders, and restrained metadata.
- **Tertiary (#0E6B4F):** forest-green contact and conversion actions.
- **Neutral (#F7F5F0):** warm editorial page background.
- **Surface (#FFFFFF):** main content canvas.

## Typography

- Display: elegant high-contrast serif for H1/H2.
- Body: clean sans-serif with generous line height.
- Navigation / labels: compact sans-serif, medium weight, restrained letter case.

## Layout

- hero: full-bleed or large photographic hero, nav over image or clean top nav.
- services: 3-6 service blocks with icons or imagery, not generic cards only.
- proof: verified proof only; demo-safe proof structure allowed without fake reviews.
- projects: gallery grid and project-detail style section for premium/multi-page.
- FAQ/contact: FAQ + appointment/contact form for high-intent conversion.
- footer: substantial footer with quick links, service areas, contact details.

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

- Make the first viewport unmistakably roofing.
- Preserve a multi-page system feel even when generating a one-page teaser.
- Use customer-safe, polished copy with practical buyer language.
- Keep verified facts separate from demo content.

### Don't

- Copy the reference brand, logo, exact copy, code, or paid assets.
- Use text-only hero.
- Add fake reviews, fake years, fake warranties, or fake licenses.
- Expose internal workflow language to customers.
