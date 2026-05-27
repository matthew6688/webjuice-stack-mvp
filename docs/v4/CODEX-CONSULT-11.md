# Codex consult 11 · skill #3 deep validation · entity-enrichment

**Date**: 2026-05-27
**Status**: Skills #1 + #2 deep-validated (commits `4636f6a6`, `19e574a2` · 27 tests total · pre-commit clean).

## Adapter from RESPONSE-9 §E

Skill #3 is **the first paid-call layer**. The adapters change:
- **paid_call_gate** (replaces spend_boundary): assert that `--dry-run` paths never hit Places API / ABN / Tinyfish / Cloudinary; assert cost-ledger semantics (every paid call appends one line); assert quota-guard rotation works.
- **provenance_minimum** becomes **strict `_source` sibling enforcement** on every paid-write field.

## What I want from you

Same 4-section format as RESPONSE-9/10:

### A · Protocol (5 deep checks)

Skill #3 surface area is larger than #1/#2. Candidates:
- Paid-call gate (dry-run + missing-key + quota-exceeded)
- `_source` sibling on every paid-write field (places_enrichment, abn, whois, wayback, tinyfish_search)
- Quota-guard rotation (multi-key fallover via `places-quota-guard.js`)
- Idempotency (re-run same entity → no double-spend, no duplicate ledger lines)
- Ledger format integrity (each line is valid JSON · contains entity_key, provider, cost_usd, response_time_ms)
- Degrade behavior (network failures don't corrupt entity)
- SOP alignment (entity-enrichment SKILL.md vs SOP-1 + SOP-X-Tooling cost ladder)

Pick the **5 highest leverage**.

### B · Run now vs defer

Skill #3 invokes real APIs in non-dry-run mode. **Do NOT spend on a-j Places chain in this pass** (per AJ-DECISION.md). Use synthetic entities + dry-run + static checks for everything. If a critical check truly requires a live paid call, mark `blocked_paid_authorization` and defer.

### C · First concrete edit

Likely `scripts/test/test-skill03-entity-enrichment-deep.mjs` plus the existing `pl-enrich-entity --dry-run` gap (RESPONSE-9 found it doesn't exist · should we add it now to make this pass cleaner?).

### D · Stop criterion + adapter notes for skill #4

## Files involved

- `skills/profitslocal-entity-enrichment/SKILL.md` (already has the dry-run note from skill #1 audit)
- `scripts/cli/pl-enrich-entity.js` (no `--dry-run`)
- `scripts/cli/pl-places-enrich.js` (has `--dry-run`)
- `scripts/cli/pl-download-places-photos.js`
- `core/enrichment/index.js` (orchestrator)
- `core/enrichment/abn-lookup.js` / `whois-rdap.js` / `wayback.js`
- `core/extractors/google-places.js` / `places-quota-guard.js`
- `data/finance/ledger.jsonl` (read-only inspection in test)

## Constraints

- 95% confidence rule
- NO actual paid API calls in this pass
- Files under allowed paths
- Pre-commit must stay clean

Write to `docs/v4/CODEX-RESPONSE-11.md`. Under 130 lines.
