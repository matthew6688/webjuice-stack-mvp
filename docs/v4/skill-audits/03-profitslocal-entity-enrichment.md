# Skill audit · profitslocal-entity-enrichment

**Date**: 2026-05-27 · **Status**: PASS (with 1 doc fix applied)

## Step 1 · Check
- Frontmatter `name` matches dir ✅
- Description names the paid layer + provenance / ledger discipline ✅
- 3 owner SOPs cited (intake, tooling, infrastructure ladder) ✅
- Cost-ladder table + provenance contract + never-AI list documented ✅

## Step 2 · Resolve
5 `npm run` references, all resolve in package.json:
- `pl:enrich-entity` · `pl:places-enrich` · `pl:download-places-photos` · `pl:summarize-external-mentions` · `pl:run-enrichment-batch`

## Step 3 · Test
Two probes:
1. `npm run pl:places-enrich -- --entity-key dataid_0x697863f568797107-0x3e88d70ce813a66e --dry-run` → exit 0 · stdout: `Entity has no identifiers.place_id (image-lead or non-Google source) — Places enrichment skipped.` (correct degrade · matches SKILL.md failure-table row "Places quota exceeded / no place_id" pattern)
2. `head scripts/cli/pl-enrich-entity.js` → Usage line shows only `--entity-key`, `--render`, `--all-active`. **No `--dry-run` flag.**

## Step 4 · Validate
- Workflow steps 1-8 (Places → Photos → ABN → WHOIS → Wayback → Search → Ledger → Stamp) match `core/enrichment/index.js` orchestration ✅
- Cost ladder table verbatim matches `docs/v4/INFRASTRUCTURE-MAP.md §0` ✅
- Provenance `_source` sibling rule cited correctly (no `_meta.sources` violation) ✅
- **Doc-vs-code mismatch found**: SKILL.md validation block previously claimed `pl:enrich-entity --dry-run` exists, but the CLI doesn't implement that flag. Other docs reference it across the repo.

## Step 5 · Optimize
- **Contract mismatches**: 1 (resolved this run)
- **Fixes applied**: SKILL.md validation section rewritten to use `pl:places-enrich --dry-run` for zero-cost provenance check, with explicit note that `pl:enrich-entity` has no `--dry-run`.

```yaml
status: PASS
command: npm run pl:places-enrich -- --entity-key dataid_0x697863f568797107-0x3e88d70ce813a66e --dry-run
fixture: a-j (no place_id · exercises degrade path)
exit_code: 0
outputs_checked: degrade message (no place_id), no entity write
contract_mismatches: ["SKILL.md validation block referenced non-existent pl:enrich-entity --dry-run"]
fixes_applied: ["SKILL.md validation block now uses pl:places-enrich --dry-run + explicit note on pl:enrich-entity"]
remaining_risk: low · medium-term: implement --dry-run on pl:enrich-entity for full-axis validation without spend
```
