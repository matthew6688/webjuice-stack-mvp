# SOP · Image Strategy · real vs stock vs AI · ProfitsLocal · codex R86 · 2026-05-29

> **PURPOSE**: decide when to use real client/GBP/website photos, stock library images, or AI-generated images in customer website renders.
>
> **STATUS**: planning contract only. Do not wire composer behavior from this SOP until the next implementation round.
>
> **CORE DECISION**: use **quality-gated mixed imagery**, not real-first and not stock-first.

---

## §1 · Principle

Use the image that best serves the section's job, subject to truth and provenance.

Real images are preferred when the section is selling trust, proof, workmanship, or customer recognition. Stock or AI images are allowed when the section is selling first-impression polish, mood, material clarity, or design-system consistency and the available real photo fails the section gate.

Every rendered image must carry internal provenance. Customer-facing pages must not pretend stock or AI imagery is verified business proof.

---

## §2 · Existing Inputs

Do not rebuild these capabilities:

- `pl:classify-images` already emits `category`, `quality_score`, `brand_fit_for_roofing_site`, `suggested_uses`, `suggested_alt`, and recommendations for `homepage_hero`, service slots, gallery, and about/team.
- R83 provenance already defines `verified`, `geo_derived`, `ai_inferred`, `ai_placeholder`, `stock_placeholder`, and `replace_policy`.
- The current composer still renders hard-coded stock assets in several slots. R86 does not change that yet.

---

## §3 · Section Strategy Matrix

| Section / slot | Primary source | Gate for real image | Fallback | Provenance rule |
|---|---|---:|---|---|
| `hero` | real only if excellent | `category=hero`, `quality_score >= 8`, `brand_fit >= 8`, strong crop/aspect fit | intentional stock or AI-generated brand-fit image | real=`verified`; deliberate stock=`stock_placeholder + usage_intent=intentional_design_asset`; deliberate AI=`ai_placeholder + usage_intent=intentional_design_asset`; forced fallback=`*_placeholder + usage_intent=fallback_missing_real` |
| `gallery` / `our work` / `projects` | real | `quality_score >= 6`, `brand_fit >= 5`, visible trade/project subject | omit weak items; use stock only as clearly demo/preview filler | real=`verified`; stock gallery proof defaults to `stock_placeholder` unless explicitly editorial/demo |
| `before-after` | real paired evidence when available | both images real, same/related project, `quality_score >= 5` | stock/AI only in preview/demo, never as verified proof | real pair=`verified`; fake/demo pair=`stock_placeholder` or `ai_placeholder` with `replace_required` |
| `services` | real service/process photo | `category=service|gallery|hero`, `quality_score >= 6`, section-relevant `suggested_uses` | stock/AI material or process image | deliberate polish=`*_placeholder + usage_intent=intentional_design_asset`; missing-real filler=`*_placeholder + usage_intent=fallback_missing_real` |
| `about` | real team/equipment/workplace | `category=about|team`, `quality_score >= 6`, human/equipment context fits brand | stock/AI only if not implying real team identity | real=`verified`; fake people/team image cannot be represented as staff |
| `team` | real only | identifiable real team/member and usable quality | no image, initials, logo, or layout without headshots | do not use stock/AI faces as team members |
| `logo` | real/customer brand only | `category=logo`, clean enough for header/footer | generated default demo logo only when no real logo exists | customer logo=`verified`; generated demo logo=`ai_placeholder + usage_intent=intentional_design_asset` until accepted |
| `decorative` / texture / background | design-system source | visual fit matters more than truth, but no false claims | stock/AI acceptable | `*_placeholder + usage_intent=intentional_design_asset` when chosen deliberately |
| `social proof` / reviews | never image-proof unless real | must be real customer/review evidence | no fake proof imagery | stock/AI cannot imply verified review/customer event |

---

## §4 · Quality And Style Gates

Use the current classifier fields now. Do not block R86 implementation on new classifier work.

Minimum gates:

- **Hero real photo**: `quality_score >= 8` and `brand_fit_for_roofing_site >= 8`.
- **Gallery / work proof**: `quality_score >= 6`; allow `brand_fit >= 5` because authenticity matters more here.
- **Service image**: `quality_score >= 6` and relevant `suggested_uses` or matching category.
- **About/team**: `quality_score >= 6`; fake team photos are prohibited.
- **Reject / down-rank**: logos in photo slots, blurry/broken/corrupted files, wrong niche, screenshots, unrelated signage, obvious crop failures, or anything classifier marks below 5.

