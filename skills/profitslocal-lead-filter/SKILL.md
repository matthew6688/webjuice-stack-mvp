---
name: profitslocal-lead-filter
description: Use after `profitslocal-lead-discovery` has produced raw entities and before any expensive enrichment runs. This skill is the gate that decides which entities are worth paying for. Runs cheap-audit (T0/T1 only — no premium LLM), niche-relevance match, and the exclusion-filter, then writes the A/B/C/D opportunity grade to the entity. Excluded leads exit as terminal-archive without burning Places/ABN quota.
---

# ProfitsLocal · Lead Filter

Cheap, deterministic gate between raw discovery and paid enrichment. Decides which entities advance.

## When to use

- Right after `profitslocal-lead-discovery` writes `data/leads/entities/*.json` from a batch
- Before `profitslocal-entity-enrichment` (which spends real money)
- Re-run any time the niche / city / opportunity definition changes
- Discord drop: `这批 50 个 leads 哪些值得 enrich？`

Do **not** use this skill for: scoring a fully enriched entity (that's done inside enrichment), generating outreach (`profitslocal-research-pack` later), or human-eye triage of a single entity (open the JSON directly).

## Owner SOP

`docs/SOP_2_LEAD_DISCOVERY_PIPELINE.md` — A/B/C/D rules, cheap-audit hard-trigger table, niche-relevance regex sets. This SKILL.md wraps the CLIs and never restates the SOP tables.

## Inputs

| File | Required | Notes |
|------|----------|-------|
| `data/leads/entities/<entityKey>.json` | yes | one per entity, written by lead-discovery |
| `core/leads/exclusion-filter.js` config | inferred | invoked by `cheap-audit-queue` (`core/leads/cheap-audit-queue.js:149-156`) |
| niche / city query metadata on entity | yes | for niche-relevance check |

## Canonical command

```bash
npm run pl:run-enrichment-batch -- --skip-approval
```

Internally this drives `cheap-audit-queue.js`, which runs exclusion-filter → cheap-audit → niche-match → A/B/C/D grade in one pass. No premium LLM calls. No Places-API spend for already-rated entities.

Force a single entity:

```bash
npm run pl:enrich-entity -- --entity-key <key> --skip-paid
```

Exit codes:
- `0` → batch finished (per-entity outcomes recorded in entity JSON)
- non-zero → fatal config / IO error (not "lead failed grading")

## Workflow

```text
1. SCAN    · iterate entities missing cheap_audit / predict_grade
2. EXCLUDE · run exclusion-filter (niche-blacklist, country, dead-link patterns)
3. CHEAP   · run T0/T1 cheap-audit (no LLM premium · website fetch + cheap parse)
4. NICHE   · niche-relevance regex check against category + name + description
5. GRADE   · write {cheap_audit, predict_grade, exclusion_filter} to entity.latest
6. EMIT    · excluded/D-grade leads → terminal-archive (no further work)
            · A/B/C → ready for `profitslocal-entity-enrichment`
```

## Output (writes back to the same entity JSON)

```json
{
  "latest": {
    "cheap_audit": {
      "action": "advance | skip",
      "reason": "...",
      "gbp_quality": 0,
      "final_score": 0
    },
    "predict_grade": {
      "predict_grade": "A | B | C | D",
      "audit_now": true,
      "reasons": ["..."],
      "priority": 0
    },
    "exclusion_filter": {
      "excluded": false,
      "layer": null,
      "reason": null
    }
  }
}
```

## A/B/C/D rules (one-line each · full table in SOP-2 §3)

| Grade | Rule |
|---|---|
| **A** | No website OR website 404/parked. Auto-demo eligible. |
| **B** | Has site · audit composite ≤ 60 · ≥ 2 high-severity findings. Auto-demo eligible. |
| **C** | Site composite 61–79. Cold-outreach queue only · no demo. |
| **D** | Composite ≥ 80 OR not contactable. Terminal archive. |

Override: `--force-grade <A|B|C|D>` records `reason` in entity.

## Failure & degrade

| Failure | Fallback |
|---------|----------|
| Website fetch times out | record `cheap_audit.action=advance` with `reason: fetch-timeout · re-check upstream` · still grade by signals |
| Exclusion-filter regex panic | log and skip filter for that entity · do not block grade |
| Niche-relevance ambiguous | default `predict_grade=C` · let human review |

## Downstream consumers

| Skill / CLI | Behaviour |
|---|---|
| `profitslocal-entity-enrichment` | only processes entities with `predict_grade ∈ {A,B,C}` |
| `leads:discovery-report` | uses `predict_grade` for batch summary |
| `pl:outreach-brief` | reads `predict_grade=C` cold-queue |

## Validation

```bash
npm run leads:test-lead-ops
npm run leads:test-lead-ops-low-info
npm run leads:test-lead-ops-scenarios
```

Synthetic-fixture only · no API spend.

## Handoff to next skill

When `predict_grade ∈ {A,B}` and `exclusion_filter.excluded === false`, the next skill is **`profitslocal-entity-enrichment`**, which spends real Places / ABN / Tinyfish budget on this lead.

## If something looks wrong

- Lead graded D but has obvious problems on its site → cheap-audit fetch may have failed silently; check `entity.latest.cheap_audit.reason`
- Lead excluded but should be in scope → check `core/leads/exclusion-filter.js` regex set; add a unit fixture before relaxing
- A/B grades feel inverted → `core/leads/grade-router.js` is the rule engine; do not patch heuristics in the skill
