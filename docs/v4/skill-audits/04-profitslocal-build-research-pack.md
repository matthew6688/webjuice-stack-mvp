# Skill audit · profitslocal-build-research-pack

**Date**: 2026-05-27 · **Status**: PASS

## Step 1 · Check
- Frontmatter `name` matches dir (note: dir is `profitslocal-build-research-pack`; SKILL.md frontmatter `name: profitslocal-build-research-pack` ✅)
- Description names orchestrator role ✅
- **Sibling skills section added 2026-05-27 Move A** · cross-links to entity-enrichment / data-checkpoint / assemble-handoff / audit-handoff ✅
- Truth-policy table (verified / source / inferred / generated / sample-pending) documented ✅

## Step 2 · Resolve
7 `npm run` references, all resolve:
- `pl:build-handoff` · `pl:enrich-handoff` · `pl:build-design-handoff` · `pl:assemble-handoff` · `pl:validate-handoff` · `pl:audit-handoff` · `pl:research-pack`

## Step 3 · Test
```
npm run pl:research-pack -- --slug a-j-roofing-solutions --dry-run
```
Exit 0 · Stdout enumerates the 5 sub-commands that would run (`pl:build-handoff` → `pl:enrich-handoff` → `pl:build-design-handoff` → `pl:assemble-handoff` → `pl:validate-handoff`) · env propagation summary printed · no writes.

## Step 4 · Validate
- Workflow steps 1-8 match `scripts/cli/pl-research-pack.js:118-184` orchestration ✅
- Ready-to-Build gate (4 statuses · `ready_to_build / needs_customer_confirmation / needs_more_info / blocked_conflicting_evidence`) matches `audit/ready-to-build.json` shape ✅
- Read-order contract (DESIGN-MANIFEST → core-facts → brand-tokens → page-map → content → image-manifest → ready-to-build) matches `core/composer/read-order.js` reference ✅
- "Never AI-generate" list (business_name / phone / address / ABN / license / reviews / years / owner) is identical to data-checkpoint's hard-field set ✅
- **Sibling-skill table** correctly identifies which siblings own which CLI · this skill's role as orchestrator is unambiguous ✅

## Step 5 · Optimize
```yaml
status: PASS
command: npm run pl:research-pack -- --slug a-j-roofing-solutions --dry-run
fixture: a-j-roofing-solutions (YELLOW)
exit_code: 0
outputs_checked: dry-run command enumeration + env summary
contract_mismatches: []
fixes_applied: []
remaining_risk: low · directory name `profitslocal-build-research-pack` differs from the npm CLI `pl:research-pack`; SKILL.md description threads that gap clearly · no rename needed
```
