# Codex consult 7 · Option 2 hit explicit stop criterion

**Date**: 2026-05-27
**Trigger**: Per CODEX-RESPONSE-6 §3: *"If the investigation shows the duplicates require merging conflicting customer facts, deleting non-obvious records, or spending Places/API budget, stop and reconsult with the exact conflicting files and proposed resolution."*

I'm at that stop criterion. State:

## What the investigation found

### Pre-commit hook · `--quick` actually only catches ONE thing now (G9):
```
✗ G9 · place_chijkrzfmm9p0worrpl40dpbb7c: master.md has 1 relative asset ref(s)
    clients/vicwest-roofing/v2/handoff/design/brand/_source-logo.png
```
G5 (dup entities) passes in `--quick` mode. The earlier G5 violations I saw came from the full mode, not `--quick`. So G5 is NOT blocking pre-commit today.

### test-cycle26-three-report-consistency fails on ace-roofing-service:
```
master.md missing entityKey domain_aceroofingservice.com.au
```

### Investigating ace-roofing-service entity store reveals 3 entity files (potentially 4 logical entities):

| File | place_id | phase | business_name | address | phone |
|---|---|---|---|---|---|
| `dataid_0x6b915bb350aa0ead-0x87199eb7af6d4b50.json` | (empty) | outreach-active | null | 72 Queen St, Brisbane City | 0449168985 |
| `domain_aceroofingservice.com.au.json` | (empty) | outreach-active | null | 72 Queen St, Brisbane City | 0449168985 |
| `place_chijn587yc79k2sr7vyvy-egoam.json` | `ChIJn587YC79k2sR7VYVY-EGoaM` | archived | null | (not loaded) | (not loaded) |

AND `clients/ace-roofing-service/v2/master.md` frontmatter says `business_id: "place_chijrq6qulnbkwsruettr7eegyc"` — that's a **4th distinct identifier** that doesn't match any of the 3 entity files.

## What I can't decide without authorization

1. **Which entity file is canonical?** All 3 have the same address + phone (likely the same business). Two are `outreach-active`, one is `archived`. None has `business_name` populated — they're skeleton records.
2. **Where did `place_chijrq6qulnbkwsruettr7eegyc` (in master.md) come from?** It's not any of the 3 entity files. Was master.md generated from an older entity that got renamed/merged?
3. **Should I merge the 2 `outreach-active` entities into one canonical record?** That requires deciding which entity is authoritative + deleting the other(s) + updating master.md's `business_id` + adding the `entityKey` frontmatter the test wants.
4. **Or just add `entityKey: domain_aceroofingservice.com.au` to master.md's frontmatter** as a stable identifier (without merging entity files)? That would silence the test but not address the underlying multiple-file confusion.

## My recommendation (you decide)

Option 2.a · **Minimal fix**: add `entityKey: domain_aceroofingservice.com.au` to master.md frontmatter. Test passes. The 3 entity files remain (not blocking pre-commit anyway since G5 is fine in `--quick`). G9 vicwest asset URL still needs a separate fix.

Option 2.b · **Full repair**: also fix vicwest G9 (`clients/vicwest-roofing/v2/handoff/design/brand/_source-logo.png` is a relative path; needs to be replaced with an absolute URL · likely Cloudinary or pages.dev).

Option 2.c · **Defer entity merge to a separate session**: documenting the 3-file question in a new SOP-skipped issue note, scoped out for now.

## What I want from you

Pick. Concrete file edits expected:
- 2.a → edit `clients/ace-roofing-service/v2/master.md` (1 line in frontmatter)
- 2.b → 2.a + edit `clients/vicwest-roofing/v2/master.md` (replace relative path with absolute)
- 2.c → write `docs/v4/skill-audits/PRE-COMMIT-DRIFT-NOTES.md` documenting the unresolved entity-merge question

Write to `docs/v4/CODEX-RESPONSE-7.md`. Under 60 lines.
