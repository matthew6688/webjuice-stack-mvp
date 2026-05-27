---
name: profitslocal-lead-discovery
description: Use when you need to batch-find local-business leads that match ProfitsLocal's product fit — type A (no website at all) or type B (existing website with redesign-grade problems). Drives the full pipeline from Google Places search → entity enrichment → audit gate → A/B/C/D grading → masterMD generation → discovery report. Stops at handoff; does not build the website.
---

# ProfitsLocal · Lead Discovery

Batch-find qualified local-business leads and emit a canonical handoff for downstream research/build.

## When to use

- "Find 20 roofers in Brisbane that need a website"
- "Batch search for `<niche>` in `<city>`"
- "Grade these Maps results and tell me which are A / B / C"
- Discord drop: `搜 50 个 plumbers in Melbourne 跑一遍`
- Single-lead finalize after `image-lead-discovery` has produced raw evidence

Do **not** use this skill for: building the demo site, generating outreach emails (that's `outreach-brief` → `pl:email-draft`), or single-lead manual triage (use `lead-ops` for those).

## Inputs

| Field | Required | Notes |
|-------|----------|-------|
| `query` | yes | One or more Google Maps text-search queries (`"roofer in brisbane"`). Repeat `--query` for multi-query batches. |
| `niche` | inferred | Parsed from query if absent (`roofer`, `plumber`, `dentist`, …). |
| `city` | inferred | Parsed from query if absent. |
| `limit` | optional | Default 20 per query. |
| `minQualification` | optional | `A` / `B` / `C`. Default `B` (= skip D + most C). |
| `budgetMode` | optional | `places-only` (cheap) · `places+enrich` (default) · `full` (adds Wayback / WHOIS / ABN). |

## Workflow

```text
1. INTAKE   · Google Places textsearch → upsert entities (one batch thread per query)
2. ENRICH   · per-entity: places-details + ABN + WHOIS + Wayback + visual audit (gated by budgetMode)
3. QUALIFY  · A/B/C/D using rule engine (has-website? · audit-score? · grade-router rules)
4. MASTER   · per-qualified entity: generate master.md (frontmatter + sales SOT + evidence)
5. HANDOFF  · emit `data/leads/handoffs/<entityKey>.lead-to-research.json` for downstream skill
6. REPORT   · write batch summary to `data/leads/reports/<run>.json` + post to discovery thread
```

## Lead types decided here

| Code | Meaning | Rule |
|------|---------|------|
| **A** | No website at all OR website unreachable | `website` empty/404/parked → grade A; auto-demo |
| **B** | Has website but redesign-grade problems | audit composite ≤ 60 AND ≥ 2 high-severity findings → grade B; auto-demo |
| **C** | Has decent website; warm outreach only | audit 61–79 → grade C; cold-outreach queue (no demo) |
| **D** | Out of scope (audit ≥ 80 OR not contactable) | archive |

## Main commands

```bash
# 1. Search + intake (cost: ~$0.017/lead via Google Places API)
npm run pl:places-search-intake -- --query "roofer in brisbane" --limit 20 --with-details

# 2. Enrich + audit + grade (single-pass batch)
npm run pl:run-enrichment-batch -- --skip-approval

# 3. Per-entity finalize (regen master.md + handoff)
npm run pl:enrich-entity -- --entity-key <key> --render

# 4. Score + select from a batch into a search run
npm run leads:search-runner -- \
  --query "roofer in brisbane" \
  --niche roofer --city Brisbane \
  --min-qualification B

# 5. Batch summary report (must be run after enrichment batch)
npm run leads:discovery-report -- --niche roofer --city Brisbane

# 6. Single-lead pipeline (post image-lead-discovery handoff)
npm run leads:lead-ops -- --client <slug>
```

## Outputs (canonical paths)

```text
# Entity store (1 file per business, source of truth)
data/leads/entities/<entityKey>.json
  · identifiers · latest (places snapshot) · enrichment · audit
  · grade · phase · recommendedAction

# Batch run record
data/lead-runs/<niche>/<city>/<runId>.json
  · totals · selected[] · skipped[] · collectionQueue[]

# Per-client masterMD (sales SOT)
clients/<slug>/v2/master.md
  · frontmatter: business_id, name, niche, city, rating, website, audit_score, decision, assets
  · body: grading, evidence, audit detail, next action, GEO readiness

# Canonical handoff for downstream Skill B
data/leads/handoffs/<entityKey>.lead-to-research.json
  · see docs/contracts/lead-to-research.md

# Batch summary
data/leads/reports/<runId>.json
  · totals by grade · selected for handoff · skipped reasons
```

## Decision rules (machine-readable)

Source of truth: `core/leads/qualification.js` + `core/leads/grade-router.js`.

- A leads → auto-spawn `demo_build` task + open Discord thread
- B leads → same as A
- C leads → enqueue `data/leads/cold-outreach-queue.json` (idempotent by entityKey)
- D leads → archive · no further work

Override flags:
- `--force-grade <A|B|C|D>` for manual reclassification (records `reason` in entity)
- `--skip-archive` to keep D leads visible for human review

## Failure & degrade

| Failure | Fallback |
|---------|----------|
| Google Places quota exceeded | `npm run leads:maps-scrape` (Playwright fallback) or manual CSV via `--input` |
| Audit (visual / copy) fails | Mark entity `audit_status: needs_human` · still grade by available signals · masterMD emits skeleton |
| ABN/WHOIS lookup fails | Skip silently · log to `entity.enrichment._meta.trace` · do not block grade |
| masterMD render fails | Block handoff for this entity · emit `data/leads/errors/<key>.json` · continue batch |

## Evidence policy

Every grade decision must reference at least one piece of evidence:
- Google Place ID + textsearch query
- Audit score with version stamp
- ABN / WHOIS / Wayback timestamp when applicable
- Hard facts (phone / email / address) with `_meta.source`

**Never invent**: license number, ABN, review count, years in business, owner name. If unverified → omit from masterMD or mark `pending verification`.

## Validation

```bash
# Smoke (synthetic fixture, no live API)
npm run leads:test-lead-ops
npm run leads:test-lead-ops-low-info
npm run leads:test-lead-ops-scenarios

# Live (consumes Places quota — only when iterating on real run)
npm run pl:preflight  # checks API keys + quota + git state
npm run pl:places-search-intake -- --query "test query" --limit 3 --dry-run
```

## Handoff to next skill (2026-05-27 modularization update)

When grade ∈ {A, B} and masterMD rendered, this skill writes:

```text
data/leads/handoffs/<entityKey>.lead-to-research.json
```

Schema: see `docs/contracts/lead-to-research.md` v1.

The natural downstream chain:

```text
profitslocal-lead-discovery  (this skill · finds + initial grade)
  → profitslocal-lead-filter       (cheap gate · exclusion + A/B/C/D · NO paid calls)
  → profitslocal-entity-enrichment (Places / ABN / GBP photos / Tinyfish · paid)
  → profitslocal-build-research-pack (assemble brief + content + design)
  → profitslocal-data-checkpoint   (GREEN/YELLOW/RED OD-readiness gate)
  → profitslocal-assemble-handoff  (produces od-package/)
  → profitslocal-audit-handoff     (P1-P7 pre-build gate)
  → [PENDING] profitslocal-compose-site
  → profitslocal-quality-audit     (4-tier ship gate)
```

The grading this skill does is the **first** pass — `profitslocal-lead-filter` re-grades after cheap-audit + niche-relevance + exclusion-filter run, and is the gate before paid enrichment.

## If something looks wrong

- Lead has website but graded A → check `pl-places-search-intake` website-field extraction; verify Place ID
- Lead graded D but should be B → audit may have failed silently; rerun `pl:enrich-entity --entity-key <key>`
- masterMD has hard claims ("ranking won't drop") → those are template defaults; fix in `core/reports/master-md-builder.js`
- Handoff file missing → check `data/leads/errors/<key>.json` for render failure
