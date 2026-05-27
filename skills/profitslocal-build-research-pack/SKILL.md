---
name: profitslocal-build-research-pack
description: Use when a lead has been qualified by `profitslocal-lead-discovery` (grade A or B) and you need to prepare the source-of-truth research package required to build the website. Drives entity enrichment → official-site crawl → core-facts extraction → content/design/structure handoff → OD-package manifest. Stops at the handoff layer; the composer / template renderer is a separate step.
---

# ProfitsLocal · Build Research Pack

Turn a qualified lead's `lead-to-research.json` into a buildable project capsule under `clients/<slug>/v2/handoff/`.

## Sibling skills (2026-05-27 modularization)

Several stages this skill used to own internally are now canonical skills in their own right. This skill remains the **orchestrator wrapper** — `pl:research-pack` still drives them end-to-end via `--mode enriched|full` — but each stage is independently invokable and has its own SKILL.md:

| Stage | Owning skill | CLI |
|---|---|---|
| Upstream paid enrichment | `profitslocal-entity-enrichment` | `pl:enrich-entity`, `pl:places-enrich`, `pl:download-places-photos`, `pl:summarize-external-mentions` |
| OD-readiness gate | `profitslocal-data-checkpoint` | `pl:data-checkpoint` |
| Package assembly | `profitslocal-assemble-handoff` | `pl:assemble-handoff` |
| Pre-build audit | `profitslocal-audit-handoff` | `pl:audit-handoff` |

Call this skill when you want the full chain. Call a specific sibling when you've already run upstream and need a targeted re-run.

## When to use

- Skill A wrote `data/leads/handoffs/<entityKey>.lead-to-research.json` and you're now prepping build assets
- Manual: customer provided a slug and you want to (re)generate the v2 handoff package
- Re-enrich after the client confirmed missing facts (logo / certifications / project photos)

Do **not** use this skill to: search for new leads (`profitslocal-lead-discovery`), render the actual website (composer / template family work), or generate outreach emails.

## Inputs

| Field | Required | Notes |
|-------|----------|-------|
| `entityKey` or `slug` | yes | Either identifies the client uniquely. Skill resolves to the other. |
| `--from-handoff` | optional | Path to `lead-to-research.json` (auto-located if absent). |
| `--customer-notes` | optional | Path to plain-text or JSON with customer-supplied corrections / assets. |
| `--niche` | inferred | From entity.identifiers.niche; needed to pick niche adapter. |
| `--mode` | optional | `mvp` (defaults heavy) · `enriched` (default, runs enrich-handoff) · `full` (adds OD assemble + audit). |

## Workflow

```text
1. RESOLVE     · entityKey ↔ slug ↔ master.md  ↔ lead-to-research handoff
2. ENRICH      · entity-level 4-source enrichment (ABN / WHOIS / Wayback / GBP details)
3. CRAWL       · multi-page crawl of official site if present (services / about / contact / gallery)
4. EXTRACT     · core-facts.json (LOCKED hard facts) + content.<niche>.json + design.<niche>.json + brand-spec.md
5. ASSEMBLE    · structure/page-map + page-sections + cta-system + image-manifest
6. PACKAGE     · od-package/DESIGN-MANIFEST.json (canonical read-order + facts policy + tokens)
7. VALIDATE    · schema check + provenance check + ready-to-build gate
8. EMIT        · data/leads/handoffs/<entityKey>.research-to-build.v1.json (downstream marker)
```

## Source ladder (in order — fail through gracefully)

1. **Google Places** — identity / address / phone / hours / map URL / photo refs / rating
2. **Official website crawl** — services list / process / about / brand voice / page copy
3. **Brand asset extraction** — logo (SVG / PNG) / colour palette / fonts via official site favicon + CSS
4. **GBP photos** — when official site missing or thin (replace AI stock with real client photos)
5. **PDF / OCR** — restaurant menus, brochures, sign images (restaurant-niche only)
6. **Customer / manual confirmation** — last-resort fill for missing critical fields

## Main commands

```bash
# 1. MVP fast path (defaults heavy; not production-ready alone)
npm run pl:build-handoff -- --entity-key <entityKey>

# 2. Enrich the MVP handoff (real-data pass · default for production)
npm run pl:enrich-handoff -- --slug <slug>

# 3. Design / brand resolution (logo + tokens + style)
npm run pl:build-design-handoff -- --slug <slug>

# 4. Structure assembly (page-map, sections, CTA, images)
npm run pl:assemble-handoff -- --slug <slug>

# 5. Validate against schema + facts policy
npm run pl:validate-handoff -- --slug <slug>

# 6. Audit the assembled handoff (data-coverage + brief-quality)
npm run pl:audit-handoff -- --slug <slug>

# 7. One-shot wrapper (P1 · proposed)
npm run pl:research-pack -- --slug <slug>   # runs 1→6 in order; halts on validate fail
```

## Outputs (canonical paths)

