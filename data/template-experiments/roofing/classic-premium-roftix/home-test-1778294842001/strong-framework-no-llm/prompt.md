# Fixed Home Page Experiment: Classic Premium Roftix
Variant: strong-framework-no-llm
Hypothesis: Strong framework improves structure but may suppress Open Design visual taste.
## Non-negotiable Experiment Rules
- Build only one polished home page: `index.html`.
- Use the files in the seeded `assets/` folder as primary imagery. Do not fetch replacement stock images.
- Do not use external URLs for images.
- No fake licences, fake awards, fake review quotes, fake exact addresses, fake years in business, or fake prices.
- Customer-facing text must not mention Open Design, ProfitsLocal, template-lab, audit, mockup, experiment, or internal workflow.
- Include one obvious phone/form quote path.
- The page should be visually strong enough to judge from a screenshot.
## Fixed Business Facts
{
  "niche": "roofing",
  "family": "classic-premium-roftix",
  "page": "home",
  "businessName": "RidgeLine Roof Co.",
  "businessType": "local roofing contractor",
  "serviceArea": "Brisbane and Gold Coast",
  "contact": {
    "phone": "0400 000 000",
    "email": "",
    "website": ""
  },
  "services": [
    "Roof repairs",
    "Roof restoration",
    "Metal roofing",
    "Gutter repairs",
    "Roof inspections"
  ],
  "primaryAction": "request a roof inspection or quote",
  "proofBoundary": [
    "exact address",
    "email",
    "phone",
    "reviews",
    "licenses",
    "certifications",
    "years in business",
    "awards",
    "prices"
  ],
  "demoSafeContent": [
    "FAQ",
    "process",
    "service descriptions",
    "project teaser structure",
    "blog titles"
  ]
}
## Seeded Approved Assets
- hero: assets/hero-family1-hero-premium-roof-at-blue-hour.png (6dddb55aee2b)
- serviceRepair: assets/serviceRepair-family1-service-roof-repair-flashing-detail.png (ffad6a21f15a)
- serviceInstall: assets/serviceInstall-family1-service-roof-installation-detail.png (1c3418d06644)
- about: assets/about-family1-about-roofer-working-roof-frame.png (d38c9365a6f9)
- proof: assets/proof-family1-project-before-after-roof-transformation.png (0ee14f3749e5)
## Local LLM Copy Brief
Status: not_requested. Reason: copy mode disabled.
## Constraint Mode
Follow the framework contract closely.
Use the section order and image slots exactly unless impossible.
Use design tokens and section purposes as hard constraints.
## Framework Contract
{
  "schemaVersion": 1,
  "source": "generated-homepage-framework-v1",
  "warning": "Existing section-patterns.json has no section detail; this generated homepage framework is the active test contract.",
  "family": "classic-premium-roftix",
  "page": "home",
  "sections": [
    {
      "id": "hero",
      "job": "Make the roofing offer obvious in 3 seconds.",
      "imageSlot": "hero",
      "required": [
        "business name",
        "roofing category",
        "primary phone/form CTA",
        "one short promise"
      ]
    },
    {
      "id": "services",
      "job": "Show the homeowner what work can be requested.",
      "imageSlot": "serviceRepair or serviceInstall",
      "required": [
        "3-5 services",
        "plain descriptions",
        "no fake certifications"
      ]
    },
    {
      "id": "proof",
      "job": "Make the work feel concrete without inventing reviews or exact metrics.",
      "imageSlot": "proof or about",
      "required": [
        "process proof",
        "material/workmanship cues",
        "demo-safe project structure"
      ]
    },
    {
      "id": "quote-process",
      "job": "Explain how a visitor gets an inspection or quote.",
      "imageSlot": "serviceInstall",
      "required": [
        "step sequence",
        "phone/form CTA"
      ]
    },
    {
      "id": "faq-contact-footer",
      "job": "Answer common concerns and make contact easy.",
      "imageSlot": "none",
      "required": [
        "FAQ",
        "contact form",
        "phone link",
        "complete footer"
      ]
    }
  ]
}
## Design Language
# Classic Premium Roftix Design Language

