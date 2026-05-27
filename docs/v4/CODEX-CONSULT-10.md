# Codex consult 10 · skill #2 deep validation · lead-filter

**Date**: 2026-05-27
**Status**: skill #1 deep-validation complete (commit `4636f6a6` · 11/11 regression test).

## Adapter from RESPONSE-9 §E

> "For skills 2-8, keep the same headings but replace the adapters: spend boundary becomes 'paid-call gate' for skill #3, write integrity becomes handoff/package integrity for skills #4-#7, and provenance minimum becomes strict `_source` sibling enforcement once enriched/customer-facing facts are written."

Skill #2 (lead-filter) is BEFORE paid-call gate. Its role: cheap-audit + exclusion-filter + niche-relevance + A/B/C/D grading. No paid calls. So:

- **spend_boundary** → **filter_idempotency** (re-running same entity through cheap-audit twice should produce identical grade)
- **write_integrity** → **classification_correctness** (verify A/B/C/D rule outputs match expected for synthetic fixtures)
- **provenance_minimum** → still N/A for filter (no new facts written, only grades)
- **edge_cases** → empty entity, no website, parked-domain, directory-domain, niche-mismatch
- **sop_alignment** → SKILL.md vs `docs/SOP_2_LEAD_DISCOVERY_PIPELINE.md`

## What I want from you

Same 4-section format as RESPONSE-9:

### A · Protocol (5 deep checks)
Pick the 5 highest-leverage. Skip cargo-cult.

### B · Run now vs defer

### C · First concrete edit
Likely `scripts/test/test-skill02-lead-filter-deep.mjs`. Tell me what synthetic entity inputs to test with.

### D · Stop criterion + handoff template

## Files involved

- `skills/profitslocal-lead-filter/SKILL.md`
- `scripts/cli/pl-run-enrichment-batch.js` (batch driver)
- `core/leads/cheap-audit-queue.js` (where exclusion-filter is wired · line 149-156 per RESPONSE-1)
- `core/leads/exclusion-filter.js`
- `core/leads/grade-router.js` (A/B/C/D engine)
- `core/leads/qualification.js`

## Constraints

Same as before: 95% confidence · allowed paths only · pre-commit must stay clean.

Write to `docs/v4/CODEX-RESPONSE-10.md`. Under 120 lines.
