# Phase A Spike Report · 2026-05-28

> **Audience**: Codex (PM)
> **Status**: spike (research + design · no implementation yet · awaiting your verdict)
> **Per your spec**: page-map shape + module coverage table + brand snapshot rule + dry-run flow + score estimate

---

## 1 · Module coverage against SOP §2 12-section flow

| # | SOP section | Module type · variant | Status |
|---|---|---|---|
| 1 | sticky-header | `handoff/shared/header.html` (verbatim) | ✓ shared · not a module |
| 2 | hero | `modules/hero/` · 6 variants (dense-conversion / fullbleed-with-form / fullbleed-with-stats / cinematic-with-bundled-photo / split-image-right / compact-banner) | ✓ |
| 3 | trust-bar | `modules/trust-bar/` · 2 variants (dense-with-icons / horizontal-chips) | ✓ |
| 4 | service-list | `modules/services-grid/` · 2 variants (dense-cards-4col / icon-cards-3col) | ✓ (name = services-grid · update SOP wording) |
| 5 | about-story | `modules/about-intro/` (dense-statement) + `modules/about-body/` (sections-narrative) | ✓ |
| 6 | reviews | `modules/reviews/` · 2 variants (card-grid-3col / dense-with-photos) | ✓ |
| 7 | before-after | `modules/before-after/` (draggable-slider) | ✓ |
| 8 | service-area | `modules/service-areas/` (chip-list) | ✓ (name plural · SOP wording fix) |
| 9 | process | `modules/process/` (four-step-horizontal) | ✓ |
| 10 | faq | `modules/faq/` · 2 variants (accordion / accordion-refined) | ✓ |
| 11 | cta-band | `modules/cta-band/` · 2 variants (centered-dark / dense-conversion) | ✓ |
| 12 | footer | `handoff/shared/footer.html` (verbatim) | ✓ shared |
| 13 | sticky-mobile-bar | **MISSING** | ❌ create (1 hr · 1 variant) |

**Gap is 1 module · not 5+.** Codex was right. My SOP §2 had names `service-list` / `service-area` (singular); modules use plural `services-grid` / `service-areas`. Update SOP wording rather than rename modules (modules are canonical · SOP is the drift).

---

## 2 · Proposed single-page page-map shape (extends existing v2-spec.json contract)

No new abstraction. Same `v2-spec.json` schema · 1 page with 12 blocks:

```json
{
  "version": "2.0",
  "mode": "single-page",                              ← NEW (default: "multi-page")
  "niche": "roofing",
  "pages": [
    {
      "id": "home",
      "slug": "/",
      "file": "index.html",
      "role": "single-page",                          ← NEW role value
      "h1": "Ballarat roofs done properly...",
      "meta_description": "...",
      "blocks": [
        { "type": "hero",             "variant": "dense-conversion",  "content": null },
        { "type": "trust-bar",        "variant": "horizontal-chips",  "content": null },
        { "type": "services-grid",    "variant": "icon-cards-3col",   "content": null },
        { "type": "about-intro",      "variant": "dense-statement",   "content": null },
        { "type": "reviews",          "variant": "card-grid-3col",    "content": null },
        { "type": "before-after",     "variant": "draggable-slider",  "content": null },
        { "type": "service-areas",    "variant": "chip-list",         "content": null },
        { "type": "process",          "variant": "four-step-horizontal","content": null },
        { "type": "faq",              "variant": "accordion-refined", "content": null },
        { "type": "cta-band",         "variant": "dense-conversion",  "content": null },
        { "type": "sticky-mobile-bar","variant": "phone-cta-pair",    "content": null }
      ]
    }
  ],
  "header": {...},                                    ← unchanged
  "footer": {...},                                    ← unchanged
  "brand": {...},                                     ← unchanged (snapshot from clients/<slug>/v2/brand/)
  "facts": {...}                                      ← unchanged
}
```

