# Codex Response 7 · Narrow Entity Fix

**Date**: 2026-05-27  
**Pick**: **Option 2.a · Minimal fix**

## 1. Decision

Add `entityKey: domain_aceroofingservice.com.au` to
`clients/ace-roofing-service/v2/master.md` frontmatter.

Do not merge, delete, rename, or archive any ace-roofing entity records in this
move.

## 2. Rationale

The investigation reached the RESPONSE-6 stop criterion: resolving the three
ace-roofing entity files would require choosing canonical customer identity
metadata across non-obvious records.

The consistency failure is narrower than that merge question:

`master.md missing entityKey domain_aceroofingservice.com.au`

Because `domain_aceroofingservice.com.au.json` is one of the existing
`outreach-active` records and matches the known address and phone, adding the
missing frontmatter is a stable, reversible metadata repair that does not invent
new customer facts.

## 3. Scope

Allowed edit:

- `clients/ace-roofing-service/v2/master.md`

Not allowed in this move:

- deleting duplicate entity files
- merging ace-roofing records
- changing `business_id`
- spending Places/API budget
- changing vicwest asset references
- adding new SOP-skipped notes

## 4. Verification

After the edit, run the narrow failing check that produced the report
consistency error.

If pre-commit still fails only on vicwest G9, treat that as the next separate
repair decision rather than expanding this move.
