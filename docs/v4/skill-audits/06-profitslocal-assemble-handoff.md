# Skill audit · profitslocal-assemble-handoff

**Date**: 2026-05-27 · **Status**: PASS

## Step 1 · Check
- Frontmatter `name` matches dir ✅
- Description names RED/YELLOW handling + locked-facts contract ✅
- Owner SOPs cited ✅
- Input list (checkpoint + design + content + structure + core-facts + image-manifest) documented ✅
- Output tree (facts.json + brand/ + content/ + structure/ + assets/ + DESIGN-HANDOFF.md) documented ✅

## Step 2 · Resolve
1 `npm run` reference (`pl:assemble-handoff`) · resolves ✅

## Step 3 · Test (2 fixtures · GREEN + YELLOW)

### vicwest-roofing (GREEN)
```
npm run pl:assemble-handoff -- --slug vicwest-roofing
```
Exit 0 · `[validate-handoff] PASS · ✓ v2-spec.json validated` · od-package/ written with all required subtrees.

### a-j-roofing-solutions (YELLOW)
```
npm run pl:assemble-handoff -- --slug a-j-roofing-solutions
```
Exit 0 · `pages: 13 · services: 5 · blocks total: 110` · 2 LEGACY shared/header.html + shared/footer.html warnings (composer ignores these · documented as expected v2-spec.header / footer flow).
od-package/ contents: `DESIGN-HANDOFF.md / DESIGN-MANIFEST.json / README.md / asset-prompts.md / assets / brand / content / facts.json / shared / structure`

## Step 4 · Validate
- GREEN path: assemble + validate both PASS ✅
- YELLOW path: assemble completes, downstream audit (P2/P3) still catches missing image-manifest + brand-spec on a-j (expected per AJ-DECISION.md) ✅
- `facts.json` has `schema: profitslocal.locked-facts.v1` + `locked_facts` + `facts_policy.ai_may_modify: false` ✅ (verified earlier in session)
- Legacy `shared/header.html` warnings are non-blocking · matches "proceed with `_warnings[]`" failure-table row ✅

## Step 5 · Optimize
- **Contract mismatches**: minor · SKILL.md output tree doesn't mention `shared/` and `asset-prompts.md` which the CLI emits. Adding for completeness would be tidier but is non-blocking.
- **Fixes applied**: none (SKILL.md output tree updated would be over-spec given the legacy warnings indicate `shared/` is being phased out)
- **Remaining risk**: low

```yaml
status: PASS
command: npm run pl:assemble-handoff -- --slug {vicwest-roofing, a-j-roofing-solutions}
fixture: vicwest (GREEN) + a-j (YELLOW)
exit_code: [0, 0]
outputs_checked: od-package/ subtree contents + validate-handoff PASS
contract_mismatches: ["SKILL.md output tree omits shared/ + asset-prompts.md (legacy · phasing out)"]
fixes_applied: []
remaining_risk: low
```