Niche: roofing

## Reference Summary

Inspired by the Roftix-style multi-page roofing screenshots Matthew provided: dark blue photographic roof hero, elegant editorial serif headings, generous white editorial sections, green trust/CTA accents, deep dark footer, and strong page system coverage.

Use this as a premium roofing system, not a literal clone.

## Visual Thesis

Premium residential roofing with cinematic trust: dramatic roof photography, refined editorial typography, and practical conversion sections that feel established rather than flashy.

## Typography Direction

- Display: elegant high-contrast serif for H1/H2.
- Body: clean sans-serif with generous line height.
- Navigation / labels: compact sans-serif, medium weight, restrained letter case.

## Color System

- Dominant: deep roof blue / navy photo overlays.
- Accent: forest green for contact and primary CTA.
- Secondary accent: warm orange only for small active states.
- Background: white and very light warm gray.
- Footer: near-black charcoal with muted gray text.

## Imagery

- hero: real house roof / roofline photo with evening or premium architectural mood.
- services: roofers at work, material details, roof repair/install photos.
- project/gallery: before/after, residential roof projects, close-ups.
- team/trust: credible contractor portraits if available; otherwise no fake team claims.
- CTA: roof or home exterior image with readable overlay.

## Layout Patterns

- hero: full-bleed or large photographic hero, nav over image or clean top nav.
- services: 3-6 service blocks with icons or imagery, not generic cards only.
- proof: verified proof only; demo-safe proof structure allowed without fake reviews.
- projects: gallery grid and project-detail style section for premium/multi-page.
- FAQ/contact: FAQ + appointment/contact form for high-intent conversion.
- footer: substantial footer with quick links, service areas, contact details.

## Best Fit

- Established roofer with a website worth redesigning.
- Premium residential roof restoration / replacement.
- Lead where we have enough visuals or can source/produce strong roof imagery.

## Do

- Make the first viewport unmistakably roofing.
- Preserve a multi-page system feel even when generating a one-page teaser.
- Use customer-safe, polished copy with practical buyer language.
- Keep verified facts separate from demo content.

## Do Not

- Copy the reference brand, logo, exact copy, code, or paid assets.
- Use text-only hero.
- Add fake reviews, fake years, fake warranties, or fake licenses.
- Expose internal workflow language to customers.
## DESIGN.md Contract
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
## QA Rubric
{
  "schemaVersion": 1,
  "passScore": 85,
  "criteria": [
    {
      "id": "referenceFidelity",
      "label": "Reference fidelity without copying",
      "weight": 15
    },
    {
      "id": "firstViewportImpact",
      "label": "First viewport impact",
      "weight": 15
    },
    {
      "id": "imageDensity",
      "label": "Image density and niche relevance",
      "weight": 12
    },
    {
      "id": "nicheFit",
      "label": "Niche and sub-niche fit",
      "weight": 12
    },
    {
      "id": "pageCompleteness",
      "label": "Page/system completeness",
      "weight": 12
    },
    {
      "id": "ctaHierarchy",
      "label": "CTA hierarchy and conversion path",
      "weight": 10
    },
    {
      "id": "trustProof",
      "label": "Trust/proof richness",
      "weight": 8
    },
    {
      "id": "mobilePolish",
      "label": "Mobile polish",
      "weight": 8
    },
    {
      "id": "copyCleanliness",
      "label": "Customer-facing copy cleanliness",
      "weight": 8
    }
  ],
  "hardFails": [
    "customer-visible internal workflow terms",
    "missing primary visual asset in a photo-heavy family",
    "fake verified facts such as reviews, licenses, address, years, awards, or prices",
    "no visible phone/form/contact path in lead-generation templates"
  ]
}
## Final Self-Check Before Finishing
- Screenshot mentally: does first viewport clearly look like a roofing business, not a generic text page?
- Are the images large enough and placed intentionally?
- Does the copy sound like a real local roofer, not a SaaS landing page?
- Is the design stronger than a default web-prototype seed?