Style fit is not a new schema requirement for the next cut because `brand_fit_for_roofing_site` already exists. Later, if failures repeat, add a more generic `style_fit_score` and `aspect_fit` to the manifest.

---

## §5 · Provenance Semantics

R83's `stock_placeholder = replace_required` is correct for forced fallback, but insufficient for deliberate design choices. Add explicit intent without inventing a fifth truth ladder.

Recommended representation:

```json
{
  "tier": "stock_placeholder",
  "source_kind": "stock",
  "usage_intent": "intentional_design_asset",
  "replace_policy": "none"
}
```

Meaning:

- `stock_placeholder` + `usage_intent=fallback_missing_real` + `replace_policy=replace_required`: no real image existed or passed the gate; must replace before final launch if the section claims real proof.
- `stock_placeholder` + `usage_intent=intentional_design_asset` + `replace_policy=none`: deliberately chosen licensed/owned stock-style asset for mood, material, decoration, or non-proof hero polish.
- `ai_placeholder` + `usage_intent=fallback_missing_real` + `replace_policy=replace_required`: generated stand-in for missing real content.
- `ai_placeholder` + `usage_intent=intentional_design_asset` + `replace_policy=confirm`: generated brand-fit asset that can ship only after explicit acceptance.

Do not rename the existing R83 tier ladder yet. If we later want cleaner enums, migrate by adding `source_kind` / `usage_intent`, not by breaking existing readers.

---

## §6 · Composer Selection Order

When implementation starts, composer image resolution should follow this order per slot:

1. Read `image-manifest.json` and candidate recommendations.
2. Pick a real image only if it passes the section gate.
3. If a real candidate fails hero/service style gates, demote it to gallery or omit it.
4. Use stock/AI only from approved owned libraries or generated assets with internal provenance.
5. Write an image decision map for audit/debug, including selected path, rejected candidates, gate result, provenance, and replace policy.

Do not silently reuse a hard-coded stock image without recording why it won.

---

## §7 · Immediate R86 Decisions

| Question | Decision | Reason | Immediate instruction |
|---|---|---|---|
| 1. Default strategy | **Quality-gated mixed** | Real photos are trust assets, but weak real photos can damage the first impression more than strong owned stock/AI. | Do not implement blind real-first. Resolve per slot with gates. |
| 2. Section strategy | **Yes, section-specific** | Gallery/work proof needs authenticity; hero/decorative slots need polish and design-system fit. | Use the matrix in §3. |
| 3. Quality/style gate | **Use existing classifier fields first** | `quality_score`, `brand_fit_for_roofing_site`, `category`, and `suggested_uses` already cover the next cut. | No classifier schema expansion before composer wiring. Add `style_fit_score` later only if needed. |
| 4. Stock provenance | **Distinguish forced fallback from deliberate stock** | "No real image" and "intentional visual asset" have different client actions. | Add `usage_intent`; keep R83 tiers compatible. |
| 5. Deliverable | **SOP first, 0 code** | This is a product/design policy decision, not an engineering patch. | This document is the R86 deliverable. |
| 6. Order | **SOP → composer → a-j/mark backfill → verify** | The composer needs a stable policy before touching customer outputs. | Next implementation round starts with image decision map + slot resolver. |

---

## §8 · Recommended Next Cut

Implementation sequence after this planning round:

1. Add an image resolver to `pl:compose-editorial` or shared composer helper that reads `image-manifest.json`.
2. Emit `clients/<slug>/v2/editorial-output/image-decisions.json`.
3. Replace hard-coded stock hero/service/gallery slots only where a gated real image wins.
4. Backfill a-j and mark-squire manifests/decisions.
5. Re-run renders and audit screenshots for vicwest, a-j, and mark-squire.
6. Compare audit deltas and visual screenshots before promoting the rule into `CANONICAL.md`.

---

## §9 · Hard No

- No fake stock/AI team headshots.
- No stock/AI before-after presented as completed client work.
- No customer-facing "verified" language for unverified imagery.
- No automatic real-photo hero if the photo fails hero quality or brand fit.
- No silent hard-coded stock once the resolver exists.
