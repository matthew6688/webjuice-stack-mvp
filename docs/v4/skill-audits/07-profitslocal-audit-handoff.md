# Skill audit · profitslocal-audit-handoff

**Date**: 2026-05-27 · **Status**: PASS

## Step 1 · Check
- Frontmatter `name` matches dir ✅
- Description names P1-P7 layered checks + binary HARD/SOFT gates ✅
- Owner SOP cited (`docs/v3/SOP-AUDIT-STANDARD.md`) ✅
- P5 strip-provenance Move C documentation included (2026-05-27) ✅

## Step 2 · Resolve
1 `npm run` reference (`pl:audit-handoff`) · resolves ✅

## Step 3 · Test (2 fixtures · clean GREEN + YELLOW with expected hard fails)

### vicwest-roofing (GREEN handoff)
```
npm run pl:audit-handoff -- --dir clients/vicwest-roofing/v2/handoff/od-package
```
Exit 0 · `OVERALL: ✅ PASS (0 hard · 0 soft)` · all 7 layers PASS ✅

### a-j-roofing-solutions (YELLOW handoff · expected 3 HARD fails per AJ-DECISION.md)
```
npm run pl:audit-handoff -- --dir clients/a-j-roofing-solutions/v2/handoff/od-package
```
Exit 1 · `OVERALL: ❌ FAIL (3 hard · 1 soft)` ·
- P2 image-manifest HARD FAIL · missing `image-manifest.json` (no source photos)
- P3 brand-pack HARD FAIL · missing brand-spec / tokens / agent-handoff / visual-style-contract
- P1 structural HARD FAIL · same missing brand pack files
- P5 meta-language SOFT (post-Move C, this was 7 in vicwest; a-j still has 7 because the strip-provenance fix runs but a-j content has different sources)

## Step 4 · Validate
- 7 layers (P1-P7) match `scripts/cli/pl-audit-handoff.js` layer functions ✅
- P5 strip-provenance behaviour matches `stripProvenance()` impl (HTML comments, `_meta_*` / `_source` keys, JSON `notes`/`source`/`generator` keys) ✅
- HARD-fail exit 1 + SOFT-fail exit 0 behaviour matches SKILL.md ✅
- `_handoff-audit.json` schema (`pass / layers[] / summary`) verified on both fixtures ✅
- "AI-inferred core facts are a P4/P6 hard fail" rule documented and enforced ✅

## Step 5 · Optimize
- **Contract mismatches**: none
- **Fixes applied**: none (Move C P5 strip-provenance landed in earlier commit)
- **Remaining risk**: low · vicwest 0/0 baseline is the canonical regression target

```yaml
status: PASS_WITH_EXPECTED_EXTERNAL_BLOCKER (a-j fixture)
command: npm run pl:audit-handoff -- --dir clients/{vicwest-roofing,a-j-roofing-solutions}/v2/handoff/od-package
fixture: vicwest (PASS 0/0) + a-j (3 hard · expected per AJ-DECISION.md)
exit_code: [0, 1]
outputs_checked: _handoff-audit.json layers[] + summary
contract_mismatches: []
fixes_applied: []
remaining_risk: low
```
