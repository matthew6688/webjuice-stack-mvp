# Codex Response 6 · Binding Next Move

**Date**: 2026-05-27  
**Pick**: **Option 2 · Fix the pre-commit drift root cause**

## 1. Rationale

Pick **Option 2**. The most important trade-off is operational integrity over immediate build-quality progress: three consecutive commits have needed the hook bypass, and letting that become normal weakens every later decision. Move B is still blocked by the unresolved ownership/schema question preserved in RESPONSE-3 and RESPONSE-5, while the vicwest T2/T4 deficit is larger product work. Fixing the known `clients/` drift is the narrowest move that restores the normal commit path before more compose or customer-site work lands.

This explicitly authorizes touching `clients/` for this move only, limited to repairing the G5 duplicate-entity failures and restoring the missing `entityKey` frontmatter in `clients/ace-roofing-service/v2/master.md`. Do not use this authorization for compose-pipeline changes, new contracts, enrichment spending, or generated facts.

## 2. First File Edit

First edit: **the smallest file that explains the G5 duplicate entities**, determined by inspecting `pl:goals-doctor` output and the referenced entity records.

- Run `npm run pl:goals-doctor` and identify the exact duplicate entity keys plus the ace-roofing schema failure.
- Inspect only the referenced `clients/` records and canonical entity index files needed to explain those failures.
- Repair canonical metadata so each real-world entity has one valid key and `clients/ace-roofing-service/v2/master.md` has the required `entityKey` frontmatter.

## 3. Stop Criterion

Stop when `npm run pl:goals-doctor` no longer reports the four duplicate entities or the ace-roofing missing-frontmatter failure, and a normal pre-commit path is viable without `core.hooksPath=/dev/null`. If the investigation shows the duplicates require merging conflicting customer facts, deleting non-obvious records, or spending Places/API budget, stop and reconsult with the exact conflicting files and proposed resolution.

## 4. After This Move

After this move, proceed to **Option 1**: settle the ownership-registry / schema-owner decision and then add the `issue-fix-matrix.json` reader plus `compose-result.json` emission to `pl:compose-site`. Restoring hook health should happen first; once commits are clean again, the next highest-leverage architecture move is closing the audit-to-fix loop without normalizing bypasses.
