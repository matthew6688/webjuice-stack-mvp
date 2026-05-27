# Codex Response 9 · Skill #1 Deep Validation Protocol

**Date**: 2026-05-27  
**Pick**: Run a narrow deep pass on `profitslocal-lead-discovery`: spend safety, intake edges, entity idempotency, SOP boundary, and one regression test.

## A · Protocol

The lightweight audit proved the skill doc shape and one dry-run command. The deep pass should add **five** checks only:

1. **Spend boundary**
   - Run dry-run with one and multiple queries.
   - Assert no Google extractor, Discord thread, entity write, queue write, or finance ledger mutation happens.
   - Verify failure without API key happens before writes and exits with a useful error.
   - Reason: this is the highest-risk operator mistake; it protects quota and data.

2. **Input edge coverage**
   - Empty query must fail cleanly.
   - Repeated `--query` and bare positional query must both be accepted.
   - Multi-word AU city must normalize consistently (`gold coast`, `toowoomba`, `brisbane`).
   - One outside-AU query may be recorded as supported or unsupported, but behavior must be explicit.
   - Reason: skill #1 is the pipeline entry point; bad parsing poisons every downstream skill.

3. **Entity identity + idempotent writes**
   - Use temp `storeRoot`; do not touch real `data/leads`.
   - Upsert the same run twice with the same `place_id`; expect one entity file and one `entity.runs` entry.
   - Upsert two businesses sharing a directory-domain website; expect distinct entity keys via `place_id` / `data_id`, not domain collision.
   - Re-run with richer contact data; expect merge, not overwrite-to-null.
   - Reason: duplicate/colliding entities are expensive downstream and hard to repair later.

4. **Source/provenance minimum**
   - For intake fields written by `pl-places-search-intake`, require machine-readable origin at least at entity level: `latest.sourceType`, `latest.sourceQuery`, `latest.discovery_rank`, `latest.google_places_provider`, and identifiers.
   - Do **not** require `_source` sibling on every Stage-0 intake field yet; that belongs to enrichment/handoff facts and would be a contract expansion.
   - Flag the existing SKILL wording that says hard facts use `_meta.source`; current project state prefers `_source` sibling for paid/enriched fields.
   - Reason: enforce traceability without inventing a new Stage-0 schema.

5. **SOP boundary alignment**
   - Compare `skills/profitslocal-lead-discovery/SKILL.md` with `docs/SOP_1_INTAKE_DISCOVERY.md` and SOP-2 entrance expectations.
   - Skill #1 may claim intake/search/upsert/queueing and first-pass routing.
   - It must not claim ownership of paid enrichment, full audit, final A/B/C/D, masterMD, or handoff if those are now delegated to skills #2-#7.
   - Reason: Response 5 made this skill upstream-first; deep validation must prevent stale monolith wording.

Skip performance timing for this pass. It is lower leverage until a real paid batch is authorized.

## B · Run Now vs Defer

Run now:

1. Dry-run spend boundary:
   `npm run pl:places-search-intake -- --query "roofer in brisbane" --query "plumber in gold coast" --limit 2 --dry-run`
2. Empty-query failure:
   `npm run pl:places-search-intake -- --limit 1 --dry-run`
3. API-key failure without writes, if the local environment allows key masking safely:
   run with `GOOGLE_PLACES_API_KEY=` and a temp store guard; otherwise record `blocked_env_key_masking`.
4. Static/source check of `scripts/cli/pl-places-search-intake.js` for dry-run returning before extractor/thread/store construction.
5. New temp-store regression for `core/leads/discovery-store.js` identity and idempotency.
6. SOP/skill wording check, with doc fix if the skill still describes downstream ownership as part of skill #1.

Defer to later skills:

- Full `_source` sibling enforcement: skill #3 and handoff skills own paid/enriched facts.
- Cost ledger append semantics for paid calls: skill #3 owns enrichment spend; skill #1 only proves dry-run no-spend and estimated `costPolicy`.
- Visual audit, grade-router correctness, masterMD content, and handoff schema: skills #2, #4, #6, and #7 own those checks.
- Performance per lead: only meaningful after Matthew authorizes a paid live Places batch.

## C · First Concrete Edit

First edit: `scripts/test/test-skill01-lead-discovery-deep.mjs`

Expected assertions:

- `upsertDiscoveryRun()` against a temp `storeRoot` writes one entity for duplicate `place_id`.
- `entity.runs` remains idempotent for the same `{runId, query}`.
- richer second write fills missing phone/website without nulling existing fields.
- directory domains do not become entity-key roots when better IDs exist.
- the resulting entity has intake provenance minimum: source type, source query, rank, provider, identifiers.

If that test fails because the store appends duplicate `history` or event rows, do not over-fix unless it changes behavior. The binding invariant is entity identity and run references, not an append-only audit log.

Likely second edit: `skills/profitslocal-lead-discovery/SKILL.md`

Narrow it so skill #1 is documented as intake/discovery plus first-pass queueing, while downstream paid enrichment/filter/handoff remain separate skills.

## D · Stop Criterion

Skill #1 deep-validation is done when:

1. `docs/v4/skill-audits/01-profitslocal-lead-discovery-DEEP.md` exists.
2. It records the five protocol checks with command/output evidence.
3. The new regression test exists and passes directly.
4. Any skill-doc mismatch found in the SOP boundary check is fixed or explicitly recorded as `blocked_reconsult`.
5. `npm run ops:skill-cli-validate` passes.
6. Pre-commit remains clean.
7. No real `clients/` contracts are created and no AI-generated core facts are introduced.

## E · Hand-Off Contract

`01-profitslocal-lead-discovery-DEEP.md` should be a reusable template with per-skill adapters, not a bespoke essay.

Required sections:

```yaml
skill: profitslocal-lead-discovery
status: PASS | PASS_WITH_EXPECTED_EXTERNAL_BLOCKER | FAIL
scope_owner: intake_discovery
commands_run: []
fixtures: []
spend_boundary: pass | fail | blocked
edge_cases: []
write_integrity: pass | fail | not_applicable
provenance_minimum: pass | fail | deferred_to_skill_3
sop_alignment: pass | fail
regression_tests_added: []
fixes_applied: []
remaining_risk: []
next_skill_adapter_notes: []
```

For skills 2-8, keep the same headings but replace the adapters: spend boundary becomes "paid-call gate" for skill #3, write integrity becomes handoff/package integrity for skills #4-#7, and provenance minimum becomes strict `_source` sibling enforcement once enriched/customer-facing facts are written.
