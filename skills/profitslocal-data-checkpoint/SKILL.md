---
name: profitslocal-data-checkpoint
description: Use immediately after `profitslocal-build-research-pack` finishes a client's handoff package, BEFORE composing a website. This skill is the OD-readiness gate that decides whether the client has enough verified data to ship a website at all (GREEN), only a single-page demo with a "preview" banner (YELLOW), or whether OD must be refused (RED). It's the single hard halt before burning LLM/compute on a low-signal client. Spec: docs/v3/SOP-DATA-CHECKPOINT.md (canonical · Matthew signed 2026-05-19).
---

# ProfitsLocal · Data Checkpoint

OD-readiness gate. Reads a client's handoff facts + customer-brief + entity data, returns one of GREEN / YELLOW / RED verdicts. Halts the pipeline before compose if the data is too thin.

## When to use

- Right after `profitslocal-build-research-pack` produces `clients/<slug>/v2/handoff/`
- Before `pl:assemble-handoff` / `pl:compose-site` / `pl:build-od-seed`
- Re-run any time upstream data changes (new enrichment, customer fixed a field, new sources crawled)
- Discord drop: `<slug> 还能上 OD 吗？`

Do **not** use this skill for: scoring rendered website quality (that's `profitslocal-quality-audit` after compose), generating outreach emails, or single-lead manual triage.

## Owner SOP

**`docs/v3/SOP-DATA-CHECKPOINT.md`** (canonical · v3 · Matthew signed 2026-05-19). Field thresholds, page-count recommendations, YELLOW banner rules, and the verdict decision table all live there — this SKILL.md wraps the CLI, never restates the spec.

## Inputs

| File | Required | Notes |
|------|----------|-------|
| `clients/<slug>/v2/core-extract.json` | yes | Hard + rich facts extracted from upstream pipeline |
| `clients/<slug>/v2/customer-brief.md` | yes | Must be ≥ 3000 words / 18 sections |
| `clients/<slug>/v2/handoff/od-package/facts.json` | yes | Composer's snapshot of locked facts |
| `data/leads/entities/<entityKey>.json` | inferred | Resolved via master.md frontmatter `business_id` |

## Canonical command

```bash
npm run pl:data-checkpoint -- --slug <slug>
```

Exit codes:
- `0` → GREEN or YELLOW (safe to proceed downstream)
- `1` → RED (must fix upstream data before continuing)

Override flag:
- `--force-pages multi` → Matthew-only override; bypasses YELLOW → single-page recommendation. Records the override + reason in `checkpoint.json`.

## Workflow

```text
1. RESOLVE   · slug → entity (via master.md frontmatter business_id)
2. SCAN HARD · 5 hard fields per SOP §1.1 (business_name, phone, address, customer-brief.md ≥ 3000 words, sources_consumed)
3. SCAN RICH · 6 rich fields per SOP §1.2 (abn, service_list ≥ 5, testimonials ≥ 3, suburbs_served ≥ 10, owner_name, experience_claim)
4. VERDICT   · per SOP §1.3 decision table:
                 RED  = ANY hard field missing
                 YELLOW = ALL hard ✓ AND ANY rich needs AI fallback
                 GREEN = ALL hard ✓ AND ALL rich verified
5. EMIT      · clients/<slug>/v2/checkpoint.json (schema below)
6. (optional) RENDER · clients/<slug>/v2/pipeline.html  Stage 0 visualization
```

## Output contract · `clients/<slug>/v2/checkpoint.json`

Schema authoritative source: [SOP-DATA-CHECKPOINT §3](../../docs/v3/SOP-DATA-CHECKPOINT.md#3-checkpointjson-输出-schema).

Key fields any consumer must read:

| Field | Type | Meaning |
|-------|------|---------|
| `verdict` | `"GREEN"` \| `"YELLOW"` \| `"RED"` | Hard gate result |
| `recommended_pages` | `"multi"` \| `"single"` \| `null` | Downstream page-count target (multi=10pp · single=1 long pp · null=refuse) |
| `hard_fields[*].ok` | bool | Per-field PASS/FAIL · all 5 must be true for non-RED |
| `rich_fields[*].provenance` | `"verified"` \| `"ai-completed"` \| `"ai-inferred"` \| `"ai-fabricated"` \| `"radius-inferred"` | Drives YELLOW banner labelling |
| `missing` | string[] | Field names that triggered RED (empty for GREEN/YELLOW) |
| `inferred` | string[] | Field names with AI fallback (drives YELLOW banner content) |
| `fix_commands` | `{field, fix}[]` | Suggested upstream re-runs to upgrade RED→YELLOW or YELLOW→GREEN |

## Downstream consumers (who reads `checkpoint.json`)

| Skill / CLI | Behaviour on verdict |
|-------------|---------------------|
| `pl:assemble-handoff` | RED → exit 1 with run-first hint (`--skip-checkpoint` bypass for legacy) |
| `pl:build-od-seed` | RED → exit 1 (per SOP §5) |
| `pl:llm-site-architect` | Reads `recommended_pages` to decide page count |
| `pl:publish-demo` | YELLOW → enforces preview banner + `cf-pages-deploy.json.preview_mode=true` (SOP §4) |

## Failure & degrade

| Failure | Fallback |
|---------|----------|
| `core-extract.json` missing | exit 1 · run `pl:llm-extract-core --slug <slug>` first |
| `customer-brief.md` < 3000 words | RED verdict with `customer_brief_words` failure logged |
| Entity not found (slug → business_id mismatch) | exit 1 · check master.md frontmatter |
| GBP / ABN / WHOIS upstream offline | Field marked missing in `hard_fields[*]` · verdict reflects what's reachable · does not silently pass |

## YELLOW → publish constraints

Per [SOP-DATA-CHECKPOINT §4](../../docs/v3/SOP-DATA-CHECKPOINT.md#4-yellow-上线规则), a YELLOW client may be published only with:
1. Preview-banner module at top of every page
2. Footer "Preview build · `<timestamp>`" line
3. `cf-pages-deploy.json` with `preview_mode: true` + `inferred_fields: [...]`
4. Discord notification listing inferred fields

This is enforced downstream by `pl:publish-demo` reading `verdict` + `inferred[]` from `checkpoint.json`.

## Validation

```bash
# Smoke (on a known-GREEN fixture)
npm run pl:data-checkpoint -- --slug vicwest-roofing
# expected: exit 0 · verdict=GREEN · recommended_pages=multi
```

No dedicated unit test yet (the CLI's behaviour is exercised end-to-end via `pl:e2e`).

## Handoff to next skill (2026-05-27 modularization update)

When verdict ∈ {GREEN, YELLOW}, the natural next skill is **`profitslocal-assemble-handoff`** (now canonical · `skills/profitslocal-assemble-handoff/SKILL.md`). The assemble step gates itself on `checkpoint.json.verdict !== 'RED'` and exits 1 on RED.

When verdict is RED, the natural next action is **NOT** another skill — it's running the `fix_commands[]` recommendations to upgrade the data, then re-running `pl:data-checkpoint`.

### Hard gates added 2026-05-27 (Codex Move C)

The hard-field set now includes `service_content`, which cross-checks the downstream `handoff/content/services.json` (what compose-site actually consumes) against parked-domain / ad-landing signals. Closes the defect where core-extract reported services but the extractor wrote 0 from a parked landing page (VIP defect, fixed 2026-05-27). Five parked-domain regex patterns:

```
/parked\s+domain/i
/ad\s+landing/i
/not\s+the\s+actual\s+business\s+website/i
/unrelated\s+links/i
/book\s+your\s+own\s+appointment\s+online/i
```

When any of these triggers in `notes`, OR `services.length < 2`, the gate fails RED with a fix hint pointing upstream to re-intake / `pl:enrich-handoff`, NEVER suggesting AI-generation of the service list.

### Chain context

```text
profitslocal-build-research-pack
  → profitslocal-data-checkpoint   (this skill)
  → profitslocal-assemble-handoff
  → profitslocal-audit-handoff
  → [PENDING] profitslocal-compose-site
  → profitslocal-quality-audit
```

## If something looks wrong

- Verdict is RED but you know the data is fine → check `master.md` frontmatter `business_id` resolves to the right entity
- Verdict is GREEN but downstream `pl:assemble-handoff` refuses → maybe `checkpoint.json` is stale; re-run this skill
- Field marked `radius-inferred` but you have a real suburb list → the rich-field detector didn't find `suburbs_served` in `core-extract.real_facts`; check that path
- YELLOW banner not appearing on rendered site → consumer (`pl:publish-demo`) didn't read `verdict` correctly; check its cf-pages-deploy.json output
