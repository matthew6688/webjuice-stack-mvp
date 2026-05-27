---
name: profitslocal-entity-enrichment
description: Use after `profitslocal-lead-filter` graded a lead A or B and before any handoff/research work. This skill is where paid enrichment happens — Google Places Details, ABN registry, WHOIS, Wayback, GBP photos download, Tinyfish search-ladder for external mentions. Every paid call lands in the cost ledger; provenance is stamped via `_source` sibling fields. Never AI-generates name/phone/address/license/services.
---

# ProfitsLocal · Entity Enrichment

The paid-call layer. Turns a graded entity into a fact-rich one. Strict provenance + ledger discipline.

## When to use

- Lead has `predict_grade ∈ {A,B}` and `cheap_audit.action === "advance"`
- After lead-filter, before research-pack / data-checkpoint
- Re-run when a specific field is missing (`--only places` / `--only abn` etc.)
- Discord drop: `把 vicwest 这单的 ABN + GBP photos 拉一下`

Do **not** use this skill for: writing the customer brief (that's `profitslocal-research-pack`), AI-completing missing facts (that violates the never-invent rule), or running on un-filtered raw leads (wastes Places quota).

## Owner SOPs

- `docs/SOP_1_INTAKE_DISCOVERY.md` — intake field schema + provenance rules
- `docs/SOP_X_TOOLING.md` — search/fetch ladder (Tinyfish → DDG → Dokobot → Perplexity / Tinyfish → Firecrawl → Dokobot)
- `docs/v4/INFRASTRUCTURE-MAP.md §0` — locked T0/T1/T2/T3 cost ladder
- Reference: user-memory `feedback_cost_discipline.md` + `reference_search_providers_routing.md`

## Inputs

| File | Required | Notes |
|------|----------|-------|
| `data/leads/entities/<entityKey>.json` | yes | must already have `predict_grade` from lead-filter |
| `GOOGLE_PLACES_API_KEY` | for Places | env · multi-key rotation in `places-quota-guard.js` |
| `ABN_LOOKUP_GUID` | for ABN | env · au.gov.au registry |
| Tinyfish API key | for external mentions | env |

## Canonical commands

```bash
# Full enrichment (one entity · idempotent · skips already-filled fields)
npm run pl:enrich-entity -- --entity-key <key>

# Single-axis (cheap targeted re-run)
npm run pl:places-enrich -- --entity-key <key>
npm run pl:download-places-photos -- --entity-key <key> --limit 6
npm run pl:summarize-external-mentions -- --slug <slug>
npm run pl:enrich-handoff -- --slug <slug>   # for the handoff-side enrichment B-steps

# Batch (queue-driven · respects cost ladder + ledger)
npm run pl:run-enrichment-batch -- --skip-approval
```

Cost (per entity, typical):
- Places Details: $0.017 / lookup (free-quota covered ≤ ~12k/month)
- Place Photos: $0.007 × ≤ 6
- ABN: $0
- WHOIS / Wayback: $0
- Tinyfish search: T1 subscription
- Total: ~$0.05–0.10 / entity

## Workflow

```text
1. PLACES   · place_id lookup → Place Details (hours · rating · photo_references)
2. PHOTOS   · download photo_references → upload to Cloudinary → write photo_urls[]
3. ABN      · ABN registry lookup → entity_name / status / state
4. WHOIS    · domain owner / registrar / created_date (no-cost · rdap)
5. WAYBACK  · earliest snapshot timestamp (proves real business age)
6. SEARCH   · Tinyfish ladder for external mentions (yelp/houzz/linkedin/weebly)
7. LEDGER   · every paid call appended to data/cost-ledger.jsonl
8. STAMP    · _source sibling on every written field (provenance is 2026-05-17 signed)
```

## Output (writes back to entity JSON)

```json
{
  "latest": {
    "places_enrichment": {
      "place_id": "...",
      "photo_references": [...],
      "photo_urls": ["https://res.cloudinary.com/..."],
      "hours": {...},
      "_source": "google-places"
    }
  },
  "enrichment": {
    "abn": { "number": "...", "entity_name": "...", "_source": "abn-au-gov" },
    "whois": { "registrar": "...", "created": "...", "_source": "rdap" },
    "wayback": { "earliest": "...", "_source": "archive.org" },
    "tinyfish_search": { "mentions": [...], "_source": "tinyfish-ladder" }
  }
}
```

Photos additionally land in `clients/<slug>/v2/handoff/photos/source/` via G-13 (`scripts/cli/pl-download-places-photos.js`).

## Cost-ladder (LOCKED · do not redesign)

| Tier | Provider | Trigger | Per-call cost |
|---|---|---|---|
| T0 | Docker scraper · cheap-audit local · rdap WHOIS | always first | $0 |
| T1 | Tinyfish search · Dokobot Chrome reader · subscription pool | T0 misses | $0 (subscription) |
| T2 | Google Places Details · Place Photos | T1 fails on identity | $0.017 / $0.007 |
| T3 | Perplexity rotation · GPT-4o vision | T2 still ambiguous | metered · ledger required |

**Hard rule**: never escalate a tier without recording the T0/T1 miss reason in the entity trace.

## Provenance contract

Every paid field MUST carry `_source` as a sibling key. Centralized `_meta.sources` map is forbidden (`docs/CURRENT-STATE-2026-05-27.md:100-103`). Provenance ownership: SOP-3 (`docs/SOP_OWNERSHIP_REGISTRY.md:195-197`).

**Never AI-generate**: `business_name`, `phone`, `address`, `abn`, `license_number`, `owner_name`, `review_count`, `service_list`. Missing → leave null + `_source: null` (NOT a fabricated value).

## Failure & degrade

| Failure | Fallback |
|---------|----------|
| Places quota exceeded | quota-guard routes through next key in pool (`places-quota-guard.js` G-12) · ledger records key used |
| ABN lookup down | mark field missing with `_source: "abn-down · retry"` · do not block downstream |
| Tinyfish API 429 | back off to DDG → Dokobot → Perplexity (T3) per ladder · log fall-through |
| Cloudinary upload fails | retain place-photo CDN URL with `_source: "places-direct · cloudinary-failed"` |
| WHOIS / Wayback timeout | skip silently · field stays null |

## Downstream consumers

| Skill / CLI | Reads |
|---|---|
| `profitslocal-research-pack` | full enrichment block + photos |
| `profitslocal-data-checkpoint` | `places_enrichment` for GBP signals · `abn.number` for rich-field gate |
| `profitslocal-assemble-handoff` | `photo_urls` for hero/gallery roles |

## Validation

```bash
# Targeted dry-run (only pl:places-enrich supports --dry-run today · 2026-05-27)
npm run pl:places-enrich -- --entity-key <key> --dry-run

# Single-axis live run (cheapest validation · pl:enrich-entity does NOT have --dry-run)
npm run pl:enrich-entity -- --entity-key <key>

# Ledger inspection
tail -20 data/cost-ledger.jsonl | jq .
```

**Note**: `pl:enrich-entity` has no `--dry-run` flag (only `--render` and `--all-active`). For zero-cost validation of provenance shape, use `pl:places-enrich --dry-run` against a single entity.

## Handoff to next skill

When enrichment completes (`entity.latest.places_enrichment.place_id` is set AND at least 1 paid source landed), the next skill is **`profitslocal-research-pack`**, which assembles the multi-source brief.

## If something looks wrong

- Photos missing despite `photo_references` non-empty → check `pl:download-places-photos` ran AFTER `pl:places-enrich` (ordering matters)
- Provenance fields missing on enrichment block → upstream skipped `_source` stamping; do NOT post-fix by inferring source
- `core/llm/key-rotation.js` referenced in docs but doesn't exist → multi-key rotation only implemented in `places-quota-guard.js`; for other providers, single-key only today
- Perplexity fallback "unavailable" → `core/llm/perplexity.js` file doesn't exist yet · T3 escalation falls through to error
