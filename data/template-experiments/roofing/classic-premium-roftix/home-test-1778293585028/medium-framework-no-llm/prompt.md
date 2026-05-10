# Fixed Home Page Experiment: Classic Premium Roftix
Variant: medium-framework-no-llm
Hypothesis: Medium constraints should preserve business structure while leaving visual freedom.
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
Follow the business and section goals, but make visual decisions freely.
Use the framework as a guide, not a cage.
Prefer a beautiful result over mechanically satisfying every section note.
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
## Final Self-Check Before Finishing
- Screenshot mentally: does first viewport clearly look like a roofing business, not a generic text page?
- Are the images large enough and placed intentionally?
- Does the copy sound like a real local roofer, not a SaaS landing page?
- Is the design stronger than a default web-prototype seed?
