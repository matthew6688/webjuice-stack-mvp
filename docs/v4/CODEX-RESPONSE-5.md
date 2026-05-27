# Codex Response 5 · Binding Validation Plan

**Date**: 2026-05-27  
**Pick**: Option 4 first, defer Move B, then validate the 8 canonical skills one by one.

## A · Sequence

1. **Do Option 4 first**: add focused regression coverage for the `service_content` hard gate. This is still the right first step because Response 3 made it the next move after the Move C/A commit (`docs/v4/CODEX-RESPONSE-3.md:22-24`), and CONSULT-5 says the landed state depends on VIP being RED-gated by that exact behavior (`docs/v4/CODEX-CONSULT-5.md:6-10`).
2. **A-J decision**: do **not** run the paid Places chain yet and do **not** archive. Keep A-J as the canonical YELLOW fixture for validation. Run only the commands needed to prove YELLOW behavior and audit/report gaps. If a skill cannot be validated without spending Places/API budget, record that as `blocked_external_dependency`, not as a skill failure.
3. **Skip Move B today**. Do not add `compose-result.json` or make `pl:compose-site` consume `issue-fix-matrix.json` in this tranche. Response 3 already preserved the guardrail that new compose contracts need ownership/schema validation first (`docs/v4/CODEX-RESPONSE-3.md:8`, `docs/v4/CODEX-RESPONSE-3.md:24`).
4. **Then run per-skill validation** in the order below. Fix narrow documentation/CLI mismatches inside `skills/`, `scripts/cli/`, `core/`, or `docs/v4/`; do not repair unrelated `clients/` drift.
5. **Commit once** after the regression test, A-J decision note, per-skill audit reports, and any scoped fixes are complete. If hooks still fail only on the known pre-existing client-data drift, use the Response 4 bypass pattern: `git -c core.hooksPath=/dev/null commit`, after recording evidence; do not use `--no-verify` (`docs/v4/CODEX-RESPONSE-4.md:8-14`, `docs/v4/CODEX-RESPONSE-4.md:20-32`).

## B · Per-Skill Validation Protocol

Run the same five steps for each skill:

1. **Check**: read `skills/<skill>/SKILL.md`; verify frontmatter `name` equals the directory name, description states the trigger, and the doc names owner CLI, inputs, outputs, downstream, and failure/degrade behavior.
2. **Resolve**: collect every `npm run ...` reference in that SKILL.md and confirm it exists in `package.json`; confirm CLI flags in the doc match the script header/help or actual parser.
3. **Test**: run the canonical command on the assigned fixture below. Prefer dry-run/read-only flags for discovery/filter/enrichment unless the skill's contract is specifically about writing output.
4. **Validate**: inspect the declared outputs and exit behavior. JSON outputs must parse; required top-level keys must match the SKILL.md contract; RED/YELLOW/GREEN behavior must match the documented stop/degrade rules.
5. **Optimize**: write a short audit note with `status`, `command`, `fixture`, `exit_code`, `outputs_checked`, `contract_mismatches`, `fixes_applied`, and `remaining_risk`.

Capture results as **one file per skill** under `docs/v4/skill-audits/<skill>.md`, plus `docs/v4/skill-audits/SUMMARY.md`. One file per skill keeps failures reviewable and lets a later operator rerun only one skill.

If a skill fails validation:

- **Block and fix** when the failure is a skill-doc mismatch, bad command reference, wrong output path, broken parser, or a false GREEN/false pass inside allowed paths.
- **Record and continue** when the failure is an expected fixture state: VIP RED, A-J YELLOW, missing API key, paid provider unavailable, or pre-existing client-data drift outside the allowed paths.
- **Stop and reconsult** if fixing requires `clients/` edits, new mandatory compose contracts, SOP ownership changes, or AI-generating core facts.

Per-skill validated means: its audit file says `status: PASS` or `status: PASS_WITH_EXPECTED_EXTERNAL_BLOCKER`; all command references resolve; the canonical command was run or deliberately dry-run; outputs/exit codes match the SKILL.md; and any optimization needed inside allowed paths has been applied.

## C · Validation Order And Fixtures

Use upstream-first, with deliberate RED/YELLOW/GREEN coverage:

| Order | Skill | Fixture | Canonical test |
|---:|---|---|---|
| 1 | `profitslocal-lead-discovery` | dry-run Brisbane roofing query | `npm run pl:places-search-intake -- --query "roofer in brisbane" --limit 3 --dry-run`; validate no invented entity facts and command contract |
| 2 | `profitslocal-lead-filter` | existing pending/entity store, dry-run | `npm run pl:run-enrichment-batch -- --limit 1 --dry-run --skip-approval`; validate filter docs match batch/cheap-audit behavior |
| 3 | `profitslocal-entity-enrichment` | A-J if entity exists; otherwise vicwest entity; dry-run where supported | `npm run pl:places-enrich -- --entity-key <fixture-entity-key> --dry-run`; also verify whether `pl:enrich-entity` docs wrongly claim `--dry-run`, because the current script header only advertises `--render` |
| 4 | `profitslocal-build-research-pack` | A-J YELLOW | `npm run pl:research-pack -- --slug <a-j-slug> --dry-run`; validate orchestrator steps and halt/degrade wording |
| 5 | `profitslocal-data-checkpoint` | VIP RED, vicwest GREEN, A-J YELLOW | run `npm run pl:data-checkpoint -- --slug <slug>` for all three; validate `service_content` RED and no AI-service fix hint |
| 6 | `profitslocal-assemble-handoff` | vicwest GREEN, A-J YELLOW | `npm run pl:assemble-handoff -- --slug vicwest-roofing`; for A-J, expect pass/degrade or documented refusal; never bypass RED |
| 7 | `profitslocal-audit-handoff` | vicwest GREEN package, A-J YELLOW package | `npm run pl:audit-handoff -- --dir clients/<slug>/v2/handoff/od-package`; validate P1-P5 gates and P5 provenance stripping |
| 8 | `profitslocal-quality-audit` | vicwest build output if present | `npm run pl:audit-tier -- --slug vicwest-roofing --output-dir clients/vicwest-roofing/v2/build`; if no build exists, record `blocked_missing_build_output` because compose remains pending |

Do not reorder. The consult's skill list is already pipeline-shaped (`docs/v4/CODEX-CONSULT-5.md:51-64`), and validating downstream before checkpoint/assembly would confuse data defects with skill-contract defects.

## D · Whole-Task Stop Criterion

Done means all of the following are true:

1. Option 4 regression exists and proves VIP-like parked/empty services RED-gate through `service_content`.
2. A-J has a recorded decision: **defer paid Places, keep as YELLOW validation fixture**.
3. `docs/v4/skill-audits/` contains 8 per-skill audit files plus `SUMMARY.md`.
4. Every skill is `PASS` or `PASS_WITH_EXPECTED_EXTERNAL_BLOCKER`; no unresolved command-reference or output-contract mismatch remains inside allowed paths.
5. The three stable doctors have been rerun: `npm run ops:sop-audit`, `npm run ops:doc-freshness-audit`, `npm run ops:skill-cli-validate`.
6. One commit contains the regression, audit reports, response doc, and tightly scoped fixes. Do **not** split into eight commits unless a single skill requires a nontrivial code fix worth isolating.

Move B remains explicitly out of scope for this task.
