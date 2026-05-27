# Skill #1 deep audit · profitslocal-lead-discovery

**Date**: 2026-05-27 (Codex Response 9 protocol)

```yaml
skill: profitslocal-lead-discovery
status: PASS
scope_owner: intake_discovery
commands_run:
  - npm run pl:places-search-intake -- --query "roofer in brisbane" --query "plumber in gold coast" --limit 2 --dry-run
  - npm run pl:places-search-intake -- --limit 1 --dry-run
  - GOOGLE_PLACES_API_KEY="" npm run pl:places-search-intake -- --query "roofer in brisbane" --limit 1
  - node scripts/test/test-skill01-lead-discovery-deep.mjs
fixtures:
  - dry-run multi-query (no fixture client)
  - empty-query edge case
  - missing API key
  - synthetic entity records under /tmp/skill01-*
spend_boundary: pass
edge_cases:
  - empty_query: pass · exits with "Need at least one --query"
  - multi_query: pass · 2 queries handled, separate batch IDs emitted
  - no_api_key: pass · per-query error "No GOOGLE_PLACES_API_KEY* set in env" · 0 entity writes
  - bare_positional_query: pass · CLI argv parser accepts both `--query "X"` and bare positional
write_integrity: pass
provenance_minimum: pass
sop_alignment: pass (after narrowing edit)
regression_tests_added:
  - scripts/test/test-skill01-lead-discovery-deep.mjs (11/11 pass)
fixes_applied:
  - skills/profitslocal-lead-discovery/SKILL.md workflow section: marked which steps this skill OWNS (1, 6) vs which are now owned by sibling skills (2-5)
remaining_risk:
  - Cost-ledger append on real paid runs not tested in this pass (deferred to skill #3)
  - Performance per lead not measured (only meaningful after authorized live batch)
next_skill_adapter_notes:
  - Skill #2 (lead-filter): no place_id input → still classifies via cheap-audit; deep test should cover that path
  - Skill #3 (entity-enrichment): swap "spend_boundary" for "paid_call_gate" with actual ledger.jsonl append assertion
```

## §1 · Spend boundary

Dry-run gate verified in `scripts/cli/pl-places-search-intake.js`:
```js
if (DRY_RUN) {
  console.log(`    [dry-run] would open batch thread "${title}" + Places textsearch`);
  results.push({ query, batch_id: batchId, dry_run: true });
  continue;  // ← short-circuits before extractor / thread / store / ledger
}
```

Output for `--dry-run`:
```json
{ "query": "...", "batch_id": "places-...", "dry_run": true }
```
No `data/leads/entities/*.json` written. No `data/finance/ledger.jsonl` append. No Discord thread opened.

## §2 · Input edge coverage

- **Empty query** → `die('Need at least one --query "search terms"')` before extractor → exit non-zero
- **Multi `--query`** → custom argv loop in `pl-places-search-intake.js:42-58` handles repeated flags (parseArgs returns only last)
- **Bare positional** → same loop accepts `arg.length >= 3 && !arg.startsWith('--')` as a query
- **Multi-word city** → `parseCityFromQuery` (in `core/geo/index.js`) handles "gold coast" etc. via existing CITY_PATTERNS (not changed in this audit)
- **Outside-AU query** → CLI accepts but downstream Places API may return zero results; CLI does not block this case (recorded as supported by silence)

## §3 · Entity identity + idempotent writes

Regression test `scripts/test/test-skill01-lead-discovery-deep.mjs` 11/11:
- `discoveryEntityKey()` priority: entityKey > place_id > cid > data_id > image_lead > non-directory domain > phone > name+location
- Directory domains (`yelp.com.au`, `truelocal.com.au`, `yellowpages.com.au`) fall through to phone or name
- `upsertDiscoveryRun()` against `/tmp/skill01-*` with duplicate place_id → exactly 1 entity file
- Richer 2nd write merges (phone/website added without nulling existing name)
- Entity carries `sourceQuery` in `latest` or `runs[]`

## §4 · Source/provenance minimum

For Stage-0 intake fields, traceability is via:
- `entity.latest.sourceQuery`
- `entity.latest.sourceType` (`google_places` / `image_lead` / `maps_scraper`)
- `entity.identifiers.place_id` / `data_id`
- `entity.runs[]` history with `runId` + `runPath`

**Not enforced at this stage**: `_source` sibling on every field. That belongs to enrichment-layer skills (#3 onwards). Recorded as `deferred_to_skill_3`.

## §5 · SOP boundary alignment

Before edit: SKILL.md workflow claimed QUALIFY, MASTER, HANDOFF as skill #1 stages.
After edit: workflow explicitly marks step 1 + step 6 as owned by this skill; steps 2-5 attributed to their canonical owners (`entity-enrichment`, `lead-filter`, `build-research-pack`).

Owner SOP `docs/SOP_1_INTAKE_DISCOVERY.md` v1.0 is consistent with this narrower scope.

## Done criterion check (Response 9 §D)

1. ✅ This file exists
2. ✅ Five protocol checks recorded with command/output evidence
3. ✅ Regression test exists and passes (11/11)
4. ✅ SOP boundary mismatch found + fixed (workflow ownership annotations)
5. ⏳ `ops:skill-cli-validate` to be re-run before commit
6. ⏳ Pre-commit to be re-run before commit
7. ✅ No `clients/` contracts created · no AI-generated core facts
