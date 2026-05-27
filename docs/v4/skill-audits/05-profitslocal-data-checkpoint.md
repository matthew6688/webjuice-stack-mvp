# Skill audit · profitslocal-data-checkpoint

**Date**: 2026-05-27 · **Status**: PASS

## Step 1 · Check
- Frontmatter `name` matches dir ✅
- Description names the OD-readiness gate verdict structure ✅
- Owner SOP cited (`docs/v3/SOP-DATA-CHECKPOINT.md`) ✅
- **Move C `service_content` gate section added 2026-05-27** · documents 5 parked-domain regex patterns + chain context ✅

## Step 2 · Resolve
1 `npm run` reference (`pl:data-checkpoint`) · resolves ✅

## Step 3 · Test (3 fixtures · RED/YELLOW/GREEN coverage)

| Slug | Exit | Verdict | Pages | Hard | Rich |
|---|---:|---|---|---:|---:|
| vicwest-roofing | 0 | GREEN | multi | 7/7 | 6/6 |
| vip-roofing-brisbane | 1 | **RED** | — | 6/7 | 5/6 |
| a-j-roofing-solutions | 0 | YELLOW | single | 7/7 | 3/6 |

## Step 4 · Validate
- VIP RED correctly cites `service_content` as the missing hard field ✅
- VIP fix hint references upstream re-intake / `pl:enrich-handoff` AND contains `NEVER AI-generate` ✅
- Regression test `scripts/test/test-data-checkpoint-service-content.mjs` 7/7 passes (added today · Phase 1 Option 4) ✅
- `checkpoint.json` schema (`verdict / recommended_pages / hard_fields / rich_fields / missing / inferred / counts`) matches SKILL.md output contract ✅
- a-j YELLOW recommended_pages=`single` matches signal-aware layout decision (signal score below multi-lite threshold) ✅

## Step 5 · Optimize
- **Contract mismatches**: none
- **Fixes applied**: regression test added (covers the new gate)
- **Remaining risk**: low · gate is now defended by 7-assertion test

```yaml
status: PASS
command: npm run pl:data-checkpoint -- --slug {vicwest-roofing, vip-roofing-brisbane, a-j-roofing-solutions}
fixture: 3 customers (RED/YELLOW/GREEN)
exit_code: [0, 1, 0]
outputs_checked: checkpoint.json verdict + missing[].field=service_content (vip)
contract_mismatches: []
fixes_applied: ["regression test scripts/test/test-data-checkpoint-service-content.mjs · 7/7 pass"]
remaining_risk: low
```
