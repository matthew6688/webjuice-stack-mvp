# Ridge & Hammer Roofing Template Style Guide

Template family: `editorial-bold-commercial`

## Visual Position

Bold commercial roofing energy: oversized poster typography, black and white contrast, vivid construction orange, and real roof-worker photography. The first viewport should feel like a confident commercial contractor, not a generic local-service brochure.

## Tokens

```css
:root {
  --bg: #F7F7F4;
  --surface: #FFFFFF;
  --fg: #050505;
  --muted: #6D6D6D;
  --border: #D8D8D2;
  --accent: #F25A1D;
  --sky: #DDEAF0;
  --metal: #B8B9B4;
}
```

## Typography

- Display: Inter, Arial, Helvetica, sans-serif.
- Body: Inter, Arial, Helvetica, sans-serif.
- Labels and numbers: system monospace.
- H1 uses poster scale, uppercase, weight 950, line-height under 0.9.
- H2 uses compressed commercial scale, uppercase, weight 920+.
- Labels are small uppercase and orange.

## Logo

Use one default demo logo only: simple geometric roof/service mark plus readable RH wordmark. Do not create multiple logo choices for this family.

## Imagery

Use the reviewed local image set in `assets/`:

- `hero-worker-standing-metal-roof-wide.png`
- `project-commercial-metal-roof-detail.png`
- `service-roofer-metal-roof-diagonal.png`
- `service-orange-accent-roof-work.png`
- `story-two-roofers-metal-roof-portrait.png`

Hero must use the wide worker-on-metal-roof image with large sky negative space. The commercial metal roof detail and diagonal roofer image should be used for proof, services, materials, or gallery sections.

## Section Rhythm

Primary page:

1. Poster hero with roof-worker image.
2. Marquee service band.
3. Black story/stat block.
4. Numbered service list.
5. Material/photo proof split.
6. Asymmetric project gallery.
7. Process.
8. FAQ.
9. Contact.
10. Footer.

Outreach page:

1. Short poster hero.
2. Proof strip.
3. Fit/service list.
4. Photo proof.
5. Contact CTA.

## Copy Rules

- Customer-facing copy only.
- Do not mention internal workflow, audits, template systems, or build process.
- Do not invent verified facts: exact address, email, reviews, licenses, certifications, years in business, awards, or prices.
- Demo-safe copy can cover service descriptions, FAQ, process, and project teaser structure.
- Use placeholders for contact information when the real business detail is not verified.

## Accent Budget

Orange is used for labels, primary CTAs, selected stat emphasis, and small service separators. Avoid orange backgrounds across whole sections. Black poster blocks and photography should carry the design.
