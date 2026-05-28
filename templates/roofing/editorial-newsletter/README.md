# Editorial Newsletter · Template

> Templated extraction of the Matthew-approved Phase 3 hand-rendered editorial preview (`templates/roofing/brand-grid-experiment/vicwest-roofing/editorial/preview.html` · audit 89/A/SHIP · D2.5 brand_palette_honored 100/100).
>
> Source: codex Round 23 GO · Phase B Step 1.
> Parity contract: `docs/v3/PHASE3-PARITY-CHECKLIST.md` (every box must check before this template is considered correct).

## Files

- `template.html` · Mustache-templated single-page (9 sections: hero · strap · services · about · reviews · gallery · coverage · contact · colophon + sticky mobile CTA)
- `README.md` · this doc

## Renderer

`pl:compose-editorial --slug <slug>` (Phase B Step 2 · `scripts/cli/pl-compose-editorial.js`).

## Mustache field contract

Composer must supply this shape (top-level keys):

```
{
  client: {
    business_name, short_name, city, state, phone_display, phone_tel, email,
    address_html (raw), hours_html (raw), hours_lines: [],
    year_founded, abn?, license_authority?, license_number?,
    license_visible (bool — only true when authority + number both present + verified),
    google_maps_url?,
  },
  brand: { primary_hex, accent_hover_hex, accent_active_hex },
  brand_tokens_css_inline: <raw CSS string from brand-tokens.css>,
  seo: { title, meta_description, canonical_url, og_title, og_description },
  jsonld_localbusiness: <raw JSON string · RoofingContractor schema>,
  asset: {
    favicon_path, logo_horizontal_path, logo_mono_light_path,
  },
  hero: {
    eyebrow, headline, subhead,
    cta_primary_label, cta_secondary_label,
    chips: [str, ...],  // ≥4 per parity REQ-HE5
    image: { src, alt, plate_label, caption },
  },
  strap: { cells: [{value, label}, ...] },  // 4 cells
  services: {
    eyebrow, headline, subhead,
    items: [{number, category, title, body, image_src, image_alt}],  // 4-6
  },
  about: {
    eyebrow, headline, image_src, image_alt, image_caption,
    paragraphs: [str, ...],  // 2-3
  },
  reviews: {
    eyebrow, headline, subhead,
    items: [{stars_aria, stars_unicode, quote, author, location, source_label}],  // 3
    is_placeholder (bool),  // if true · disclaimer banner renders
    real_count (int),  // shown in disclaimer
  },
  gallery: {
    eyebrow, headline, subhead,
    pairs: [{idx, before_src, before_alt, after_src, after_alt, caption}],  // R-BA-6 draggable-slider
  },
  coverage: { eyebrow, headline, subhead, suburbs: [str, ...], by_arrangement_text? },
  contact: { eyebrow, headline, subhead },
  colophon: { tagline, year },
}
```

## Provenance integration (codex R23 EE-2 c)

Composer reads `_source` field from core-extract.json / facts.json. Fields with `_source: ai-placeholder` cause `reviews.is_placeholder = true` (banner shown · NEVER in JSON-LD facts). Fields missing or `_source: needed-client-supplied` hide the corresponding chip/section. `_source: forbidden` (e.g. lifetime guarantee per AV-6) strip from output.

## R-BA-6 hard rule

Gallery section uses draggable-slider DOM (`.ba-slider` / `.ba-divider` / `.ba-handle`) NOT static side-by-side figures. Drag script inline at bottom.

## Parity gate

Vicwest validation MUST pass all 5 visual parity criteria (logo / palette / license / subhead density / audit score ≥89) + 30+ REQ-* IDs in `docs/v3/PHASE3-PARITY-CHECKLIST.md`. No expansion to other clients until gate passes.

## Future variants

- `editorial-portrait` — single hero portrait emphasis (owner-led trades · mark-squire style)
- `editorial-magazine` — multi-column dense layout (commercial / large operations)

Don't add until 2 are needed (codex R9 D3 "no premature split").
