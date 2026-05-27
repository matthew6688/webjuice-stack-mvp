# Skill Validation Summary · 2026-05-27

Per Codex Response 5 binding plan. All 8 canonical skills validated.

## Verdict

**8/8 PASS** (1 PASS_WITH_EXPECTED_EXTERNAL_BLOCKER for a-j YELLOW fixture · per AJ-DECISION.md)

| # | Skill | Status | Fixes |
|---:|---|---|---|
| 1 | profitslocal-lead-discovery | PASS | — |
| 2 | profitslocal-lead-filter | PASS | — |
| 3 | profitslocal-entity-enrichment | PASS | SKILL.md validation block: `pl:enrich-entity --dry-run` → `pl:places-enrich --dry-run` (`pl:enrich-entity` has no `--dry-run`) |
| 4 | profitslocal-build-research-pack | PASS | — |
| 5 | profitslocal-data-checkpoint | PASS | regression test `scripts/test/test-data-checkpoint-service-content.mjs` added · 7/7 pass |
| 6 | profitslocal-assemble-handoff | PASS | — |
| 7 | profitslocal-audit-handoff | PASS | — (vicwest 0/0 · a-j 3 hard expected per AJ-DECISION) |
| 8 | profitslocal-quality-audit | PASS | SKILL.md `--out` → `--output-dir` (CLI flag name correction) |

## Doc-vs-code mismatches found + fixed

1. **entity-enrichment** · `pl:enrich-entity --dry-run` doesn't exist · SKILL.md was misleading. Rewrote validation block to use `pl:places-enrich --dry-run` for zero-cost provenance check + explicit note that `pl:enrich-entity` has no `--dry-run` flag.
2. **quality-audit** · `pl:audit-tier --out` is wrong flag name · CLI accepts `--output-dir`. Fixed all 2 occurrences in SKILL.md.

## New regression coverage

- `scripts/test/test-data-checkpoint-service-content.mjs` · 7 tests · static checks for the 5 parked-domain regexes + live smoke against vip fixture (exit 1 RED · cite `service_content` · `NEVER AI-generate` in fix hint).

## Customer state (validated this run)

| Customer | checkpoint | handoff audit | Notes |
|---|---|---|---|
| vicwest-roofing | GREEN/multi · Hard 7/7 · Rich 6/6 | 0 hard · 0 soft | ✅ canonical happy path |
| vip-roofing-brisbane | **RED**/— · Hard 6/7 · Rich 5/6 | 1 hard (services 0) | ✅ correctly gated (parked-domain detection working) |
| a-j-roofing-solutions | YELLOW/single · Hard 7/7 · Rich 3/6 | 3 hard · 1 soft | ✅ expected per AJ-DECISION.md (defer Places chain) |

## Quality-audit smoke (vicwest open-design-v2)

Real LLM call (Claude vision T3.1 · ~3 min):
- T1 PASS · T2 = 29 · T3 = 89 · T4 = 50
- **Composite = 56 · Grade D** (below ship threshold 73)
- `_tier-audit.json` + `_tier-audit.md` written

This is a build-quality finding (T2 + T4 low), NOT a skill defect. The skill correctly identified the build as non-ship-eligible.

## 3 SOP doctors (re-run after fixes)

To be run before commit:
- `npm run ops:sop-audit`
- `npm run ops:doc-freshness-audit`
- `npm run ops:skill-cli-validate`

## Done criterion check (Response 5 §D)

1. ✅ Option 4 regression exists (`test-data-checkpoint-service-content.mjs` · 7/7 pass)
2. ✅ A-J recorded decision (`AJ-DECISION.md`: defer paid Places, keep as YELLOW fixture)
3. ✅ 8 per-skill audit files + this SUMMARY.md
4. ✅ Every skill PASS or PASS_WITH_EXPECTED_EXTERNAL_BLOCKER · 0 unresolved mismatches in allowed paths
5. ⏳ 3 doctors to be re-run before commit
6. ⏳ Single commit per Codex stop criterion
