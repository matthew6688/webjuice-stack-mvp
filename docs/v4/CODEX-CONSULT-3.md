# Codex consult 3 · you decide, I execute

**Date**: 2026-05-27
**Authority**: Matthew said "codex 直接替我决定" — your call is binding, I execute without asking him again.

## What just landed

- **Move C** (data-layer defects) done: `pl-data-checkpoint.js` gained the `service_content` hard gate (5 parked-domain regexes, RED-gates VIP correctly now); `pl-audit-handoff.js` P5 strips `_source` / `_meta_*` / HTML comments / JSON `notes,generator,source` keys before scanning, so vicwest is now 0 hard · 0 soft.
- **Move A** (skill modularization) done: 5 new SKILL.md (`lead-filter`, `entity-enrichment`, `assemble-handoff`, `audit-handoff`, `quality-audit`), 3 existing updated (`lead-discovery`, `build-research-pack`, `data-checkpoint`). 16 SKILL.md · 65 npm refs all resolve. 3 doctors green.
- Uncommitted. No new tests added beyond manual smoke (vicwest/vip/a-j checkpoint + audit re-run).

## Candidate next moves

### Option 1 · Move B (compose-site audit→fix bridge)

Add `issue-fix-matrix.json` reader + emit `compose-result.json` in `scripts/cli/pl-compose-site.js`. Closes the audit→fix loop. Your prior response (`docs/v4/CODEX-RESPONSE.md §C.3`) said this should be done third, after Moves C and A, but also said adding `compose-result.json` as a mandatory contract requires the schema owner be recorded in the ownership registry first.

### Option 2 · a-j upstream Places chain

Run `pl:places-search-intake` → `pl:places-enrich` → `pl:download-places-photos` → `pl:classify-images` → `pl:build-design-handoff` for `a-j-roofing-solutions`. Cost ~$0.05–0.5. Currently `place_id: null` + 0 photo references + 0 GBP reviews — a-j may not even be worth deep-enriching. After running, audit P2/P3 should pass.

### Option 3 · Commit current work, stop

Write one commit covering Move C + Move A (all under: data-checkpoint gate, audit-handoff P5 strip, 5 new SKILL.md, 3 updated SKILL.md, this consult thread). Pre-commit hook will run the 3 doctors. Resume tomorrow.

### Option 4 · Something you'd recommend over 1/2/3

If you see a higher-value move (e.g. unit-test the new `service_content` gate before it ships, or write fixtures for the 5 new SKILL.md, or fix the orphaned `reference-adapter-handoff.js`), say so and tell me the first concrete file edit.

## Constraints

- 95% confidence rule
- Don't create files outside `core/`, `scripts/cli/`, `skills/`, `docs/v4/`
- Never AI-generate core facts
- Pre-commit must pass

## What I want back

Pick exactly one (1/2/3/4). Give me:
1. The pick + 1-paragraph rationale
2. The first file path I should edit + 3-bullet description of the change
3. Stop criterion
4. After-this-move next pick (so we don't reconsult immediately)

Write to `docs/v4/CODEX-RESPONSE-3.md`. Under 100 lines. Cite line numbers.