```text
clients/<slug>/v2/handoff/
├── core-facts.json              # LOCKED hard facts · _meta.sources required
├── content/
│   ├── services.json            # [{id, name, desc, page_slug, evidence_quote, _source}]
│   ├── about.md
│   ├── faq.json
│   └── hero-copy.json
├── design/
│   ├── brand-tokens.json        # colors / fonts / spacing
│   ├── design-style.md          # design language doc
│   └── image-manifest.json      # per-image: source / role / provenance
├── structure/
│   ├── page-map.json            # which pages exist + their roles
│   ├── page-sections.json       # per-page block flow
│   └── cta-system.json          # primary / secondary CTA targets
├── od-package/
│   ├── DESIGN-MANIFEST.json     # canonical read-order + facts policy + responsive contract
│   ├── v2-spec.json             # composer-ready spec
│   └── README.md
└── audit/
    ├── data-coverage.json       # % facts present vs required
    ├── brief-quality.json       # narrative completeness score
    └── ready-to-build.json      # gate decision
```

## Truth policy (provenance tiers)

Every fact / piece of copy is tagged with one of:

| Tier | Meaning | Allowed in customer-facing copy? |
|------|---------|-----------------------------------|
| `verified` | From official site / customer confirmation | ✓ |
| `source` | From GBP / public records (ABR / ASIC) | ✓ |
| `inferred` | Library default parameterized from facts (city, years) | ✓ (no provenance label visible) |
| `generated` | AI-generated extrapolation | ✓ (no provenance label visible) |
| `sample-pending-verification` | Placeholder · clearly demo | ✗ on production, ✓ on demo banner |

**Never AI-generate**: business_name · phone · address · ABN · license number · review counts · years in business · owner name.

**OK to AI-generate** (with explicit provenance tag): service descriptions · process explanations · FAQ answers · about narrative · CTA copy.

## Ready-to-Build gate

After step 7 (`validate-handoff`), one of four statuses is set:

| Status | Meaning |
|--------|---------|
| `ready_to_build` | All required facts present · proceed to composer |
| `needs_customer_confirmation` | Business-critical fields missing (phone OR address OR services) |
| `needs_more_info` | Optional but high-value fields missing (logo · gallery · reviews) — build with library defaults + flag |
| `blocked_conflicting_evidence` | Two sources contradict on hard facts — human review required |

The gate status is written to:
```
clients/<slug>/v2/handoff/audit/ready-to-build.json
```

## Failure & degrade

| Failure | Fallback |
|---------|----------|
| No official website | Use GBP-only path (services from GBP categories + photos from GBP API) — flag `needs_more_info` |
| Logo unavailable | Generate brand mark + name wordmark via `local-brand-logo` skill — never fake an extracted logo |
| Services list empty after crawl | Niche-default services + flag `needs_customer_confirmation` |
| Brand colors not extractable | Niche-default palette + flag `inferred` provenance |
| Crawl rate-limited | Retry with backoff · then mark `needs_human` |

## Read-order contract

When downstream composer / family applies this handoff, read in this order:

1. `od-package/DESIGN-MANIFEST.json` (top-level instructions)
2. `core-facts.json` (LOCKED hard facts — never override)
3. `design/brand-tokens.json` (CSS variables)
4. `structure/page-map.json` + `page-sections.json` (which pages, which blocks)
5. `content/*.json` (per-section copy)
6. `design/image-manifest.json` (per-block image references)
7. `audit/ready-to-build.json` (gate status — halt if not `ready_to_build` or `needs_more_info`)

This ordering is enforced by `core/composer/read-order.js` and tested in `data/qa/composer-read-order.smoke.json`.

## Validation

```bash
# Schema validation (JSON Schema · runs all artifacts)
npm run pl:validate-handoff -- --slug <slug>

# Audit (data coverage + brief quality + ready-to-build gate)
npm run pl:audit-handoff -- --slug <slug>

# Integration: pick a canonical fixture client
npm run pl:research-pack -- --slug vicwest-roofing --mode full
# expected: ready-to-build.json status = "ready_to_build"
```

## If something looks wrong

- `core-facts.json` has invented data → enrichment over-filled · re-run with `--mode mvp` first
- `services.json` missing `_source` per item → re-run `pl:enrich-handoff`
- `DESIGN-MANIFEST.json` missing readOrder → `assemble-handoff` didn't complete · check logs
- `ready_to_build` keeps returning `blocked_conflicting_evidence` → manually resolve in `core-facts.json` and re-validate
- Logo SVG looks AI-broken → check `design/image-manifest.json[logo]._source`; if `generated`, regenerate via `logo-design` skill

## Handoff to next skill

The natural downstream order (as of 2026-05-27 modularization):

```text
profitslocal-build-research-pack  (this skill)
  → profitslocal-data-checkpoint  (GREEN/YELLOW/RED gate)
  → profitslocal-assemble-handoff (produces od-package/)
  → profitslocal-audit-handoff    (P1-P7 gate · ship or block)
  → [PENDING] profitslocal-compose-site  (unstable · not canonical yet)
  → profitslocal-quality-audit    (4-tier T1+T2+T3+T4 · composite ≥ 73)
```

The website-build layer (`pl:compose-site` / OD pipeline) is intentionally NOT a canonical skill yet — see `docs/v4/CODEX-RESPONSE.md §C.4` for graduation criteria. Until it crosses the threshold, treat `pl:compose-site` and `pl:iterate-site` as experimental.
