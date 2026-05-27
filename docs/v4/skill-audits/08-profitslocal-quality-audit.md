# Skill audit · profitslocal-quality-audit

**Date**: 2026-05-27 · **Status**: PASS (with composite gap noted)

## Step 1 · Check
- Frontmatter `name` matches dir ✅
- Description names 4-tier standard + T1 zero-tolerance + composite ≥ 73 ✅
- Owner SOP cited (`docs/v3/SOP-AUDIT-STANDARD.md`) ✅
- T1 wrong-state-authority ban (VIC→VBA / QLD→QBCC / NSW→Fair Trading / WA→Building Commission) documented ✅

## Step 2 · Resolve
1 `npm run` reference (`pl:audit-tier`) · resolves ✅

## Step 3 · Test (vicwest build output)
```
npm run pl:audit-tier -- --slug vicwest-roofing --output-dir clients/vicwest-roofing/concept/open-design-v2
```
Exit 0 · ran T1/T2/T3/T4 + T3.1 vision composite (Claude vision · ~3 min)
- T1 PASS (binary facts)
- T2: 29 (visual/UX)
- T3: 89 (content fidelity · vision composite 86)
- T4: 50 (cross-page · missing PageSpeed/WCAG/GEO/old-issue-fix)
- **Composite: 56 · Grade D** · below ship threshold of 73
- Writes `_tier-audit.json` + `_tier-audit.md` ✅

## Step 4 · Validate
- Output files exist + parse ✅
- T1 binary verdict correctly evaluated separately from T2-T4 scoring ✅
- `--output-dir` flag works (SKILL.md called it `--out`; **mismatch · CLI uses `--output-dir`**)
- Vision audit runs as expected (T3.1 dimension)
- "Composite ≥ 73" ship threshold is the documented ship gate; this run's 56 correctly identifies vicwest's current build as not-ship-eligible (matches earlier "vicwest 89" comment in V4 docs referring to a different build / different scoring rubric — current canonical composite is the source of truth)

## Step 5 · Optimize
- **Contract mismatches**: SKILL.md says `--out <build-dir>`; CLI accepts `--output-dir <dir>`. Fix SKILL.md.
- **Fixes applied**: see flag-name correction below
- **Remaining risk**: low

### Fix · SKILL.md flag rename

SKILL.md uses `--out` in examples; CLI uses `--output-dir`. Updating SKILL.md.

```yaml
status: PASS
command: npm run pl:audit-tier -- --slug vicwest-roofing --output-dir clients/vicwest-roofing/concept/open-design-v2
fixture: vicwest open-design-v2 build (real LLM call · vision audit ran)
exit_code: 0
outputs_checked: _tier-audit.json + _tier-audit.md · T1 PASS · composite 56/100 (below ship)
contract_mismatches: ["SKILL.md uses --out · CLI accepts --output-dir"]
fixes_applied: ["SKILL.md updated to --output-dir"]
remaining_risk: low · composite 56 indicates the build itself needs T2/T4 work · NOT a skill-validation defect
```
