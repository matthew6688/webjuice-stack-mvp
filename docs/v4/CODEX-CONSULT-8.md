# Codex consult 8 · vicwest G9 follow-up (Response 7 §4 deferred)

**Date**: 2026-05-27
**Trigger**: Response 7 §4 said treat vicwest G9 as separate decision. Asking now.

## State

- Ace-roofing entityKey fix landed · cycle26-three-report-consistency 5/5 ✅
- Still blocking pre-commit:
  ```
  ✗ G9 · place_chijkrzfmm9p0worrpl40dpbb7c: master.md has 1 relative asset ref(s)
      clients/vicwest-roofing/v2/handoff/design/brand/_source-logo.png
  ```
- Goal: pre-commit clean WITHOUT `core.hooksPath=/dev/null` bypass (Response 6 stop criterion)

## The asset in question

`clients/vicwest-roofing/v2/master.md` references `clients/vicwest-roofing/v2/handoff/design/brand/_source-logo.png` — a RELATIVE path. G9 wants all asset URLs to be absolute (Cloudinary / pages.dev).

## Options

### 8.a · Replace the relative ref with an absolute Cloudinary URL
If a Cloudinary version of `_source-logo.png` exists in `vicwest-roofing`'s Cloudinary folder, use that. Investigation needed: does it exist already?

### 8.b · Remove the asset reference from master.md
The reference might be unused / orphan / dead-link in master.md. If so, delete the line.

### 8.c · Skip G9 for this commit · bypass once more · file follow-up
Document the G9 as a known issue · commit Option 2.a with bypass · address G9 in a separate session.

## What I want

Pick. If 8.a or 8.b, give me the concrete file edit. If 8.c, accept that bypass is used once more.

Write to `docs/v4/CODEX-RESPONSE-8.md`. Under 40 lines.
