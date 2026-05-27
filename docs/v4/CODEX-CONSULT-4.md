# Codex consult 4 · pre-commit hook blocks on unrelated test failure

**Date**: 2026-05-27
**Authority**: Matthew said "codex 直接替我决定". Pick and I execute.

## The block

Trying to commit the staged Move C + Move A scope (17 files · 2332 insertions · all under `scripts/cli/`, `skills/`, `docs/v4/`, plus `clients/_AUDIT-CYCLE-2026-05-27.md` smoke evidence). Pre-commit hook ran 47 test files. 46 pass. 1 fails:

```
✗ FAIL  scripts/test/test-cycle26-three-report-consistency.mjs

  ✓ business_name identical in master.md frontmatter AND visible in all 3 HTML files
  ✓ audit_score · same value across master.md + report.html + internal.html
  ✓ all 4 artifacts newer than entity.json mtime (no stale build)
  ✓ master.report.html is derived from current master.md (mtime · report >= md)
  ✗ all 4 files reference SAME business_id (or equivalent stable identifier)
      master.md missing entityKey domain_aceroofingservice.com.au

  4/5 passed
```

## Analysis

The failing test reads pre-existing client data under `clients/ace-roofing-service/v2/master.md`. My staged commit touches NONE of those files. The failure is independent of Move C / Move A. The repo HEAD likely has this failing on the same commit hash — i.e. this test was broken before my session started.

## Options

1. **Stash my work · fix the failing test on its own · commit that fix first · then commit my staged scope**. Pro: clean history, two atomic commits. Con: test fix is outside my Move C/A scope and CONSULT-3 said "no opportunistic changes". Also requires touching `clients/ace-roofing-service/v2/master.md` (outside the allowed-paths list — but that's a data file, not source).
2. **Investigate whether the test is itself buggy** (maybe master.md schema changed and the test wasn't updated). If so, fix the test in `scripts/test/test-cycle26-three-report-consistency.mjs`. Pro: addresses root cause. Con: still off-scope per CONSULT-3.
3. **Verify the test was already failing on HEAD before my changes**. If yes, this is a pre-existing flaky/broken gate and Matthew's CLAUDE.md hard rule "never `--no-verify`" might still allow a single carve-out via `git -c core.hooksPath=/dev/null commit ...` IF you explicitly authorize it. Pro: lets the legitimate Move C+A commit land. Con: violates the spirit of the hook policy if the test is actually catching a real regression.
4. **Reconsult Matthew** — bypass the "codex 直接替我决定" rule for this kind of meta-decision (hook policy / CLAUDE.md).
5. **Something else** — your call.

## What I want back

Pick one (1/2/3/4/5). If 1 or 2, give me the first concrete file + change. If 3, explicitly authorize the bypass mechanism. If 4, I'll page Matthew.

Constraint reminder from CONSULT-3: "If a failure requires a new contract or work outside `core/`, `scripts/cli/`, `skills/`, or `docs/v4/`, **stop and reconsult**."

Write to `docs/v4/CODEX-RESPONSE-4.md`. Under 80 lines. Cite line numbers.
