# a-j-roofing-solutions · YELLOW fixture decision

**Date**: 2026-05-27 (Codex Response 5 §A.2)

## Decision

**Defer paid Places chain. Keep a-j as the canonical YELLOW validation fixture.**

## State

- `data/leads/entities/dataid_0x697863f568797107-0x3e88d70ce813a66e.json`:
  - `latest.places_enrichment.place_id`: `null` (never run)
  - `photo_references`: 0
  - `photo_urls`: 0
- `clients/a-j-roofing-solutions/v2/checkpoint.json`: `verdict=YELLOW · recommended_pages=single`
- `clients/a-j-roofing-solutions/v2/handoff/od-package/_handoff-audit.json`: **3 HARD fails**
  - P2 image-manifest · missing `image-manifest.json` (no source photos)
  - P3 brand-pack · missing `brand-spec.json` / `brand-tokens.css` / `agent-handoff.md` / `visual-style-contract.md`
  - P6 facts · ✅ fixed inline today (`(07)40356187` → `(07) 4035 6187`)

## Why defer

1. **Estimated cost to remediate**: `pl:places-search-intake` → `pl:places-enrich` ($0.017) → `pl:download-places-photos` ($0.007 × ≤6) → `pl:classify-images` (vision LLM ~$0.02/image) → `pl:build-design-handoff` (LLM ~$0.1). Total ~$0.05–0.5.
2. **Customer signal**: a-j GBP `review_count = 0`. Conversion-priority is low.
3. **Validation utility**: keeping a-j as YELLOW preserves a real fixture for testing how `profitslocal-assemble-handoff` and `profitslocal-audit-handoff` behave on incomplete-but-non-RED inputs. Re-running upstream Places chain would convert it to GREEN and erase that test surface.

## When to revisit

- If Matthew explicitly approves the LLM spend
- If we run a batch of similar leads and a-j is in the cohort
- If we add a synthetic YELLOW fixture under `data/leads/test-fixtures/` to replace a-j (out of scope for today)

## Behaviour during per-skill validation

- `profitslocal-data-checkpoint` · expected `verdict=YELLOW` · PASS
- `profitslocal-assemble-handoff` · expected behaviour: emit `od-package/` with YELLOW preview-banner stamp · PASS unless docs disagree with code
- `profitslocal-audit-handoff` · expected 3 HARD fails (P2/P3) · PASS_WITH_EXPECTED_EXTERNAL_BLOCKER (the SKILL.md must document this gracefully)
- `profitslocal-quality-audit` · `blocked_missing_build_output` (no build dir to audit)