**Implementation impact on pl:compose-site**: when `mode === "single-page"`, skip the multi-page about/contact/services-overview/etc. pages · render only the single `home` page · keep header/footer verbatim · keep sticky-mobile-bar absolute-positioned outside main grid.

**Style-router job (Phase A or B?)**: pick `variant` per block per client brand archetype (e.g. heritage → `cinematic-with-bundled-photo` hero; suburban-volume → `compact-banner`). My current v2-spec.json fixtures have `variant: null` which falls back to defaults. Style-router can be Phase B unless you say earlier.

---

## 3 · Brand snapshot rule (per your Q-A-1 decision)

```
AUTHORING (where I edit · SSOT for assets)
  clients/<slug>/v2/brand/
    ├── brand-spec.json
    ├── brand-tokens.css
    ├── logo-{mark,wordmark,horizontal,dark,light,mono-dark,mono-light}.svg
    ├── favicon.svg + social-avatar.svg
    ├── visual-style-contract.md + agent-handoff.md
    └── _v3-{brand-tokens,logo-mode}.json

BUILD SNAPSHOT (what compose-site reads · created by assemble-handoff)
  clients/<slug>/v2/handoff/od-package/brand/
    ├── brand-tokens.css     ← copied verbatim from authoring
    ├── logos/                ← copied
    ├── brand-spec.json       ← copied
    └── _snapshot.json        ← {source, snapshot_at, source_sha256}

RENDER (compose-site reads ONLY snapshot · never authoring)
  clients/<slug>/v2/composed-output/index.html  ← references handoff/od-package/brand/
```

**Implementation impact on pl:assemble-handoff**: add a copy step `clients/<slug>/v2/brand/* → clients/<slug>/v2/handoff/od-package/brand/` with snapshot-source SHA logged. Existing pl:assemble-handoff already creates `handoff/od-package/brand/` (vicwest currently has it from prior OD pipeline runs) · the change is making `clients/<slug>/v2/brand/` the canonical source.

For vicwest specifically: it ALREADY has `handoff/od-package/brand/` from old OD pipeline (different SHA from my Phase 1 brand kit). Spike must determine which wins. Recommend: my Phase 1 brand kit at `clients/<slug>/v2/brand/` wins · old OD-pipeline brand assets get archived.

---

## 4 · pl:e2e --single-page --dry-run flow

```
pl:e2e --slug vicwest-roofing --single-page --dry-run
  ↓
[1/6] pl:data-checkpoint --slug vicwest-roofing
       → reads clients/vicwest-roofing/v2/checkpoint.json
       → vicwest = YELLOW (verified earlier) → proceed with warn
[2/6] pl:assemble-handoff --slug vicwest-roofing --single-page
       → builds handoff/od-package/
       → NEW: copies clients/.../v2/brand/* → handoff/od-package/brand/ + _snapshot.json
       → writes v2-spec.json with mode=single-page · pages=[1] (12 blocks)
[3/6] pl:validate-handoff --slug vicwest-roofing
       → validates schema-v2.json · refuses on missing required fields
[4/6] pl:validate-single-page-brief --slug vicwest-roofing       ← NEW (CODEX-PRIO-2 · defer per your seq)
       → SOP §3 H1-H9 + §6 schema · suburb ≥8 · urgency_mix vs emergency_phone
[5/6] pl:compose-site --slug vicwest-roofing --single-page
       → reads v2-spec.json mode=single-page
       → emits clients/<slug>/v2/composed-output/index.html ONLY
       → no about.html / contact.html / etc.
[6/6] pl:audit-tier --slug vicwest-roofing (v3 · production gate · Matthew-signed)
       + pl:audit-v4 --slug vicwest-roofing (experimental · diagnostic only)
       → composite + brand-contract report
```

**--dry-run** prints each step without writing files. Useful for testing v2-spec.json shape changes.

---

## 5 · Score estimate · per your "55-68 first run"

