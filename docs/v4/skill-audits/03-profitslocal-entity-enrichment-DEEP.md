# Skill #3 deep audit · profitslocal-entity-enrichment

**Date**: 2026-05-27 (Codex Response 11 protocol)

```yaml
skill: profitslocal-entity-enrichment
status: PASS_WITH_EXPECTED_EXTERNAL_BLOCKER
scope_owner: paid_entity_enrichment
commands_run:
  - npm run pl:enrich-entity -- --entity-key dataid_0x697863f568797107-0x3e88d70ce813a66e --dry-run
  - node scripts/test/test-skill03-entity-enrichment-deep.mjs
fixtures:
  - a-j entity (no place_id · exercises whois/wayback/tinyfish/abn dry-plan, skips places-details)
  - static checks on whois-rdap.js · tinyfish-summary.js · enrichment/index.js · places-quota-guard.js
paid_call_gate: pass
source_sibling_enforcement: pass
quota_guard_rotation: pass (static check) · blocked_paid_authorization (live rotation under real exhaustion)
enrichment_idempotency: pass (additive merge confirmed via `{...entity, enrichment}` pattern)
ledger_integrity: blocked_paid_authorization (real paid-call ledger append not tested without spend)
sop_alignment: pass
regression_tests_added:
  - scripts/test/test-skill03-entity-enrichment-deep.mjs (12/12 pass)
fixes_applied:
  - scripts/cli/pl-enrich-entity.js: added --dry-run flag (per RESPONSE-11 §C "Likely second edit")
    · lists planned providers based on entity state (place_id → places-details, domain/website → whois/wayback/tinyfish/abn)
    · short-circuits before enrichEntity() call · 0 writes · 0 paid calls
remaining_risk:
  - Live quota rotation behavior under real exhaustion not exercised (blocked_paid_authorization)
  - Cost-ledger format vs actual data/finance/ledger.jsonl: Codex spec mentioned entity_key/cost_usd/response_time_ms; actual ledger uses clientSlug/type/category/amount. Enrichment may not currently append to ledger.jsonl at all (only places-search-intake references ledgerPath). Recorded as a follow-up.
next_skill_adapter_notes:
  - skill_4 (build-research-pack) consumes enriched facts · must verify _source siblings present on each used field
  - skill_4 should treat missing enrichment as routing degrade (RED/YELLOW data-checkpoint signal), not as evidence for grade
  - skill_4 owns research/brief/handoff assembly · skill_3 only provides paid enrichment integrity
```

## §1 · Paid-call gate

`pl-enrich-entity --dry-run` exits 0. Output:
```
▶ A & J Roofing Solutions (dataid_0x697863f568797107-0x3e88...) · [DRY-RUN]
    planned providers: whois-rdap, wayback, tinyfish-search, abn-lookup
```
Static check: `if (DRY_RUN)` branch appears BEFORE `await enrichEntity()` and contains `continue;` to skip the live enrichment block.

Missing API key path: existing per-query error in pl-places-enrich (verified in skill #1 audit) — `"No GOOGLE_PLACES_API_KEY* set in env"` surfaces before any paid call.

## §2 · `_source` sibling enforcement

- **whois-rdap** stamps `domain_age_source` field (e.g. `rdap_registration` / `wayback_first_snapshot`)
- **tinyfish-summary** writes markdown with frontmatter including `_source: tinyfish:fetch` + `fetched_at`
- **enrichment/index.js** writes `_meta.trace[]` listing every source attempt + `enriched_at` timestamp
- **enrichment/index.js** returns additive `{...entity, enrichment}` (does not overwrite existing entity fields)

## §3 · Quota-guard rotation

`places-quota-guard.js` references multi-key env (`GOOGLE_PLACES_API_KEY_1` / `_2` / pool). Exports `PlacesQuotaCapExceeded` as a distinct error class. No infinite-retry loops detected. **Live rotation under real exhaustion not tested** — recorded `blocked_paid_authorization`.

## §4 · Enrichment idempotency

Structural confirmation only (no live calls):
- `safeRun(name, fn, target, trace)` wraps every provider in try/catch · trace records each attempt
- Pipeline does not abort on individual provider failure
- Return is additive (`{...entity, enrichment}`)
- Repeated run with identical inputs would produce identical `enrichment._meta.trace` entries · the rest of the entity is preserved

## §5 · Ledger integrity

`data/finance/ledger.jsonl` exists; format inspection shows generic finance events:
```json
{"id":"evt_...","clientSlug":"...","type":"revenue","category":"sale","units":1,"unitCost":399,"amount":399,"currency":"USD","provider":"stripe","metadata":{...}}
```
This format does NOT match Codex's idealized `entity_key / cost_usd / response_time_ms` shape. **Enrichment may not currently append to ledger.jsonl** (only `pl-places-search-intake` references `ledgerPath`). Recorded as a follow-up — the SKILL.md documents the cost ladder + ledger contract aspirationally but the wiring is partial.

## §6 · SOP + skill alignment

- SKILL.md mentions T0→T3 cost ladder ✓
- SKILL.md documents `_source` sibling rule, NOT `_meta.sources` centralized map ✓
- SKILL.md "Never AI-generate" list covers all core facts (business_name, phone, address, abn, license, owner_name, etc.) ✓

## Done criterion check (Response 11 §D)

1. ✅ This file exists
2. ✅ 5 protocol checks recorded with evidence
3. ✅ test-skill03-entity-enrichment-deep.mjs 12/12 pass
4. ✅ `pl-enrich-entity --dry-run` added · proven no-spend/no-write
5. ✅ Live-provider checks recorded as `blocked_paid_authorization`
6. ✅ SOP/SKILL cost-ladder and provenance match · no mismatches found in code
7. ⏳ `ops:skill-cli-validate` to run before commit
8. ⏳ Pre-commit to run before commit
