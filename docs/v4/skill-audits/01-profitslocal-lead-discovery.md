# Skill audit · profitslocal-lead-discovery

**Date**: 2026-05-27 · **Status**: PASS

## Step 1 · Check (SKILL.md shape)
- Frontmatter `name` matches dir ✅
- Description states trigger (batch-find leads · type A/B) ✅
- Owner CLI, inputs, outputs, downstream, failure/degrade documented ✅
- Chain context section added (2026-05-27 Move A update) ✅

## Step 2 · Resolve (npm refs)
All 7 `npm run` references resolve (verified by `ops:skill-cli-validate`):
- `pl:places-search-intake` ✅
- `pl:run-enrichment-batch` ✅
- `pl:enrich-entity` ✅
- `leads:search-runner` ✅
- `leads:discovery-report` ✅
- `leads:lead-ops` ✅
- `pl:preflight` ✅

## Step 3 · Test (canonical command on fixture)
```
npm run pl:places-search-intake -- --query "roofer in brisbane" --limit 3 --dry-run
```
Exit 0 · Output records `"dry_run": true` · No API calls · No invented entity facts.

## Step 4 · Validate (contract vs reality)
- Output: discovery-run JSON contains `dry_run: true` flag ✅
- Workflow steps 1-6 (INTAKE → ENRICH → QUALIFY → MASTER → HANDOFF → REPORT) match `core/leads/discovery-store.js` + `core/leads/qualification.js` ✅
- A/B/C/D rule table matches `core/leads/grade-router.js` (cited in SKILL.md) ✅

## Step 5 · Optimize
- **Contract mismatches**: none
- **Fixes applied**: none needed
- **Remaining risk**: low · `--dry-run` path is well-exercised
- **Outputs checked**: `dry_run: true` field present in console output

```yaml
status: PASS
command: npm run pl:places-search-intake -- --query "roofer in brisbane" --limit 3 --dry-run
fixture: dry-run Brisbane roofers (no fixture client needed)
exit_code: 0
outputs_checked: dry_run:true flag in stdout
contract_mismatches: []
fixes_applied: []
remaining_risk: low
```