| Phase | Tier | Predicted score | Reason |
|---|---|---:|---|
| Spike 1 · vicwest single-page first compose | v3 composite | 58-65 | modules library wasn't designed against SOP §3 hero rules · hero copy length OK · but variant selection arbitrary |
| Spike 1 · vicwest | v4 brand contract | 60-75 | brand-tokens.css IS in snapshot · compose-site uses tokens · should be > current 34 (hand-written brand-grid-experiment had 27% var-coverage because compose-site is more disciplined than ad-hoc sub-agent) |
| After 1 fix-loop iteration | v3 composite | 70-78 | iterate-site picks specific failures (suburb count · phone count · etc.) and surgical fixes |
| 3-client cross-validation | v3 mean | 65-75 | mark-squire heritage will score well · a-j INFERRED brand will be penalised on factual accuracy |

**Below your 55-68 threshold target unlikely** unless module variants are wildly off-SOP. Confirm risk tolerance: do we accept first-compose result above 55 even if below 73 ship-gate · iterate · then declare Phase A done?

---

## 6 · Concrete implementation order (your reorder A2 → A4 → A1 → A3 → A6 → A5 → A7)

| Step | Hours | Output |
|---|---|---|
| **A2 module coverage audit** | DONE | ✓ this report §1 |
| **A4 brand snapshot rule** | 2 hr | modify pl:assemble-handoff to copy + snapshot + SHA log |
| **A1 single-page spec shape** | 0.5 hr | doc + 1 vicwest v2-spec.json (single-page) fixture |
| **A3 pl:compose-site --single-page flag** | 2 hr | mode=single-page · skip multi-page logic · 1 file out |
| **+sticky-mobile-bar module** | 1 hr | `modules/sticky-mobile-bar/phone-cta-pair.html` |
| **A6 vicwest e2e compose + audit** | 1 hr | scores · iterate flag · 1 fix-loop |
| **A6 cross 3 clients** | 1 hr | mark-squire + a-j (per Q-A-7) |
| **A5 pre-render gate** | 2 hr | pl:validate-single-page-brief (after seeing real failure modes) |
| **A7 archive forks** | 10 min | `experiments/_archive/` |
| **Total spike → full** | **~9 hr** | repeatable single-page pipeline |

---

## 7 · external/skills · per your curation pushback

You said: don't integrate code · use as reference only · biggest source is our own modules + SOP not external wisdom.

I adjust:
- ❌ DROP: gstack/design-review (was code · downgrade to fix-loop protocol read)
- ❌ DROP: anthropics-skills/frontend-design (too generic · read once)
- ✅ KEEP: marketingskills/cro · extract specific rules → pl-audit-v4 dim definitions
- ✅ KEEP: marketingskills/copywriting · extract specific prompts → pl-llm-page-copywriter when SOP fail
- ✅ KEEP: taste-skill/brandkit · already used for Phase 1 SOP reference (no further pull)
- ✅ ADD: own `templates/roofing/modules/_library-manifest.json` as PRIMARY source

---

## 8 · Open questions for you

**Q-B-1 · Old OD-pipeline brand assets at vicwest**: vicwest has `handoff/od-package/brand/` from prior OD runs (different SHA than Phase 1). Which wins? My pick: Phase 1 wins (it's the SOP-aligned canonical) · old gets archived.

**Q-B-2 · style-router timing**: pick block variant per client brand archetype. Phase A or defer to B? My pick: defer to B · spike uses default variants (each block has documented default).

**Q-B-3 · "below 55 = stop · refactor modules" tripwire**: if first compose comes in below 55 · stop · don't iterate · refactor modules library first. Agree?

**Q-B-4 · Module variant selection for spike**: I propose vicwest fixture uses `hero/dense-conversion` · `trust-bar/horizontal-chips` · `services-grid/icon-cards-3col` · `cta-band/dense-conversion`. Confirm or counter-propose.

**Q-B-5 · Next reported deliverable**: per your spec "Phase A spike result not big implementation" · I should now do A4 + A1 + new sticky-mobile-bar module + A3 + first compose · then report v3+v4 scores. Estimated ~5-6 hr of work + 1 hr ai-review. Approve.
