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
- Hero quality is a hard visual requirement: the first viewport must be photo-led, roofing-specific, conversion-focused, and stronger than a generic split-card SaaS hero. If the hero image feels small, decorative, or detached from the offer, redesign the hero before finishing.
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
      "job": "Make the roofing offer obvious and visually desirable in 3 seconds.",
      "imageSlot": "hero",
      "required": [
        "business name",
        "roofing category",
        "service area in H1",
        "primary phone/form CTA",
        "one short promise",
        "large roof/roofer image that dominates or strongly anchors the first viewport",
        "not a generic SaaS split hero or small decorative image card"
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

Modern productized roofing: precise, clean, consultative, and easy to compare, especially for businesses that sell materials, roofing systems, inspections, or quote packages. The first viewport must still feel like a premium roofing company, not a SaaS dashboard, brochure shell, or text-first consulting page.

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

- hero: large cinematic roof or roofer photograph with real scale, ideally spanning most of the first viewport. The hero image cannot feel like a small card preview.
- materials: tile/metal product shots or AI-generated material tiles.
- services: one strong service image plus accordion rows.
- FAQ: minimal, clear.

## Layout Patterns

- hero: immersive photo-first hero or large editorial image block with headline/CTA integrated into the composition. Avoid safe split-card SaaS hero layouts unless the image still dominates the first viewport.
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
- Make the first screen immediately desirable enough for outreach: strong roof image, clear local roofing offer, obvious quote/phone action.

## Do Not

- Use busy collage layouts.
- Overdo luxury serif type.
- Invent prices or product brands unless provided.
- Put the main roof image inside a small decorative card beside generic text.
- Let the hero read as SaaS, agency, or blog editorial instead of local roofing.
## Final Self-Check Before Finishing
- Screenshot mentally: does first viewport clearly look like a roofing business, not a generic text page?
- Are the images large enough and placed intentionally?
- Would the hero alone make a cold prospect curious enough to open the full preview?
- If the hero uses a split layout, is the roofing image still dominant and premium rather than card-like?
- Does the copy sound like a real local roofer, not a SaaS landing page?
- Is the design stronger than a default web-prototype seed?
