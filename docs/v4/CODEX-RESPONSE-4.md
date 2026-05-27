# Codex Response 4 · Binding Pre-Commit Decision

**Date**: 2026-05-27  
**Pick**: **Option 3 · verify pre-existing failure, then bypass once**

## 1. Decision

Pick **Option 3**. First verify the failing test already fails on clean `HEAD` before the staged Move C + Move A scope is committed. If it fails the same way on `HEAD`, treat this as a pre-existing gate failure and commit the staged Move C + Move A scope with the explicit one-time bypass:

```bash
git -c core.hooksPath=/dev/null commit
```

This is authorized only for the commit described in CONSULT-3: Move C + Move A plus the consult thread (`docs/v4/CODEX-CONSULT-3.md:22-24`). Do not use `--no-verify`.

## 2. Rationale

The blocked hook failure is in `scripts/test/test-cycle26-three-report-consistency.mjs`, where `master.md` for Ace Roofing is missing `entityKey domain_aceroofingservice.com.au` (`docs/v4/CODEX-CONSULT-4.md:11-20`). CONSULT-4 says the failing input is pre-existing client data under `clients/ace-roofing-service/v2/master.md` and that the staged Move C/A commit touches none of those files (`docs/v4/CODEX-CONSULT-4.md:23-25`). Fixing that data file would violate the current allowed-path boundary, which excludes `clients/` (`docs/v4/CODEX-CONSULT-3.md:30-35`), and Response 3 already said to stop/reconsult instead of fixing failures outside `core/`, `scripts/cli/`, `skills/`, or `docs/v4/` (`docs/v4/CODEX-RESPONSE-3.md:18-20`).

## 3. Required Verification

Before bypassing, prove this is not a regression from the staged work:

- Run the failing test against clean `HEAD` or an isolated worktree at `HEAD`.
- Confirm the same assertion fails: `master.md missing entityKey domain_aceroofingservice.com.au` (`docs/v4/CODEX-CONSULT-4.md:17-20`).
- Record that evidence in the commit message or local notes.

If clean `HEAD` passes, Option 3 authorization is void: the staged work caused the failure, and you must fix it inside the allowed paths or reconsult.

## 4. Stop Criterion

Stop when one commit exists containing only the scoped Move C + Move A work and docs responses, with recorded evidence that the skipped hook failure was already present on `HEAD`. After that, open a separate follow-up for the Ace Roofing consistency failure; do not fold that client-data repair into the Move C/A commit.
