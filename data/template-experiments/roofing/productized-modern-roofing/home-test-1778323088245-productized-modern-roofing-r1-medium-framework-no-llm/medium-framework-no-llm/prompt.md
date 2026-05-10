# Fixed Home Page Experiment: Productized Modern Roofing
Variant: medium-framework-no-llm
Hypothesis: Medium constraints should preserve business structure while leaving visual freedom.
## Non-negotiable Experiment Rules
- Build only one polished home page: `index.html`.
- Use the files in the seeded `assets/` folder as primary imagery. Do not fetch replacement stock images.
- Do not use external URLs for images.
- No fake licences, fake awards, fake verified reviews, fake exact addresses, fake years in business, or fake prices.
- Review/testimonial modules may use AI-generated reference copy only when clearly marked in HTML metadata, e.g. `data-review-provenance="ai-reference-placeholder"` or `<meta name="review-provenance" content="ai-reference-placeholder; replace with real Google or customer reviews before live">`.
- Customer-facing text must not mention Open Design, ProfitsLocal, template-lab, audit, mockup, experiment, or internal workflow.
- Include one obvious phone/form quote path.
- Include complete local SEO basics: descriptive title, exactly one H1 with roofing + service area, LocalBusiness/RoofingContractor JSON-LD with telephone and areaServed/address placeholder, and a real Google Maps/directions URL placeholder such as `https://www.google.com/maps/search/?api=1&query=Brisbane+roofing+contractor`.
- Every raster image must have meaningful alt text; all non-hero images should use `loading="lazy"`.
- The page should be visually strong enough to judge from a screenshot.
## Fixed Business Facts
{
  "niche": "roofing",
  "family": "productized-modern-roofing",
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
- hero: assets/hero-family3-hero-modern-metal-roof-sunset-wide.png (7c37f658fc8c)
- inspection: assets/inspection-family3-inspection-drone-roof-check.png (288c9189b006)
- materialTerracotta: assets/materialTerracotta-family3-product-terracotta-tile-sample.png (ae614e9d5cd3)
- materialMetal: assets/materialMetal-family3-product-standing-seam-metal-sample.png (28b473b683df)
- materialComposite: assets/materialComposite-family3-product-composite-shingle-sample.png (ad102841ad12)
- service: assets/service-family3-service-modern-roofer-metal-roof.png (d7bb14aa18b0)
## Local LLM Copy Brief
Status: not_requested. Reason: copy mode disabled.
## Constraint Mode
Follow the business and section goals, but make visual decisions freely.
Use the framework as a guide, not a cage.
Prefer a beautiful result over mechanically satisfying every section note.
## Framework Contract
{
  "schemaVersion": 1,
  "source": "generated-homepage-framework-v1",
  "warning": "Existing section-patterns.json has no section detail; this generated homepage framework is the active test contract.",
  "family": "productized-modern-roofing",
  "page": "home",
  "sections": [
    {
      "id": "hero",
      "job": "Make the roofing offer obvious in 3 seconds.",
      "imageSlot": "hero",
      "required": [
        "business name",
        "roofing category",
        "service area in H1",
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
        "service area",
        "hours",
        "real Google Maps/directions URL placeholder",
        "complete footer"
      ]
    }
  ]
}
## Design Language
# Productized Modern Roofing Design Language

Niche: roofing

## Reference Summary

Inspired by Matthew's Roofex-style reference: modern SaaS/Webflow-like polish, clean gray/white layout, product/material tiles, partner logo strip, FAQ accordion, service accordion, large footer wordmark, and calm premium photography.

## Visual Thesis

Modern productized roofing: precise, clean, consultative, and easy to compare, especially for businesses that sell materials, roofing systems, inspections, or quote packages.

## Typography Direction

- Display: modern sans-serif with large clean shapes.
- Body: neutral sans-serif.
- UI labels: small, technical, understated.

## Color System

- Dominant: white and light gray.
- Accent: black / charcoal with subtle green or blue only for actions.
- Background: airy off-white bands.
- Footer: pale gray or charcoal with oversized wordmark treatment.

## Imagery

- hero: contractor on roof with clean overlay.
- materials: tile/metal product shots or AI-generated material tiles.
- services: one strong service image plus accordion rows.
- FAQ: minimal, clear.

## Layout Patterns

- hero: contained image hero with simple nav and stats.
- trust: muted logo/partner strip when demo-safe.
- materials: product grid with roof tile/material cards.
- services: accordion/list with one preview image.
- FAQ: centered accordion.
- CTA: premium roofing banner with image overlay.

## Best Fit

- Roofers who sell roof materials, restoration packages, inspections, or repeatable service bundles.
- Simple multi-page website where clarity and quoting matter more than editorial drama.
- Leads where we want to emphasize organized process and product choice.

## Do

- Keep spacing calm and readable.
- Make comparison/product structure clear.
- Use FAQ and materials as conversion tools.

## Do Not

- Use busy collage layouts.
- Overdo luxury serif type.
- Invent prices or product brands unless provided.
## Final Self-Check Before Finishing
- Screenshot mentally: does first viewport clearly look like a roofing business, not a generic text page?
- Are the images large enough and placed intentionally?
- Does the copy sound like a real local roofer, not a SaaS landing page?
- Is the design stronger than a default web-prototype seed?
