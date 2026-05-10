# Fixed Home Page Experiment: Editorial Bold Commercial
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
  "family": "editorial-bold-commercial",
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
- hero: assets/hero-family2-hero-worker-standing-metal-roof-wide.png (b91752026dec)
- projectDetail: assets/projectDetail-family2-project-commercial-metal-roof-detail.png (26bca0a341f8)
- service: assets/service-family2-service-roofer-metal-roof-diagonal.png (a6890a2adb99)
- projectTile: assets/projectTile-family2-service-orange-accent-roof-work.png (5adfc148fb53)
- story: assets/story-family2-story-two-roofers-metal-roof-portrait.png (d9c23209f79c)
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
  "family": "editorial-bold-commercial",
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
# Editorial Bold Commercial Design Language

Niche: roofing

## Reference Summary

Inspired by Matthew's Rooftop Heroes-style screenshot: oversized poster typography, black/white/orange palette, strong roof-worker cutouts, image collage, bold stats, large black story block, and confident commercial/residential service positioning.

## Visual Thesis

Bold commercial roofing energy: big type, sharp orange accents, documentary roof work photography, and confident proof blocks for companies that want to look bigger than a one-person operation. The hero must be the memorable part of the template: poster-scale, roofing-specific, and visually stronger than a normal contractor homepage.

## Typography Direction

- Display: oversized geometric sans-serif, tight but readable.
- Body: clean sans-serif.
- Labels: small uppercase category labels.

## Color System

- Dominant: white and black.
- Accent: vivid construction orange.
- Support: pale sky blue / roof metal gray for shaped section breaks.
- Footer: light rounded CTA footer or black story block.

## Imagery

- hero: worker on roof / roof detail with strong scale, preferably layered with oversized typography or a confident service strip. The image must carry the first viewport, not merely decorate it.
- collage: tiles, metal roofs, commercial roof angles.
- services: human + roof material mix.
- projects: large image grid with architectural roof details.

## Layout Patterns

- hero: poster-scale headline layered with roof image and contractor figure.
- service band: horizontal marquee-like service categories.
- story: black block with overlapping photos and big stats.
- services list: numbered service rows with arrow actions.
- featured work: asymmetric editorial image grid.
- CTA: short, memorable, slightly playful but still professional.

## Best Fit

- Commercial roofing.
- Metal roofing.
- Established contractors with broad service range.
- Cold outreach where we want the demo to feel expensive and differentiated.

## Do

- Use big visual hierarchy and fewer words.
- Make statistics visually prominent only when demo-safe or verified.
- Keep orange as accent, not background everywhere.
- Give the first screen a clear commercial hook: bold roofing headline, roof-worker or roof-detail scale, visible CTA, and one service/navigation strip.

## Do Not

- Make it cute or pastel.
- Use tiny service cards.
- Claim exact project counts, countries, awards, or years unless verified.
- Use a plain split hero, generic centered headline, or small image treatment.
## Final Self-Check Before Finishing
- Screenshot mentally: does first viewport clearly look like a roofing business, not a generic text page?
- Are the images large enough and placed intentionally?
- Would the hero alone make a cold prospect curious enough to open the full preview?
- If the hero uses a split layout, is the roofing image still dominant and premium rather than card-like?
- Does the copy sound like a real local roofer, not a SaaS landing page?
- Is the design stronger than a default web-prototype seed?
