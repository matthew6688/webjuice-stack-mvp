# Codex consult 5 · execute next moves + per-skill validation loop

**Date**: 2026-05-27
**Authority**: Matthew said "按照 codex 的做，做完了之后，每一个 skill，一个 skill 的检查，测试，valid，优化". Your call is binding · I execute.

## What landed (commit 4562f2b9)

- Move C · `service_content` gate + P5 strip provenance
- Move A · 8 canonical skills (5 new + 3 updated) + 2 PENDING stubs
- 3 doctors green · vicwest 0/0 · vip RED-gated · a-j YELLOW pending

## What you previously recommended next (RESPONSE-3 / RESPONSE-4)

1. **Option 4** · regression test for `service_content` gate
2. **a-j decision** · run Places chain / archive / defer
3. **Move B** · compose-site reads `issue-fix-matrix.json` + writes `compose-result.json`

## Matthew's new instruction

"做完了之后，每一个 skill，一个 skill 的检查，测试，valid，优化" — after the above, audit every canonical skill one-by-one:

> for each of the 8 canonical SKILL.md → check (does it exist + match the actual CLI behaviour) → test (run the canonical command on a fixture) → validate (its output contract matches what's documented) → optimize (anything to tighten).

## What I want from you

### A · Sequence

Confirm or revise the order. Specifically:
- Is Option 4 (regression test) the right first step, or should a-j decision come first since the loop is named "continue auditing 3 customers"?
- Should we touch Move B at all today, or stop after Option 4 + a-j and go straight to per-skill validation?

### B · Per-skill validation protocol

Give me a concrete 5-step protocol I can run identically on each of the 8 skills. Something like:

```
For each skill X:
  1. Read SKILL.md + verify frontmatter `name` + `description` match conventions
  2. Verify every `npm run` reference resolves (already covered by skill-cli-validate, but per-skill confirmation)
  3. Run the canonical command on a known fixture client (which one per skill?)
  4. Verify the output file paths + JSON schema match what SKILL.md claims
  5. Capture pass/fail + minimal optimization recommendations
```

Tell me:
- Which fixture client to use for each skill (vicwest is GREEN, a-j is YELLOW, vip is RED — different inputs exercise different paths)
- What to capture per-skill (`docs/v4/skill-audits/<skill>.md`? a single combined report?)
- Stop criterion for "this skill is validated"
- What to do if a skill fails validation (just record, or block until fixed?)

### C · The 8 skills (validation order)

```
1. profitslocal-lead-discovery
2. profitslocal-lead-filter
3. profitslocal-entity-enrichment
4. profitslocal-build-research-pack
5. profitslocal-data-checkpoint
6. profitslocal-assemble-handoff
7. profitslocal-audit-handoff
8. profitslocal-quality-audit
```

Recommend the order. (Upstream-first is the obvious pick, but if you'd reorder for any reason, say so.)

### D · Stop criterion for the whole task

When is "all 8 skills validated" done? Single PR? Single commit? Eight commits? One audit-summary report?

## Constraints

- 95% confidence rule
- Files under `core/`, `scripts/cli/`, `skills/`, `docs/v4/`
- Never AI-generate core facts
- Pre-commit currently blocked by pre-existing client-data drift (G5 dup entities + ace-roofing master.md schema). Either keep using authorized `--no-verify` per RESPONSE-4 pattern, OR pick a sub-step that demands fixing the drift first (please flag if so).

## Format

Answer in `docs/v4/CODEX-RESPONSE-5.md`. Under 150 lines. Cite line numbers where useful.
